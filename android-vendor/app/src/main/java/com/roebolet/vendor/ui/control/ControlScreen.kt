package com.roebolet.vendor.ui.control

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
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
import com.roebolet.vendor.ui.theme.*

@Composable
fun ControlScreen(
    vendorCode: String,
    vendorName: String,
    controlSummary: ControlSummaryResponse?,
    isLoading: Boolean,
    errorMessage: String?,
    onRefreshClick: () -> Unit,
    onBackClick: () -> Unit
) {
    val context = LocalContext.current
    val scrollState = rememberScrollState()

    val totalSales = controlSummary?.totalSales ?: 0.0
    val ticketsCount = controlSummary?.ticketsCount ?: 0
    val commissionRate = controlSummary?.commissionRate ?: 8.0
    val commissionAmount = controlSummary?.commissionAmount ?: 0.0
    val prizesPaid = controlSummary?.prizesPaid ?: 0.0
    val prizesPaidCount = controlSummary?.prizesPaidCount ?: 0
    val netDueToOwner = controlSummary?.netDueToOwner ?: (totalSales - commissionAmount - prizesPaid)
    val cashInHand = controlSummary?.cashInHand ?: (totalSales - prizesPaid)
    val currency = controlSummary?.currency ?: "HTG"
    val dateStr = controlSummary?.date ?: "Jodi a"

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
                    contentDescription = "Retour",
                    tint = Color.White
                )
            }

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "KONTWÒL / CONTRÔLE",
                    color = RoeGold,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp
                )
                Text(
                    text = "Règleman ak Bòs Bank la",
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

        // Badge Vendeur & Date
        Surface(
            color = RoeSurface,
            shape = RoundedCornerShape(14.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "$vendorCode — $vendorName",
                        color = Color.White,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Dat règleman : $dateStr",
                        color = RoeTextMuted,
                        fontSize = 11.sp
                    )
                }
                Surface(
                    color = RoeGold.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, RoeGold.copy(alpha = 0.4f))
                ) {
                    Text(
                        text = "BOLET EN DIRECT",
                        color = RoeGold,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = RoeGold)
            }
        } else if (errorMessage != null) {
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
                    Text(text = "Erreur de chargement", color = RoeDanger, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(text = errorMessage, color = Color.White, fontSize = 12.sp, textAlign = TextAlign.Center)
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = onRefreshClick,
                        colors = ButtonDefaults.buttonColors(containerColor = RoeDanger)
                    ) {
                        Text("Recommencer", color = Color.White, fontWeight = FontWeight.Bold)
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
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Box(
                                modifier = Modifier
                                    .size(42.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(RoeGold.copy(alpha = 0.15f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.ShoppingCart, contentDescription = null, tint = RoeGold, modifier = Modifier.size(24.dp))
                            }
                            Column {
                                Text("TOTAL VANT (VENTES BRUTES)", color = RoeTextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                Text("$ticketsCount fich vann jodi a", color = Color.White.copy(alpha = 0.7f), fontSize = 11.sp)
                            }
                        }
                        Text(
                            text = "${String.format("%.2f", totalSales)} $currency",
                            color = Color.White,
                            fontSize = 17.sp,
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
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Box(
                                modifier = Modifier
                                    .size(42.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(RoeGold.copy(alpha = 0.15f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.Percent, contentDescription = null, tint = RoeGold, modifier = Modifier.size(24.dp))
                            }
                            Column {
                                Text("KOMISYON PA W (VENDEUR)", color = RoeGold, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                Text("Taux fixé à ${String.format("%.1f", commissionRate)}%", color = RoeTextMuted, fontSize = 11.sp)
                            }
                        }
                        Text(
                            text = "+ ${String.format("%.2f", commissionAmount)} $currency",
                            color = RoeGold,
                            fontSize = 17.sp,
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
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Box(
                                modifier = Modifier
                                    .size(42.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(RoeDanger.copy(alpha = 0.15f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = RoeDanger, modifier = Modifier.size(24.dp))
                            }
                            Column {
                                Text("PRIM PEYE (LOTS GAGNANTS)", color = RoeDanger, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                Text("$prizesPaidCount fich gayan peye", color = RoeTextMuted, fontSize = 11.sp)
                            }
                        }
                        Text(
                            text = "- ${String.format("%.2f", prizesPaid)} $currency",
                            color = RoeDanger,
                            fontSize = 17.sp,
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
                        modifier = Modifier.padding(18.dp),
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
                            modifier = Modifier.padding(top = 2.dp, bottom = 8.dp)
                        )
                        Text(
                            text = "${String.format("%.2f", Math.max(0.0, netDueToOwner))} $currency",
                            color = RoeSuccess,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Black,
                            fontFamily = FontFamily.Monospace
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Se kantite lajan sa a ou dwe depoze nan men bòs bank lan pou jounen an.",
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
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Boutons d'Action : Imprimer Reçu Contrôle
            Button(
                onClick = {
                    val printMsg = """
                        --- ROE BOLET KONTWÒL ---
                        Vandè : $vendorCode ($vendorName)
                        Dat   : $dateStr
                        -------------------------
                        Vant Brite  : ${String.format("%.2f", totalSales)} $currency ($ticketsCount fich)
                        Komisyon (${String.format("%.1f", commissionRate)}%): ${String.format("%.2f", commissionAmount)} $currency
                        Prim Peye   : ${String.format("%.2f", prizesPaid)} $currency ($prizesPaidCount fich)
                        -------------------------
                        POU REMÈT   : ${String.format("%.2f", Math.max(0.0, netDueToOwner))} $currency
                        Kach En Caisse: ${String.format("%.2f", Math.max(0.0, cashInHand))} $currency
                        =========================
                    """.trimIndent()
                    Toast.makeText(context, "🖨️ Reçu de Contrôle Prêt à Imprimer", Toast.LENGTH_LONG).show()
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                colors = ButtonDefaults.buttonColors(containerColor = RoeGold),
                shape = RoundedCornerShape(14.dp)
            ) {
                Icon(Icons.Default.Print, contentDescription = null, tint = RoeBackground, modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "ENPRIME RAPÒ KONTWÒL SA",
                    color = RoeBackground,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black
                )
            }
        }
    }
}
