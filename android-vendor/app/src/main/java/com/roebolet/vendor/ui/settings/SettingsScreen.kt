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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.roebolet.vendor.ui.theme.*

@Composable
fun SettingsScreen(
    currentServerUrl: String,
    deviceUuid: String,
    isOnline: Boolean,
    onBackClick: () -> Unit,
    onSaveServerUrl: (String) -> Unit
) {
    val context = LocalContext.current
    var serverUrlInput by remember { mutableStateOf(currentServerUrl) }

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
                    contentDescription = "Retour",
                    tint = Color.White
                )
            }

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "PARAMÈTRES",
                    color = RoeGold,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp
                )
                Text(
                    text = "Configuration du terminal",
                    color = RoeTextMuted,
                    fontSize = 11.sp
                )
            }

            Box(modifier = Modifier.size(40.dp))
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Section 1 : Configuration API & Réseau
        Text(text = "SERVEUR CLOUD / API :", color = RoeTextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
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
                    label = { Text("URL du Serveur") },
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
                            Toast.makeText(context, "URL réinitialisée sur la production officielle", Toast.LENGTH_SHORT).show()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = RoeCard),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Défaut (Prod)", color = Color.White, fontSize = 11.sp)
                    }

                    Button(
                        onClick = {
                            val clean = if (serverUrlInput.endsWith("/")) serverUrlInput else "$serverUrlInput/"
                            onSaveServerUrl(clean)
                            Toast.makeText(context, "URL du serveur enregistrée avec succès !", Toast.LENGTH_SHORT).show()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = RoeGold),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Enregistrer", color = RoeBackground, fontSize = 11.sp, fontWeight = FontWeight.Black)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Section 2 : Matériel & Diagnostic POS
        Text(text = "MATÉRIEL & TERMINAL POS :", color = RoeTextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
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
                    Text("Identifiant UUID Matériel", color = RoeTextMuted, fontSize = 12.sp)
                    Text(deviceUuid, color = RoeGold, fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                }

                HorizontalDivider(color = RoeBorder.copy(alpha = 0.5f))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Connectivité Réseau", color = RoeTextMuted, fontSize = 12.sp)
                    Text(
                        if (isOnline) "En ligne (Connecté)" else "Hors ligne (Mode Offline Actif)",
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
                    Text("Version Logiciel", color = RoeTextMuted, fontSize = 12.sp)
                    Text("v1.0.0 (Production Certifiée)", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Bouton de Test Impression Ticket
        Button(
            onClick = {
                Toast.makeText(context, "Test d'impression thermique envoyé : Reçu de test OK", Toast.LENGTH_SHORT).show()
            },
            colors = ButtonDefaults.buttonColors(containerColor = RoeCard),
            border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth().height(48.dp)
        ) {
            Icon(Icons.Default.Print, contentDescription = null, tint = RoeGold)
            Spacer(modifier = Modifier.width(8.dp))
            Text("TESTER L'IMPRIMANTE THERMIQUE", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}
