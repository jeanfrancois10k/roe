package com.roebolet.vendor.ui.balance

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.roebolet.vendor.data.api.ControlSummaryResponse
import com.roebolet.vendor.ui.theme.*
import com.roebolet.vendor.util.AppLanguage

@Composable
fun BalanceScreen(
    vendorCode: String,
    vendorName: String,
    balance: Double,
    controlSummary: ControlSummaryResponse? = null,
    isLoading: Boolean = false,
    currentLanguage: AppLanguage = AppLanguage.CREOLE,
    onRefreshClick: () -> Unit = {},
    onBackClick: () -> Unit
) {
    val isHt = currentLanguage == AppLanguage.CREOLE
    val scrollState = rememberScrollState()
    val availableBalance = Math.max(0.0, controlSummary?.currentBalance ?: balance)
    val unpaidPrizes = controlSummary?.unpaidPrizesAmount ?: 0.0
    val unpaidCount = controlSummary?.unpaidPrizesCount ?: 0
    val centralCredits = controlSummary?.centralCreditsAmount ?: 0.0
    val shortfall = controlSummary?.shortfallAmount ?: Math.max(0.0, unpaidPrizes - availableBalance)
    val recentTransactions = controlSummary?.recentTransactions ?: emptyList()

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
                    text = if (isHt) "KONT MWEN & SÒLD" else "COMPTE & SOLDE",
                    color = RoeGold,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp
                )
                Text(
                    text = if (isHt) "Detay finansye vandè a" else "Détail financier du vendeur",
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
                if (isLoading) {
                    CircularProgressIndicator(
                        color = RoeGold,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(18.dp)
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = if (isHt) " Aktyalize" else "Actualiser",
                        tint = RoeGold
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // 1. Grande Carte : SOLDE DISPONIBLE
            Surface(
                color = RoeSurface,
                shape = RoundedCornerShape(20.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(18.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Default.AccountBalanceWallet,
                        contentDescription = null,
                        tint = RoeGold,
                        modifier = Modifier.size(36.dp)
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    Text(
                        text = if (isHt) "SÒLD KI DISPONIB" else "SOLDE DISPONIBLE",
                        color = RoeTextMuted,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.5.sp
                    )

                    Text(
                        text = "${String.format(java.util.Locale.US, "%.2f", availableBalance)} HTG",
                        color = RoeSuccess,
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Black,
                        fontFamily = FontFamily.Monospace
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    Surface(
                        color = RoeSuccess.copy(alpha = 0.15f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, RoeSuccess),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = RoeSuccess, modifier = Modifier.size(14.dp))
                            Text(
                                text = if (isHt) "Kont Vandè Aktif" else "Compte Vendeur Actif",
                                color = RoeSuccess,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            // 2. Cartes distinctes : GAINS À PAYER vs CRÉDITS REÇUS DU CENTRAL
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Carte Gains à payer
                Surface(
                    color = RoeSurface,
                    shape = RoundedCornerShape(16.dp),
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp,
                        if (unpaidPrizes > 0) RoeGold else RoeBorder
                    ),
                    modifier = Modifier.weight(1f)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = if (isHt) "GAINS POU PEYE" else "GAINS À PAYER",
                            color = RoeGold,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "${String.format(java.util.Locale.US, "%.2f", unpaidPrizes)} HTG",
                            color = if (unpaidPrizes > 0) RoeGold else Color.White,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Black,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(
                            text = if (isHt) "$unpaidCount fich gayan an atant" else "$unpaidCount ticket(s) en attente",
                            color = RoeTextMuted,
                            fontSize = 10.sp
                        )
                    }
                }

                // Carte Crédits reçus du Central
                Surface(
                    color = RoeSurface,
                    shape = RoundedCornerShape(16.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                    modifier = Modifier.weight(1f)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = if (isHt) "KREDI SANTRAL LA" else "CRÉDITS CENTRAL",
                            color = Color(0xFF60A5FA),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "${String.format(java.util.Locale.US, "%.2f", centralCredits)} HTG",
                            color = Color(0xFF60A5FA),
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Black,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(
                            text = if (isHt) "Resezi nan men Admin" else "Fonds reçus du Central",
                            color = RoeTextMuted,
                            fontSize = 10.sp
                        )
                    }
                }
            }

            // Alerte si Solde Disponible < Gains à Payer
            if (shortfall > 0) {
                Surface(
                    color = RoeDanger.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(14.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, RoeDanger),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(Icons.Default.Warning, contentDescription = null, tint = RoeDanger, modifier = Modifier.size(22.dp))
                        Column {
                            Text(
                                text = if (isHt)
                                    "Manke ${String.format(java.util.Locale.US, "%.2f", shortfall)} HTG pou peye gayan an"
                                else
                                    "Manque ${String.format(java.util.Locale.US, "%.2f", shortfall)} HTG pour couvrir les gains",
                                color = RoeDanger,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Black
                            )
                            Text(
                                text = if (isHt)
                                    "Kontakte Super Admin nan pou li kredite kont ou ak kouvèti gayan an."
                                else
                                    "Contactez le Super Administrateur pour créditer votre compte (Couverture du gain client).",
                                color = Color.White.copy(alpha = 0.85f),
                                fontSize = 10.sp
                            )
                        }
                    }
                }
            }

            // 3. HISTORIQUE DES TRANSACTIONS RÉCENTES (Crédits Central, Paiements de gains, etc.)
            Text(
                text = if (isHt) "ISTORIK TRANZAKSYON KONT LAN :" else "HISTORIQUE DES TRANSACTIONS :",
                color = RoeTextMuted,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold
            )

            Surface(
                color = RoeSurface,
                shape = RoundedCornerShape(16.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                modifier = Modifier.fillMaxWidth()
            ) {
                if (recentTransactions.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (isHt) "Pa gen tranzaksyon anrejistre ankò." else "Aucune transaction enregistrée.",
                            color = RoeTextMuted,
                            fontSize = 11.sp
                        )
                    }
                } else {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        recentTransactions.take(15).forEachIndexed { idx, tx ->
                            val isPos = tx.amount >= 0
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = tx.description ?: tx.type,
                                        color = Color.White,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "${(tx.createdAt ?: "").take(16).replace("T", " ")} • ${tx.operatorUsername ?: "Système"}",
                                        color = RoeTextMuted,
                                        fontSize = 10.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text(
                                        text = "${if (isPos) "+" else ""}${String.format(java.util.Locale.US, "%.2f", tx.amount)} HTG",
                                        color = if (isPos) RoeSuccess else RoeDanger,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Black,
                                        fontFamily = FontFamily.Monospace
                                    )
                                    Text(
                                        text = "Solde: ${String.format(java.util.Locale.US, "%.2f", tx.balanceAfter)} G",
                                        color = RoeTextMuted,
                                        fontSize = 10.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                            }
                            if (idx < recentTransactions.take(15).size - 1) {
                                HorizontalDivider(color = RoeBorder.copy(alpha = 0.5f))
                            }
                        }
                    }
                }
            }

            // 4. Informations du Point de Vente
            Text(
                text = if (isHt) "ENFÒMASYON SOU PWEN VANT LA :" else "INFORMATIONS POINT DE VENTE :",
                color = RoeTextMuted,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold
            )

            Surface(
                color = RoeSurface,
                shape = RoundedCornerShape(16.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    InfoRow(label = if (isHt) "Kòd Vandè" else "Code Vendeur", value = vendorCode)
                    HorizontalDivider(color = RoeBorder.copy(alpha = 0.5f))
                    InfoRow(label = if (isHt) "Non Vandè a" else "Nom du Titulaire", value = vendorName)
                    HorizontalDivider(color = RoeBorder.copy(alpha = 0.5f))
                    InfoRow(label = if (isHt) "Lajan Itilize" else "Devise d'Exploitation", value = "Goud Ayisyen (HTG)")
                    HorizontalDivider(color = RoeBorder.copy(alpha = 0.5f))
                    InfoRow(
                        label = if (isHt) "Komisyon sou Vant" else "Commission Vente",
                        value = "${String.format(java.util.Locale.US, "%.1f", controlSummary?.commissionRate ?: 5.0)}%"
                    )
                }
            }

            Surface(
                color = RoeCard,
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(Icons.Default.Security, contentDescription = null, tint = RoeGold, modifier = Modifier.size(24.dp))
                    Text(
                        text = if (isHt)
                            "Tout tranzaksyon ak pèman ganyan yo verifye epi sekirize ak siyati kriptografik imiyab."
                        else
                            "Toutes les transactions et paiements de gains sont audités et scellés avec signature cryptographique immuable.",
                        color = RoeTextMuted,
                        fontSize = 11.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = label, color = RoeTextMuted, fontSize = 12.sp)
        Text(text = value, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}
