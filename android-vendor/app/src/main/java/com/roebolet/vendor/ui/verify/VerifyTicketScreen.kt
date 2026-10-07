package com.roebolet.vendor.ui.verify

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.roebolet.vendor.data.api.VerifyTicketResponse
import com.roebolet.vendor.ui.theme.*

@Composable
fun VerifyTicketScreen(
    isLoading: Boolean,
    verificationResult: VerifyTicketResponse?,
    errorMessage: String?,
    onVerifyClick: (String) -> Unit,
    onPayClick: (String) -> Unit,
    onBackClick: () -> Unit
) {
    var ticketQuery by remember { mutableStateOf("") }
    var showConfirmPayDialog by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RoeBackground)
            .padding(14.dp)
    ) {
        // En-tête avec bouton retour
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            IconButton(
                onClick = onBackClick,
                modifier = Modifier
                    .size(42.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(RoeSurface)
                    .border(1.dp, RoeBorder, RoundedCornerShape(12.dp))
            ) {
                Icon(
                    imageVector = Icons.Default.ArrowBack,
                    contentDescription = "Retour",
                    tint = Color.White
                )
            }

            Text(
                text = "VÉRIFIER TICKET",
                color = RoeGold,
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 1.sp
            )

            Spacer(modifier = Modifier.size(42.dp))
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Champ de saisie ou scan QR code
        OutlinedTextField(
            value = ticketQuery,
            onValueChange = { ticketQuery = it.uppercase() },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Numéro ticket ou scan QR...", color = RoeTextMuted) },
            singleLine = true,
            leadingIcon = {
                Icon(Icons.Default.QrCodeScanner, contentDescription = null, tint = RoeGold)
            },
            trailingIcon = {
                if (ticketQuery.isNotEmpty()) {
                    IconButton(onClick = { ticketQuery = "" }) {
                        Icon(Icons.Default.Clear, contentDescription = "Effacer", tint = RoeTextMuted)
                    }
                }
            },
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = RoeSurface,
                unfocusedContainerColor = RoeSurface,
                focusedBorderColor = RoeGold,
                unfocusedBorderColor = RoeBorder,
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White
            ),
            shape = RoundedCornerShape(14.dp),
            keyboardOptions = KeyboardOptions(
                capitalization = KeyboardCapitalization.Characters,
                imeAction = ImeAction.Search
            ),
            keyboardActions = KeyboardActions(
                onSearch = {
                    if (ticketQuery.isNotBlank()) {
                        focusManager.clearFocus()
                        onVerifyClick(ticketQuery)
                    }
                }
            )
        )

        Spacer(modifier = Modifier.height(10.dp))

        // Gros bouton tactile "VÉRIFIER"
        Button(
            onClick = {
                if (ticketQuery.isNotBlank()) {
                    focusManager.clearFocus()
                    onVerifyClick(ticketQuery)
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            enabled = !isLoading && ticketQuery.isNotBlank(),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = RoeGold)
        ) {
            if (isLoading) {
                CircularProgressIndicator(modifier = Modifier.size(22.dp), color = RoeBackground)
            } else {
                Icon(Icons.Default.Search, contentDescription = null, tint = RoeBackground)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "VÉRIFIER MAINTENANT",
                    color = RoeBackground,
                    fontWeight = FontWeight.Black,
                    fontSize = 15.sp
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Message d'erreur s'il y a lieu
        if (errorMessage != null) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = RoeDanger.copy(alpha = 0.15f)),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = RoeDanger)
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(text = errorMessage, color = RoeDanger, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        // Affichage du résultat de vérification
        if (verificationResult != null) {
            val res = verificationResult
            val isWinner = res.statusKey == "WINNER"
            val isAlreadyPaid = res.statusKey == "ALREADY_PAID"

            val cardBg = when {
                isWinner -> RoeSuccess.copy(alpha = 0.12f)
                isAlreadyPaid -> RoeDanger.copy(alpha = 0.12f)
                else -> RoeSurface
            }
            val cardBorder = when {
                isWinner -> RoeSuccess
                isAlreadyPaid -> RoeDanger
                else -> RoeBorder
            }

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.5.dp, cardBorder, RoundedCornerShape(16.dp)),
                colors = CardDefaults.cardColors(containerColor = cardBg),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Badge Statut
                    Surface(
                        color = when {
                            isWinner -> RoeSuccess
                            isAlreadyPaid -> RoeDanger
                            else -> RoeCard
                        },
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = res.statusLabel,
                            color = if (isWinner || isAlreadyPaid) Color.White else RoeGold,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Black,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Numéro de Ticket
                    Text(
                        text = res.ticketNumber,
                        color = Color.White,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )

                    Text(
                        text = "${res.gameName} — Tirage N°${res.drawNumber}",
                        color = RoeTextMuted,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    // Montant du Gain
                    if (res.wonAmount > 0) {
                        Text(
                            text = "MONTANT DU GAIN",
                            color = if (isWinner) RoeSuccess else RoeTextMuted,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 1.sp
                        )
                        Text(
                            text = "$${String.format("%.2f", res.wonAmount)}",
                            color = if (isWinner) RoeGold else Color.White,
                            fontSize = 32.sp,
                            fontWeight = FontWeight.Black,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Bouton d'action pour payer le ticket si gagnant et non payé
                    if (res.canBePaid) {
                        Button(
                            onClick = { showConfirmPayDialog = true },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = RoeSuccess)
                        ) {
                            Icon(Icons.Default.AttachMoney, contentDescription = null, tint = Color.White)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "PAYER CE TICKET ($${String.format("%.2f", res.wonAmount)})",
                                color = Color.White,
                                fontWeight = FontWeight.Black,
                                fontSize = 16.sp
                            )
                        }
                    }
                }
            }
        }
    }

    // Dialogue de confirmation de paiement
    if (showConfirmPayDialog && verificationResult != null) {
        AlertDialog(
            onDismissRequest = { showConfirmPayDialog = false },
            title = {
                Text(
                    text = "CONFIRMATION DE PAIEMENT",
                    fontWeight = FontWeight.Black,
                    color = Color.White
                )
            },
            text = {
                Text(
                    text = "Confirmez-vous le versement en espèces de $${String.format("%.2f", verificationResult.wonAmount)} au client ?\n\nCe ticket sera scellé et votre compte vendeur sera immédiatement crédité.",
                    color = Color.White.copy(alpha = 0.85f)
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showConfirmPayDialog = false
                        onPayClick(verificationResult.ticketId)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = RoeSuccess)
                ) {
                    Text("OUI, PAYER", fontWeight = FontWeight.Black)
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmPayDialog = false }) {
                    Text("ANNULER", color = RoeTextMuted)
                }
            },
            containerColor = RoeSurface,
            shape = RoundedCornerShape(16.dp)
        )
    }
}
