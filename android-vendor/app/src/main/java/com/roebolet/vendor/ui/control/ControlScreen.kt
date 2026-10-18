package com.roebolet.vendor.ui.control

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
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.roebolet.vendor.data.api.ControlSummaryResponse
import com.roebolet.vendor.data.api.SalesReportResponse
import com.roebolet.vendor.ui.theme.*
import com.roebolet.vendor.util.AppLanguage
import com.roebolet.vendor.util.Strings

@Composable
fun ControlScreen(
    vendorCode: String,
    vendorName: String,
    controlSummary: ControlSummaryResponse?,
    salesReport: SalesReportResponse? = null,
    selectedPeriod: String = "day",
    isLoading: Boolean,
    errorMessage: String?,
    currentLanguage: AppLanguage = AppLanguage.CREOLE,
    onPeriodChange: (String) -> Unit = {},
    onRefreshClick: () -> Unit,
    onBackClick: () -> Unit
) {
    val context = LocalContext.current
    val scrollState = rememberScrollState()
    val isHt = currentLanguage == AppLanguage.CREOLE

    var selectedTabIndex by remember { mutableStateOf(0) } // 0: Règleman, 1: Vant pa Tiraj

    // Données consolidées (priorité aux données de période si semaine/mois, sinon controlSummary)
    val totalSales = if (selectedPeriod == "day") {
        controlSummary?.totalSales ?: salesReport?.global?.totalSales ?: 0.0
    } else {
        salesReport?.global?.totalSales ?: 0.0
    }

    val ticketsCount = if (selectedPeriod == "day") {
        controlSummary?.ticketsCount ?: salesReport?.global?.ticketsCount ?: 0
    } else {
        salesReport?.global?.ticketsCount ?: 0
    }

    val commissionRate = controlSummary?.commissionRate ?: 8.0
    val commissionAmount = if (selectedPeriod == "day") {
        controlSummary?.commissionAmount ?: (totalSales * (commissionRate / 100.0))
    } else {
        totalSales * (commissionRate / 100.0)
    }

    val prizesPaid = if (selectedPeriod == "day") {
        controlSummary?.prizesPaid ?: salesReport?.global?.prizesPaid ?: 0.0
    } else {
        salesReport?.global?.prizesPaid ?: 0.0
    }

    val prizesPaidCount = controlSummary?.prizesPaidCount ?: salesReport?.global?.winningTicketsCount ?: 0
    val netDueToOwner = totalSales - commissionAmount - prizesPaid
    val cashInHand = totalSales - prizesPaid
    val currency = controlSummary?.currency ?: "HTG"

    val periodLabel = when (selectedPeriod) {
        "week" -> Strings.t("this_week", currentLanguage)
        "month" -> Strings.t("this_month", currentLanguage)
        else -> Strings.t("today", currentLanguage)
    }

    val drawsList = salesReport?.byDraw ?: emptyList()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RoeBackground)
            .padding(14.dp)
    ) {
        // En-tête de navigation
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
                    text = "KONTWÒL & RAPÒ VANT",
                    color = RoeGold,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp
                )
                Text(
                    text = if (isHt) "Règleman ak Bòs Bank la — $periodLabel" else "Règlement & Ventes — $periodLabel",
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

        Spacer(modifier = Modifier.height(10.dp))

        // SÉLECTEUR DE PÉRIODE (JÒDI A / SEMENN SA A / MWA SA A)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(RoeSurface)
                .border(1.dp, RoeBorder, RoundedCornerShape(12.dp))
                .padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            val periods = listOf(
                "day" to Strings.t("today", currentLanguage),
                "week" to Strings.t("this_week", currentLanguage),
                "month" to Strings.t("this_month", currentLanguage)
            )

            periods.forEach { (key, label) ->
                val isSelected = selectedPeriod == key
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (isSelected) RoeGold else Color.Transparent)
                        .clickable { onPeriodChange(key) }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = label,
                        color = if (isSelected) RoeBackground else Color.White,
                        fontSize = 11.sp,
                        fontWeight = if (isSelected) FontWeight.Black else FontWeight.Bold
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // SOUS-ONGLETS : RÈGLEMAN KACH / VANT PA TIRAJ
        TabRow(
            selectedTabIndex = selectedTabIndex,
            containerColor = RoeSurface,
            contentColor = RoeGold,
            indicator = { tabPositions ->
                TabRowDefaults.SecondaryIndicator(
                    modifier = Modifier.tabIndicatorOffset(tabPositions[selectedTabIndex]),
                    color = RoeGold,
                    height = 3.dp
                )
            },
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .border(1.dp, RoeBorder, RoundedCornerShape(10.dp))
        ) {
            Tab(
                selected = selectedTabIndex == 0,
                onClick = { selectedTabIndex = 0 },
                text = {
                    Text(
                        text = if (isHt) "RÈGLEMAN KACH" else "RÈGLEMENT & CAISSE",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (selectedTabIndex == 0) RoeGold else RoeTextMuted
                    )
                }
            )
            Tab(
                selected = selectedTabIndex == 1,
                onClick = { selectedTabIndex = 1 },
                text = {
                    Text(
                        text = "${Strings.t("sales_by_draw", currentLanguage)} (${drawsList.size})",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (selectedTabIndex == 1) RoeGold else RoeTextMuted
                    )
                }
            )
        }

        Spacer(modifier = Modifier.height(10.dp))

        if (isLoading && controlSummary == null && salesReport == null) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = RoeGold)
            }
        } else if (errorMessage != null && controlSummary == null && salesReport == null) {
            Surface(
                color = RoeDanger.copy(alpha = 0.15f),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, RoeDanger),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(text = if (isHt) "Erè nan chajman" else "Erreur de chargement", color = RoeDanger, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(text = errorMessage, color = Color.White, fontSize = 12.sp, textAlign = TextAlign.Center)
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = onRefreshClick,
                        colors = ButtonDefaults.buttonColors(containerColor = RoeDanger)
                    ) {
                        Text(if (isHt) "Rekòmanse" else "Recommencer", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        } else {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(scrollState),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Bannière d'avertissement si une erreur survient lors d'une réactualisation
                if (errorMessage != null) {
                    Surface(
                        color = RoeDanger.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(10.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, RoeDanger),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = errorMessage,
                                color = RoeDanger,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.weight(1f)
                            )
                            IconButton(onClick = onRefreshClick, modifier = Modifier.size(28.dp)) {
                                Icon(Icons.Default.Refresh, contentDescription = "Réessayer", tint = RoeDanger)
                            }
                        }
                    }
                }
                if (selectedTabIndex == 0) {
                    // ==========================================
                    // ONGLET 1 : RÈGLEMAN & CAISSE
                    // ==========================================

                    // 1. VENTES TOTALES (Gross Sales)
                    Surface(
                        color = RoeSurface,
                        shape = RoundedCornerShape(16.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Box(
                                    modifier = Modifier
                                        .size(38.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(RoeGold.copy(alpha = 0.15f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.ShoppingCart, contentDescription = null, tint = RoeGold, modifier = Modifier.size(22.dp))
                                }
                                Column {
                                    Text("TOTAL VANT (VENTES BRUTES)", color = RoeTextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    Text("$ticketsCount fich vann ($periodLabel)", color = Color.White.copy(alpha = 0.7f), fontSize = 11.sp)
                                }
                            }
                            Text(
                                text = "${String.format("%.2f", totalSales)} $currency",
                                color = Color.White,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Black,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }

                    // 2. COMMISSION DU VENDEUR
                    Surface(
                        color = RoeSurface,
                        shape = RoundedCornerShape(16.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Box(
                                    modifier = Modifier
                                        .size(38.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(RoeGold.copy(alpha = 0.15f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.Percent, contentDescription = null, tint = RoeGold, modifier = Modifier.size(22.dp))
                                }
                                Column {
                                    Text("KOMISYON PA W (VENDEUR)", color = RoeGold, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    Text("Taux fixé à ${String.format("%.1f", commissionRate)}%", color = RoeTextMuted, fontSize = 11.sp)
                                }
                            }
                            Text(
                                text = "+ ${String.format("%.2f", commissionAmount)} $currency",
                                color = RoeGold,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Black,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }

                    // 3. LOTS GAGNANTS PAYÉS
                    Surface(
                        color = RoeSurface,
                        shape = RoundedCornerShape(16.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Box(
                                    modifier = Modifier
                                        .size(38.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(RoeDanger.copy(alpha = 0.15f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = RoeDanger, modifier = Modifier.size(22.dp))
                                }
                                Column {
                                    Text("PRIM PEYE (LOTS GAGNANTS)", color = RoeDanger, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    Text("$prizesPaidCount fich gayan peye", color = RoeTextMuted, fontSize = 11.sp)
                                }
                            }
                            Text(
                                text = "- ${String.format("%.2f", prizesPaid)} $currency",
                                color = RoeDanger,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Black,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }

                    // 4. MONTANT NET DÛ AU PROPRIÉTAIRE (HIGHLIGHT PRINCIPAL)
                    Surface(
                        color = RoeCard,
                        shape = RoundedCornerShape(18.dp),
                        border = androidx.compose.foundation.BorderStroke(2.dp, RoeGold),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = "NÈT POU REMÈT BÒS LA (DÛ AU PROPRIÉTAIRE)",
                                color = RoeGold,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 1.sp,
                                textAlign = TextAlign.Center
                            )
                            Text(
                                text = "Fòmil : Vant - Komisyon - Prim Peye",
                                color = RoeTextMuted,
                                fontSize = 10.sp,
                                modifier = Modifier.padding(top = 2.dp, bottom = 6.dp)
                            )
                            Text(
                                text = "${String.format("%.2f", Math.max(0.0, netDueToOwner))} $currency",
                                color = RoeSuccess,
                                fontSize = 26.sp,
                                fontWeight = FontWeight.Black,
                                fontFamily = FontFamily.Monospace
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Se kantite lajan sa a ou dwe depoze nan men bòs bank lan pou $periodLabel.",
                                color = Color.White.copy(alpha = 0.8f),
                                fontSize = 11.sp,
                                textAlign = TextAlign.Center
                            )
                        }
                    }

                    // 5. CAISSE / ENCAISSE PHYSIQUE
                    Surface(
                        color = RoeSurface,
                        shape = RoundedCornerShape(14.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("Total Kach Nan Men W (Twawo)", color = RoeTextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                Text("Vant - Prim Peye (Net + Komisyon w)", color = Color.Gray, fontSize = 10.sp)
                            }
                            Text(
                                text = "${String.format("%.2f", Math.max(0.0, cashInHand))} $currency",
                                color = Color.White,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }
                } else {
                    // ==========================================
                    // ONGLET 2 : VANT PA TIRAJ (SALES BY DRAW)
                    // ==========================================
                    if (drawsList.isEmpty()) {
                        Surface(
                            color = RoeSurface,
                            shape = RoundedCornerShape(14.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                            modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp)
                        ) {
                            Column(
                                modifier = Modifier.padding(20.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    text = if (isHt) "Pa gen okenn vant anrejistre pou peryòd sa a." else "Aucune vente enregistrée pour cette période.",
                                    color = RoeTextMuted,
                                    fontSize = 12.sp,
                                    textAlign = TextAlign.Center
                                )
                            }
                        }
                    } else {
                        drawsList.forEach { drawItem ->
                            val drawPercent = if (totalSales > 0) ((drawItem.totalSales / totalSales) * 100.0) else 0.0

                            Surface(
                                color = RoeSurface,
                                shape = RoundedCornerShape(14.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column {
                                            Text(
                                                text = drawItem.gameName,
                                                color = Color.White,
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Black
                                            )
                                            Text(
                                                text = "Tiraj N° ${drawItem.drawNumber} • ${(drawItem.scheduledAt ?: "").take(16).replace("T", " ")}",
                                                color = RoeTextMuted,
                                                fontSize = 10.sp
                                            )
                                        }

                                        Surface(
                                            color = RoeGold.copy(alpha = 0.15f),
                                            shape = RoundedCornerShape(6.dp)
                                        ) {
                                            Text(
                                                text = "${String.format("%.1f", drawPercent)}%",
                                                color = RoeGold,
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Black,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(8.dp))
                                    HorizontalDivider(color = RoeBorder, thickness = 1.dp)
                                    Spacer(modifier = Modifier.height(8.dp))

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Column {
                                            Text(text = "Fich vann", color = RoeTextMuted, fontSize = 10.sp)
                                            Text(text = "${drawItem.ticketsCount}", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                        }

                                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                            Text(text = "Lots Gagnants", color = RoeTextMuted, fontSize = 10.sp)
                                            Text(
                                                text = "${drawItem.winningTicketsCount} (${String.format("%.2f", drawItem.wonAmount)} G)",
                                                color = if (drawItem.wonAmount > 0) RoeDanger else Color.White,
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }

                                        Column(horizontalAlignment = Alignment.End) {
                                            Text(text = "Vant Brite", color = RoeGold, fontSize = 10.sp)
                                            Text(
                                                text = "${String.format("%.2f", drawItem.totalSales)} G",
                                                color = RoeGold,
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.Black,
                                                fontFamily = FontFamily.Monospace
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Boutons d'Action : Imprimer Reçu Contrôle
            Button(
                onClick = {
                    val drawsSummary = if (drawsList.isNotEmpty()) {
                        "\n--- VANT PA TIRAJ ---\n" + drawsList.joinToString("\n") {
                            "${it.gameName} (N°${it.drawNumber}): ${String.format("%.2f", it.totalSales)} G (${it.ticketsCount} fich)"
                        } + "\n-------------------------"
                    } else ""

                    val printMsg = """
                        --- ROE BOLET KONTWÒL & RAPÒ ---
                        Vandè   : $vendorCode ($vendorName)
                        Peryòd  : $periodLabel
                        --------------------------------
                        Vant Brite  : ${String.format("%.2f", totalSales)} $currency ($ticketsCount fich)
                        Komisyon (${String.format("%.1f", commissionRate)}%): ${String.format("%.2f", commissionAmount)} $currency
                        Prim Peye   : ${String.format("%.2f", prizesPaid)} $currency ($prizesPaidCount fich)
                        --------------------------------
                        POU REMÈT   : ${String.format("%.2f", Math.max(0.0, netDueToOwner))} $currency
                        Kach En Caisse: ${String.format("%.2f", Math.max(0.0, cashInHand))} $currency
                        $drawsSummary
                        ================================
                    """.trimIndent()

                    Toast.makeText(context, "🖨️ Rapò Kontwòl ak Vant pare pou enprime !", Toast.LENGTH_LONG).show()
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                colors = ButtonDefaults.buttonColors(containerColor = RoeGold),
                shape = RoundedCornerShape(12.dp)
            ) {
                Icon(Icons.Default.Print, contentDescription = null, tint = RoeBackground, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "ENPRIME RAPÒ KONTWÒL SA ($periodLabel)",
                    color = RoeBackground,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black
                )
            }
        }
    }
}
