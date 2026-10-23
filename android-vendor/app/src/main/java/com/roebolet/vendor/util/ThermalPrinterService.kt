package com.roebolet.vendor.util

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.print.PrintAttributes
import android.print.PrintManager
import android.util.Base64
import android.webkit.WebView
import android.webkit.WebViewClient
import com.roebolet.vendor.R
import com.roebolet.vendor.data.api.BetGrid
import com.roebolet.vendor.data.api.SellTicketResponse
import com.roebolet.vendor.data.api.VendorTicketItem
import com.roebolet.vendor.data.local.PreferencesManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.OutputStream
import java.util.UUID

/**
 * Service d'Impression Thermique Professionnel pour ROE BOLET (POS & Bluetooth)
 * Supporte :
 * 1. Les imprimantes thermiques Bluetooth 58mm / 80mm ESC/POS (POS-58, PT-210, MPT-II, GOOJPRT, etc.)
 * 2. L'Android PrintManager (Spooler d'impression système vers imprimantes WiFi/Mopria/PDF/RawBT)
 */
object ThermalPrinterService {

    private const val PREFS_NAME = "roe_printer_prefs"
    private const val KEY_PRINTER_MAC = "preferred_printer_mac"
    private const val KEY_PRINTER_NAME = "preferred_printer_name"

    // UUID standard pour communication série Bluetooth SPP (Serial Port Profile)
    private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

    // Commandes ESC/POS
    private val ESC_INIT = byteArrayOf(0x1B, 0x40) // Initialize printer
    private val ESC_ALIGN_LEFT = byteArrayOf(0x1B, 0x61, 0x00)
    private val ESC_ALIGN_CENTER = byteArrayOf(0x1B, 0x61, 0x01)
    private val ESC_ALIGN_RIGHT = byteArrayOf(0x1B, 0x61, 0x02)
    private val ESC_BOLD_ON = byteArrayOf(0x1B, 0x45, 0x01)
    private val ESC_BOLD_OFF = byteArrayOf(0x1B, 0x45, 0x00)
    private val GS_TEXT_DOUBLE = byteArrayOf(0x1D, 0x21, 0x11) // Double hauteur & largeur
    private val GS_TEXT_NORMAL = byteArrayOf(0x1D, 0x21, 0x00) // Taille normale
    private val FEED_AND_CUT = byteArrayOf(0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x42, 0x00) // Feed 3 lines & cut

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    fun getPreferredPrinterMac(context: Context): String? {
        return getPrefs(context).getString(KEY_PRINTER_MAC, null)
    }

    fun getPreferredPrinterName(context: Context): String? {
        return getPrefs(context).getString(KEY_PRINTER_NAME, null)
    }

    fun setPreferredPrinter(context: Context, macAddress: String, name: String) {
        getPrefs(context).edit()
            .putString(KEY_PRINTER_MAC, macAddress)
            .putString(KEY_PRINTER_NAME, name)
            .apply()
    }

    fun clearPreferredPrinter(context: Context) {
        getPrefs(context).edit().remove(KEY_PRINTER_MAC).remove(KEY_PRINTER_NAME).apply()
    }

