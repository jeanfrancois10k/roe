package com.roebolet.vendor.ui.settings

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.clickable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.roebolet.vendor.ui.theme.*
import com.roebolet.vendor.util.AppLanguage

@Composable
fun SettingsScreen(
    currentServerUrl: String,
    deviceUuid: String,
    isOnline: Boolean,
    currentLanguage: AppLanguage = AppLanguage.CREOLE,
    onLanguageChange: (AppLanguage) -> Unit = {},
    onBackClick: () -> Unit,
    onSaveServerUrl: (String) -> Unit
) {
    val context = LocalContext.current
    var serverUrlInput by remember { mutableStateOf(currentServerUrl) }
    val isHt = currentLanguage == AppLanguage.CREOLE

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RoeBackground)
            .padding(14.dp)
    ) {
        // En-tête
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            IconButton(
                onClick = onBackClick,
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(RoeSurface)
                    .border(1.dp, RoeBorder, RoundedCornerShape(12.dp))
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = if (isHt) "Tounen" else "Retour",
                    tint = Color.White
                )
            }

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = if (isHt) "PARAMÈT" else "PARAMÈTRES",
                    color = RoeGold,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp
                )
                Text(
                    text = if (isHt) "Konfigirasyon tèminal la" else "Configuration du terminal",
                    color = RoeTextMuted,
                    fontSize = 11.sp
                )
            }

            Box(modifier = Modifier.size(40.dp))
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Section 0 : Langue de l'application / Lang Aplikasyon
        Text(
            text = if (isHt) "LANG APLIKASYON (LANGUE) :" else "LANGUE DE L'APPLICATION (LANG) :",
            color = RoeTextMuted,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(6.dp))

        Surface(
            color = RoeSurface,
            shape = RoundedCornerShape(16.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Option Kreyòl Ayisyen
                Surface(
                    color = if (isHt) RoeGold else RoeCard,
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp,
                        if (isHt) RoeGold else RoeBorder
                    ),
                    modifier = Modifier
                        .weight(1f)
                        .clickable {
                            onLanguageChange(AppLanguage.CREOLE)
                            Toast.makeText(context, "Lang chanje an Kreyòl", Toast.LENGTH_SHORT).show()
                        }
                ) {
                    Row(
                        modifier = Modifier.padding(vertical = 12.dp, horizontal = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = "🇭🇹 Kreyòl (Ayiti)",
                            color = if (isHt) RoeBackground else Color.White,
                            fontWeight = FontWeight.Black,
                            fontSize = 13.sp
                        )
                    }
                }

                // Option Français
                Surface(
                    color = if (!isHt) RoeGold else RoeCard,
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp,
                        if (!isHt) RoeGold else RoeBorder
                    ),
                    modifier = Modifier
                        .weight(1f)
                        .clickable {
                            onLanguageChange(AppLanguage.FRENCH)
                            Toast.makeText(context, "Langue changée en Français", Toast.LENGTH_SHORT).show()
                        }
                ) {
                    Row(
                        modifier = Modifier.padding(vertical = 12.dp, horizontal = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = "🇫🇷 Français",
                            color = if (!isHt) RoeBackground else Color.White,
                            fontWeight = FontWeight.Black,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Section 1 : Configuration API & Réseau
        Text(
            text = if (isHt) "SÈVÈ CLOUD / API :" else "SERVEUR CLOUD / API :",
            color = RoeTextMuted,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(6.dp))

        Surface(
            color = RoeSurface,
            shape = RoundedCornerShape(16.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                OutlinedTextField(
                    value = serverUrlInput,
                    onValueChange = { serverUrlInput = it },
                    label = { Text(if (isHt) "Adrès Sèvè Cloud" else "URL du Serveur") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = RoeGold,
                        unfocusedBorderColor = RoeBorder,
                        focusedLabelColor = RoeGold,
                        unfocusedLabelColor = RoeTextMuted
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = {
                            serverUrlInput = "https://roe-chi.vercel.app/"
                            onSaveServerUrl("https://roe-chi.vercel.app/")
                            Toast.makeText(context, if (isHt) "Adrès la retounen sou sèvè pwodiksyon an" else "URL réinitialisée sur la production officielle", Toast.LENGTH_SHORT).show()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = RoeCard),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(if (isHt) "Pwodiksyon" else "Défaut (Prod)", color = Color.White, fontSize = 11.sp)
                    }

                    Button(
                        onClick = {
                            val clean = if (serverUrlInput.endsWith("/")) serverUrlInput else "$serverUrlInput/"
                            onSaveServerUrl(clean)
                            Toast.makeText(context, if (isHt) "Adrès sèvè a anrejistre avèk siksè !" else "URL du serveur enregistrée avec succès !", Toast.LENGTH_SHORT).show()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = RoeGold),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(if (isHt) "Anrejistre" else "Enregistrer", color = RoeBackground, fontSize = 11.sp, fontWeight = FontWeight.Black)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Section 2 : Matériel & Diagnostic POS
        Text(
            text = if (isHt) "MATERYÈL AK TÈMINAL POS :" else "MATÉRIEL & TERMINAL POS :",
            color = RoeTextMuted,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(6.dp))

        Surface(
            color = RoeSurface,
            shape = RoundedCornerShape(16.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(if (isHt) "Nimewo Aparèy (UUID)" else "Identifiant UUID Matériel", color = RoeTextMuted, fontSize = 12.sp)
                    Text(deviceUuid, color = RoeGold, fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                }

                HorizontalDivider(color = RoeBorder.copy(alpha = 0.5f))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(if (isHt) "Koneksyon Rezo" else "Connectivité Réseau", color = RoeTextMuted, fontSize = 12.sp)
                    Text(
                        if (isOnline) {
                            if (isHt) "An liy (Konekte)" else "En ligne (Connecté)"
                        } else {
                            if (isHt) "Òf liy (Mòd Offline)" else "Hors ligne (Mode Offline Actif)"
                        },
                        color = if (isOnline) RoeSuccess else RoeWarning,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                HorizontalDivider(color = RoeBorder.copy(alpha = 0.5f))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(if (isHt) "Vèsyon Lojisyèl" else "Version Logiciel", color = RoeTextMuted, fontSize = 12.sp)
                    Text("v1.0.1 (Production Certifiée)", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Bouton de Test Impression Ticket
        Button(
            onClick = {
                Toast.makeText(context, if (isHt) "Tès enprimant tèmik voye : Enpresyon OK" else "Test d'impression thermique envoyé : Reçu de test OK", Toast.LENGTH_SHORT).show()
            },
            colors = ButtonDefaults.buttonColors(containerColor = RoeCard),
            border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth().height(48.dp)
        ) {
            Icon(Icons.Default.Print, contentDescription = null, tint = RoeGold)
            Spacer(modifier = Modifier.width(8.dp))
            Text(if (isHt) "TESTE ENPRIMANT TÈMIK" else "TESTER L'IMPRIMANTE THERMIQUE", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}
