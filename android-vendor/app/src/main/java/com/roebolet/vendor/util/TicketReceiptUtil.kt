package com.roebolet.vendor.util

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Calendar

object TicketReceiptUtil {

    // Haïti est sur UTC-4 / GMT-4 en période d'heure d'été (EDT)
    val HAITI_TIMEZONE: java.util.TimeZone = java.util.TimeZone.getTimeZone("GMT-4")

    /**
     * Parse un horodatage ISO (UTC) et le convertit précisément dans le fuseau d'Haïti (GMT-4)
     */
    fun parseHaitiCalendar(isoString: String?): java.util.Calendar? {
        if (isoString.isNullOrEmpty()) return null
        return try {
            val clean = isoString.take(19).replace(" ", "T")
            val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US)
            sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
            val date = sdf.parse(clean) ?: return null
            val cal = java.util.Calendar.getInstance(HAITI_TIMEZONE)
            cal.time = date
            cal
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Détermine si un tirage correspond à la session MIDI ou SOIR selon l'heure d'Haïti.
     * Règle Borlette :
     * 1. Priorité au sessionName officiel du serveur ("SOIR" ou "MIDI")
     * 2. Analyse du nom du jeu (ex: NY MIDI vs NY SOIR)
     * 3. Analyse de l'heure programmée (scheduledAt) convertie en heure d'Haïti : avant 16h00 = MIDI, à partir de 16h00 = SOIR
     * 4. Fallback heure actuelle d'Haïti : avant 16h00 = MIDI, à partir de 16h00 = SOIR
     */
    fun getDrawPeriod(gameName: String?, scheduledAt: String? = null, sessionName: String? = null): String {
        if (!sessionName.isNullOrBlank()) {
            val s = sessionName.trim().uppercase()
            if (s.contains("SOIR") || s.contains("EVENING") || s.contains("NUIT") || s.contains("NIGHT")) return "SOIR"
            if (s.contains("MIDI") || s.contains("MIDDAY") || s.contains("MATIN") || s.contains("DAY")) return "MIDI"
        }

        val upper = (gameName ?: "").uppercase()
        if (upper.contains("SOIR") || upper.contains("EVENING") || upper.contains("NUIT") || upper.contains("NIGHT")) {
            return "SOIR"
        }
        if (upper.contains("MIDI") || upper.contains("MIDDAY") || upper.contains("MATIN") || upper.contains("JOUR") || upper.contains("DAY")) {
            return "MIDI"
        }

        if (!scheduledAt.isNullOrEmpty()) {
            val cal = parseHaitiCalendar(scheduledAt)
            if (cal != null) {
                val haitiHour = cal.get(java.util.Calendar.HOUR_OF_DAY)
                return if (haitiHour < 16) "MIDI" else "SOIR"
            }
        }

        val cal = java.util.Calendar.getInstance(HAITI_TIMEZONE)
        val currentHour = cal.get(java.util.Calendar.HOUR_OF_DAY)
        return if (currentHour < 16) "MIDI" else "SOIR"
    }

    /**
     * Formate uniquement l'heure de fermeture ou de tirage en heure d'Haïti
     * Ex: "13:28 (01:28 PM)" ou "21:43 (09:43 PM)"
     */
    fun formatHaitiTimeOnly(isoString: String?): String {
        val cal = parseHaitiCalendar(isoString) ?: return isoString?.take(16)?.replace("T", " ") ?: ""
        val sdf = java.text.SimpleDateFormat("HH:mm (hh:mm a)", java.util.Locale.US)
        sdf.timeZone = HAITI_TIMEZONE
        return sdf.format(cal.time)
    }

    /**
     * Formate la date et heure complète en heure civile d'Haïti
     * Ex: "20/10/2026 21:43"
     */
    fun formatHaitiDateTime(isoString: String?): String {
        val cal = parseHaitiCalendar(isoString) ?: return isoString?.take(16)?.replace("T", " ") ?: ""
        val sdf = java.text.SimpleDateFormat("dd/MM/yyyy HH:mm", java.util.Locale.US)
        sdf.timeZone = HAITI_TIMEZONE
        return sdf.format(cal.time)
    }

    /**
     * Formate le nom d'affichage propre du tirage avec la mention MIDI ou SOIR
     * Ex: "BOLET NEW YORK - MIDI" ou "BOLET FLORIDA - SOIR (#102)"
     */
    fun formatDrawDisplayName(
        gameName: String?,
        drawNumber: Any? = null,
        scheduledAt: String? = null,
        sessionName: String? = null
    ): String {
        val baseName = (gameName ?: "TIRAJ OFISYÈL")
            .replace(Regex("(?i)\\s*\\(midi\\s*&\\s*soir\\)"), "")
            .replace(Regex("(?i)\\s*\\(midi\\)"), "")
            .replace(Regex("(?i)\\s*\\(soir\\)"), "")
            .trim()
            .uppercase()

        val period = getDrawPeriod(gameName, scheduledAt, sessionName)
        val drawNumStr = if (drawNumber != null && drawNumber.toString().isNotEmpty()) " (#$drawNumber)" else ""
        return "$baseName - $period$drawNumStr"
    }

    /**
     * Formate le libellé du jeu sur le ticket de caisse (ex: Loto 4, Mariage, Borlette, etc.)
     * Corrige l'affichage où Loto 4 affichait 'Borlette' à tort.
     */
    fun formatGameLabel(gameType: String?, numbers: List<String>? = null): String {
        val gt = (gameType ?: "").uppercase().trim()
        val firstNum = numbers?.firstOrNull()?.filter { it.isDigit() } ?: ""
        return when {
            gt.contains("MAR") -> "Mariage"
            gt in listOf("LOTO4", "LOTTO4", "LOT4", "L4") -> "Loto 4"
            gt in listOf("LOTO3", "LOTTO3", "LOT3", "L3") -> "Loto 3"
            gt in listOf("LOTO5", "LOTTO5", "LOT5", "L5") -> "Loto 5"
            numbers?.size == 2 -> "Mariage"
            firstNum.length == 4 -> "Loto 4"
            firstNum.length == 5 -> "Loto 5"
            firstNum.length == 3 -> "Loto 3"
            gt in listOf("BORLETTE", "BOLET", "BOR") -> "Borlette"
            else -> if (firstNum.length == 4) "Loto 4" else "Borlette"
        }
    }

    /**
     * Formate les numéros de la grille avec le bon séparateur :
     * 'X' pour Mariage (ex: 02X20 au lieu de 02*20 ou 02-20)
     * '-' pour les autres jeux si multiples numéros
     */
    fun formatGridNumbers(gameType: String?, numbers: List<String>): String {
        val isMarriage = (gameType ?: "").uppercase().contains("MAR") || numbers.size == 2
        val separator = if (isMarriage) "X" else "-"
        return numbers.joinToString(separator).replace("*", "X").replace("x", "X")
    }

    /**
     * Décode une chaîne Base64 en ImageBitmap pour Jetpack Compose
     */
    fun decodeBase64Bitmap(base64Str: String): ImageBitmap? {
        return try {
            val clean = if (base64Str.contains(",")) base64Str.substringAfter(",") else base64Str
            val bytes = Base64.decode(clean.trim(), Base64.DEFAULT)
            val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            bitmap?.asImageBitmap()
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Formate le rapport de vente thermique (Photo 2)
     */
    fun formatThermalSalesReportText(
        lotteryName: String,
        vendorCode: String,
        startDate: String,
        endDate: String,
        drawName: String = "Tous les tirages",
        global: com.roebolet.vendor.data.api.SalesReportGlobal
    ): String {
        val now = java.text.SimpleDateFormat("HH:mm - dd/MM/yyyy", java.util.Locale.getDefault()).format(java.util.Date())
        val startFormatted = formatDateDisplay(startDate)
        val endFormatted = formatDateDisplay(endDate)

        return """
            ${lotteryName.uppercase()}*****

            Données MAJ : $now
            Rapo du $startFormatted au $endFormatted
            $drawName
            Banque : $vendorCode
            ================================
            Nombre fiches vendues :
            ${global.nombreFichesVendues}
            --------------------------------
            Nombre fiches gagnantes :
            ${global.nombreFichesGagnantes}
            ================================
            Vant :
            Total : ${String.format("%.0f", global.ventesTotal)}
            Cash : ${String.format("%.0f", global.ventesCash)}
            Moncash : ${String.format("%.0f", global.ventesMoncash)}
            --------------------------------
            Paiements pet :
            ${String.format("%.0f", global.paiementsPertes)}
            --------------------------------
            Balance cash
            (ventes - pertes)
            ${String.format("%.0f", global.balanceCash)}
            --------------------------------
            Commission :
            ${String.format("%.0f", global.commission)}
            --------------------------------
            Balance totale
            (balance cash - commission)
            ${String.format("%.0f", global.balanceTotale)}
            ================================
        """.trimIndent()
    }

    /**
     * Formate le rapport de fiches gagnantes thermique (Photo 1)
     */
    fun formatThermalWinningTicketsText(
        lotteryName: String,
        vendorCode: String,
        drawName: String = "tous tirages",
        winningTickets: List<com.roebolet.vendor.data.api.WinningTicketReportItem>
    ): String {
        val now = java.text.SimpleDateFormat("HH:mm - dd/MM/yyyy", java.util.Locale.getDefault()).format(java.util.Date())
        val sb = StringBuilder()
        sb.append("${lotteryName.uppercase()}*****\n\n")
        sb.append("$now\n")
        sb.append("Tirage : $drawName\n")
        sb.append("Banque : $vendorCode\n\n")
        sb.append("Tickets gagnants ($drawName)\n")
        sb.append("--------------------------------\n")
        if (winningTickets.isEmpty()) {
            sb.append("Aucun ticket gagnant enregistré.\n")
        } else {
            for (t in winningTickets) {
                val datePart = t.createdAt.take(16).replace("T", " ")
                sb.append("${t.ticketNumber} $datePart\n")
                sb.append("Mise ${String.format("%.0f", t.totalAmount)} Gen ${String.format("%.0f", t.wonAmount)} ${t.payoutStatus}\n")
                sb.append("--------------------------------\n")
            }
        }
        return sb.toString()
    }

    fun formatDateDisplay(isoOrDate: String): String {
        return try {
            val clean = isoOrDate.take(10)
            val parts = clean.split("-")
            if (parts.size == 3) "${parts[2]}/${parts[1]}/${parts[0]}" else clean
        } catch (_: Exception) {
            isoOrDate
        }
    }
}

/**
 * Composant Compose pour l'en-tête du ticket : affiche le logo officiel si configuré,
 * ou le croissant de lune 🌙 par défaut.
 */
@Composable
fun LotteryLogoView(
    logoUrl: String?,
    modifier: Modifier = Modifier,
    fallbackEmoji: String = "🌙"
) {
    val bitmap = remember(logoUrl) {
        if (!logoUrl.isNullOrEmpty() && (logoUrl.startsWith("data:image") || logoUrl.length > 50)) {
            TicketReceiptUtil.decodeBase64Bitmap(logoUrl)
        } else {
            null
        }
    }

    if (bitmap != null) {
        Box(
            modifier = modifier
                .padding(vertical = 4.dp),
            contentAlignment = Alignment.Center
        ) {
            Image(
                bitmap = bitmap,
                contentDescription = "Logo Borlette",
                modifier = Modifier
                    .heightIn(max = 52.dp)
                    .widthIn(max = 140.dp)
            )
        }
    } else {
        Text(
            text = fallbackEmoji,
            fontSize = 28.sp,
            modifier = modifier.padding(vertical = 2.dp)
        )
    }
}

/**
 * Badge d'identification claire de session [ TIRAJ MIDI ] ou [ TIRAJ SOIR ]
 */
@Composable
fun DrawPeriodBadge(
    period: String,
    modifier: Modifier = Modifier
) {
    val isMidi = period.uppercase() == "MIDI"
    Surface(
        color = if (isMidi) Color(0xFFFFF8E1) else Color(0xFFEDE7F6),
        shape = RoundedCornerShape(4.dp),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            if (isMidi) Color(0xFFFFB300) else Color(0xFF7E57C2)
        ),
        modifier = modifier.padding(vertical = 2.dp)
    ) {
        Text(
            text = "[ TIRAJ $period ]",
            color = if (isMidi) Color(0xFFE65100) else Color(0xFF311B92),
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
            textAlign = TextAlign.Center
        )
    }
}
