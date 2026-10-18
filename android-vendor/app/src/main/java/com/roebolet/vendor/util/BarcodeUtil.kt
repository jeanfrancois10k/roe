package com.roebolet.vendor.util

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Générateur et composant de rendu Code 128 (Subset B)
 * Permet à tout scanner physique ou caméra de flasher le code unique de chaque fiche.
 */
object Barcode128Util {
    private val PATTERNS = arrayOf(
        "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
        "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
        "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
        "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
        "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
        "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
        "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
        "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
        "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
        "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
        "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
    )

    fun encode(text: String): BooleanArray {
        if (text.isEmpty()) return BooleanArray(0)

        val cleanText = text.trim()
        val values = mutableListOf<Int>()
        for (ch in cleanText) {
            val code = ch.code - 32
            if (code in 0..95) {
                values.add(code)
            } else {
                values.add(0) // espace par défaut si caractère hors ASCII standard
            }
        }

        var sum = 104 // Code B start
        for (i in values.indices) {
            sum += values[i] * (i + 1)
        }
        val checksum = sum % 103

        val allSymbols = mutableListOf<Int>()
        allSymbols.add(104) // Start B
        allSymbols.addAll(values)
        allSymbols.add(checksum)
        allSymbols.add(106) // Stop

        val modules = mutableListOf<Boolean>()
        // Quiet zone gauche (10 modules blancs)
        repeat(10) { modules.add(false) }

        for (sym in allSymbols) {
            val p = PATTERNS[sym]
            var isBar = true
            for (ch in p) {
                val width = ch.digitToInt()
                repeat(width) { modules.add(isBar) }
                isBar = !isBar
            }
        }

        // Quiet zone droite (10 modules blancs)
        repeat(10) { modules.add(false) }

        return modules.toBooleanArray()
    }
}

@Composable
fun Barcode128View(
    code: String,
    modifier: Modifier = Modifier,
    height: Dp = 46.dp,
    showCodeText: Boolean = true
) {
    val modules = remember(code) { Barcode128Util.encode(code) }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Color.White)
            .padding(vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        if (modules.isNotEmpty()) {
            Canvas(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(height)
            ) {
                val totalModules = modules.size
                val moduleWidth = size.width / totalModules.toFloat()
                for (i in 0 until totalModules) {
                    if (modules[i]) {
                        drawRect(
                            color = Color.Black,
                            topLeft = Offset(x = i * moduleWidth, y = 0f),
                            size = Size(width = moduleWidth + 0.5f, height = size.height)
                        )
                    }
                }
            }
        }

        if (showCodeText) {
            Spacer(modifier = Modifier.height(3.dp))
            Text(
                text = code,
                color = Color.Black,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.5.sp
            )
        }
    }
}
