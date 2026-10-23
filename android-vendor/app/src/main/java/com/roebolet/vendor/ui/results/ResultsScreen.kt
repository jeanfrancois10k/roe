package com.roebolet.vendor.ui.results

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.roebolet.vendor.data.api.DrawResultItem
import com.roebolet.vendor.ui.theme.*
import com.roebolet.vendor.util.AppLanguage
import com.roebolet.vendor.util.DrawPeriodBadge
import com.roebolet.vendor.util.TicketReceiptUtil

@Composable
fun ResultsScreen(
    results: List<DrawResultItem>,
    isLoading: Boolean,
    currentLanguage: AppLanguage = AppLanguage.CREOLE,
    onBackClick: () -> Unit,
    onRefreshClick: () -> Unit
) {
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
                    text = if (isHt) "REZILTA OFISYÈL" else "RÉSULTATS OFFICIELS",
                    color = RoeGold,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp
                )
                Text(
                    text = if (isHt) "Tiraj ofisyèl jodi a" else "Tirages certifiés du jour",
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
                    contentDescription = if (isHt) "Rechaje" else "Actualiser",
                    tint = RoeGold
                )
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = RoeGold, strokeWidth = 2.dp)
            }
        } else if (results.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = RoeGold, modifier = Modifier.size(48.dp))
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = if (isHt) "Poko gen okenn tiraj ki pwoklame jodi a" else "Aucun tirage proclamé aujourd'hui",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    )
                    Text(
                        text = if (isHt)
                            "Kou administrasyon an fin mete rezilta yo, y ap parèt la a touswit."
                        else
                            "Dès que l'administration proclame les numéros gagnants, ils s'affichent ici instantanément.",
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
                items(results) { res ->
                    val period = TicketReceiptUtil.getDrawPeriod(res.gameName, res.salesClosingAt ?: res.scheduledAt ?: res.publishedAt, res.sessionName)

                    Surface(
                        color = RoeSurface,
                        shape = RoundedCornerShape(16.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(text = res.gameName, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Black)
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Text(
                                            text = if (isHt) "Tiraj N° ${res.drawNumber}" else "Tirage N° ${res.drawNumber}",
                                            color = RoeGold,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                        DrawPeriodBadge(period = res.sessionName ?: period)
                                    }
                                }

                                Text(
                                    text = TicketReceiptUtil.formatHaitiDateTime(res.salesClosingAt ?: res.scheduledAt ?: res.publishedAt),
                                    color = RoeTextMuted,
                                    fontSize = 11.sp
                                )
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            // Les 3 boules gagnantes
                            val first = res.winningResults?.get("firstPrize")?.toString() ?: "--"
                            val second = res.winningResults?.get("secondPrize")?.toString() ?: "--"
                            val third = res.winningResults?.get("thirdPrize")?.toString() ?: "--"

                            // Bandeau résumé résultat officiel
                            Surface(
                                color = RoeCard,
                                shape = RoundedCornerShape(10.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 12.dp, vertical = 6.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = if (isHt) "REZILTA BÒLÈT :" else "RÉSULTAT BORLETTE :",
                                        color = RoeTextMuted,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "$first - $second - $third",
                                        color = RoeGold,
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Black,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceEvenly
                            ) {
                                WinningBall(
                                    prizeLabel = if (isHt) "1ye Lo & Lòt 3" else "1er Lot & Lòt 3",
                                    number = first,
                                    subLabel = if (first.length >= 2) (if (isHt) "1ye: ${first.takeLast(2)}" else "1er: ${first.takeLast(2)}") else null,
                                    isFirst = true
                                )
                                WinningBall(
                                    prizeLabel = if (isHt) "2yèm Lo" else "2e Lot",
                                    number = second,
                                    subLabel = null
                                )
                                WinningBall(
                                    prizeLabel = if (isHt) "3yèm Lo" else "3e Lot",
                                    number = third,
                                    subLabel = null
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun WinningBall(
    prizeLabel: String,
    number: String,
    subLabel: String? = null,
    isFirst: Boolean = false
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = prizeLabel,
            color = if (isFirst) RoeGold else RoeTextMuted,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(4.dp))
        Box(
            modifier = Modifier
                .width(if (number.length >= 3) 64.dp else 52.dp)
                .height(52.dp)
                .clip(if (number.length >= 3) RoundedCornerShape(26.dp) else CircleShape)
                .background(if (isFirst) RoeGold else RoeCard)
                .border(
                    2.dp,
                    if (isFirst) RoeGoldDark else RoeBorder,
                    if (number.length >= 3) RoundedCornerShape(26.dp) else CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = number,
                color = if (isFirst) RoeBackground else Color.White,
                fontSize = if (number.length >= 3) 16.sp else 18.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace
            )
        }
        if (subLabel != null) {
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = subLabel,
                color = RoeGold,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace
            )
        } else {
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = "-",
                color = Color.Transparent,
                fontSize = 9.sp
            )
        }
    }
}
