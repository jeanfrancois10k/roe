package com.roebolet.vendor.ui.login

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
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
    onLanguageChange: (AppLanguage) -> Unit = {},
    onLoginClick: (vendorCode: String, pin: String) -> Unit
) {
    var vendorCode by remember { mutableStateOf(initialVendorCode.ifEmpty { "VEND-001" }) }
    var pin by remember { mutableStateOf("") }
    val isHt = currentLanguage == AppLanguage.CREOLE

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RoeBackground)
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
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
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
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
            modifier = Modifier.padding(top = 4.dp)
        ) {
            Image(
                painter = painterResource(id = com.roebolet.vendor.R.drawable.app_logo),
                contentDescription = "Logo ROE",
                modifier = Modifier
                    .size(64.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .border(1.dp, RoeGold.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "ROE BOLET",
                color = RoeGold,
                fontSize = 24.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 2.sp
            )
            Text(
                text = if (isHt) "TÈMINAL VANT OFISYÈL" else "TERMINAL DE VENTE OFFICIEL",
                color = RoeTextMuted,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
            )

            Spacer(modifier = Modifier.height(10.dp))

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
                modifier = Modifier.fillMaxWidth(0.85f)
            )

            Spacer(modifier = Modifier.height(8.dp))

            // PIN Display (points ou chiffres)
            Row(
                modifier = Modifier
                    .fillMaxWidth(0.85f)
                    .height(48.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(RoeCard)
                    .border(1.dp, if (pin.isNotEmpty()) RoeGold else RoeBorder, RoundedCornerShape(12.dp)),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                if (pin.isEmpty()) {
                    Text(
                        text = "ENTREZ VOTRE CODE PIN (4-6)",
                        color = RoeTextMuted,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                } else {
                    Text(
                        text = "● ".repeat(pin.length).trim(),
                        color = RoeGold,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }

            if (errorMessage != null) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = errorMessage,
                    color = RoeDanger,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 16.dp)
                )
            }
        }

        // Pavé Numérique Haute Ergonomie (Gros Boutons pour POS)
        Column(
            modifier = Modifier.fillMaxWidth(0.9f),
            verticalArrangement = Arrangement.spacedBy(8.dp)
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
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
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
                                .height(56.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(btnColor)
                                .border(1.dp, if (key == "OK") RoeGold else RoeBorder, RoundedCornerShape(14.dp))
                                .clickable(enabled = !isLoading) {
                                    when (key) {
                                        "C" -> if (pin.isNotEmpty()) pin = pin.dropLast(1)
                                        "OK" -> {
                                            if (vendorCode.isNotEmpty() && pin.length >= 4) {
                                                onLoginClick(vendorCode, pin)
                                            }
                                        }
                                        else -> if (pin.length < 6) pin += key
                                    }
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = key,
                                color = textColor,
                                fontSize = if (isActionKey) 16.sp else 22.sp,
                                fontWeight = FontWeight.Black
                            )
                        }
                    }
                }
            }
        }

        // Footer avec informations terminal
        Text(
            text = "Terminal : $deviceUuid • v1.0.0",
            color = RoeTextMuted.copy(alpha = 0.6f),
            fontSize = 9.sp,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier.padding(bottom = 6.dp)
        )
    }
}
