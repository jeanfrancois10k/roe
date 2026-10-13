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

@Composable
fun ResultsScreen(
    results: List<DrawResultItem>,
    isLoading: Boolean,
    onBackClick: () -> Unit,
    onRefreshClick: () -> Unit
) {
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
                    text = "RÉSULTATS OFFICIELS",
                    color = RoeGold,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp
                )
                Text(
                    text = "Tirages certifiés du jour",
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

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = RoeGold, strokeWidth = 2.dp)
            }
        } else if (results.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = RoeGold, modifier = Modifier.size(48.dp))
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = "Aucun tirage proclamé aujourd'hui", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Text(text = "Dès que l'administration proclame les numéros gagnants, ils s'affichent ici instantanément.", color = RoeTextMuted, fontSize = 12.sp, textAlign = TextAlign.Center)
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(results) { res ->
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
                                    Text(text = "Tirage N° ${res.drawNumber}", color = RoeGold, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }

                                Text(
                                    text = res.publishedAt?.take(16)?.replace("T", " ") ?: "Aujourd'hui",
                                    color = RoeTextMuted,
                                    fontSize = 11.sp
                                )
                            }

                            Spacer(modifier = Modifier.height(12.dp))

                            // Les 3 boules gagnantes
                            val first = res.winningResults?.get("firstPrize")?.toString() ?: "--"
                            val second = res.winningResults?.get("secondPrize")?.toString() ?: "--"
                            val third = res.winningResults?.get("thirdPrize")?.toString() ?: "--"

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceEvenly
                            ) {
                                WinningBall(prizeLabel = "1er Lot", number = first, isFirst = true)
                                WinningBall(prizeLabel = "2e Lot", number = second)
                                WinningBall(prizeLabel = "3e Lot", number = third)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun WinningBall(prizeLabel: String, number: String, isFirst: Boolean = false) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = prizeLabel, color = if (isFirst) RoeGold else RoeTextMuted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(4.dp))
        Box(
            modifier = Modifier
                .size(54.dp)
                .clip(CircleShape)
                .background(if (isFirst) RoeGold else RoeCard)
                .border(2.dp, if (isFirst) RoeGoldDark else RoeBorder, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = number,
                color = if (isFirst) RoeBackground else Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace
            )
        }
    }
}
