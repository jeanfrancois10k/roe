package com.roebolet.vendor.ui.balance

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Security
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
import com.roebolet.vendor.ui.theme.*
import com.roebolet.vendor.util.AppLanguage

@Composable
fun BalanceScreen(
    vendorCode: String,
    vendorName: String,
    balance: Double,
    currentLanguage: AppLanguage = AppLanguage.CREOLE,
    onBackClick: () -> Unit
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

            Box(modifier = Modifier.size(40.dp))
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Grande Carte Solde
        Surface(
            color = RoeSurface,
            shape = RoundedCornerShape(20.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, RoeBorder),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    imageVector = Icons.Default.AccountBalanceWallet,
                    contentDescription = null,
                    tint = RoeGold,
                    modifier = Modifier.size(40.dp)
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = if (isHt) "SÒLD KI DISPONIB" else "SOLDE DISPONIBLE",
                    color = RoeTextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.5.sp
                )

                Text(
                    text = "${String.format("%.2f", Math.abs(balance))} HTG",
                    color = RoeGold,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace
                )

                Spacer(modifier = Modifier.height(14.dp))

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

        Spacer(modifier = Modifier.height(16.dp))

        // Informations du Point de Vente
        Text(
            text = if (isHt) "ENFÒMASYON SOU PWEN VANT LA :" else "INFORMATIONS POINT DE VENTE :",
            color = RoeTextMuted,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))

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
                InfoRow(label = if (isHt) "Komisyon sou Vant" else "Commission Vente", value = "Standard (5.0%)")
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

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
