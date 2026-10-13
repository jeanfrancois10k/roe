package com.roebolet.vendor.ui.sell

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.roebolet.vendor.data.api.BetGrid
import com.roebolet.vendor.data.api.OpenDrawItem
import com.roebolet.vendor.data.api.SellTicketResponse
import com.roebolet.vendor.ui.theme.*

@Composable
fun SellTicketScreen(
    openDraws: List<OpenDrawItem>,
    isLoadingDraws: Boolean,
    isSubmitting: Boolean,
    errorMessage: String?,
    soldTicketResult: SellTicketResponse?,
    onBackClick: () -> Unit,
    onSubmitTicket: (drawId: String, gameId: String, grids: List<BetGrid>) -> Unit,
    onDismissReceipt: () -> Unit
) {
    var selectedDrawIndex by remember { mutableStateOf(0) }
    var numberInput by remember { mutableStateOf("") }
    var amountInput by remember { mutableStateOf("25") }
    val grids = remember { mutableStateListOf<BetGrid>() }

    val currentDraw = openDraws.getOrNull(selectedDrawIndex)
    val totalAmount = grids.sumOf { it.betAmount * (it.multiplier ?: 1) }

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
                    text = "NOUVELLE VENTE",
                    color = RoeGold,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp
                )
                Text(
                    text = "Émission Ticket Borlette",
                    color = RoeTextMuted,
                    fontSize = 11.sp
                )
            }

            Box(modifier = Modifier.size(40.dp))
        }

        Spacer(modifier = Modifier.height(12.dp))

        if (isLoadingDraws) {
            Box(modifier = Modifier.fillMaxWidth().height(80.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = RoeGold, strokeWidth = 2.dp)
            }
        } else if (openDraws.isEmpty()) {
            Surface(
                color = RoeSurface,
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.Schedule, contentDescription = null, tint = RoeWarning, modifier = Modifier.size(32.dp))
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(text = "Aucun tirage ouvert actuellement", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text(text = "Veuillez patienter ou ouvrir un tirage depuis le panneau d'administration.", color = RoeTextMuted, fontSize = 11.sp, textAlign = TextAlign.Center)
                }
            }
        } else {
            // Sélecteur de Tirage
            Text(text = "CHOISIR LA LOTERIE :", color = RoeTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(4.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                openDraws.forEachIndexed { index, draw ->
                    val isSelected = index == selectedDrawIndex
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (isSelected) RoeGold else RoeSurface)
                            .border(1.dp, if (isSelected) RoeGold else RoeBorder, RoundedCornerShape(12.dp))
                            .clickable { selectedDrawIndex = index }
                            .padding(vertical = 8.dp, horizontal = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = draw.game.name,
                                color = if (isSelected) RoeBackground else Color.White,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Black
                            )
                            Text(
                                text = "N° ${draw.drawNumber}",
                                color = if (isSelected) RoeBackground.copy(alpha = 0.8f) else RoeGold,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Formulaire d'ajout de ligne de jeu
        Surface(
            color = RoeSurface,
            shape = RoundedCornerShape(16.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Champ Numéro
                    OutlinedTextField(
                        value = numberInput,
                        onValueChange = { if (it.length <= 4 && it.all { c -> c.isDigit() }) numberInput = it },
                        label = { Text("Numéro (ex: 24)", fontSize = 11.sp) },
                        placeholder = { Text("00-99", fontSize = 12.sp) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = RoeGold,
                            unfocusedBorderColor = RoeBorder,
                            focusedLabelColor = RoeGold,
                            unfocusedLabelColor = RoeTextMuted
                        ),
                        modifier = Modifier.weight(1f)
                    )

                    // Champ Mise (HTG)
                    OutlinedTextField(
                        value = amountInput,
                        onValueChange = { if (it.all { c -> c.isDigit() }) amountInput = it },
                        label = { Text("Mise (HTG)", fontSize = 11.sp) },
                        placeholder = { Text("25", fontSize = 12.sp) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = RoeGold,
                            unfocusedTextColor = RoeGold,
                            focusedBorderColor = RoeGold,
                            unfocusedBorderColor = RoeBorder,
                            focusedLabelColor = RoeGold,
                            unfocusedLabelColor = RoeTextMuted
                        ),
                        modifier = Modifier.weight(1f)
                    )

                    // Bouton Ajouter (+)
                    Button(
                        onClick = {
                            val num = numberInput.trim()
                            val amt = amountInput.toDoubleOrNull() ?: 0.0
                            if (num.isNotEmpty() && amt > 0) {
                                grids.add(BetGrid(numbers = listOf(num), betAmount = amt, multiplier = 1))
                                numberInput = ""
                            }
                        },
                        enabled = numberInput.isNotBlank() && (amountInput.toDoubleOrNull() ?: 0.0) > 0,
                        colors = ButtonDefaults.buttonColors(containerColor = RoeGold),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.height(54.dp).padding(top = 6.dp)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = "Ajouter", tint = RoeBackground)
                    }
                }

                // Boutons raccourcis de mise
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    listOf("10", "25", "50", "100", "250").forEach { quickAmt ->
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (amountInput == quickAmt) RoeCardHover else RoeCard)
                                .border(1.dp, if (amountInput == quickAmt) RoeGold else RoeBorder, RoundedCornerShape(8.dp))
                            .clickable { amountInput = quickAmt }
                            .padding(vertical = 4.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = "$quickAmt G", color = if (amountInput == quickAmt) RoeGold else RoeTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Liste des grilles du ticket
        Text(
            text = "GRILLES SÉLECTIONNÉES (${grids.size}) :",
            color = RoeTextMuted,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(4.dp))

        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(RoeSurface)
                .border(1.dp, RoeBorder, RoundedCornerShape(14.dp))
                .padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            if (grids.isEmpty()) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                        Text(text = "Aucun numéro dans le ticket. Ajoutez au moins une mise ci-dessus.", color = RoeTextMuted, fontSize = 12.sp, textAlign = TextAlign.Center)
                    }
                }
            } else {
                itemsIndexed(grids) { index, grid ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(RoeCard)
                            .border(1.dp, RoeBorder, RoundedCornerShape(10.dp))
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Box(
                                modifier = Modifier
                                    .size(32.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(RoePurpleDark),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = grid.numbers.joinToString("-"),
                                    color = RoeGold,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Black,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                            Text(text = "Bolet Simple", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                        }

                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                text = "${String.format("%.2f", grid.betAmount)} G",
                                color = RoeGold,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Black,
                                fontFamily = FontFamily.Monospace
                            )
                            IconButton(
                                onClick = { grids.removeAt(index) },
                                modifier = Modifier.size(28.dp)
                            ) {
                                Icon(Icons.Default.Delete, contentDescription = "Supprimer", tint = RoeDanger, modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }
            }
        }

        if (errorMessage != null) {
            Spacer(modifier = Modifier.height(8.dp))
            Surface(
                color = RoeDanger.copy(alpha = 0.15f),
                border = androidx.compose.foundation.BorderStroke(1.dp, RoeDanger),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = errorMessage,
                    color = RoeDanger,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(10.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Barre d'Action & Validation Vente
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(RoeSurface)
                .border(1.dp, RoeBorder, RoundedCornerShape(16.dp))
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(text = "TOTAL À PAYER", color = RoeTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                Text(
                    text = "${String.format("%.2f", totalAmount)} G",
                    color = RoeGold,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace
                )
            }

            Button(
                onClick = {
                    if (currentDraw != null && grids.isNotEmpty()) {
                        onSubmitTicket(currentDraw.id, currentDraw.game.id, grids.toList())
                    }
                },
                enabled = currentDraw != null && grids.isNotEmpty() && !isSubmitting,
                colors = ButtonDefaults.buttonColors(containerColor = RoeGold),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.height(48.dp)
            ) {
                if (isSubmitting) {
                    CircularProgressIndicator(color = RoeBackground, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                } else {
                    Icon(Icons.Default.Print, contentDescription = null, tint = RoeBackground)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(text = "VALIDER & ÉMETTRE", color = RoeBackground, fontSize = 13.sp, fontWeight = FontWeight.Black)
                }
            }
        }
    }

    // Modal Reçu Ticket Vendu
    if (soldTicketResult != null) {
        AlertDialog(
            onDismissRequest = onDismissReceipt,
            containerColor = RoeSurface,
            title = {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = RoeSuccess)
                    Text(text = "TICKET ÉMIS AVEC SUCCÈS", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Black)
                }
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(RoeCard)
                        .border(1.dp, RoeBorder, RoundedCornerShape(12.dp))
                        .padding(14.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(text = "ROE BOLET OFFICIEL", color = RoeGold, fontWeight = FontWeight.Black, fontSize = 15.sp)
                    Text(text = soldTicketResult.ticketNumber, color = Color.White, fontWeight = FontWeight.Black, fontSize = 16.sp, fontFamily = FontFamily.Monospace)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = "Montant : ${String.format("%.2f", soldTicketResult.totalAmount)} G", color = RoeGold, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text(text = "Sceau SHA-256 : ${soldTicketResult.secureChecksum.take(16)}...", color = RoeTextMuted, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = "Ticket imprimé et enregistré sur le serveur centralisé.", color = RoeTextMuted, fontSize = 11.sp, textAlign = TextAlign.Center)
                }
            },
            confirmButton = {
                Button(
                    onClick = onDismissReceipt,
                    colors = ButtonDefaults.buttonColors(containerColor = RoeGold),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text("NOUVEAU TICKET", color = RoeBackground, fontWeight = FontWeight.Black)
                }
            }
        )
    }
}
