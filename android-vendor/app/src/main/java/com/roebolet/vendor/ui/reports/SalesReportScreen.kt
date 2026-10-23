package com.roebolet.vendor.ui.reports

import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.roebolet.vendor.data.api.SalesReportResponse
import com.roebolet.vendor.data.api.WinningTicketReportItem
import com.roebolet.vendor.ui.theme.*
import com.roebolet.vendor.util.AppLanguage
import com.roebolet.vendor.util.LotteryLogoView
import com.roebolet.vendor.util.Strings
import com.roebolet.vendor.util.ThermalPrinterService
import com.roebolet.vendor.util.TicketReceiptUtil
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun SalesReportScreen(
    report: SalesReportResponse?,
    isLoading: Boolean,
    errorMessage: String?,
    selectedPeriod: String,
    currentLanguage: AppLanguage = AppLanguage.CREOLE,
    vendorCode: String = "",
    vendorName: String = "",
    lotteryLogoUrl: String? = null,
    lotteryName: String = "ROE BOLET",
    onFilterChange: (period: String, startDate: String?, endDate: String?, drawId: String?) -> Unit = { _, _, _, _ -> },
    onPeriodChange: (String) -> Unit,
    onRefreshClick: () -> Unit,
    onBackClick: () -> Unit
) {
    val isCreole = currentLanguage == AppLanguage.CREOLE
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var isPrintingThermal by remember { mutableStateOf(false) }
    val clipboardManager = LocalClipboardManager.current

    // Onglets : 0 = Rapo Vant & Balans (Photo 2), 1 = Fich Gayan (Photo 1)
    var selectedReportTab by remember { mutableStateOf(0) }

    // Dialog Plage de dates personnalisée
    var showDateRangeDialog by remember { mutableStateOf(false) }

    val todayStr = remember { SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date()) }
    var customStartDate by remember { mutableStateOf(report?.startDate?.take(10) ?: todayStr) }
    var customEndDate by remember { mutableStateOf(report?.endDate?.take(10) ?: todayStr) }

    // Dialog Aperçu et Impression Thermique
    var showThermalPrintDialog by remember { mutableStateOf(false) }
    var printContentText by remember { mutableStateOf("") }
    var printTitleText by remember { mutableStateOf("") }

    val effectiveLotteryName = report?.lottery?.name?.takeIf { it.isNotBlank() && it != "TOTAL CENTER LOTO" } ?: lotteryName
    val effectiveLogo = report?.lottery?.logoUrl ?: lotteryLogoUrl
    val effectiveVendorCode = if (vendorCode.isNotEmpty()) vendorCode else (report?.vendor?.code ?: "404")

    val startDisplay = TicketReceiptUtil.formatDateDisplay(report?.startDate ?: customStartDate)
    val endDisplay = TicketReceiptUtil.formatDateDisplay(report?.endDate ?: customEndDate)
    val nowTimeStr = remember { SimpleDateFormat("HH:mm - dd/MM/yyyy", Locale.getDefault()).format(Date()) }

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
                    text = Strings.t("sales_reports", currentLanguage),
                    color = RoeGold,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp
                )
                Text(
                    text = "Banque : $effectiveVendorCode",
                    color = RoeTextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                IconButton(
                    onClick = { showDateRangeDialog = true },
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(RoeSurface)
                        .border(1.dp, RoeBorder, RoundedCornerShape(12.dp))
                ) {
                    Icon(
                        imageVector = Icons.Default.DateRange,
                        contentDescription = "Calendrier",
                        tint = RoeGold
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
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Barre d'onglets : RAPÒ VANT & BALANS vs FICH GAYAN
        Surface(
            color = RoeSurface,
            shape = RoundedCornerShape(12.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(4.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Button(
                    onClick = { selectedReportTab = 0 },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (selectedReportTab == 0) RoeGold else Color.Transparent
                    ),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(vertical = 8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        Icons.Default.ReceiptLong,
                        contentDescription = null,
                        tint = if (selectedReportTab == 0) Color.Black else RoeTextMuted,
                        modifier = Modifier.size(15.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = if (isCreole) "Vant & Balans" else "Ventes & Balance",
                        color = if (selectedReportTab == 0) Color.Black else RoeTextMuted,
                        fontSize = 11.sp,
                        fontWeight = if (selectedReportTab == 0) FontWeight.Black else FontWeight.Bold
                    )
                }

                Button(
                    onClick = { selectedReportTab = 1 },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (selectedReportTab == 1) RoeGold else Color.Transparent
                    ),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(vertical = 8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        Icons.Default.EmojiEvents,
                        contentDescription = null,
                        tint = if (selectedReportTab == 1) Color.Black else RoeTextMuted,
                        modifier = Modifier.size(15.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = if (isCreole) "Fich Gayan (${report?.global?.nombreFichesGagnantes ?: 0})" else "Tickets Gagnants (${report?.global?.nombreFichesGagnantes ?: 0})",
                        color = if (selectedReportTab == 1) Color.Black else RoeTextMuted,
                        fontSize = 11.sp,
                        fontWeight = if (selectedReportTab == 1) FontWeight.Black else FontWeight.Bold
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // SÉLECTEUR DE PÉRIODE & ENTRE PLUSIEURS DATES
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            val quickPeriods = listOf(
                "day" to if (isCreole) "Jodiya" else "Aujourd'hui",
                "week" to if (isCreole) "Semèn sa" else "Semaine",
                "month" to if (isCreole) "Mwa sa" else "Ce Mois"
            )

            quickPeriods.forEach { (key, label) ->
                val isSelected = selectedPeriod == key
                Surface(
                    color = if (isSelected) RoeGold else RoeSurface,
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, if (isSelected) RoeGold else RoeBorder),
                    modifier = Modifier
                        .weight(1f)
                        .clickable {
                            onFilterChange(key, null, null, null)
                        }
                ) {
                    Text(
                        text = label,
                        color = if (isSelected) Color.Black else RoeTextMuted,
                        fontSize = 11.sp,
                        fontWeight = if (isSelected) FontWeight.Black else FontWeight.Bold,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(vertical = 7.dp)
                    )
                }
            }

            // Bouton Plage de Dates Personnalisée (Entre plusieurs dates)
            val isCustomActive = selectedPeriod == "custom"
            Surface(
                color = if (isCustomActive) RoeGold else RoeSurface,
                shape = RoundedCornerShape(8.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, if (isCustomActive) RoeGold else RoeBorder),
                modifier = Modifier
                    .weight(1.3f)
                    .clickable { showDateRangeDialog = true }
            ) {
                Row(
                    modifier = Modifier.padding(vertical = 7.dp, horizontal = 6.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.DateRange,
                        contentDescription = null,
                        tint = if (isCustomActive) Color.Black else RoeGold,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = if (isCreole) "Chwazi Dat" else "Entre Dates",
                        color = if (isCustomActive) Color.Black else Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1
                    )
                }
            }
        }

        // Bannière Période Active
        Spacer(modifier = Modifier.height(8.dp))
        Surface(
            color = RoeCard,
            shape = RoundedCornerShape(8.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder.copy(alpha = 0.5f)),
            modifier = Modifier
                .fillMaxWidth()
                .clickable { showDateRangeDialog = true }
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.DateRange,
                        contentDescription = "Calendrier",
                        tint = RoeGold,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Rapo du $startDisplay au $endDisplay",
                        color = RoeGold,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
                Text(
                    text = "MAJ: ${nowTimeStr.take(5)}",
                    color = RoeTextMuted,
                    fontSize = 10.sp
                )
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Message d'erreur
        errorMessage?.let {
            Surface(
                color = RoeDanger.copy(alpha = 0.15f),
                border = androidx.compose.foundation.BorderStroke(1.dp, RoeDanger),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp)
            ) {
                Text(
                    text = it,
                    color = RoeDanger,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(10.dp)
                )
            }
        }

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = RoeGold, strokeWidth = 2.dp)
            }
        } else if (report != null) {
            val global = report.global

            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // ONGLET 0 : RAPO VANT & BALANS (Conforme Photo 2)
                if (selectedReportTab == 0) {
                    item {
                        Surface(
                            color = RoeSurface,
                            shape = RoundedCornerShape(14.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                // Entête Fiche Rapo Vant
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text(
                                            text = effectiveLotteryName.uppercase(),
                                            color = Color.White,
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Black
                                        )
                                        Text(
                                            text = "Banque : $effectiveVendorCode",
                                            color = RoeGold,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                    LotteryLogoView(logoUrl = effectiveLogo, modifier = Modifier.size(36.dp))
                                }

                                Spacer(modifier = Modifier.height(8.dp))
                                HorizontalDivider(color = RoeBorder, thickness = 1.dp)
                                Spacer(modifier = Modifier.height(8.dp))

                                // Nombre Fiches Vendues & Gagnantes
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Surface(
                                        color = RoeCard,
                                        shape = RoundedCornerShape(8.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Column(modifier = Modifier.padding(10.dp)) {
                                            Text(text = "Nombre fiches vendues", color = RoeTextMuted, fontSize = 10.sp)
                                            Spacer(modifier = Modifier.height(2.dp))
                                            Text(
                                                text = "${global.nombreFichesVendues}",
                                                color = Color.White,
                                                fontSize = 20.sp,
                                                fontWeight = FontWeight.Black,
                                                fontFamily = FontFamily.Monospace
                                            )
                                        }
                                    }

                                    Surface(
                                        color = RoeCard,
                                        shape = RoundedCornerShape(8.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Column(modifier = Modifier.padding(10.dp)) {
                                            Text(text = "Nombre fiches gagnantes", color = RoeTextMuted, fontSize = 10.sp)
                                            Spacer(modifier = Modifier.height(2.dp))
                                            Text(
                                                text = "${global.nombreFichesGagnantes}",
                                                color = RoeGold,
                                                fontSize = 20.sp,
                                                fontWeight = FontWeight.Black,
                                                fontFamily = FontFamily.Monospace
                                            )
                                        }
                                    }
                                }

                                Spacer(modifier = Modifier.height(10.dp))

                                // VENTES (Total, Cash, Moncash)
                                Surface(
                                    color = RoeCard,
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(modifier = Modifier.padding(12.dp)) {
                                        Text(text = "VANT :", color = RoeGold, fontSize = 11.sp, fontWeight = FontWeight.Black)
                                        Spacer(modifier = Modifier.height(6.dp))
                                        ThermalLine(label = "Total :", value = "${String.format("%.0f", global.ventesTotal)} HTG", isBold = true, valueColor = Color.White)
                                        ThermalLine(label = "Cash :", value = "${String.format("%.0f", global.ventesCash)} HTG", valueColor = Color.White)
                                        ThermalLine(label = "Moncash :", value = "${String.format("%.0f", global.ventesMoncash)} HTG", valueColor = RoeTextMuted)
                                    }
                                }

                                Spacer(modifier = Modifier.height(8.dp))

                                // PAIEMENTS PERTES
                                Surface(
                                    color = RoeCard,
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(modifier = Modifier.padding(12.dp)) {
                                        ThermalLine(
                                            label = "Paiements pet :",
                                            value = "${String.format("%.0f", global.paiementsPertes)} HTG",
                                            isBold = true,
                                            valueColor = if (global.paiementsPertes > 0) RoeDanger else Color.White
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.height(8.dp))

                                // BALANCE CASH (Ventes - Pertes) -> Gain ou Perte
                                Surface(
                                    color = Color(0xFF1E2433),
                                    shape = RoundedCornerShape(10.dp),
                                    border = androidx.compose.foundation.BorderStroke(
                                        1.dp,
                                        if (global.balanceCash >= 0) RoeSuccess.copy(alpha = 0.5f) else RoeDanger.copy(alpha = 0.5f)
                                    ),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(modifier = Modifier.padding(12.dp)) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                text = if (isCreole) "Balans nèt (Gain / Pèt)" else "Balance nette (Gain / Perte)",
                                                color = RoeTextMuted,
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold
                                            )
                                            Surface(
                                                color = if (global.balanceCash >= 0) RoeSuccess.copy(alpha = 0.2f) else RoeDanger.copy(alpha = 0.2f),
                                                shape = RoundedCornerShape(6.dp)
                                            ) {
                                                Text(
                                                    text = if (global.balanceCash >= 0) (if (isCreole) "BENEFIS" else "BÉNÉFICE") else (if (isCreole) "PÈT" else "PERTE"),
                                                    color = if (global.balanceCash >= 0) RoeSuccess else RoeDanger,
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Black,
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }
                                        }
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(
                                            text = "${String.format("%.0f", global.balanceCash)} HTG",
                                            color = if (global.balanceCash >= 0) RoeSuccess else RoeDanger,
                                            fontSize = 20.sp,
                                            fontWeight = FontWeight.Black,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.height(8.dp))

                                // COMMISSION & BALANCE TOTALE
                                Surface(
                                    color = RoeCard,
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(modifier = Modifier.padding(12.dp)) {
                                        ThermalLine(
                                            label = "Commission (${String.format("%.1f", global.commissionRate)}%) :",
                                            value = "${String.format("%.0f", global.commission)} HTG",
                                            valueColor = RoeGold
                                        )
                                        Spacer(modifier = Modifier.height(4.dp))
                                        HorizontalDivider(color = RoeBorder.copy(alpha = 0.5f), thickness = 1.dp)
                                        Spacer(modifier = Modifier.height(4.dp))
                                        ThermalLine(
                                            label = "Balance totale (cash - comm) :",
                                            value = "${String.format("%.0f", global.balanceTotale)} HTG",
                                            isBold = true,
                                            valueColor = RoeGold
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Répartition par tirage
                    if (report.byDraw.isNotEmpty()) {
                        item {
                            Text(
                                text = "Détail Par Tirage",
                                color = RoeGold,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(vertical = 4.dp)
                            )
                        }

                        items(report.byDraw) { drawItem ->
                            Surface(
                                color = RoeSurface,
                                shape = RoundedCornerShape(10.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(10.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text(text = drawItem.gameName, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                        Text(text = "Tirage #${drawItem.drawNumber} • ${drawItem.ticketsCount} fiches", color = RoeTextMuted, fontSize = 10.sp)
                                    }
                                    Text(
                                        text = "${String.format("%.0f", drawItem.totalSales)} HTG",
                                        color = RoeGold,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Black,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                            }
                        }
                    }
                }

                // ONGLET 1 : FICH GAYAN (Tickets Gagnants - Conforme Photo 1)
                if (selectedReportTab == 1) {
                    val winners = report.winningTickets ?: emptyList()

                    item {
                        Surface(
                            color = RoeSurface,
                            shape = RoundedCornerShape(12.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(
                                    text = "Tickets gagnants (tous tirages)",
                                    color = RoeGold,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Black
                                )
                                Text(
                                    text = "Total gains à payer : ${String.format("%.0f", global.totalWonAmount)} HTG (${winners.size} fiches)",
                                    color = RoeTextMuted,
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }

                    if (winners.isEmpty()) {
                        item {
                            Surface(
                                color = RoeSurface,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = if (isCreole) "Pa gen okenn fich gayan pou peryòd sa a." else "Aucun ticket gagnant enregistré pour cette période.",
                                    color = RoeTextMuted,
                                    fontSize = 12.sp,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.padding(24.dp)
                                )
                            }
                        }
                    } else {
                        items(winners) { winTicket ->
                            Surface(
                                color = RoeSurface,
                                shape = RoundedCornerShape(10.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(10.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = winTicket.ticketNumber,
                                            color = Color.White,
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Black,
                                            fontFamily = FontFamily.Monospace
                                        )
                                        Text(
                                            text = winTicket.createdAt.take(16).replace("T", " "),
                                            color = RoeTextMuted,
                                            fontSize = 10.sp,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }

                                    Spacer(modifier = Modifier.height(4.dp))

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Text(
                                                text = "Mise: ${String.format("%.0f", winTicket.totalAmount)} G",
                                                color = RoeTextMuted,
                                                fontSize = 11.sp
                                            )
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text(
                                                text = "Gen: ${String.format("%.0f", winTicket.wonAmount)} G",
                                                color = RoeGold,
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Black
                                            )
                                        }

                                        val isPaid = winTicket.payoutStatus == "P"
                                        Surface(
                                            color = if (isPaid) Color(0xFF1B5E20) else Color(0xFFE65100),
                                            shape = RoundedCornerShape(4.dp)
                                        ) {
                                            Text(
                                                text = if (isPaid) "P (Peyé)" else "NP (Non Peyé)",
                                                color = Color.White,
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
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

            // BOUTON IMPRIMER RAPPORT
            Button(
                onClick = {
                    if (selectedReportTab == 0) {
                        printTitleText = "Rapport Ventes & Balances"
                        printContentText = TicketReceiptUtil.formatThermalSalesReportText(
                            lotteryName = effectiveLotteryName,
                            vendorCode = effectiveVendorCode,
                            startDate = report.startDate,
                            endDate = report.endDate,
                            drawName = "Tous les tirages",
                            global = global
                        )
                    } else {
                        printTitleText = "Rapport Tickets Gagnants"
                        printContentText = TicketReceiptUtil.formatThermalWinningTicketsText(
                            lotteryName = effectiveLotteryName,
                            vendorCode = effectiveVendorCode,
                            drawName = "tous tirages",
                            winningTickets = report.winningTickets ?: emptyList()
                        )
                    }
                    showThermalPrintDialog = true
                },
                colors = ButtonDefaults.buttonColors(containerColor = RoeGold),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
            ) {
                Icon(Icons.Default.Print, contentDescription = null, tint = RoeBackground, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = if (selectedReportTab == 0) "ENPRIME RAPÒ VANT ($startDisplay → $endDisplay)" else "ENPRIME FICH GAYAN YO",
                    color = RoeBackground,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black
                )
            }
        }
    }

    // Helper pour afficher le sélecteur de calendrier natif Android
    val openDatePicker: (String, (String) -> Unit) -> Unit = { initialDateStr, onSelected ->
        val cal = Calendar.getInstance()
        try {
            if (initialDateStr.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))) {
                val parts = initialDateStr.split("-").map { it.toInt() }
                cal.set(parts[0], parts[1] - 1, parts[2])
            }
        } catch (_: Exception) {}

        android.app.DatePickerDialog(
            context,
            { _, year, month, dayOfMonth ->
                val formatted = String.format(Locale.US, "%04d-%02d-%02d", year, month + 1, dayOfMonth)
                onSelected(formatted)
            },
            cal.get(Calendar.YEAR),
            cal.get(Calendar.MONTH),
            cal.get(Calendar.DAY_OF_MONTH)
        ).show()
    }

    // MODAL DIALOG : SÉLECTION DE PLAGE DE DATES (ENTRE PLUSIEURS DATES AVEC CALENDRIER)
    if (showDateRangeDialog) {
        Dialog(onDismissRequest = { showDateRangeDialog = false }) {
            Surface(
                color = RoeSurface,
                shape = RoundedCornerShape(16.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                modifier = Modifier.fillMaxWidth().padding(16.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isCreole) "Chwazi Peryòd Dat" else "Choisir l'Intervalle de Dates",
                            color = Color.White,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Black
                        )
                        Icon(
                            imageVector = Icons.Default.DateRange,
                            contentDescription = null,
                            tint = RoeGold,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    Text(
                        text = if (isCreole) "Klike sou ikòn kalandriye a pou chwazi dat kòmansman ak finisyon" else "Cliquez sur l'icône calendrier pour choisir le début et la fin",
                        color = RoeTextMuted,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(top = 2.dp, bottom = 10.dp)
                    )

                    // Raccourcis rapides
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        val sdfFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
                        val calPresets = Calendar.getInstance()

                        // Aujourd'hui
                        val todayVal = sdfFormat.format(calPresets.time)

                        // Hier
                        calPresets.add(Calendar.DAY_OF_MONTH, -1)
                        val yesterdayVal = sdfFormat.format(calPresets.time)

                        // 7 derniers jours
                        calPresets.time = Date()
                        calPresets.add(Calendar.DAY_OF_MONTH, -6)
                        val last7Val = sdfFormat.format(calPresets.time)

                        listOf(
                            (if (isCreole) "Jodiya" else "Aujourd'hui") to (todayVal to todayVal),
                            (if (isCreole) "Yè" else "Hier") to (yesterdayVal to yesterdayVal),
                            (if (isCreole) "7 jou" else "7 jours") to (last7Val to todayVal)
                        ).forEach { (label, range) ->
                            Surface(
                                color = RoeCard,
                                shape = RoundedCornerShape(6.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable {
                                        customStartDate = range.first
                                        customEndDate = range.second
                                    }
                            ) {
                                Text(
                                    text = label,
                                    color = RoeGold,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.padding(vertical = 4.dp)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    Text(text = "Date de début (YYYY-MM-DD) :", color = RoeGold, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    OutlinedTextField(
                        value = customStartDate,
                        onValueChange = { customStartDate = it },
                        singleLine = true,
                        placeholder = { Text("Ex: 2026-10-16", color = RoeTextMuted) },
                        trailingIcon = {
                            IconButton(onClick = {
                                openDatePicker(customStartDate) { customStartDate = it }
                            }) {
                                Icon(
                                    imageVector = Icons.Default.DateRange,
                                    contentDescription = "Ouvrir calendrier",
                                    tint = RoeGold
                                )
                            }
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = RoeGold,
                            unfocusedBorderColor = RoeBorder
                        ),
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    Text(text = "Date de fin (YYYY-MM-DD) :", color = RoeGold, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    OutlinedTextField(
                        value = customEndDate,
                        onValueChange = { customEndDate = it },
                        singleLine = true,
                        placeholder = { Text("Ex: 2026-10-18", color = RoeTextMuted) },
                        trailingIcon = {
                            IconButton(onClick = {
                                openDatePicker(customEndDate) { customEndDate = it }
                            }) {
                                Icon(
                                    imageVector = Icons.Default.DateRange,
                                    contentDescription = "Ouvrir calendrier",
                                    tint = RoeGold
                                )
                            }
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = RoeGold,
                            unfocusedBorderColor = RoeBorder
                        ),
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = { showDateRangeDialog = false },
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(text = "Annuler", color = RoeTextMuted, fontSize = 11.sp)
                        }

                        Button(
                            onClick = {
                                showDateRangeDialog = false
                                onFilterChange("custom", customStartDate.trim(), customEndDate.trim(), null)
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = RoeGold),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.DateRange, contentDescription = null, tint = RoeBackground, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(text = "Afiche Rapò", color = RoeBackground, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }

    // MODAL DIALOG : APERÇU REÇU THERMIQUE OFFICIEL (CONFORME AUX PHOTOS)
    if (showThermalPrintDialog) {
        Dialog(onDismissRequest = { showThermalPrintDialog = false }) {
            Surface(
                color = Color.White,
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 24.dp)
            ) {
                Column(
                    modifier = Modifier
                        .padding(14.dp)
                        .verticalScroll(rememberScrollState()),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "🖨️ Reçu Thermique",
                            color = Color.Black,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                        IconButton(onClick = { showThermalPrintDialog = false }) {
                            Icon(Icons.Default.Close, contentDescription = "Fermer", tint = Color.Black)
                        }
                    }

                    HorizontalDivider(color = Color.LightGray)
                    Spacer(modifier = Modifier.height(8.dp))

                    // Reçu Blanc Style Papier Thermique
                    Surface(
                        color = Color(0xFFF9F9F9),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFDDDDDD)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = printContentText,
                            color = Color.Black,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            lineHeight = 15.sp,
                            modifier = Modifier.padding(10.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Boutons d'Action (Copier / Partager / Confirmer impression)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = {
                                clipboardManager.setText(AnnotatedString(printContentText))
                                Toast.makeText(context, "Texte du rapport copié !", Toast.LENGTH_SHORT).show()
                            },
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(text = "Copier", color = Color.Black, fontSize = 11.sp)
                        }

                        Button(
                            onClick = {
                                try {
                                    val sendIntent = Intent().apply {
                                        action = Intent.ACTION_SEND
                                        putExtra(Intent.EXTRA_TEXT, printContentText)
                                        type = "text/plain"
                                    }
                                    context.startActivity(Intent.createChooser(sendIntent, "Partager le rapport"))
                                } catch (_: Exception) {
                                    Toast.makeText(context, "Partage impossible", Toast.LENGTH_SHORT).show()
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = RoeGoldDark),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.Share, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(text = "Partager", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }

                        Button(
                            onClick = {
                                if (isPrintingThermal) return@Button
                                isPrintingThermal = true
                                scope.launch {
                                    ThermalPrinterService.printReportReceipt(context, printContentText) { success, msg ->
                                        isPrintingThermal = false
                                        Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
                                        if (success) {
                                            showThermalPrintDialog = false
                                        }
                                    }
                                }
                            },
                            enabled = !isPrintingThermal,
                            colors = ButtonDefaults.buttonColors(containerColor = Color.Black),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            if (isPrintingThermal) {
                                CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(text = "...", color = Color.White, fontSize = 11.sp)
                            } else {
                                Icon(Icons.Default.Print, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(text = "Imprimer", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ThermalLine(
    label: String,
    value: String,
    isBold: Boolean = false,
    valueColor: Color = Color.White
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            color = if (isBold) Color.White else RoeTextMuted,
            fontSize = 11.sp,
            fontWeight = if (isBold) FontWeight.Bold else FontWeight.Normal
        )
        Text(
            text = value,
            color = valueColor,
            fontSize = if (isBold) 13.sp else 12.sp,
            fontWeight = if (isBold) FontWeight.Black else FontWeight.Bold,
            fontFamily = FontFamily.Monospace
        )
    }
}
