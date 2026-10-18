package com.roebolet.vendor.ui.tickets

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.roebolet.vendor.data.api.VendorTicketItem
import com.roebolet.vendor.ui.theme.*
import com.roebolet.vendor.util.AppLanguage
import com.roebolet.vendor.util.Strings

@Composable
fun TicketsListScreen(
    title: String = "HISTORIQUE DES TICKETS",
    tickets: List<VendorTicketItem>,
    isLoading: Boolean,
    isCancelling: Boolean = false,
    currentLanguage: AppLanguage = AppLanguage.CREOLE,
    vendorCode: String = "",
    vendorName: String = "",
    deviceUuid: String = "",
    onBackClick: () -> Unit,
    onRefreshClick: () -> Unit,
    onReplayTicket: (VendorTicketItem) -> Unit = {},
    onCancelTicket: (ticketId: String) -> Unit = {}
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedTicketForPreview by remember { mutableStateOf<VendorTicketItem?>(null) }
    var ticketToCancel by remember { mutableStateOf<VendorTicketItem?>(null) }

    val isCreole = currentLanguage == AppLanguage.CREOLE

    // Filtrage dynamique en temps réel (numéro de ticket ou numéro joué)
    val filteredTickets = remember(tickets, searchQuery) {
        val q = searchQuery.trim().lowercase()
        if (q.isEmpty()) {
            tickets
        } else {
            tickets.filter { item ->
                item.ticketNumber.lowercase().contains(q) ||
                (item.playedGrids?.any { grid ->
                    grid.numbers.any { num -> num.lowercase().contains(q) }
                } == true) ||
                (item.game?.get("name")?.toString()?.lowercase()?.contains(q) == true)
            }
        }
    }

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
                    contentDescription = Strings.t("back", currentLanguage),
                    tint = Color.White
                )
            }

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = Strings.t("tickets_history", currentLanguage).ifEmpty { title },
                    color = RoeGold,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp
                )
                Text(
                    text = if (isCreole) "${filteredTickets.size} fich jwenn" else "${filteredTickets.size} tickets trouvés",
                    color = RoeTextMuted,
                    fontSize = 11.sp
                )
            }

            IconButton(
                onClick = onRefreshClick,
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(RoeSurface)
                    .border(1.dp, RoeBorder, RoundedCornerShape(12.dp))
            ) {
                Icon(
                    imageVector = Icons.Default.Refresh,
                    contentDescription = "Actualiser",
                    tint = RoeGold
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Barre de Recherche
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = {
                Text(
                    text = Strings.t("search_ticket", currentLanguage),
                    color = RoeTextMuted,
                    fontSize = 13.sp
                )
            },
            leadingIcon = {
                Icon(Icons.Default.Search, contentDescription = null, tint = RoeGold, modifier = Modifier.size(18.dp))
            },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = { searchQuery = "" }) {
                        Icon(Icons.Default.Clear, contentDescription = "Effacer", tint = RoeTextMuted, modifier = Modifier.size(18.dp))
                    }
                }
            },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = RoeSurface,
                unfocusedContainerColor = RoeSurface,
                focusedBorderColor = RoeGold,
                unfocusedBorderColor = RoeBorder,
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White
            ),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(12.dp))

        if (isLoading) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = RoeGold, strokeWidth = 2.dp)
            }
        } else if (filteredTickets.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = if (isCreole) "Pa gen okenn fich" else "Aucun ticket trouvé",
                        color = Color.White,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = if (isCreole) "Fich ou vann sou tèminal sa a ap parèt la a." else "Les tickets vendus depuis ce terminal s'afficheront ici.",
                        color = RoeTextMuted,
                        fontSize = 12.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(filteredTickets) { ticket ->
                    Surface(
                        color = RoeSurface,
                        shape = RoundedCornerShape(14.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { selectedTicketForPreview = ticket }
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            // En-tête de carte (Numéro + Statut)
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = ticket.ticketNumber,
                                    color = Color.White,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Black,
                                    fontFamily = FontFamily.Monospace
                                )

                                val statusColor = when (ticket.status) {
                                    "CONFIRMED" -> if (ticket.isWinner) RoeGold else RoeSuccess
                                    "WON" -> RoeGold
                                    "CANCELLED" -> RoeDanger
                                    else -> RoeTextMuted
                                }

                                Surface(
                                    color = statusColor.copy(alpha = 0.15f),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, statusColor),
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Text(
                                        text = when (ticket.status) {
                                            "CONFIRMED" -> if (ticket.isWinner) (if (isCreole) "GAGNAN" else "GAGNANT") else (if (isCreole) "KONFIME" else "CONFIRMÉ")
                                            "CANCELLED" -> if (isCreole) "ANILE" else "ANNULÉ"
                                            else -> ticket.status
                                        },
                                        color = statusColor,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Black,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(6.dp))

                            // Date & Montant
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                val gameName = ticket.game?.get("name")?.toString() ?: ""
                                val drawNumber = ticket.draw?.get("drawNumber")?.toString() ?: ""
                                val drawDesc = if (gameName.isNotEmpty()) "$gameName ($drawNumber)" else ticket.createdAt.take(16).replace("T", " ")

                                Text(
                                    text = drawDesc,
                                    color = RoeTextMuted,
                                    fontSize = 11.sp
                                )

                                Text(
                                    text = "${String.format("%.2f", ticket.totalAmount)} HTG",
                                    color = RoeGold,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Black,
                                    fontFamily = FontFamily.Monospace
                                )
                            }

                            // Numéros joués en aperçu rapide
                            ticket.playedGrids?.let { grids ->
                                if (grids.isNotEmpty()) {
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        grids.take(4).forEach { grid ->
                                            Surface(
                                                color = Color(0xFF2C3246),
                                                shape = RoundedCornerShape(4.dp)
                                            ) {
                                                Text(
                                                    text = "${grid.numbers.joinToString("-")} (${grid.betAmount.toInt()}G)",
                                                    color = Color(0xFFB0B7C3),
                                                    fontSize = 10.sp,
                                                    fontFamily = FontFamily.Monospace,
                                                    modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                                                )
                                            }
                                        }
                                        if (grids.size > 4) {
                                            Text(
                                                text = "+${grids.size - 4}",
                                                color = RoeTextMuted,
                                                fontSize = 10.sp,
                                                modifier = Modifier.align(Alignment.CenterVertically)
                                            )
                                        }
                                    }
                                }
                            }

                            if (ticket.isWinner) {
                                Spacer(modifier = Modifier.height(6.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = if (isCreole) "Lajan ou genyen :" else "Gain remporté :",
                                        color = RoeGold,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "${String.format("%.2f", ticket.wonAmount)} HTG",
                                        color = RoeGold,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Black
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            // Boutons d'actions rapides (Aperçu, Rejouer, Annuler)
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.End,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                // Bouton Rejouer / Modifier
                                OutlinedButton(
                                    onClick = { onReplayTicket(ticket) },
                                    shape = RoundedCornerShape(8.dp),
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = RoeGold),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, RoeGold.copy(alpha = 0.5f)),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                                    modifier = Modifier.height(32.dp)
                                ) {
                                    Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = Strings.t("replay_ticket", currentLanguage),
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }

                                // Bouton Annuler Vente (Seulement si CONFIRMED)
                                if (ticket.status == "CONFIRMED") {
                                    Spacer(modifier = Modifier.width(8.dp))
                                    OutlinedButton(
                                        onClick = { ticketToCancel = ticket },
                                        shape = RoundedCornerShape(8.dp),
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = RoeDanger),
                                        border = androidx.compose.foundation.BorderStroke(1.dp, RoeDanger.copy(alpha = 0.5f)),
                                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                        modifier = Modifier.height(32.dp)
                                    ) {
                                        Icon(Icons.Default.Delete, contentDescription = null, modifier = Modifier.size(13.dp))
                                        Spacer(modifier = Modifier.width(3.dp))
                                        Text(
                                            text = Strings.t("cancel_sale", currentLanguage),
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // DIALOG APERÇU COMPLET DU TICKET / FICHE DE VENTE (IMPRIMABLE)
    selectedTicketForPreview?.let { previewTicket ->
        AlertDialog(
            onDismissRequest = { selectedTicketForPreview = null },
            containerColor = Color.White,
            shape = RoundedCornerShape(16.dp),
            title = {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = Strings.t("ticket_preview_title", currentLanguage),
                        color = Color(0xFF6236FF),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Black
                    )
                    IconButton(onClick = { selectedTicketForPreview = null }, modifier = Modifier.size(28.dp)) {
                        Icon(Icons.Default.Close, contentDescription = "Fermer", tint = Color.Gray)
                    }
                }
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // En-tête officiel de la fiche
                    Text(
                        text = "ROE BOLET OFISYÈL",
                        color = Color(0xFF6236FF),
                        fontWeight = FontWeight.Black,
                        fontSize = 16.sp
                    )
                    Text(
                        text = "BÒLÈT NOU - GENYEN ASIRANS",
                        color = Color(0xFF757575),
                        fontWeight = FontWeight.Bold,
                        fontSize = 10.sp
                    )
                    Spacer(modifier = Modifier.height(6.dp))

                    HorizontalDivider(color = Color(0xFFE0E0E0), thickness = 1.dp)
                    Spacer(modifier = Modifier.height(6.dp))

                    // Infos Vendeur, Tèminal, Dat
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(text = "Tèminal :", color = Color(0xFF616161), fontSize = 11.sp)
                        Text(text = deviceUuid.take(16), color = Color.Black, fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(text = "Vandè :", color = Color(0xFF616161), fontSize = 11.sp)
                        Text(text = if (vendorName.isNotEmpty()) "$vendorCode - $vendorName" else vendorCode, color = Color.Black, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(text = "Fich N° :", color = Color(0xFF616161), fontSize = 11.sp)
                        Text(text = previewTicket.ticketNumber, color = Color.Black, fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Black)
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(text = "Dat / Lè :", color = Color(0xFF616161), fontSize = 11.sp)
                        Text(text = previewTicket.createdAt.take(19).replace("T", " "), color = Color.Black, fontSize = 11.sp)
                    }

                    // Info Tirage
                    val gameName = previewTicket.game?.get("name")?.toString() ?: "Loterie"
                    val drawNum = previewTicket.draw?.get("drawNumber")?.toString() ?: ""
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(text = "Tiraj :", color = Color(0xFF616161), fontSize = 11.sp)
                        Text(text = "$gameName (Tiraj $drawNum)", color = Color(0xFF6236FF), fontSize = 11.sp, fontWeight = FontWeight.Black)
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    HorizontalDivider(color = Color(0xFF6236FF), thickness = 1.dp)
                    Spacer(modifier = Modifier.height(6.dp))

                    // Liste des numéros joués (Format table thermique)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = "JEU", color = Color(0xFF757575), fontSize = 10.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1.2f))
                        Text(text = "NIMEWO", color = Color(0xFF757575), fontSize = 10.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1.5f), textAlign = TextAlign.Center)
                        Text(text = "OPSYON", color = Color(0xFF757575), fontSize = 10.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1.2f), textAlign = TextAlign.Center)
                        Text(text = "MONTAN", color = Color(0xFF757575), fontSize = 10.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1.2f), textAlign = TextAlign.End)
                    }
                    Spacer(modifier = Modifier.height(4.dp))

                    val grids = previewTicket.playedGrids ?: emptyList()
                    if (grids.isEmpty()) {
                        Text(
                            text = "(Detay nimewo yo anrejistre sou sèvè a)",
                            color = Color.Gray,
                            fontSize = 11.sp,
                            modifier = Modifier.padding(vertical = 8.dp)
                        )
                    } else {
                        grids.forEach { g ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 2.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = g.gameType ?: "BORLETTE",
                                    color = Color(0xFF424242),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.weight(1.2f)
                                )
                                Text(
                                    text = g.numbers.joinToString("-"),
                                    color = Color.Black,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Black,
                                    fontFamily = FontFamily.Monospace,
                                    modifier = Modifier.weight(1.5f),
                                    textAlign = TextAlign.Center
                                )
                                Text(
                                    text = g.option ?: if (g.isGratis == true) "GRATIS" else "TOUT",
                                    color = if (g.isGratis == true) Color(0xFF2E7D32) else Color(0xFF616161),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.weight(1.2f),
                                    textAlign = TextAlign.Center
                                )
                                Text(
                                    text = "${String.format("%.2f", g.betAmount)} G",
                                    color = Color.Black,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    modifier = Modifier.weight(1.2f),
                                    textAlign = TextAlign.End
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(6.dp))
                    HorizontalDivider(color = Color(0xFF6236FF), thickness = 1.5.dp)
                    Spacer(modifier = Modifier.height(6.dp))

                    // Total et Statut
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(text = "TOTAL FICHE :", color = Color.Black, fontWeight = FontWeight.Black, fontSize = 13.sp)
                        Text(
                            text = "${String.format("%.2f", previewTicket.totalAmount)} HTG",
                            color = Color(0xFF6236FF),
                            fontWeight = FontWeight.Black,
                            fontSize = 16.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    // Statut du ticket
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(text = "Statut :", color = Color(0xFF616161), fontSize = 11.sp)
                        Text(
                            text = when (previewTicket.status) {
                                "CONFIRMED" -> if (previewTicket.isWinner) "GAGNANT" else "CONFIRMÉ"
                                "CANCELLED" -> "ANNULÉ"
                                else -> previewTicket.status
                            },
                            color = when (previewTicket.status) {
                                "CONFIRMED" -> if (previewTicket.isWinner) Color(0xFFE65100) else Color(0xFF2E7D32)
                                "CANCELLED" -> Color(0xFFD32F2F)
                                else -> Color.Gray
                            },
                            fontWeight = FontWeight.Black,
                            fontSize = 11.sp
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Code-barres simulé thermique
                    Text(
                        text = "||| | |||| | |||||| || | |||| ||| |||||||",
                        color = Color.Black,
                        fontSize = 18.sp,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 2.sp
                    )
                    Text(
                        text = "Siyati : ${(previewTicket.secureChecksum ?: previewTicket.ticketNumber).take(20)}...",
                        color = Color.Gray,
                        fontSize = 9.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            },
            confirmButton = {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    // Rejouer depuis le modal
                    Button(
                        onClick = {
                            val t = previewTicket
                            selectedTicketForPreview = null
                            onReplayTicket(t)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6236FF)),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(text = Strings.t("replay_ticket", currentLanguage), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }

                    // Annuler la vente depuis le modal si CONFIRMED
                    if (previewTicket.status == "CONFIRMED") {
                        Button(
                            onClick = {
                                val t = previewTicket
                                selectedTicketForPreview = null
                                ticketToCancel = t
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = RoeDanger),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(text = Strings.t("cancel_sale", currentLanguage), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { selectedTicketForPreview = null }) {
                    Text(text = Strings.t("close", currentLanguage), color = Color(0xFF616161))
                }
            }
        )
    }

    // DIALOG CONFIRMATION D'ANNULATION DU TICKET
    ticketToCancel?.let { targetTicket ->
        AlertDialog(
            onDismissRequest = { if (!isCancelling) ticketToCancel = null },
            title = {
                Text(
                    text = Strings.t("confirm_cancel_title", currentLanguage),
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = RoeDanger
                )
            },
            text = {
                Column {
                    Text(
                        text = Strings.t("confirm_cancel_msg", currentLanguage),
                        fontSize = 13.sp,
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Surface(
                        color = Color(0xFF1E2433),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text(
                                text = "Ticket : ${targetTicket.ticketNumber}",
                                color = RoeGold,
                                fontWeight = FontWeight.Black,
                                fontSize = 13.sp,
                                fontFamily = FontFamily.Monospace
                            )
                            Text(
                                text = "Montant remboursé : ${String.format("%.2f", targetTicket.totalAmount)} HTG",
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val id = targetTicket.id
                        ticketToCancel = null
                        onCancelTicket(id)
                    },
                    enabled = !isCancelling,
                    colors = ButtonDefaults.buttonColors(containerColor = RoeDanger),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    if (isCancelling) {
                        CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(16.dp))
                    } else {
                        Text(text = Strings.t("cancel_sale", currentLanguage), fontWeight = FontWeight.Bold)
                    }
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { ticketToCancel = null },
                    enabled = !isCancelling
                ) {
                    Text(text = Strings.t("cancel", currentLanguage), color = Color.White)
                }
            }
        )
    }
}
