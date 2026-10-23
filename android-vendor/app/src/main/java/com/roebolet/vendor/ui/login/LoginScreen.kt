package com.roebolet.vendor.ui.login

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.roebolet.vendor.ui.theme.*
import com.roebolet.vendor.util.AppLanguage

@Composable
fun LoginScreen(
    initialVendorCode: String,
    deviceUuid: String,
    errorMessage: String?,
    isLoading: Boolean,
    currentLanguage: AppLanguage = AppLanguage.CREOLE,
    pin: String = "",
    onPinChange: (String) -> Unit = {},
    onLanguageChange: (AppLanguage) -> Unit = {},
    onLoginClick: (vendorCode: String, pin: String) -> Unit
) {
    var vendorCode by remember { mutableStateOf(initialVendorCode.ifEmpty { "VEND-001" }) }
    var internalPin by remember { mutableStateOf("") }
    val effectivePin = if (pin.isNotEmpty()) pin else internalPin
    val isHt = currentLanguage == AppLanguage.CREOLE

    fun updatePin(newVal: String) {
        internalPin = newVal
        onPinChange(newVal)
    }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(RoeBackground)
    ) {
        val screenHeight = maxHeight
        val isCompact = screenHeight < 680.dp
        val isVeryShort = screenHeight < 540.dp

        val logoSize = if (isVeryShort) 36.dp else if (isCompact) 44.dp else 60.dp
        val titleSize = if (isVeryShort) 18.sp else if (isCompact) 20.sp else 24.sp
        val subtitleSize = if (isVeryShort) 9.sp else if (isCompact) 10.sp else 11.sp
        val pinBoxHeight = if (isVeryShort) 38.dp else if (isCompact) 42.dp else 48.dp
        val keyHeight = if (isVeryShort) 40.dp else if (isCompact) 44.dp else 54.dp
        val keySpacing = if (isVeryShort) 4.dp else if (isCompact) 6.dp else 8.dp
        val keyFontSize = if (isVeryShort) 17.sp else if (isCompact) 19.sp else 22.sp
        val verticalSpacing = if (isVeryShort) 4.dp else if (isCompact) 8.dp else 12.dp

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 14.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = if (isCompact) Arrangement.spacedBy(verticalSpacing) else Arrangement.SpaceBetween
        ) {
            // Barre supérieure : Sélecteur de Langue (Kreyòl / Français)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                Surface(
                    color = RoeCard,
                    shape = RoundedCornerShape(10.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                    modifier = Modifier.clickable {
                        val next = if (isHt) AppLanguage.FRENCH else AppLanguage.CREOLE
                        onLanguageChange(next)
                    }
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = if (isHt) "🇭🇹 Kreyòl" else "🇫🇷 Français",
                            color = RoeGold,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = if (isHt) "• Chanje" else "• Changer",
                            color = RoeTextMuted,
                            fontSize = 10.sp
                        )
                    }
                }
            }

            // En-tête de Marque avec Logo Officiel
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(top = 2.dp)
            ) {
                Image(
                    painter = painterResource(id = com.roebolet.vendor.R.drawable.app_logo),
                    contentDescription = "Logo ROE",
                    modifier = Modifier
                        .size(logoSize)
                        .clip(RoundedCornerShape(14.dp))
                        .border(1.dp, RoeGold.copy(alpha = 0.5f), RoundedCornerShape(14.dp))
                )
                Spacer(modifier = Modifier.height(if (isVeryShort) 4.dp else 6.dp))
                Text(
                    text = "ROE BOLET",
                    color = RoeGold,
                    fontSize = titleSize,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 2.sp
                )
                Text(
                    text = if (isHt) "TÈMINAL VANT OFISYÈL" else "TERMINAL DE VENTE OFFICIEL",
                    color = RoeTextMuted,
                    fontSize = subtitleSize,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )

                Spacer(modifier = Modifier.height(if (isVeryShort) 6.dp else 8.dp))

                // Code Vendeur Input
                OutlinedTextField(
                    value = vendorCode,
                    onValueChange = { vendorCode = it.uppercase() },
                    label = { Text(if (isHt) "KÒD VANDÈ" else "ID VENDEUR", color = RoeTextMuted, fontSize = 11.sp) },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = RoeGold,
                        unfocusedBorderColor = RoeBorder,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(if (isCompact) 0.95f else 0.85f)
                )

                Spacer(modifier = Modifier.height(if (isVeryShort) 4.dp else 6.dp))

                // PIN Display (points ou chiffres)
                Row(
                    modifier = Modifier
                        .fillMaxWidth(if (isCompact) 0.95f else 0.85f)
                        .height(pinBoxHeight)
                        .clip(RoundedCornerShape(12.dp))
                        .background(RoeCard)
                        .border(1.dp, if (effectivePin.isNotEmpty()) RoeGold else RoeBorder, RoundedCornerShape(12.dp)),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    if (effectivePin.isEmpty()) {
                        Text(
                            text = if (isHt) "ANTRE KÒD PIN OU (4-6)" else "ENTREZ VOTRE CODE PIN (4-6)",
                            color = RoeTextMuted,
                            fontSize = if (isVeryShort) 11.sp else 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    } else {
                        Text(
                            text = "● ".repeat(effectivePin.length).trim(),
                            color = RoeGold,
                            fontSize = if (isVeryShort) 18.sp else 22.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }

                if (errorMessage != null) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = errorMessage,
                        color = RoeDanger,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 12.dp)
                    )
                }
            }

            // Pavé Numérique Haute Ergonomie (Compatible Écran Court & MobiIoT)
            Column(
                modifier = Modifier.fillMaxWidth(if (isCompact) 0.98f else 0.9f),
                verticalArrangement = Arrangement.spacedBy(keySpacing)
            ) {
                val keyRows = listOf(
                    listOf("1", "2", "3"),
                    listOf("4", "5", "6"),
                    listOf("7", "8", "9"),
                    listOf("C", "0", "OK")
                )

                for (row in keyRows) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(keySpacing)
                    ) {
                        for (key in row) {
                            val isActionKey = key == "C" || key == "OK"
                            val btnColor = when (key) {
                                "OK" -> RoeGold
                                "C" -> RoeDanger.copy(alpha = 0.2f)
                                else -> RoeCard
                            }
                            val textColor = when (key) {
                                "OK" -> RoeBackground
                                "C" -> RoeDanger
                                else -> Color.White
                            }

                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(keyHeight)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(btnColor)
                                    .border(1.dp, if (key == "OK") RoeGold else RoeBorder, RoundedCornerShape(12.dp))
                                    .clickable(enabled = !isLoading) {
                                        when (key) {
                                            "C" -> if (effectivePin.isNotEmpty()) updatePin(effectivePin.dropLast(1))
                                            "OK" -> {
                                                if (vendorCode.isNotEmpty() && effectivePin.length >= 4) {
                                                    onLoginClick(vendorCode, effectivePin)
                                                }
                                            }
                                            else -> if (effectivePin.length < 6) updatePin(effectivePin + key)
                                        }
                                    },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = key,
                                    color = textColor,
                                    fontSize = if (isActionKey) (if (isVeryShort) 14.sp else 16.sp) else keyFontSize,
                                    fontWeight = FontWeight.Black
                                )
                            }
                        }
                    }
                }
            }

            // Footer avec informations terminal
            Text(
                text = "Terminal : $deviceUuid • v1.0.3",
                color = RoeTextMuted.copy(alpha = 0.6f),
                fontSize = 9.sp,
                fontFamily = FontFamily.Monospace,
                modifier = Modifier.padding(bottom = 4.dp)
            )
        }
    }
}