    /**
     * Retourne la liste des périphériques Bluetooth appairés au terminal Android,
     * classés par pertinence (imprimantes thermiques/POS en priorité).
     */
    @SuppressLint("MissingPermission")
    fun getPairedPrinters(context: Context): List<BluetoothDevice> {
        return try {
            val bm = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val adapter = bm?.adapter ?: BluetoothAdapter.getDefaultAdapter()
            val bonded = adapter?.bondedDevices?.toList() ?: emptyList()
            val printerKeywords = listOf("print", "pos", "mpt", "inner", "thermal", "bt", "58", "80", "rpp", "pt-", "zj-", "receipt", "blue")
            bonded.sortedByDescending { dev ->
                val name = try { (dev.name ?: "").lowercase() } catch (_: Exception) { "" }
                var score = 0
                if (printerKeywords.any { name.contains(it) }) score += 10
                if (name.contains("pos") || name.contains("print") || name.contains("inner")) score += 20
                try {
                    val major = dev.bluetoothClass?.majorDeviceClass
                    val cls = dev.bluetoothClass?.deviceClass
                    if (major == 1536 || cls == 1664) score += 30 // BluetoothClass.Device.Major.IMAGING
                } catch (_: Exception) {}
                score
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Envoie un flux d'octets ESC/POS vers l'imprimante Bluetooth connectée
     */
    @SuppressLint("MissingPermission")
    suspend fun sendBytesToBluetoothPrinter(
        context: Context,
        bytes: ByteArray,
        macAddress: String? = null
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val targetMac = macAddress 
            ?: getPreferredPrinterMac(context) 
            ?: getPairedPrinters(context).firstOrNull()?.address
        if (targetMac.isNullOrEmpty()) {
            return@withContext Result.failure(Exception("Aucune imprimante Bluetooth sélectionnée."))
        }

        val bm = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        val adapter = bm?.adapter ?: BluetoothAdapter.getDefaultAdapter()
        if (adapter == null || !adapter.isEnabled) {
            return@withContext Result.failure(Exception("Le Bluetooth est désactivé sur le terminal."))
        }

        var socket: BluetoothSocket? = null
        try {
            val device = adapter.getRemoteDevice(targetMac)
            try { adapter.cancelDiscovery() } catch (_: Exception) {}

            var connected = false
            var lastEx: Exception? = null

            // Méthode 1 : SPP RFCOMM standard sécurisé
            try {
                socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
                socket.connect()
                connected = true
            } catch (e: Exception) {
                lastEx = e
                try { socket?.close() } catch (_: Exception) {}
            }

            // Méthode 2 : Insecure RFCOMM (Requis pour POS-58, PT-210, MPT-II, GOOJPRT)
            if (!connected) {
                try {
                    socket = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID)
                    socket.connect()
                    connected = true
                } catch (e: Exception) {
                    lastEx = e
                    try { socket?.close() } catch (_: Exception) {}
                }
            }

            // Méthode 3 : Réflexion port série 1 (fallback matériel direct)
            if (!connected) {
                try {
                    val method = device.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType)
                    socket = method.invoke(device, 1) as BluetoothSocket
                    socket.connect()
                    connected = true
                } catch (e: Exception) {
                    lastEx = e
                    try { socket?.close() } catch (_: Exception) {}
                }
            }

            if (!connected || socket == null) {
                throw lastEx ?: Exception("Connexion impossible à l'imprimante Bluetooth.")
            }

            val outStream: OutputStream = socket.outputStream
            outStream.write(bytes)
            outStream.flush()

            // Petite temporisation pour que le buffer thermique soit imprimé
            kotlinx.coroutines.delay(600)

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(Exception("Erreur imprimante : ${e.localizedMessage ?: "Vérifiez que l'imprimante est allumée et appairée."}"))
        } finally {
            try {
                socket?.close()
            } catch (_: Exception) {}
        }
    }

    /**
     * Convertit un Bitmap Android en flux d'octets ESC/POS 'GS v 0' pour impression thermique
     */
    fun bitmapToEscPosRaster(srcBitmap: Bitmap, maxWidth: Int = 384): ByteArray {
        val stream = ByteArrayOutputStream()
        try {
            val origWidth = srcBitmap.width
            val origHeight = srcBitmap.height
            val targetWidth = if (origWidth > maxWidth) maxWidth else ((origWidth / 8) * 8).coerceAtLeast(8)
            val scale = targetWidth.toFloat() / origWidth.toFloat()
            val targetHeight = (origHeight * scale).toInt().coerceAtLeast(1)

            val scaledBitmap = Bitmap.createScaledBitmap(srcBitmap, targetWidth, targetHeight, true)

            val widthBytes = targetWidth / 8
            val xL = (widthBytes % 256).toByte()
            val xH = (widthBytes / 256).toByte()
            val yL = (targetHeight % 256).toByte()
            val yH = (targetHeight / 256).toByte()

            // Commande GS v 0 0 xL xH yL yH
            stream.write(byteArrayOf(0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH))

            // Conversion monochrome 1-bit par seuillage
            for (y in 0 until targetHeight) {
                for (xByte in 0 until widthBytes) {
                    var byteVal = 0
                    for (bit in 0 until 8) {
                        val x = xByte * 8 + bit
                        val pixel = scaledBitmap.getPixel(x, y)
                        val alpha = (pixel shr 24) and 0xFF
                        val r = (pixel shr 16) and 0xFF
                        val g = (pixel shr 8) and 0xFF
                        val b = pixel and 0xFF
                        val luminance = (0.299 * r + 0.587 * g + 0.114 * b).toInt()

                        // Si le pixel est opaque et sombre -> point noir (1)
                        if (alpha > 50 && luminance < 170) {
                            byteVal = byteVal or (1 shl (7 - bit))
                        }
                    }
                    stream.write(byteVal)
                }
            }
        } catch (_: Exception) {}
        return stream.toByteArray()
    }

    /**
     * Construit les octets ESC/POS d'un ticket officiel de loterie
     */
    fun buildTicketEscPos(
        ticket: VendorTicketItem,
        prefs: PreferencesManager,
        context: Context? = null
    ): ByteArray {
        val stream = ByteArrayOutputStream()

        fun write(vararg b: ByteArray) {
            b.forEach { stream.write(it) }
        }

        fun writeText(text: String, charset: String = "CP437") {
            try {
                stream.write(text.toByteArray(charset(charset)))
            } catch (_: Exception) {
                stream.write(text.toByteArray())
            }
        }

        val lotteryName = prefs.getLotteryName()
        val lotteryPhone = prefs.getLotteryPhone()
        val lotteryBankRef = prefs.getLotteryBankRef()
        val lotteryHeaderNote = prefs.getLotteryHeaderNote()
        val lotteryFooterNote = prefs.getLotteryFooterNote()
        val lotteryMariageGratis = prefs.getLotteryMariageGratis()

        val rawGameName = ticket.game?.get("name")?.toString() ?: "TIRAJ OFISYÈL"
        val drawNum = ticket.draw?.get("drawNumber")
        val schedOrCreated = ticket.draw?.get("scheduledAt")?.toString() ?: ticket.createdAt
        val session = ticket.draw?.get("sessionName")?.toString() ?: ticket.draw?.get("session")?.toString()
        val drawDisplayName = TicketReceiptUtil.formatDrawDisplayName(rawGameName, drawNum, schedOrCreated, session)
        val drawPeriod = session?.uppercase() ?: TicketReceiptUtil.getDrawPeriod(rawGameName, schedOrCreated, session)

        val dateDisplay = TicketReceiptUtil.formatHaitiDateTimeSeconds(ticket.createdAt)

        // 1. Initialisation
        write(ESC_INIT)

        // 2. Logo Officiel Loterie (Impression Graphique ESC/POS GS v 0)
        if (context != null) {
            try {
                var logoBitmap: Bitmap? = null
                val logoUrl = prefs.getLotteryLogoUrl()
                if (logoUrl.isNotEmpty() && (logoUrl.startsWith("data:image") || logoUrl.length > 50)) {
                    try {
                        val clean = if (logoUrl.contains(",")) logoUrl.substringAfter(",") else logoUrl
                        val bytes = Base64.decode(clean.trim(), Base64.DEFAULT)
                        logoBitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    } catch (_: Exception) {}
                }
                if (logoBitmap == null) {
                    try {
                        logoBitmap = BitmapFactory.decodeResource(context.resources, R.drawable.app_logo)
                    } catch (_: Exception) {}
                }
                if (logoBitmap != null) {
                    write(ESC_ALIGN_CENTER)
                    val rasterBytes = bitmapToEscPosRaster(logoBitmap, maxWidth = 320)
                    if (rasterBytes.isNotEmpty()) {
                        write(rasterBytes)
                        writeText("\n")
                    }
                }
            } catch (_: Exception) {}
        }

        // 3. En-tête Loterie Centrée
        write(ESC_ALIGN_CENTER)
        write(ESC_BOLD_ON, GS_TEXT_DOUBLE)
        writeText("$lotteryName\n")
        write(GS_TEXT_NORMAL, ESC_BOLD_OFF)

        if (lotteryPhone.isNotEmpty()) {
            writeText("Tel: $lotteryPhone\n")
        }
        if (lotteryBankRef.isNotEmpty()) {
            writeText("Bnk: $lotteryBankRef\n")
        }
        if (lotteryHeaderNote.isNotEmpty()) {
            writeText("$lotteryHeaderNote\n")
        }

        writeText("--------------------------------\n")

        // 3. Identification du Tirage & Date en heure d'Haïti
        write(ESC_BOLD_ON)
        writeText("$drawDisplayName\n")
        write(ESC_BOLD_OFF)
        writeText("[ TIRAJ $drawPeriod ]\n")
        writeText("Dat: $dateDisplay\n")
        write(ESC_BOLD_ON)
        writeText("Ticket: ${ticket.ticketNumber}\n")
        write(ESC_BOLD_OFF)

        writeText("--------------------------------\n")

        // 4. Grilles jouées
        write(ESC_ALIGN_LEFT)
        val grids = ticket.playedGrids ?: emptyList()
        val regularGrids = grids.filter { it.isGratis != true }
        val gratisGrids = grids.filter { it.isGratis == true }

        regularGrids.forEach { g ->
            val gameLabel = TicketReceiptUtil.formatGameLabel(g.gameType, g.numbers)
            val numStr = TicketReceiptUtil.formatGridNumbers(g.gameType, g.numbers)
            val left = "$gameLabel $numStr"
            val right = "${String.format(java.util.Locale.US, "%.0f", g.betAmount)} HTG"
            val spaces = (32 - left.length - right.length).coerceAtLeast(1)
            write(ESC_BOLD_ON)
            writeText(left + " ".repeat(spaces) + right + "\n")
            write(ESC_BOLD_OFF)
        }

        if (gratisGrids.isNotEmpty()) {
            writeText("\n-- Mariage Gratuit --\n")
            gratisGrids.forEach { g ->
                val numStr = TicketReceiptUtil.formatGridNumbers("MARIAGE", g.numbers)
                val left = "Mariage $numStr"
                val right = "GRATUIT"
                val spaces = (32 - left.length - right.length).coerceAtLeast(1)
                writeText(left + " ".repeat(spaces) + right + "\n")
            }
        }

        write(ESC_ALIGN_CENTER)
        writeText("================================\n")

        // 5. Total
        write(ESC_BOLD_ON, GS_TEXT_DOUBLE)
        val totalText = "TOTAL: ${String.format(java.util.Locale.US, "%.0f", ticket.totalAmount)} HTG\n"
        writeText(totalText)
        write(GS_TEXT_NORMAL, ESC_BOLD_OFF)
        writeText("================================\n")

        // 6. Code-Barres officiel Code 128 (Impression thermique haute précision)
        try {
            val barcodeBitmap = Barcode128Util.generateBarcodeBitmap(ticket.ticketNumber, width = 360, height = 65)
            val barcodeRaster = bitmapToEscPosRaster(barcodeBitmap, maxWidth = 360)
            if (barcodeRaster.isNotEmpty()) {
                write(ESC_ALIGN_CENTER)
                write(barcodeRaster)
                writeText("\n")
            }
        } catch (_: Exception) {}

        // 7. Signature & Sécurité
        val checksum = (ticket.secureChecksum ?: ticket.ticketNumber).take(22)
        write(ESC_ALIGN_CENTER)
        writeText("Siyati: $checksum...\n")

        // 8. Footer légal
        if (lotteryFooterNote.isNotEmpty()) {
            writeText("$lotteryFooterNote\n")
        }
        if (lotteryMariageGratis.isNotEmpty()) {
            writeText("$lotteryMariageGratis\n")
        }

        writeText("\nBonswa & Bon chans !\n")

        // 8. Coupure
        write(FEED_AND_CUT)

        return stream.toByteArray()
    }

    /**
     * Construit les octets ESC/POS d'un ticket de test
     */
    fun buildTestReceiptEscPos(prefs: PreferencesManager, context: Context? = null): ByteArray {
        val stream = ByteArrayOutputStream()

        fun write(vararg b: ByteArray) {
            b.forEach { stream.write(it) }
        }

        fun writeText(text: String) {
            try {
                stream.write(text.toByteArray(charset("CP437")))
            } catch (_: Exception) {
                stream.write(text.toByteArray())
            }
        }

        val lotteryName = prefs.getLotteryName()
        val now = java.text.SimpleDateFormat("dd/MM/yyyy HH:mm:ss", java.util.Locale.US).apply {
            timeZone = TicketReceiptUtil.HAITI_TIMEZONE
        }.format(java.util.Date())

        write(ESC_INIT)

        if (context != null) {
            try {
                var logoBitmap: Bitmap? = null
                val logoUrl = prefs.getLotteryLogoUrl()
                if (logoUrl.isNotEmpty() && (logoUrl.startsWith("data:image") || logoUrl.length > 50)) {
                    val clean = if (logoUrl.contains(",")) logoUrl.substringAfter(",") else logoUrl
                    val bytes = Base64.decode(clean.trim(), Base64.DEFAULT)
                    logoBitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                }
                if (logoBitmap == null) {
                    logoBitmap = BitmapFactory.decodeResource(context.resources, R.drawable.app_logo)
                }
                if (logoBitmap != null) {
                    write(ESC_ALIGN_CENTER)
                    val rasterBytes = bitmapToEscPosRaster(logoBitmap, maxWidth = 320)
                    if (rasterBytes.isNotEmpty()) {
                        write(rasterBytes)
                        writeText("\n")
                    }
                }
            } catch (_: Exception) {}
        }

        write(ESC_ALIGN_CENTER)
        write(ESC_BOLD_ON, GS_TEXT_DOUBLE)
        writeText("$lotteryName\n")
        write(GS_TEXT_NORMAL)
        writeText("TEST D'IMPRESSION POS\n")
        write(ESC_BOLD_OFF)
        writeText("--------------------------------\n")
        writeText("Lè Ayiti : $now\n")
        writeText("Statut Imprimante : EN LIGNE (OK)\n")
        writeText("Largeur Papier : 58mm / 32 Cols\n")
        writeText("--------------------------------\n")
        write(ESC_ALIGN_LEFT)
        writeText("1. Borlette 22            50 HTG\n")
        writeText("2. Loto 4  1610          100 HTG\n")
        writeText("3. Mariage 02X20          50 HTG\n")
        write(ESC_ALIGN_CENTER)
        writeText("================================\n")
        write(ESC_BOLD_ON)
        writeText("TOTAL TEST : 200 HTG\n")
        write(ESC_BOLD_OFF)
        writeText("================================\n")
        writeText("Siyati : ROE-TEST-CERTIFIED-OK\n")
        writeText("Enprimant tèmik la pare pou pwodiksyon !\n")
        write(FEED_AND_CUT)

        return stream.toByteArray()
    }

    /**
     * Imprime un ticket officiel :
     * Tente via Bluetooth si une imprimante est configurée ou appairée,
     * sinon propose le PrintManager système Android.
     */
    suspend fun printTicket(
        context: Context,
        ticket: SellTicketResponse,
        onStatus: (success: Boolean, message: String) -> Unit
    ) {
        val nowIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US).format(java.util.Date())
        val schedOrCreated = ticket.scheduledAt ?: ticket.createdAt ?: nowIso
        val vendorTicket = VendorTicketItem(
            id = ticket.id ?: ticket.ticketNumber,
            ticketNumber = ticket.ticketNumber,
            totalAmount = ticket.totalAmount,
            status = ticket.status ?: "CONFIRMED",
            createdAt = ticket.createdAt ?: schedOrCreated,
            game = mapOf("name" to (ticket.gameName ?: "TIRAJ OFISYÈL")),
            draw = mapOf(
                "drawNumber" to (ticket.drawNumber?.toString() ?: ""),
                "scheduledAt" to schedOrCreated,
                "sessionName" to (ticket.sessionName ?: "")
            ),
            secureChecksum = ticket.secureChecksum,
            playedGrids = ticket.playedGrids
        )
        printTicket(context, vendorTicket, onStatus)
    }

    /**
     * Imprime un ticket officiel (VendorTicketItem) :
     * Tente via Bluetooth si une imprimante est configurée ou appairée,
     * sinon propose le PrintManager système Android.
     */
    suspend fun printTicket(
        context: Context,
        ticket: VendorTicketItem,
        onStatus: (success: Boolean, message: String) -> Unit
    ) {
        val prefs = PreferencesManager(context)
        val mac = getPreferredPrinterMac(context)

        if (!mac.isNullOrEmpty()) {
            val bytes = buildTicketEscPos(ticket, prefs, context)
            val res = sendBytesToBluetoothPrinter(context, bytes, mac)
            if (res.isSuccess) {
                onStatus(true, "Ticket imprimé avec succès sur l'imprimante Bluetooth.")
                return
            }
        }

        // Si aucune imprimante Bluetooth enregistrée, vérifier s'il existe une imprimante appairée
        val paired = getPairedPrinters(context)
        if (paired.isNotEmpty()) {
            val first = paired.first()
            val bytes = buildTicketEscPos(ticket, prefs, context)
            val res = sendBytesToBluetoothPrinter(context, bytes, first.address)
            if (res.isSuccess) {
                setPreferredPrinter(context, first.address, first.name ?: "Imprimante POS")
                onStatus(true, "Ticket imprimé sur ${first.name ?: "imprimante Bluetooth"}.")
                return
            }
        }

        // Fallback PrintManager
        onStatus(false, "Aucune imprimante Bluetooth connectée. Rendez-vous dans Paramètres pour associer une imprimante.")
    }

    /**
     * Construit les octets ESC/POS d'une fiche UNIFIÉE pour plusieurs tirages sélectionnés
     * Imprime une seule fiche compacte regroupant tous les tirages avec les mêmes grilles.
     */
    fun buildMultiTicketEscPos(
        tickets: List<SellTicketResponse>,
        prefs: PreferencesManager,
        context: Context? = null
    ): ByteArray {
        val stream = ByteArrayOutputStream()

        fun write(vararg b: ByteArray) {
            b.forEach { stream.write(it) }
        }

        fun writeText(text: String, charset: String = "CP437") {
            try {
                stream.write(text.toByteArray(charset(charset)))
            } catch (_: Exception) {
                stream.write(text.toByteArray())
            }
        }

        val lotteryName = prefs.getLotteryName()
        val lotteryPhone = prefs.getLotteryPhone()
        val lotteryBankRef = prefs.getLotteryBankRef()
        val lotteryHeaderNote = prefs.getLotteryHeaderNote()
        val lotteryFooterNote = prefs.getLotteryFooterNote()
        val lotteryMariageGratis = prefs.getLotteryMariageGratis()

        val firstTicket = tickets.first()
        val dateDisplay = TicketReceiptUtil.formatHaitiDateTimeSeconds(firstTicket.createdAt)

        // 1. Initialisation
        write(ESC_INIT)

        // 2. Logo Officiel Loterie
        if (context != null) {
            try {
                var logoBitmap: Bitmap? = null
                val logoUrl = prefs.getLotteryLogoUrl()
                if (logoUrl.isNotEmpty() && (logoUrl.startsWith("data:image") || logoUrl.length > 50)) {
                    try {
                        val clean = if (logoUrl.contains(",")) logoUrl.substringAfter(",") else logoUrl
                        val bytes = Base64.decode(clean.trim(), Base64.DEFAULT)
                        logoBitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    } catch (_: Exception) {}
                }
                if (logoBitmap == null) {
                    try {
                        logoBitmap = BitmapFactory.decodeResource(context.resources, R.drawable.app_logo)
                    } catch (_: Exception) {}
                }
                if (logoBitmap != null) {
                    write(ESC_ALIGN_CENTER)
                    val rasterBytes = bitmapToEscPosRaster(logoBitmap, maxWidth = 320)
                    if (rasterBytes.isNotEmpty()) {
                        write(rasterBytes)
                        writeText("\n")
                    }
                }
            } catch (_: Exception) {}
        }

        // 3. En-tête Loterie Centrée
        write(ESC_ALIGN_CENTER)
        write(ESC_BOLD_ON, GS_TEXT_DOUBLE)
        writeText("$lotteryName\n")
        write(GS_TEXT_NORMAL, ESC_BOLD_OFF)

        if (lotteryPhone.isNotEmpty()) writeText("Tel: $lotteryPhone\n")
        if (lotteryBankRef.isNotEmpty()) writeText("Bnk: $lotteryBankRef\n")
        if (lotteryHeaderNote.isNotEmpty()) writeText("$lotteryHeaderNote\n")

        writeText("--------------------------------\n")

        // 4. Titre de la Fiche Multi-Tirages
        write(ESC_BOLD_ON)
        writeText("FICHE MULTI-TIRAGES (${tickets.size} Tiraj)\n")
        write(ESC_BOLD_OFF)
        writeText("Dat: $dateDisplay\n")
        writeText("--------------------------------\n")

        // Liste de tous les tirages sélectionnés avec leur numéro de ticket
        write(ESC_ALIGN_LEFT)
        write(ESC_BOLD_ON)
        writeText("TIRAJ YO CHWAZI :\n")
        write(ESC_BOLD_OFF)

        tickets.forEachIndexed { index, t ->
            val rawGame = t.gameName ?: "TIRAJ OFISYÈL"
            val period = t.sessionName?.uppercase() ?: TicketReceiptUtil.getDrawPeriod(rawGame, t.scheduledAt, t.sessionName)
            val shortName = TicketReceiptUtil.formatShortDrawName(rawGame, null, t.scheduledAt, t.sessionName)
            write(ESC_BOLD_ON)
            writeText("${index + 1}. $shortName [$period]\n")
            write(ESC_BOLD_OFF)
            writeText("   Fich N°: ${t.ticketNumber}\n")
        }

        writeText("--------------------------------\n")

        // 5. Grilles jouées (affichées une seule fois)
        val sampleGrids = firstTicket.playedGrids ?: emptyList()
        val regularGrids = sampleGrids.filter { it.isGratis != true }
        val gratisGrids = sampleGrids.filter { it.isGratis == true }

        regularGrids.forEach { g ->
            val gameLabel = TicketReceiptUtil.formatGameLabel(g.gameType, g.numbers)
            val numStr = TicketReceiptUtil.formatGridNumbers(g.gameType, g.numbers)
            val left = "$gameLabel $numStr"
            val right = "${String.format(java.util.Locale.US, "%.0f", g.betAmount)} HTG"
            val spaces = (32 - left.length - right.length).coerceAtLeast(1)
            write(ESC_BOLD_ON)
            writeText(left + " ".repeat(spaces) + right + "\n")
            write(ESC_BOLD_OFF)
        }

        if (gratisGrids.isNotEmpty()) {
            writeText("\n-- Mariage Gratuit --\n")
            gratisGrids.forEach { g ->
                val numStr = TicketReceiptUtil.formatGridNumbers("MARIAGE", g.numbers)
                val left = "Mariage $numStr"
                val right = "GRATUIT"
                val spaces = (32 - left.length - right.length).coerceAtLeast(1)
                writeText(left + " ".repeat(spaces) + right + "\n")
            }
        }

        writeText("--------------------------------\n")

        // 6. Sous-total par tirage et Total Général Multi-Tirages
        val subtotalPerDraw = regularGrids.sumOf { it.betAmount }
        val grandTotal = tickets.sumOf { it.totalAmount }

        val leftSub = "Miz pa Tiraj :"
        val rightSub = "${String.format(java.util.Locale.US, "%.0f", subtotalPerDraw)} HTG"
        val spacesSub = (32 - leftSub.length - rightSub.length).coerceAtLeast(1)
        writeText(leftSub + " ".repeat(spacesSub) + rightSub + "\n")

        val leftCount = "Kantite Tiraj :"
        val rightCount = "x ${tickets.size}"
        val spacesCount = (32 - leftCount.length - rightCount.length).coerceAtLeast(1)
        writeText(leftCount + " ".repeat(spacesCount) + rightCount + "\n")

        write(ESC_ALIGN_CENTER)
        writeText("================================\n")
        write(ESC_BOLD_ON, GS_TEXT_DOUBLE)
        val totalText = "TOTAL: ${String.format(java.util.Locale.US, "%.0f", grandTotal)} HTG\n"
        writeText(totalText)
        write(GS_TEXT_NORMAL, ESC_BOLD_OFF)
        writeText("================================\n")

        // 7. Codes-Barres de contrôle
        tickets.forEachIndexed { index, t ->
            try {
                val shortName = TicketReceiptUtil.formatShortDrawName(t.gameName, null, t.scheduledAt, t.sessionName)
                write(ESC_ALIGN_CENTER)
                writeText("$shortName:\n")
                val barcodeBitmap = Barcode128Util.generateBarcodeBitmap(t.ticketNumber, width = 360, height = 50)
                val barcodeRaster = bitmapToEscPosRaster(barcodeBitmap, maxWidth = 360)
                if (barcodeRaster.isNotEmpty()) {
                    write(barcodeRaster)
                    writeText("\n")
                }
                writeText("${t.ticketNumber}\n\n")
            } catch (_: Exception) {}
        }

        // 8. Signature globale & mentions
        val masterChecksum = (firstTicket.secureChecksum ?: firstTicket.ticketNumber).take(22)
        write(ESC_ALIGN_CENTER)
        writeText("Siyati: $masterChecksum...\n")

        if (lotteryFooterNote.isNotEmpty()) writeText("$lotteryFooterNote\n")
        if (lotteryMariageGratis.isNotEmpty()) writeText("$lotteryMariageGratis\n")

        writeText("\nBonswa & Bon chans !\n")
        write(FEED_AND_CUT)

        return stream.toByteArray()
    }

    /**
     * Imprime un lot de tickets (ou un ticket unique) sous forme d'une seule fiche compacte
     * Évite l'impression en série de multiples reçus successifs.
     */
    suspend fun printTicketBatch(
        context: Context,
        tickets: List<SellTicketResponse>,
        onStatus: (success: Boolean, message: String) -> Unit
    ) {
        if (tickets.isEmpty()) return
        if (tickets.size == 1) {
            printTicket(context, tickets.first(), onStatus)
            return
        }

        val prefs = PreferencesManager(context)
        val mac = getPreferredPrinterMac(context)

        if (!mac.isNullOrEmpty()) {
            val bytes = buildMultiTicketEscPos(tickets, prefs, context)
            val res = sendBytesToBluetoothPrinter(context, bytes, mac)
            if (res.isSuccess) {
                onStatus(true, "Fiche multi-tirages imprimée avec succès.")
                return
            }
        }

        val paired = getPairedPrinters(context)
        if (paired.isNotEmpty()) {
            val first = paired.first()
            val bytes = buildMultiTicketEscPos(tickets, prefs, context)
            val res = sendBytesToBluetoothPrinter(context, bytes, first.address)
            if (res.isSuccess) {
                setPreferredPrinter(context, first.address, first.name ?: "Imprimante POS")
                onStatus(true, "Fiche multi-tirages imprimée sur ${first.name ?: "imprimante Bluetooth"}.")
                return
            }
        }

        onStatus(false, "Aucune imprimante Bluetooth connectée. Associez votre imprimante dans les Paramètres.")
    }

    /**
     * Imprime un ticket de test thermique
     */
    suspend fun printTestReceipt(
        context: Context,
        onStatus: (success: Boolean, message: String) -> Unit
    ) {
        val prefs = PreferencesManager(context)
        val mac = getPreferredPrinterMac(context)

        val targetMac = mac ?: getPairedPrinters(context).firstOrNull()?.address
        if (targetMac == null) {
            onStatus(false, "Aucune imprimante Bluetooth appairée trouvée. Veuillez appairer votre imprimante dans les paramètres Bluetooth d'Android.")
            return
        }

        val bytes = buildTestReceiptEscPos(prefs, context)
        val res = sendBytesToBluetoothPrinter(context, bytes, targetMac)
        if (res.isSuccess) {
            if (mac == null && targetMac.isNotEmpty()) {
                val dev = getPairedPrinters(context).firstOrNull { it.address == targetMac }
                @SuppressLint("MissingPermission")
                val devName = try { dev?.name ?: "Imprimante POS" } catch (_: Exception) { "Imprimante POS" }
                setPreferredPrinter(context, targetMac, devName)
            }
            onStatus(true, "Test d'impression envoyé avec succès à l'imprimante !")
        } else {
            onStatus(false, res.exceptionOrNull()?.message ?: "Erreur d'impression.")
        }
    }

    /**
     * Imprime un reçu de rapport des ventes / contrôle sur l'imprimante thermique Bluetooth
     */
    suspend fun printReportReceipt(
        context: Context,
        reportText: String,
        onStatus: (success: Boolean, message: String) -> Unit
    ) {
        val prefs = PreferencesManager(context)
        val mac = getPreferredPrinterMac(context)
        val targetMac = mac ?: getPairedPrinters(context).firstOrNull()?.address

        if (targetMac.isNullOrEmpty()) {
            onStatus(false, "Pa gen okenn enprimant Bluetooth apparié trouvée.")
            return
        }

        val stream = ByteArrayOutputStream()
        fun write(vararg b: ByteArray) { b.forEach { stream.write(it) } }
        fun writeText(text: String, charset: String = "CP437") {
            try { stream.write(text.toByteArray(charset(charset))) }
            catch (_: Exception) { stream.write(text.toByteArray()) }
        }

        write(ESC_INIT)

        // Logo Officiel
        try {
            var logoBitmap: Bitmap? = null
            val logoUrl = prefs.getLotteryLogoUrl()
            if (logoUrl.isNotEmpty() && (logoUrl.startsWith("data:image") || logoUrl.length > 50)) {
                try {
                    val clean = if (logoUrl.contains(",")) logoUrl.substringAfter(",") else logoUrl
                    val bytes = Base64.decode(clean.trim(), Base64.DEFAULT)
                    logoBitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                } catch (_: Exception) {}
            }
            if (logoBitmap == null) {
                try {
                    logoBitmap = BitmapFactory.decodeResource(context.resources, R.drawable.app_logo)
                } catch (_: Exception) {}
            }
            if (logoBitmap != null) {
                write(ESC_ALIGN_CENTER)
                val raster = bitmapToEscPosRaster(logoBitmap, maxWidth = 320)
                if (raster.isNotEmpty()) {
                    write(raster)
                    writeText("\n")
                }
            }
        } catch (_: Exception) {}

        // En-tête centré
        val lotteryName = prefs.getLotteryName()
        write(ESC_ALIGN_CENTER)
        write(ESC_BOLD_ON, GS_TEXT_DOUBLE)
        writeText("$lotteryName\n")
        write(GS_TEXT_NORMAL)
        writeText("RAPÒ VANT & KONTWÒL\n")
        write(ESC_BOLD_OFF)
        writeText("================================\n")
        write(ESC_ALIGN_LEFT)
        writeText("$reportText\n")
        write(ESC_ALIGN_CENTER)
        writeText("================================\n")
        writeText("Siyati: ROE-RAPPORT-CERTIFIE\n")
        writeText("Dat: ${TicketReceiptUtil.formatHaitiDateTimeSeconds(null)}\n")
        write(FEED_AND_CUT)

        val bytes = stream.toByteArray()
        val res = sendBytesToBluetoothPrinter(context, bytes, targetMac)
        if (res.isSuccess) {
            onStatus(true, "Rapport imprimé avec succès sur l'imprimante Bluetooth !")
        } else {
            onStatus(false, res.exceptionOrNull()?.message ?: "Erreur d'impression du rapport.")
        }
    }

    /**
     * Impression via le spooler natif Android PrintManager (HTML WebView)
     */
    fun printHtmlViaPrintManager(
        context: Context,
        jobName: String,
        htmlDocument: String
    ) {
        val printManager = context.getSystemService(Context.PRINT_SERVICE) as? PrintManager ?: return
        val webView = WebView(context)
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                val printAdapter = webView.createPrintDocumentAdapter(jobName)
                val printAttributes = PrintAttributes.Builder()
                    .setMediaSize(PrintAttributes.MediaSize.ISO_A7) // Style ticket de caisse
                    .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                    .build()
                printManager.print(jobName, printAdapter, printAttributes)
            }
        }
        webView.loadDataWithBaseURL(null, htmlDocument, "text/html", "UTF-8", null)
    }

