package com.roebolet.vendor.ui.reports

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Refresh
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
import com.roebolet.vendor.data.api.SalesReportResponse
import com.roebolet.vendor.ui.theme.*
import com.roebolet.vendor.util.AppLanguage
import com.roebolet.vendor.util.Strings

@Composable
fun SalesReportScreen(
    report: SalesReportResponse?,
    isLoading: Boolean,
    errorMessage: String?,
    selectedPeriod: String,
    currentLanguage: AppLanguage = AppLanguage.CREOLE,
    vendorCode: String = "",
    vendorName: String = "",
    onPeriodChange: (String) -> Unit,
    onRefreshClick: () -> Unit,
    onBackClick: () -> Unit
) {
    val isCreole = currentLanguage == AppLanguage.CREOLE

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
                    text = if (vendorName.isNotEmpty()) "$vendorCode - $vendorName" else vendorCode,
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

        Spacer(modifier = Modifier.height(14.dp))

        // Sélecteur de période : JOUR | SEMAINE | MOIS
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
                val periods = listOf(
                    "day" to Strings.t("today", currentLanguage),
                    "week" to Strings.t("this_week", currentLanguage),
                    "month" to Strings.t("this_month", currentLanguage)
                )

                periods.forEach { (key, label) ->
                    val isSelected = selectedPeriod == key
                    Button(
                        onClick = { onPeriodChange(key) },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isSelected) RoeGold else Color.Transparent
                        ),
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(vertical = 8.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            text = label,
                            color = if (isSelected) Color.Black else RoeTextMuted,
                            fontSize = 12.sp,
                            fontWeight = if (isSelected) FontWeight.Black else FontWeight.Bold
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

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
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = RoeGold, strokeWidth = 2.dp)
            }
        } else if (report != null) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // 1. CARTE RÉSUMÉ GLOBAL
                item {
                    Surface(
                        color = RoeSurface,
                        shape = RoundedCornerShape(14.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = Strings.t("global_summary", currentLanguage),
                                    color = RoeGold,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Black,
                                    letterSpacing = 1.sp
                                )
                                Text(
                                    text = "${report.startDate.take(10)} → ${report.endDate.take(10)}",
                                    color = RoeTextMuted,
                                    fontSize = 10.sp
                                )
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            // Grand Chiffre Total Vente
                            Surface(
                                color = Color(0xFF1E2433),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier.padding(12.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text(
                                        text = Strings.t("total_sold_amount", currentLanguage),
                                        color = RoeTextMuted,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = "${String.format("%.2f", report.global.totalSales)} HTG",
                                        color = RoeGold,
                                        fontSize = 24.sp,
                                        fontWeight = FontWeight.Black,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            // Grille 2x2 des Métriques
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                // Tickets vendus
                                Surface(
                                    color = Color(0xFF1E2433),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Column(modifier = Modifier.padding(8.dp)) {
                                        Text(text = Strings.t("tickets_sold", currentLanguage), color = RoeTextMuted, fontSize = 10.sp)
                                        Text(
                                            text = "${report.global.ticketsCount}",
                                            color = Color.White,
                                            fontSize = 16.sp,
                                            fontWeight = FontWeight.Black
                                        )
                                    }
                                }

                                // Tickets gagnants
                                Surface(
                                    color = Color(0xFF1E2433),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Column(modifier = Modifier.padding(8.dp)) {
                                        Text(text = Strings.t("winning_tickets", currentLanguage), color = RoeTextMuted, fontSize = 10.sp)
                                        Text(
                                            text = "${report.global.winningTicketsCount} (${String.format("%.0f", report.global.totalWonAmount)}G)",
                                            color = RoeGold,
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Black
                                        )
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(6.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                // Lots payés
                                Surface(
                                    color = Color(0xFF1E2433),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Column(modifier = Modifier.padding(8.dp)) {
                                        Text(text = Strings.t("prizes_paid", currentLanguage), color = RoeTextMuted, fontSize = 10.sp)
                                        Text(
                                            text = "${String.format("%.2f", report.global.prizesPaid)} G",
                                            color = RoeDanger,
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Black
                                        )
                                    }
                                }

                                // Vente Nette
                                Surface(
                                    color = Color(0xFF1E2433),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Column(modifier = Modifier.padding(8.dp)) {
                                        Text(text = Strings.t("net_sales", currentLanguage), color = RoeTextMuted, fontSize = 10.sp)
                                        Text(
                                            text = "${String.format("%.2f", report.global.netRevenue)} G",
                                            color = RoeSuccess,
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Black
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // 2. SECTIONS VENTES PAR TIRAGE
                item {
                    Text(
                        text = Strings.t("sales_by_draw", currentLanguage),
                        color = RoeGold,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 1.sp,
                        modifier = Modifier.padding(vertical = 4.dp)
                    )
                }

                if (report.byDraw.isEmpty()) {
                    item {
                        Surface(
                            color = RoeSurface,
                            shape = RoundedCornerShape(12.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = if (isCreole) "Pa gen okenn vant nan peryòd sa a." else "Aucune vente enregistrée pour cette période.",
                                color = RoeTextMuted,
                                fontSize = 12.sp,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.padding(20.dp)
                            )
                        }
                    }
                } else {
                    items(report.byDraw) { drawItem ->
                        Surface(
                            color = RoeSurface,
                            shape = RoundedCornerShape(12.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = drawItem.gameName,
                                        color = Color.White,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "Tiraj N° ${drawItem.drawNumber} • ${drawItem.ticketsCount} fich",
                                        color = RoeTextMuted,
                                        fontSize = 11.sp
                                    )
                                    if (drawItem.winningTicketsCount > 0) {
                                        Text(
                                            text = "${drawItem.winningTicketsCount} gagnant(s) (${String.format("%.2f", drawItem.wonAmount)} G)",
                                            color = RoeGold,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }

                                Text(
                                    text = "${String.format("%.2f", drawItem.totalSales)} HTG",
                                    color = RoeGold,
                                    fontSize = 15.sp,
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
