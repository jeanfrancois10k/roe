package com.roebolet.vendor.util

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.SharedPreferences
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.WebView
import android.webkit.WebViewClient
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
     * Retourne la liste des périphériques Bluetooth appairés au terminal Android
     */
    @SuppressLint("MissingPermission")
    fun getPairedPrinters(context: Context): List<BluetoothDevice> {
        return try {
            val bm = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val adapter = bm?.adapter ?: BluetoothAdapter.getDefaultAdapter()
            adapter?.bondedDevices?.toList() ?: emptyList()
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
        val targetMac = macAddress ?: getPreferredPrinterMac(context)
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
            adapter.cancelDiscovery() // Annuler le scan pour optimiser la connexion

            socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
            socket.connect()

            val outStream: OutputStream = socket.outputStream
            outStream.write(bytes)
            outStream.flush()

            // Petite temporisation pour que le buffer thermique soit imprimé
            kotlinx.coroutines.delay(500)

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(Exception("Erreur connexion imprimante : ${e.localizedMessage ?: "Vérifiez que l'imprimante est allumée."}"))
        } finally {
            try {
                socket?.close()
            } catch (_: Exception) {}
        }
    }

    /**
     * Construit les octets ESC/POS d'un ticket officiel de loterie
     */
    fun buildTicketEscPos(
        ticket: VendorTicketItem,
        prefs: PreferencesManager
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
        val drawDisplayName = TicketReceiptUtil.formatDrawDisplayName(rawGameName, drawNum, schedOrCreated)
        val drawPeriod = TicketReceiptUtil.getDrawPeriod(rawGameName, schedOrCreated)

        val dateDisplay = TicketReceiptUtil.formatHaitiDateTime(ticket.createdAt)

        // 1. Initialisation
        write(ESC_INIT)

        // 2. En-tête Loterie Centrée
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
                val right = "xxxx HTG"
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

        // 6. Signature & Sécurité
        val checksum = (ticket.secureChecksum ?: ticket.ticketNumber).take(22)
        writeText("Siyati: $checksum...\n")

        // 7. Footer légal
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
    fun buildTestReceiptEscPos(prefs: PreferencesManager): ByteArray {
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
                "scheduledAt" to schedOrCreated
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
            val bytes = buildTicketEscPos(ticket, prefs)
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
            val bytes = buildTicketEscPos(ticket, prefs)
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

        val bytes = buildTestReceiptEscPos(prefs)
        val res = sendBytesToBluetoothPrinter(context, bytes, targetMac)
        if (res.isSuccess) {
            onStatus(true, "Test d'impression envoyé avec succès à l'imprimante !")
        } else {
            onStatus(false, res.exceptionOrNull()?.message ?: "Erreur d'impression.")
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
}
