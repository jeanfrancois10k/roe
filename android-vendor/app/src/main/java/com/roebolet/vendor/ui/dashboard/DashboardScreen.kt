package com.roebolet.vendor.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.roebolet.vendor.ui.theme.*

@Composable
fun DashboardScreen(
    vendorCode: String,
    vendorName: String,
    balance: Double,
    isOnline: Boolean,
    pendingSyncCount: Int = 0,
    onMenuClick: (String) -> Unit,
    onLogoutClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(RoeBackground)
            .padding(14.dp)
    ) {
        // Top Bar : Profil Vendeur & Solde en Direct
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(RoeSurface)
                .border(1.dp, RoeBorder, RoundedCornerShape(16.dp))
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(if (isOnline) RoeSuccess else RoeDanger)
                    )
                    Text(
                        text = vendorCode,
                        color = RoeGold,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                        fontFamily = FontFamily.Monospace
                    )
                    if (pendingSyncCount > 0) {
                        Surface(
                            color = RoeWarning.copy(alpha = 0.2f),
                            border = androidx.compose.foundation.BorderStroke(1.dp, RoeWarning),
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                text = "$pendingSyncCount en attente",
                                color = RoeWarning,
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                            )
                        }
                    }
                }
                Text(
                    text = vendorName,
                    color = Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                // Solde Vendeur
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "SOLDE",
                        color = RoeTextMuted,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = "$${String.format("%.2f", balance)}",
                        color = RoeGold,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Black,
                        fontFamily = FontFamily.Monospace
                    )
                }

                // Bouton Déconnexion
                IconButton(
                    onClick = onLogoutClick,
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(RoeCard)
                        .border(1.dp, RoeBorder, RoundedCornerShape(10.dp))
                ) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = "Verrouiller",
                        tint = RoeTextMuted,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // GROS BOUTON PRINCIPAL : VENTE
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(72.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(RoeGold)
                .clickable { onMenuClick("VENTE") }
                .padding(horizontal = 20.dp),
            contentAlignment = Alignment.CenterStart
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Icon(
                        imageVector = Icons.Default.ShoppingCart,
                        contentDescription = "Vente",
                        tint = RoeBackground,
                        modifier = Modifier.size(32.dp)
                    )
                    Column {
                        Text(
                            text = "NOUVELLE VENTE",
                            color = RoeBackground,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 1.sp
                        )
                        Text(
                            text = "Émettre un ticket de bolet",
                            color = RoeBackground.copy(alpha = 0.75f),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = RoeBackground,
                    modifier = Modifier.size(24.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Grille des 7 autres boutons (Exigés en Section 6)
        val menuItems = listOf(
            MenuItem("VÉRIFIER TICKET", Icons.Default.QrCodeScanner, RoePurple),
            MenuItem("TICKETS", Icons.Default.Receipt, Color.White),
            MenuItem("RÉSULTATS", Icons.Default.EmojiEvents, RoeGold),
            MenuItem("SOLDE", Icons.Default.AccountBalanceWallet, RoeSuccess),
            MenuItem("HISTORIQUE", Icons.Default.History, Color.White),
            MenuItem("SYNCHRO", Icons.Default.Sync, RoeTextMuted),
            MenuItem("PARAMÈTRES", Icons.Default.Settings, RoeTextMuted),
        )

        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // Ligne 1 : Vérifier Ticket + Tickets
            Row(modifier = Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                DashboardItem(menuItems[0], modifier = Modifier.weight(1f)) { onMenuClick(it) }
                DashboardItem(menuItems[1], modifier = Modifier.weight(1f)) { onMenuClick(it) }
            }

            // Ligne 2 : Résultats + Solde
            Row(modifier = Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                DashboardItem(menuItems[2], modifier = Modifier.weight(1f)) { onMenuClick(it) }
                DashboardItem(menuItems[3], modifier = Modifier.weight(1f)) { onMenuClick(it) }
            }

            // Ligne 3 : Historique + Synchro + Paramètres
            Row(modifier = Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                DashboardItem(menuItems[4], modifier = Modifier.weight(1f)) { onMenuClick(it) }
                DashboardItem(menuItems[5], modifier = Modifier.weight(1f)) { onMenuClick(it) }
                DashboardItem(menuItems[6], modifier = Modifier.weight(1f)) { onMenuClick(it) }
            }
        }
    }
}

data class MenuItem(
    val title: String,
    val icon: ImageVector,
    val accentColor: Color
)

@Composable
fun DashboardItem(
    item: MenuItem,
    modifier: Modifier = Modifier,
    onClick: (String) -> Unit
) {
    Box(
        modifier = modifier
            .fillMaxHeight()
            .clip(RoundedCornerShape(16.dp))
            .background(RoeCard)
            .border(1.dp, RoeBorder, RoundedCornerShape(16.dp))
            .clickable { onClick(item.title) }
            .padding(10.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = item.icon,
                contentDescription = item.title,
                tint = item.accentColor,
                modifier = Modifier.size(26.dp)
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = item.title,
                color = Color.White,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp
            )
        }
    }
}