    /**
     * Génère un document HTML complet du ticket pour impression PrintManager / Export PDF
     * avec logo officiel embarqué en Base64.
     */
    fun generateTicketHtmlReceipt(
        ticket: VendorTicketItem,
        prefs: PreferencesManager,
        context: Context
    ): String {
        val lotteryName = prefs.getLotteryName()
        val lotteryPhone = prefs.getLotteryPhone()
        val lotteryBankRef = prefs.getLotteryBankRef()
        val lotteryHeaderNote = prefs.getLotteryHeaderNote()
        val lotteryFooterNote = prefs.getLotteryFooterNote()
        val lotteryMariageGratis = prefs.getLotteryMariageGratis()

        val rawGameName = ticket.game?.get("name")?.toString() ?: "TIRAJ OFISYÈL"
        val drawNum = ticket.draw?.get("drawNumber")
        val schedOrCreated = ticket.draw?.get("scheduledAt")?.toString() ?: ticket.createdAt
        val session = ticket.draw?.get("sessionName")?.toString() ?: ticket.draw?.get("session")?.toString()
        val drawDisplayName = TicketReceiptUtil.formatDrawDisplayName(rawGameName, drawNum, schedOrCreated, session)
        val drawPeriod = session?.uppercase() ?: TicketReceiptUtil.getDrawPeriod(rawGameName, schedOrCreated, session)
        val dateDisplay = TicketReceiptUtil.formatHaitiDateTime(ticket.createdAt)

        // Récupérer le logo en Base64
        var logoBase64 = prefs.getLotteryLogoUrl()
        if (logoBase64.isEmpty() || (!logoBase64.startsWith("data:image") && logoBase64.length < 50)) {
            try {
                val inputStream = context.resources.openRawResource(R.drawable.app_logo)
                val bytes = inputStream.readBytes()
                inputStream.close()
                logoBase64 = "data:image/png;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
            } catch (_: Exception) {}
        }

        val grids = ticket.playedGrids ?: emptyList()
        val regularGrids = grids.filter { it.isGratis != true }
        val gratisGrids = grids.filter { it.isGratis == true }

        val sb = java.lang.StringBuilder()
        sb.append("<!DOCTYPE html><html><head><meta charset='utf-8'>")
        sb.append("<style>")
        sb.append("body { font-family: 'Courier New', monospace; font-size: 11px; margin: 0; padding: 12px; color: #000; width: 72mm; }")
        sb.append(".center { text-align: center; }")
        sb.append(".logo { max-height: 52px; max-width: 140px; margin: 0 auto 6px auto; display: block; }")
        sb.append(".bold { font-weight: bold; }")
        sb.append(".title { font-size: 15px; font-weight: 900; margin: 2px 0; }")
        sb.append(".divider { border-top: 1px dashed #000; margin: 6px 0; }")
        sb.append(".row { display: flex; justify-content: space-between; margin: 2px 0; }")
        sb.append(".badge { display: inline-block; padding: 2px 6px; border: 1px solid #000; font-weight: bold; font-size: 10px; margin: 3px 0; }")
        sb.append(".footer { font-size: 9px; text-align: center; margin-top: 8px; }")
        sb.append("</style></head><body>")

        sb.append("<div class='center'>")
        if (logoBase64.isNotEmpty()) {
            sb.append("<img class='logo' src='$logoBase64' alt='Logo' />")
        }
        sb.append("<div class='bold' style='letter-spacing:1px;font-size:10px;'>$lotteryHeaderNote</div>")
        sb.append("<div class='title'>${lotteryName.uppercase()}</div>")
        if (lotteryPhone.isNotEmpty() || lotteryBankRef.isNotEmpty()) {
            sb.append("<div>${if (lotteryBankRef.isNotEmpty()) "$lotteryBankRef • " else ""}Tel: $lotteryPhone</div>")
        }
        sb.append("<div>POS: ${prefs.getVendorCode().ifEmpty { "POS-001" }}</div>")
        sb.append("<div class='bold'>Dat: $dateDisplay</div>")
        sb.append("<div class='divider'></div>")
        sb.append("<div class='bold' style='font-size:13px;'>$drawDisplayName</div>")
        sb.append("<div class='badge'>[ TIRAJ $drawPeriod ]</div><br/>")
        sb.append("<div class='bold'>Ticket: ${ticket.ticketNumber}</div>")
        sb.append("</div>")

        sb.append("<div class='divider'></div>")
        regularGrids.forEach { g ->
            val label = TicketReceiptUtil.formatGameLabel(g.gameType, g.numbers)
            val nums = TicketReceiptUtil.formatGridNumbers(g.gameType, g.numbers)
            val amt = String.format("%.0f", g.betAmount)
            sb.append("<div class='row'><span class='bold'>$label $nums</span><span class='bold'>$amt HTG</span></div>")
        }

        if (gratisGrids.isNotEmpty()) {
            sb.append("<div class='divider'></div>")
            sb.append("<div class='center bold'>--- MARIAGE GRATUIT ---</div>")
            gratisGrids.forEach { g ->
                val nums = TicketReceiptUtil.formatGridNumbers("MARIAGE", g.numbers)
                sb.append("<div class='row'><span class='bold'>Mariage $nums</span><span class='bold'>GRATUIT</span></div>")
            }
        }

        sb.append("<div class='divider'></div>")
        val grandTotal = String.format("%.0f", ticket.totalAmount)
        sb.append("<div class='row bold' style='font-size:13px;'><span>TOTAL :</span><span>$grandTotal HTG</span></div>")
        sb.append("<div class='divider'></div>")

        sb.append("<div class='footer'>")
        if (lotteryMariageGratis.isNotEmpty()) {
            sb.append("<div class='bold'>$lotteryMariageGratis</div>")
        }
        sb.append("<div>$lotteryFooterNote</div>")
        sb.append("<div style='margin-top:4px;'>Sec: ${ticket.secureChecksum?.take(16) ?: ""}</div>")
        sb.append("</div>")

        sb.append("</body></html>")
        return sb.toString()
    }
}
