package com.roebolet.vendor.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import com.roebolet.vendor.util.AppLanguage

@Composable
fun DashboardScreen(
    vendorCode: String,
    vendorName: String,
    balance: Double,
    isOnline: Boolean,
    pendingSyncCount: Int = 0,
    currentLanguage: AppLanguage = AppLanguage.CREOLE,
    onLanguageChange: (AppLanguage) -> Unit = {},
    onMenuClick: (String) -> Unit,
    onLogoutClick: () -> Unit
) {
    val isHt = currentLanguage == AppLanguage.CREOLE

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
                                text = if (isHt) "$pendingSyncCount an pant" else "$pendingSyncCount en attente",
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

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                // Ventes Totales & Bouton Contrôle
                Surface(
                    color = RoeCard,
                    shape = RoundedCornerShape(10.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                    modifier = Modifier.clickable { onMenuClick("CONTROL") }
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                text = if (isHt) "VANT YO" else "VENTES",
                                color = RoeTextMuted,
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )
                            Text(
                                text = "${String.format("%.2f", Math.abs(balance))} G",
                                color = RoeGold,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Black,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                        Surface(
                            color = RoeGold,
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                text = if (isHt) "KONTWÒL" else "CONTRÔLE",
                                color = RoeBackground,
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Black,
                                modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                            )
                        }
                    }
                }

                // Bouton Changement Rapide de Langue (HT / FR)
                Surface(
                    color = RoeCard,
                    shape = RoundedCornerShape(10.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
                    modifier = Modifier.clickable {
                        val next = if (isHt) AppLanguage.FRENCH else AppLanguage.CREOLE
                        onLanguageChange(next)
                    }
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 7.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = if (isHt) "🇭🇹 HT" else "🇫🇷 FR",
                            color = RoeGold,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Black
                        )
                    }
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
                        contentDescription = if (isHt) "Fèmen Sesyon" else "Verrouiller",
                        tint = RoeTextMuted,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Zone de Contenu Défilable (Compatible Écran Court / MobiIoT & Grand Écran)
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(bottom = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // GROS BOUTON PRINCIPAL : VENTE
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(68.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(RoeGold)
                    .clickable { onMenuClick("SELL") }
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
                            modifier = Modifier.size(30.dp)
                        )
                        Column {
                            Text(
                                text = if (isHt) "NOUVO VANT" else "NOUVELLE VENTE",
                                color = RoeBackground,
                                fontSize = 19.sp,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 1.sp
                            )
                            Text(
                                text = if (isHt) "Fè yon fich bòlèt" else "Émettre un ticket de bolet",
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

            // Grille des 8 boutons (avec PEYE FICH au lieu du doublon FICH YO)
            val menuItems = listOf(
                MenuItem(if (isHt) "PEYE FICH" else "PAYER TICKET", Icons.Default.Payments, RoeGold, "PAY_TICKET"),
                MenuItem(if (isHt) "ISTORIK" else "HISTORIQUE", Icons.Default.History, Color.White, "HISTORY"),
                MenuItem(if (isHt) "REZILTA" else "RÉSULTATS", Icons.Default.EmojiEvents, RoeGold, "RESULTS"),
                MenuItem(if (isHt) "RAPÒ VANT" else "RAPPORTS", Icons.Default.DateRange, RoeGold, "REPORTS"),
                MenuItem(if (isHt) "KONTWÒL" else "CONTRÔLE", Icons.Default.PointOfSale, RoeGold, "CONTROL"),
                MenuItem(if (isHt) "VERIFYE FICH" else "VÉRIFIER TICKET", Icons.Default.QrCodeScanner, RoePurple, "VERIFY_TICKET"),
                MenuItem(if (isHt) "SENKWO" else "SYNCHRO", Icons.Default.Sync, RoeTextMuted, "SYNC"),
                MenuItem(if (isHt) "PARAMÈT" else "PARAMÈTRES", Icons.Default.Settings, RoeTextMuted, "SETTINGS"),
            )

            // Ligne 1 : Payer Ticket + Historique
            Row(modifier = Modifier.fillMaxWidth().height(80.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                DashboardItem(menuItems[0], modifier = Modifier.weight(1f)) { onMenuClick(it) }
                DashboardItem(menuItems[1], modifier = Modifier.weight(1f)) { onMenuClick(it) }
            }

            // Ligne 2 : Résultats + Rapports de Vente (avec Calendrier)
            Row(modifier = Modifier.fillMaxWidth().height(80.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                DashboardItem(menuItems[2], modifier = Modifier.weight(1f)) { onMenuClick(it) }
                DashboardItem(menuItems[3], modifier = Modifier.weight(1f)) { onMenuClick(it) }
            }

            // Ligne 3 : Contrôle + Vérifier Ticket
            Row(modifier = Modifier.fillMaxWidth().height(80.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                DashboardItem(menuItems[4], modifier = Modifier.weight(1f)) { onMenuClick(it) }
                DashboardItem(menuItems[5], modifier = Modifier.weight(1f)) { onMenuClick(it) }
            }

            // Ligne 4 : Synchro + Paramètres
            Row(modifier = Modifier.fillMaxWidth().height(80.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                DashboardItem(menuItems[6], modifier = Modifier.weight(1f)) { onMenuClick(it) }
                DashboardItem(menuItems[7], modifier = Modifier.weight(1f)) { onMenuClick(it) }
            }
        }
    }
}

data class MenuItem(
    val title: String,
    val icon: ImageVector,
    val accentColor: Color,
    val actionId: String = ""
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
            .clickable { onClick(if (item.actionId.isNotEmpty()) item.actionId else item.title) }
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
