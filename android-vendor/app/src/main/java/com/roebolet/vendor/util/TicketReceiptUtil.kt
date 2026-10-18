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

    /**
     * Détermine si un tirage correspond à la session MIDI ou SOIR.
     * Règle Borlette :
     * 1. Analyse du nom du jeu (ex: NY MIDI vs NY SOIR)
     * 2. Analyse de l'heure programmée (scheduledAt) : avant 16h00 = MIDI, à partir de 16h00 = SOIR
     * 3. Fallback heure locale actuelle : avant 16h00 = MIDI, après 16h00 = SOIR ("après midi c'est soir")
     */
    fun getDrawPeriod(gameName: String?, scheduledAt: String? = null): String {
        val upper = (gameName ?: "").uppercase()
        if (upper.contains("SOIR") || upper.contains("EVENING") || upper.contains("NUIT") || upper.contains("NIGHT")) {
            return "SOIR"
        }
        if (upper.contains("MIDI") || upper.contains("MIDDAY") || upper.contains("MATIN") || upper.contains("JOUR") || upper.contains("DAY")) {
            return "MIDI"
        }

        if (!scheduledAt.isNullOrEmpty()) {
            try {
                val hour = when {
                    scheduledAt.contains("T") -> scheduledAt.substringAfter("T").take(2).toIntOrNull()
                    scheduledAt.contains(" ") -> scheduledAt.substringAfter(" ").take(2).toIntOrNull()
                    else -> null
                }
                if (hour != null) {
                    return if (hour < 16) "MIDI" else "SOIR"
                }
            } catch (_: Exception) {}
        }

        val cal = Calendar.getInstance()
        val currentHour = cal.get(Calendar.HOUR_OF_DAY)
        return if (currentHour < 16) "MIDI" else "SOIR"
    }

    /**
     * Formate le nom d'affichage propre du tirage avec la mention MIDI ou SOIR
     * Ex: "BOLET NEW YORK - MIDI" ou "BOLET FLORIDA - SOIR (#102)"
     */
    fun formatDrawDisplayName(gameName: String?, drawNumber: Any? = null, scheduledAt: String? = null): String {
        val baseName = (gameName ?: "TIRAJ OFISYÈL")
            .replace(Regex("(?i)\\s*\\(midi\\s*&\\s*soir\\)"), "")
            .replace(Regex("(?i)\\s*\\(midi\\)"), "")
            .replace(Regex("(?i)\\s*\\(soir\\)"), "")
            .trim()
            .uppercase()

        val period = getDrawPeriod(gameName, scheduledAt)
        val drawNumStr = if (drawNumber != null && drawNumber.toString().isNotEmpty()) " (#$drawNumber)" else ""
        return "$baseName - $period$drawNumStr"
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
