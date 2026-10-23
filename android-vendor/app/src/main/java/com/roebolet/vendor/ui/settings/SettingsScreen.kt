package com.roebolet.vendor.ui.settings

import android.annotation.SuppressLint
import android.content.Intent
import android.provider.Settings
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import com.roebolet.vendor.util.AppLanguage
import com.roebolet.vendor.util.ThermalPrinterService
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(
    currentServerUrl: String,
    deviceUuid: String,
    isOnline: Boolean,
    currentLanguage: AppLanguage = AppLanguage.CREOLE,
    isCheckingUpdate: Boolean = false,
    onLanguageChange: (AppLanguage) -> Unit = {},
    onCheckUpdateClick: () -> Unit = {},
    onBackClick: () -> Unit,
    onSaveServerUrl: (String) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var serverUrlInput by remember { mutableStateOf(currentServerUrl) }
    val isHt = currentLanguage == AppLanguage.CREOLE

    // Détection automatique de l'imprimante Bluetooth appairée si aucune n'est enregistrée
    val pairedPrinters = remember { ThermalPrinterService.getPairedPrinters(context) }
    var preferredPrinterName by remember {
        val savedName = ThermalPrinterService.getPreferredPrinterName(context)
        val defaultName = if (isHt) "Okenn enprimant chwazi" else "Aucune imprimante choisie"
        if (!savedName.isNullOrEmpty()) {
            mutableStateOf(savedName)
        } else if (pairedPrinters.isNotEmpty()) {
            val autoDev = pairedPrinters.first()
            @SuppressLint("MissingPermission")
            val autoName = try { autoDev.name ?: "Enprimant POS" } catch (_: Exception) { "Enprimant POS" }
            ThermalPrinterService.setPreferredPrinter(context, autoDev.address, autoName)
            mutableStateOf(autoName)
        } else {
            mutableStateOf(defaultName)
        }
    }
    var showPrinterPicker by remember { mutableStateOf(false) }
    var isPrintingTest by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RoeBackground)
            .padding(horizontal = 14.dp)
    ) {
        // En-tête fixe en haut
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 14.dp, bottom = 10.dp),
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

        // Zone de contenu avec scroll vertical pour compatibilité totale avec tous les écrans POS/mobiles
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(bottom = 36.dp)
        ) {

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
                    Text("v1.0.2 (Production Certifiée)", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }

                HorizontalDivider(color = RoeBorder.copy(alpha = 0.5f))

                // Ligne Enprimant Bluetooth
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(if (isHt) "Enprimant Tèmik (Bluetooth)" else "Imprimante Thermique (Bluetooth)", color = RoeTextMuted, fontSize = 12.sp)
                        Text(
                            text = preferredPrinterName,
                            color = if (preferredPrinterName.contains("Aucune") || preferredPrinterName.contains("Okenn")) RoeWarning else RoeGold,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Button(
                        onClick = { showPrinterPicker = true },
                        colors = ButtonDefaults.buttonColors(containerColor = RoeCard),
                        border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                        modifier = Modifier.height(34.dp)
                    ) {
                        Text(if (isHt) "Chanje" else "Changer", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Bouton de Vérification des Mises à Jour (OTA)
        Button(
            onClick = onCheckUpdateClick,
            enabled = !isCheckingUpdate,
            colors = ButtonDefaults.buttonColors(containerColor = RoeGold),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
        ) {
            if (isCheckingUpdate) {
                CircularProgressIndicator(
                    color = RoeBackground,
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.dp
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isHt) "Vérifikasyon ap fèt..." else "Vérification en cours...",
                    color = RoeBackground,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black
                )
            } else {
                Icon(Icons.Default.CloudDownload, contentDescription = null, tint = RoeBackground)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isHt) "VERIFYE MIZAJOU APLIKASYON" else "VÉRIFIER LES MISES À JOUR",
                    color = RoeBackground,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black
                )
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Bouton de Test Impression Ticket
        Button(
            onClick = {
                if (isPrintingTest) return@Button
                isPrintingTest = true
                scope.launch {
                    ThermalPrinterService.printTestReceipt(context) { success, msg ->
                        isPrintingTest = false
                        Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
                    }
                }
            },
            enabled = !isPrintingTest,
            colors = ButtonDefaults.buttonColors(containerColor = RoeCard),
            border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth().height(48.dp)
        ) {
            if (isPrintingTest) {
                CircularProgressIndicator(color = RoeGold, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isHt) "Enpresyon tès ap fèt..." else "Impression du test en cours...",
                    color = RoeGold,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            } else {
                Icon(Icons.Default.Print, contentDescription = null, tint = RoeGold)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isHt) "TESTE ENPRIMANT TÈMIK" else "TESTER L'IMPRIMANTE THERMIQUE",
                    color = Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
        } // Fin Column avec scroll vertical
    } // Fin Column racine

    // Modal de Sélection de l'Imprimante Bluetooth
    if (showPrinterPicker) {
        val pairedDevices = remember(showPrinterPicker) { ThermalPrinterService.getPairedPrinters(context) }
        AlertDialog(
            onDismissRequest = { showPrinterPicker = false },
            containerColor = RoeSurface,
            title = {
                Text(
                    text = if (isHt) "Chwazi Enprimant Bluetooth" else "Sélectionner l'imprimante Bluetooth",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (pairedDevices.isEmpty()) {
                        Text(
                            text = if (isHt)
                                "Pa gen okenn aparèy Bluetooth ki apparié.\n\nTanpri klike sou bouton anba a pou louvri paramèt Bluetooth yo, apparier enprimant tèmik la (egz: MPT-II, POS-58, PT-210), epi retounen la a."
                            else
                                "Aucun appareil Bluetooth appairé trouvé.\n\nVeuillez cliquer sur le bouton ci-dessous pour ouvrir les Paramètres Bluetooth d'Android, associer votre imprimante thermique (ex: POS-58, MPT-II), puis revenir ici.",
                            color = RoeTextMuted,
                            fontSize = 12.sp
                        )
                    } else {
                        Text(
                            text = if (isHt) "Klike sou enprimant ou vle itilize a :" else "Sélectionnez l'imprimante à utiliser :",
                            color = RoeTextMuted,
                            fontSize = 12.sp
                        )
                        pairedDevices.forEach { dev ->
                            @SuppressLint("MissingPermission")
                            val devName = try { dev.name ?: "Appareil Inconnu" } catch (_: Exception) { "Appareil Inconnu" }
                            val devAddress = dev.address
                            val isSelected = devAddress == ThermalPrinterService.getPreferredPrinterMac(context)

                            Surface(
                                color = if (isSelected) RoeGold.copy(alpha = 0.2f) else RoeCard,
                                shape = RoundedCornerShape(10.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, if (isSelected) RoeGold else RoeBorder),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        ThermalPrinterService.setPreferredPrinter(context, devAddress, devName)
                                        preferredPrinterName = devName
                                        showPrinterPicker = false
                                        Toast.makeText(context, if (isHt) "Enprimant $devName chwazi !" else "Imprimante $devName sélectionnée !", Toast.LENGTH_SHORT).show()
                                    }
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column {
                                        Text(devName, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                        Text(devAddress, color = RoeTextMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                                    }
                                    if (isSelected) {
                                        Icon(Icons.Default.Check, contentDescription = null, tint = RoeGold)
                                    }
                                }
                            }
                        }
                    }

                    // Bouton Raccourci vers les Paramètres Bluetooth du système Android
                    Button(
                        onClick = {
                            try {
                                val intent = Intent(Settings.ACTION_BLUETOOTH_SETTINGS).apply {
                                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                                }
                                context.startActivity(intent)
                            } catch (_: Exception) {
                                Toast.makeText(context, if (isHt) "Enposib pou louvri paramèt Bluetooth yo" else "Impossible d'ouvrir les paramètres Bluetooth", Toast.LENGTH_SHORT).show()
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = RoeCard),
                        border = androidx.compose.foundation.BorderStroke(1.dp, RoeGold),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
                    ) {
                        Icon(Icons.Default.Settings, contentDescription = null, tint = RoeGold, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (isHt) "Ouvri Paramèt Bluetooth Aparèy la" else "Ouvrir Paramètres Bluetooth Android",
                            color = Color.White,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            },
            confirmButton = {
                if (ThermalPrinterService.getPreferredPrinterMac(context) != null) {
                    TextButton(
                        onClick = {
                            ThermalPrinterService.clearPreferredPrinter(context)
                            preferredPrinterName = if (isHt) "Okenn enprimant chwazi" else "Aucune imprimante choisie"
                            showPrinterPicker = false
                            Toast.makeText(context, if (isHt) "Enprimant retire" else "Imprimante désassociée", Toast.LENGTH_SHORT).show()
                        }
                    ) {
                        Text(if (isHt) "Retire Enprimant" else "Désassocier", color = RoeDanger, fontSize = 12.sp)
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { showPrinterPicker = false }) {
                    Text(if (isHt) "Fèmen" else "Fermer", color = Color.White, fontSize = 12.sp)
                }
            }
        )
    }
}
