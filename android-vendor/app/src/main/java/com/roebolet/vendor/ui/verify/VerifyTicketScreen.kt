package com.roebolet.vendor.ui.verify

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.roebolet.vendor.data.api.VendorTicketItem
import com.roebolet.vendor.data.api.VerifyTicketResponse
import com.roebolet.vendor.ui.theme.*
import com.roebolet.vendor.util.AppLanguage
import com.roebolet.vendor.util.TicketReceiptUtil

@Composable
fun VerifyTicketScreen(
    isLoading: Boolean,
    verificationResult: VerifyTicketResponse?,
    errorMessage: String?,
    currentLanguage: AppLanguage = AppLanguage.CREOLE,
    vendorTickets: List<VendorTicketItem> = emptyList(),
    onVerifyClick: (String) -> Unit,
    onPayClick: (String) -> Unit,
    onBackClick: () -> Unit
) {
    var ticketQuery by remember { mutableStateOf("") }
    var showConfirmPayDialog by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current
    val isHt = currentLanguage == AppLanguage.CREOLE

    val unpaidWinners = remember(vendorTickets) {
        vendorTickets.filter { it.isWinner && it.wonAmount > 0 && it.payoutStatus != "PAID" && it.status != "PAID" }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RoeBackground)
            .padding(horizontal = 14.dp)
    ) {
        // En-tête fixe avec bouton retour
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
                    text = if (isHt) "PEYE FICH GANYAN" else "PAYER TICKET GAGNANT",
                    color = RoeGold,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp
                )
                Text(
                    text = if (isHt) "Chèche fich la pou peye gayan an" else "Recherchez le ticket pour payer",
                    color = RoeTextMuted,
                    fontSize = 11.sp
                )
            }

            Spacer(modifier = Modifier.size(40.dp))
        }

        // Zone de contenu défilable (compatible avec MobiIoT et tous écrans courts)
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Champ de saisie ou scan QR code
            OutlinedTextField(
                value = ticketQuery,
                onValueChange = { ticketQuery = it.uppercase() },
                modifier = Modifier.fillMaxWidth(),
                placeholder = {
                    Text(
                        if (isHt) "Nimewo fich la (egz: TIC-12345)..." else "Numéro ticket ou scan QR...",
                        color = RoeTextMuted,
                        fontSize = 13.sp
                    )
                },
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

            // Gros bouton tactile "CHÈCHE / VÉRIFIER"
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
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), color = RoeBackground, strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (isHt) "Rechèch ap fèt..." else "Recherche en cours...",
                        color = RoeBackground,
                        fontWeight = FontWeight.Black,
                        fontSize = 14.sp
                    )
                } else {
                    Icon(Icons.Default.Search, contentDescription = null, tint = RoeBackground)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (isHt) "CHÈCHE FICH SA A" else "VÉRIFIER LE TICKET",
                        color = RoeBackground,
                        fontWeight = FontWeight.Black,
                        fontSize = 14.sp
                    )
                }
            }

            // Message d'erreur
            if (errorMessage != null) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = RoeDanger.copy(alpha = 0.15f)),
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, RoeDanger.copy(alpha = 0.5f))
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = RoeDanger)
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(text = errorMessage, color = RoeDanger, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            // Résultat de la vérification de la fiche
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
                                text = when (res.statusKey) {
                                    "WINNER" -> if (isHt) "🏆 FICH SA A GANYEN !" else "🏆 TICKET GAGNANT !"
                                    "ALREADY_PAID" -> if (isHt) "FICH LA TE PEYE DEJA" else "TICKET DÉJÀ PAYÉ"
                                    "PENDING_DRAW" -> if (isHt) "TIRAJ POKO SÒTI" else "TIRAGE EN COURS"
                                    "NOT_A_WINNER" -> if (isHt) "FICH PA GANYEN" else "TICKET NON GAGNANT"
                                    else -> res.statusLabel
                                },
                                color = if (isWinner || isAlreadyPaid) Color.White else RoeGold,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Black,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        // Numéro de Ticket
                        Text(
                            text = res.ticketNumber,
                            color = Color.White,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )

                        Text(
                            text = "${res.gameName} — Tirage #${res.drawNumber}",
                            color = RoeTextMuted,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )

                        // Montant du Gain
                        if (res.wonAmount > 0) {
                            Spacer(modifier = Modifier.height(10.dp))
                            Text(
                                text = if (isHt) "MONTAN POU KLIYAN AN RESEVWA" else "MONTANT DU GAIN À VERSER",
                                color = if (isWinner) RoeSuccess else RoeTextMuted,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 1.sp
                            )
                            Text(
                                text = "${String.format(java.util.Locale.US, "%.2f", res.wonAmount)} G",
                                color = if (isWinner) RoeGold else Color.White,
                                fontSize = 30.sp,
                                fontWeight = FontWeight.Black,
                                fontFamily = FontFamily.Monospace
                            )
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        // Bouton d'action pour payer le ticket si gagnant et non encore payé
                        if (res.canBePaid) {
                            Button(
                                onClick = { showConfirmPayDialog = true },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(50.dp),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = RoeSuccess)
                            ) {
                                Icon(Icons.Default.Payments, contentDescription = null, tint = Color.White)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = if (isHt) "PEYE FICH SA A (${String.format(java.util.Locale.US, "%.2f", res.wonAmount)} G)" else "PAYER CE TICKET (${String.format(java.util.Locale.US, "%.2f", res.wonAmount)} G)",
                                    color = Color.White,
                                    fontWeight = FontWeight.Black,
                                    fontSize = 15.sp
                                )
                            }
                        }
                    }
                }
            }

            // Section Fiches Gagnantes en Attente de Paiement
            if (unpaidWinners.isNotEmpty()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = if (isHt) "FICH GANYAN KI POKO PEYE :" else "TICKETS GAGNANTS EN ATTENTE :",
                    color = RoeGold,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.5.sp
                )

                unpaidWinners.forEach { winTicket ->
                    Surface(
                        color = RoeCard,
                        shape = RoundedCornerShape(12.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, RoeSuccess.copy(alpha = 0.6f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text("🏆", fontSize = 13.sp)
                                    Text(
                                        text = winTicket.ticketNumber,
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                                val rawGameName = winTicket.game?.get("name")?.toString() ?: "TIRAJ"
                                val drawNum = winTicket.draw?.get("drawNumber")
                                val sched = winTicket.draw?.get("scheduledAt")?.toString() ?: winTicket.createdAt
                                val sess = winTicket.draw?.get("sessionName")?.toString()
                                val drawLabel = TicketReceiptUtil.formatDrawDisplayName(rawGameName, drawNum, sched, sess)
                                Text(
                                    text = drawLabel,
                                    color = RoeTextMuted,
                                    fontSize = 11.sp
                                )
                                Text(
                                    text = "Gain : ${String.format(java.util.Locale.US, "%.2f", winTicket.wonAmount)} HTG",
                                    color = RoeGold,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Black
                                )
                            }

                            Button(
                                onClick = {
                                    ticketQuery = winTicket.ticketNumber
                                    onVerifyClick(winTicket.ticketNumber)
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = RoeSuccess),
                                shape = RoundedCornerShape(10.dp),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text(
                                    text = if (isHt) "PEYE" else "PAYER",
                                    color = Color.White,
                                    fontWeight = FontWeight.Black,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }
                }
            } else if (verificationResult == null) {
                // Guide d'utilisation ergonomique
                Surface(
                    color = RoeSurface,
                    shape = RoundedCornerShape(14.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            imageVector = Icons.Default.Payments,
                            contentDescription = null,
                            tint = RoeGold,
                            modifier = Modifier.size(36.dp)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = if (isHt) "Kòman pou w peye yon fich ?" else "Comment payer un ticket gagnant ?",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = if (isHt)
                                "1. Tape nimewo fich kliyan an pote ba ou a anwo a.\n2. Klike sou « CHÈCHE FICH SA A ».\n3. Si fich la ganyen, klike sou « PEYE FICH SA A » pou bay kliyan an lajan l."
                            else
                                "1. Saisissez le numéro du ticket présenté par le client.\n2. Cliquez sur « VÉRIFIER LE TICKET ».\n3. Si le ticket est gagnant, confirmez le versement pour créditer votre compte.",
                            color = RoeTextMuted,
                            fontSize = 11.sp,
                            lineHeight = 16.sp
                        )
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
                    text = if (isHt) "KONFIME PÈYMAN GANYAN" else "CONFIRMATION DE PAIEMENT",
                    fontWeight = FontWeight.Black,
                    color = Color.White,
                    fontSize = 16.sp
                )
            },
            text = {
                Text(
                    text = if (isHt)
                        "Èske ou vle peye kliyan an ${String.format(java.util.Locale.US, "%.2f", verificationResult.wonAmount)} G kach ?\n\nFich sa a ap make kòm peye epi kont vandè ou a ap ajiste imedyatman."
                    else
                        "Confirmez-vous le versement en espèces de ${String.format(java.util.Locale.US, "%.2f", verificationResult.wonAmount)} G au client ?\n\nCe ticket sera scellé et votre compte vendeur sera immédiatement crédité.",
                    color = Color.White.copy(alpha = 0.9f),
                    fontSize = 13.sp
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
                    Text(if (isHt) "WI, PEYE KLIYAN AN" else "OUI, PAYER", fontWeight = FontWeight.Black)
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmPayDialog = false }) {
                    Text(if (isHt) "ANILE" else "ANNULER", color = RoeTextMuted)
                }
            },
            containerColor = RoeSurface,
            shape = RoundedCornerShape(16.dp)
        )
    }
}
