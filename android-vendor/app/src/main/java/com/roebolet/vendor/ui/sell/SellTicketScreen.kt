package com.roebolet.vendor.ui.sell

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.roebolet.vendor.data.api.BetGrid
import com.roebolet.vendor.data.api.OpenDrawItem
import com.roebolet.vendor.data.api.SellTicketResponse
import com.roebolet.vendor.data.api.VendorTicketItem
import com.roebolet.vendor.data.local.PreferencesManager
import com.roebolet.vendor.ui.theme.*
import com.roebolet.vendor.util.AppLanguage
import com.roebolet.vendor.util.Barcode128View
import com.roebolet.vendor.util.DrawPeriodBadge
import com.roebolet.vendor.util.LotteryLogoView
import com.roebolet.vendor.util.Strings
import com.roebolet.vendor.util.TicketReceiptUtil

data class LineItem(
    val number: String = "",
    val amount: String = "",
    val option: String = "TOUT", // "TOUT", "OP 1", "OP 2", "OP 3", "GRATIS"
    val isGratis: Boolean = false
)

private val TopBarPurple = Color(0xFF6236FF)
private val TabBarPurple = Color(0xFF6236FF)
private val BodyBg = Color(0xFFECEFF1)
private val LineDividerColor = Color(0xFF9E9E9E)
private val PlaceholderColor = Color(0xFF9E9E9E)
private val TextDarkColor = Color(0xFF212121)

@Composable
fun SellTicketScreen(
    openDraws: List<OpenDrawItem>,
    isLoadingDraws: Boolean,
    isSubmitting: Boolean,
    errorMessage: String?,
    soldTicketResults: List<SellTicketResponse>?,
    currentLanguage: AppLanguage = AppLanguage.CREOLE,
    vendorCode: String = "",
    vendorName: String = "",
    deviceUuid: String = "",
    initialTicketToReplay: VendorTicketItem? = null,
    onResetReplay: () -> Unit = {},
    onBackClick: () -> Unit,
    onSubmitTicket: (selectedDraws: List<OpenDrawItem>, grids: List<BetGrid>) -> Unit,
    onDismissReceipt: () -> Unit,
    onSearchTicketByNumber: ((String, (VendorTicketItem?) -> Unit) -> Unit)? = null
) {
    val context = LocalContext.current
    val focusManager = LocalFocusManager.current
    val isCreole = currentLanguage == AppLanguage.CREOLE

    val prefs = remember { PreferencesManager(context) }
    val lotteryName = prefs.getLotteryName()
    val lotterySlogan = prefs.getLotterySlogan()
    val lotteryPhone = prefs.getLotteryPhone()
    val lotteryBankRef = prefs.getLotteryBankRef()
    val lotteryHeaderNote = prefs.getLotteryHeaderNote()
    val lotteryFooterNote = prefs.getLotteryFooterNote()
    val lotteryProvider = prefs.getLotteryProvider()
    val lotteryMariageGratis = prefs.getLotteryMariageGratis()
    val lotteryLogoUrl = prefs.getLotteryLogoUrl()

    // Sélection multi-tirages (1 ou plusieurs tirages en même temps)
    var selectedDrawIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var showDrawPicker by remember { mutableStateOf(false) }
    var showOptionsMenu by remember { mutableStateOf(false) }
    var showPreValidationPreview by remember { mutableStateOf(false) }
    var showSearchCodeDialog by remember { mutableStateOf(false) }
    var searchCodeInput by remember { mutableStateOf("") }
    var isSearchingCode by remember { mutableStateOf(false) }
    var searchCodeError by remember { mutableStateOf<String?>(null) }

    // Initialiser la sélection avec le premier tirage ouvert par défaut
    LaunchedEffect(openDraws) {
        if (selectedDrawIds.isEmpty() && openDraws.isNotEmpty()) {
            selectedDrawIds = setOf(openDraws.first().id)
        }
    }

    // Onglets de jeu : BÒLET, LOTO 3, LOTO 4, LOTO 5, MARYAJ
    val tabs = listOf("BÒLET", "LOTO 3", "LOTO 4", "LOTO 5", "MARYAJ")
    var selectedTabIndex by remember { mutableStateOf(0) }

    // Options par défaut pour Loto 4 et Maryaj
    var defaultLoto4Option by remember { mutableStateOf("TOUT") }
    var defaultMaryajOption by remember { mutableStateOf("TOUT") }

    // 10 lignes de saisie pour chaque type de jeu
    val boletLines = remember { mutableStateListOf(*Array(10) { LineItem() }) }
    val loto3Lines = remember { mutableStateListOf(*Array(10) { LineItem() }) }
    val loto4Lines = remember { mutableStateListOf(*Array(10) { LineItem() }) }
    val loto5Lines = remember { mutableStateListOf(*Array(10) { LineItem() }) }
    val maryajLines = remember { mutableStateListOf(*Array(10) { LineItem() }) }

    // Fonctions d'effacement
    fun clearAllLines() {
        for (i in 0 until 10) {
            boletLines[i] = LineItem()
            loto3Lines[i] = LineItem()
            loto4Lines[i] = LineItem()
            loto5Lines[i] = LineItem()
            maryajLines[i] = LineItem()
        }
    }

    fun loadTicketToEdit(ticket: VendorTicketItem) {
        clearAllLines()
        var bIdx = 0
        var l3Idx = 0
        var l4Idx = 0
        var l5Idx = 0
        var mIdx = 0

        ticket.playedGrids?.forEach { grid ->
            val numStr = grid.numbers.joinToString(if (grid.gameType == "MARIAGE") "x" else "")
            val amtStr = if (grid.isGratis == true) "" else grid.betAmount.toInt().toString()
            val opt = grid.option ?: if (grid.isGratis == true) "GRATIS" else "TOUT"
            val isGratis = grid.isGratis == true

            when (grid.gameType) {
                "BORLETTE", "BOLET" -> {
                    if (bIdx < 10) {
                        boletLines[bIdx] = LineItem(number = numStr, amount = amtStr, option = opt, isGratis = isGratis)
                        bIdx++
                    }
                }
                "LOTO3" -> {
                    if (l3Idx < 10) {
                        loto3Lines[l3Idx] = LineItem(number = numStr, amount = amtStr, option = opt, isGratis = isGratis)
                        l3Idx++
                    }
                }
                "LOTO4" -> {
                    if (l4Idx < 10) {
                        loto4Lines[l4Idx] = LineItem(number = numStr, amount = amtStr, option = opt, isGratis = isGratis)
                        l4Idx++
                    }
                }
                "LOTO5" -> {
                    if (l5Idx < 10) {
                        loto5Lines[l5Idx] = LineItem(number = numStr, amount = amtStr, option = opt, isGratis = isGratis)
                        l5Idx++
                    }
                }
                "MARIAGE", "MARYAJ" -> {
                    if (mIdx < 10) {
                        maryajLines[mIdx] = LineItem(number = numStr, amount = amtStr, option = opt, isGratis = isGratis)
                        mIdx++
                    }
                }
                else -> {
                    if (bIdx < 10) {
                        boletLines[bIdx] = LineItem(number = numStr, amount = amtStr, option = opt, isGratis = isGratis)
                        bIdx++
                    }
                }
            }
        }
    }

    // Gestion du Replay / Modification d'une fiche existante
    LaunchedEffect(initialTicketToReplay) {
        initialTicketToReplay?.let { ticket ->
            loadTicketToEdit(ticket)
            Toast.makeText(
                context,
                if (isCreole) "Fich ${ticket.ticketNumber} chaje pou rejoue. Ou ka modifye l !" else "Ticket ${ticket.ticketNumber} chargé pour rejouer.",
                Toast.LENGTH_SHORT
            ).show()
            onResetReplay()
        }
    }

    // Liste active selon l'onglet courant
    val currentLines = when (selectedTabIndex) {
        0 -> boletLines
        1 -> loto3Lines
        2 -> loto4Lines
        3 -> loto5Lines
        else -> maryajLines
    }

    // Longueur max du numéro selon l'onglet
    val maxDigits = when (selectedTabIndex) {
        0 -> 2 // Bòlet (00-99)
        1 -> 3 // Loto 3 (000-999)
        2 -> 4 // Loto 4
        3 -> 5 // Loto 5
        else -> 5 // Maryaj (ex: "12x34" ou "1234")
    }

    val selectedDraws = openDraws.filter { selectedDrawIds.contains(it.id) }
    val lotteryTitle = when {
        selectedDraws.isEmpty() -> if (isCreole) "Chwazi Tiraj" else "Choisir Tirage"
        selectedDraws.size == 1 -> "${selectedDraws.first().game.name} - Bòlet"
        else -> if (isCreole) "${selectedDraws.size} Tiraj chwazi" else "${selectedDraws.size} Tirages sélectionnés"
    }

    // Calcul du total global sur toutes les grilles saisies
    fun getAllValidGrids(): List<BetGrid> {
        val list = mutableListOf<BetGrid>()

        // 1. BÒLET
        boletLines.forEach { line ->
            val num = line.number.trim()
            val amt = line.amount.toDoubleOrNull() ?: 0.0
            if (num.isNotEmpty() && amt > 0) {
                list.add(BetGrid(numbers = listOf(num), betAmount = amt, multiplier = 1, gameType = "BORLETTE"))
            }
        }

        // 2. LOTO 3
        loto3Lines.forEach { line ->
            val num = line.number.trim()
            val amt = line.amount.toDoubleOrNull() ?: 0.0
            if (num.isNotEmpty() && amt > 0) {
                list.add(BetGrid(numbers = listOf(num), betAmount = amt, multiplier = 1, gameType = "LOTO3"))
            }
        }

        // 3. LOTO 4
        loto4Lines.forEach { line ->
            val num = line.number.trim()
            val amt = line.amount.toDoubleOrNull() ?: 0.0
            if (num.isNotEmpty() && amt > 0) {
                val optClean = when (line.option.uppercase().replace(" ", "")) {
                    "OP1", "OPTION1", "1" -> "OP1"
                    "OP2", "OPTION2", "2" -> "OP2"
                    "OP3", "OPTION3", "3" -> "OP3"
                    else -> "TOUT"
                }
                list.add(BetGrid(numbers = listOf(num), betAmount = amt, multiplier = 1, option = optClean, gameType = "LOTO4"))
            }
        }

        // 4. LOTO 5
        loto5Lines.forEach { line ->
            val num = line.number.trim()
            val amt = line.amount.toDoubleOrNull() ?: 0.0
            if (num.isNotEmpty() && amt > 0) {
                list.add(BetGrid(numbers = listOf(num), betAmount = amt, multiplier = 1, gameType = "LOTO5"))
            }
        }

        // 5. MARYAJ
        maryajLines.forEach { line ->
            val raw = line.number.trim()
            val isGratis = line.isGratis || line.option.uppercase().contains("GRATIS")
            val amt = if (isGratis) 0.0 else (line.amount.toDoubleOrNull() ?: 0.0)

            if (raw.isNotEmpty() && (amt > 0 || isGratis)) {
                val parts = if (raw.contains("x") || raw.contains("X") || raw.contains("-") || raw.contains(" ") || raw.contains("*")) {
                    raw.split(Regex("[xX\\-\\s\\*]+")).filter { it.isNotBlank() }
                } else if (raw.length == 4) {
                    listOf(raw.substring(0, 2), raw.substring(2, 4))
                } else {
                    listOf(raw)
                }

                val optClean = when (line.option.uppercase().replace(" ", "")) {
                    "OP1", "OPTION1", "1" -> "OP1"
                    "OP2", "OPTION2", "2" -> "OP2"
                    "OP3", "OPTION3", "3" -> "OP3"
                    "GRATIS" -> "GRATIS"
                    else -> if (isGratis) "GRATIS" else "TOUT"
                }

                list.add(BetGrid(numbers = parts, betAmount = amt, multiplier = 1, option = optClean, gameType = "MARIAGE", isGratis = isGratis))
            }
        }

        return list
    }

    val allGrids = getAllValidGrids()
    val unitTotalAmount = allGrids.sumOf { it.betAmount }
    val drawMultiplier = selectedDraws.size.coerceAtLeast(1)
    val grandTotalAmount = unitTotalAmount * drawMultiplier

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BodyBg)
    ) {
        // 1. TOP BAR VIOLETTE
        Surface(
            color = TopBarPurple,
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Titre de la Loterie sélectionnée (cliquable pour changer de tirage)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clickable { showDrawPicker = true }
                        .padding(vertical = 4.dp)
                ) {
                    Text(
                        text = lotteryTitle,
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Icon(
                        imageVector = Icons.Default.ArrowDropDown,
                        contentDescription = "Changer tirage",
                        tint = Color.White,
                        modifier = Modifier.size(24.dp)
                    )
                }

                // Actions : ✕ (Fermer) | ✓ (Valider Fiche) | ⋮ (Options)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    // Bouton ✕ (Annuler / Retour)
                    IconButton(
                        onClick = onBackClick,
                        modifier = Modifier.size(40.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Fèmen",
                            tint = Color.White,
                            modifier = Modifier.size(24.dp)
                        )
                    }

                    // Bouton ✓ (Aperçu et Validation de la fiche)
                    IconButton(
                        onClick = {
                            val validGrids = getAllValidGrids()
                            if (validGrids.isEmpty()) {
                                Toast.makeText(context, if (isCreole) "Tanpri antre omwen yon nimewo ak montan" else "Entrez au moins un numéro et montant", Toast.LENGTH_SHORT).show()
                            } else if (selectedDraws.isEmpty()) {
                                Toast.makeText(context, if (isCreole) "Chwazi omwen yon tiraj ouvè" else "Choisissez au moins un tirage ouvert", Toast.LENGTH_SHORT).show()
                            } else {
                                showPreValidationPreview = true
                            }
                        },
                        enabled = !isSubmitting,
                        modifier = Modifier.size(40.dp)
                    ) {
                        if (isSubmitting) {
                            CircularProgressIndicator(
                                color = Color.White,
                                strokeWidth = 2.dp,
                                modifier = Modifier.size(20.dp)
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = "Valide Fich",
                                tint = Color.White,
                                modifier = Modifier.size(26.dp)
                            )
                        }
                    }

                    // Bouton Recherche Ticket par Code (Modifier / Charger)
                    if (onSearchTicketByNumber != null) {
                        IconButton(
                            onClick = {
                                searchCodeError = null
                                showSearchCodeDialog = true
                            },
                            modifier = Modifier.size(36.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = Strings.t("search_by_code", currentLanguage),
                                tint = Color.White,
                                modifier = Modifier.size(24.dp)
                            )
                        }
                    }

                    // Bouton ⋮ (Menu Options)
                    Box {
                        IconButton(
                            onClick = { showOptionsMenu = true },
                            modifier = Modifier.size(36.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.MoreVert,
                                contentDescription = "Opsyon",
                                tint = Color.White,
                                modifier = Modifier.size(22.dp)
                            )
                        }

                        DropdownMenu(
                            expanded = showOptionsMenu,
                            onDismissRequest = { showOptionsMenu = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text(if (isCreole) "Efase fich la (Vide)" else "Vider la fiche") },
                                onClick = {
                                    showOptionsMenu = false
                                    clearAllLines()
                                },
                                leadingIcon = {
                                    Icon(Icons.Default.Delete, contentDescription = null, tint = RoeDanger)
                                }
                            )
                            DropdownMenuItem(
                                text = { Text(if (isCreole) "Chwazi Tiraj (Plizyè)" else "Sélectionner Tirages (Multi)") },
                                onClick = {
                                    showOptionsMenu = false
                                    showDrawPicker = true
                                }
                            )
                            if (onSearchTicketByNumber != null) {
                                DropdownMenuItem(
                                    text = { Text(Strings.t("search_by_code", currentLanguage)) },
                                    onClick = {
                                        showOptionsMenu = false
                                        searchCodeError = null
                                        showSearchCodeDialog = true
                                    },
                                    leadingIcon = {
                                        Icon(Icons.Default.Search, contentDescription = null, tint = RoeGold)
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }

        // BARRE RAPIDE DE SÉLECTION MULTI-TIRAGES (CHIPS DÉFILANTS)
        if (openDraws.isNotEmpty()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF512BD4))
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                openDraws.forEach { draw ->
                    val isSelected = selectedDrawIds.contains(draw.id)
                    Surface(
                        color = if (isSelected) Color.White else Color(0x33FFFFFF),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.clickable {
                            selectedDrawIds = if (isSelected) {
                                if (selectedDrawIds.size > 1) selectedDrawIds - draw.id else selectedDrawIds
                            } else {
                                selectedDrawIds + draw.id
                            }
                        }
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            if (isSelected) {
                                Icon(Icons.Default.Check, contentDescription = null, tint = TopBarPurple, modifier = Modifier.size(13.dp))
                            }
                            val drawPeriod = TicketReceiptUtil.getDrawPeriod(draw.game.name, draw.scheduledAt)
                            val cleanGameName = draw.game.name
                                .replace(Regex("(?i)\\s*\\(midi\\s*&\\s*soir\\)"), "")
                                .replace(Regex("(?i)\\s*\\(midi\\)"), "")
                                .replace(Regex("(?i)\\s*\\(soir\\)"), "")
                                .trim()
                            Text(
                                text = "$cleanGameName ($drawPeriod #${draw.drawNumber})",
                                color = if (isSelected) TopBarPurple else Color.White,
                                fontSize = 11.sp,
                                fontWeight = if (isSelected) FontWeight.Black else FontWeight.Medium
                            )
                        }
                    }
                }
            }
        }

        // 2. TABS BAR : BÒLET | LOTO 3 | LOTO 4 | LOTO 5 | MARYAJ
        ScrollableTabRow(
            selectedTabIndex = selectedTabIndex,
            containerColor = TabBarPurple,
            contentColor = Color.White,
            edgePadding = 8.dp,
            indicator = { tabPositions ->
                TabRowDefaults.SecondaryIndicator(
                    Modifier.tabIndicatorOffset(tabPositions[selectedTabIndex]),
                    color = Color.White,
                    height = 3.dp
                )
            }
        ) {
            tabs.forEachIndexed { index, tabName ->
                Tab(
                    selected = selectedTabIndex == index,
                    onClick = { selectedTabIndex = index },
                    text = {
                        Text(
                            text = tabName,
                            fontSize = 13.sp,
                            fontWeight = if (selectedTabIndex == index) FontWeight.Black else FontWeight.Bold,
                            color = if (selectedTabIndex == index) Color.White else Color.White.copy(alpha = 0.7f)
                        )
                    }
                )
            }
        }

        // Messages d'erreur éventuels
        errorMessage?.let {
            Surface(
                color = RoeDanger.copy(alpha = 0.15f),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text(
                    text = it,
                    color = RoeDanger,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(8.dp)
                )
            }
        }

        // 3. TABLEAU DES 10 LIGNES DE JEU
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 4.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            items(10) { rowIndex ->
                val line = currentLines[rowIndex]
                val isGratisRow = line.isGratis || line.option.uppercase().contains("GRATIS")

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 3.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Index (1., 2., 3., ... 10.)
                    Text(
                        text = "${rowIndex + 1}.",
                        color = LineDividerColor,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.width(26.dp)
                    )

                    // Champ 1 : Numéro
                    Box(
                        modifier = Modifier
                            .weight(1.3f)
                            .height(44.dp)
                    ) {
                        Column {
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxWidth(),
                                contentAlignment = Alignment.CenterStart
                            ) {
                                BasicTextField(
                                    value = line.number,
                                    onValueChange = { newVal ->
                                        val digits = newVal.filter { it.isDigit() || it == 'x' || it == 'X' || it == '-' || it == '*' }
                                        if (digits.length <= maxDigits) {
                                            currentLines[rowIndex] = line.copy(number = digits)
                                            if (digits.length == maxDigits && rowIndex < 9) {
                                                focusManager.moveFocus(FocusDirection.Right)
                                            }
                                        }
                                    },
                                    textStyle = TextStyle(
                                        color = TextDarkColor,
                                        fontSize = 17.sp,
                                        fontWeight = FontWeight.Black,
                                        fontFamily = FontFamily.Monospace
                                    ),
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(
                                        keyboardType = if (selectedTabIndex == 4) KeyboardType.Text else KeyboardType.Number,
                                        imeAction = ImeAction.Next
                                    ),
                                    keyboardActions = KeyboardActions(
                                        onNext = { focusManager.moveFocus(FocusDirection.Right) }
                                    ),
                                    cursorBrush = SolidColor(TopBarPurple),
                                    decorationBox = { innerTextField ->
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(vertical = 4.dp)
                                        ) {
                                            if (line.number.isEmpty()) {
                                                Text(
                                                    text = when (selectedTabIndex) {
                                                        0 -> "00"
                                                        1 -> "000"
                                                        2 -> "0000"
                                                        3 -> "00000"
                                                        else -> "12x34"
                                                    },
                                                    color = PlaceholderColor,
                                                    fontSize = 15.sp,
                                                    fontWeight = FontWeight.Medium
                                                )
                                            }
                                            innerTextField()
                                        }
                                    }
                                )
                            }
                            HorizontalDivider(
                                color = if (line.number.isNotEmpty()) TopBarPurple else LineDividerColor,
                                thickness = 1.dp
                            )
                        }
                    }

                    // Sélecteur d'Options pour LOTO 4 et MARYAJ
                    if (selectedTabIndex == 2 || selectedTabIndex == 4) {
                        Box(
                            modifier = Modifier
                                .width(68.dp)
                                .height(38.dp)
                                .clickable {
                                    val nextOpt = when (line.option) {
                                        "TOUT" -> "OP 1"
                                        "OP 1" -> "OP 2"
                                        "OP 2" -> "OP 3"
                                        "OP 3" -> if (selectedTabIndex == 4) "GRATIS" else "TOUT"
                                        "GRATIS" -> "TOUT"
                                        else -> "TOUT"
                                    }
                                    val gratisFlag = nextOpt == "GRATIS"
                                    currentLines[rowIndex] = line.copy(option = nextOpt, isGratis = gratisFlag)
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Surface(
                                color = if (isGratisRow) Color(0xFF2E7D32).copy(alpha = 0.15f) else TopBarPurple.copy(alpha = 0.12f),
                                shape = RoundedCornerShape(6.dp),
                                border = androidx.compose.foundation.BorderStroke(
                                    1.dp,
                                    if (isGratisRow) Color(0xFF2E7D32) else TopBarPurple
                                )
                            ) {
                                Text(
                                    text = line.option,
                                    color = if (isGratisRow) Color(0xFF2E7D32) else TopBarPurple,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }

                    // Champ 2 : Montant
                    Box(
                        modifier = Modifier
                            .weight(1.3f)
                            .height(44.dp)
                    ) {
                        Column {
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxWidth(),
                                contentAlignment = Alignment.CenterStart
                            ) {
                                BasicTextField(
                                    value = if (isGratisRow) "GRATIS" else line.amount,
                                    onValueChange = { newVal ->
                                        if (!isGratisRow) {
                                            val digits = newVal.filter { it.isDigit() }
                                            if (digits.length <= 6) {
                                                currentLines[rowIndex] = line.copy(amount = digits)
                                            }
                                        }
                                    },
                                    readOnly = isGratisRow,
                                    textStyle = TextStyle(
                                        color = if (isGratisRow) Color(0xFF2E7D32) else TextDarkColor,
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Black,
                                        fontFamily = FontFamily.Monospace
                                    ),
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(
                                        keyboardType = KeyboardType.Number,
                                        imeAction = if (rowIndex < 9) ImeAction.Next else ImeAction.Done
                                    ),
                                    keyboardActions = KeyboardActions(
                                        onNext = { focusManager.moveFocus(FocusDirection.Down) },
                                        onDone = { focusManager.clearFocus() }
                                    ),
                                    cursorBrush = SolidColor(TopBarPurple),
                                    decorationBox = { innerTextField ->
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(vertical = 4.dp)
                                        ) {
                                            if (line.amount.isEmpty() && !isGratisRow) {
                                                Text(
                                                    text = "Montan",
                                                    color = PlaceholderColor,
                                                    fontSize = 15.sp,
                                                    fontWeight = FontWeight.Medium
                                                )
                                            }
                                            innerTextField()
                                        }
                                    }
                                )
                            }
                            HorizontalDivider(
                                color = if (isGratisRow) Color(0xFF2E7D32) else if (line.amount.isNotEmpty()) TopBarPurple else LineDividerColor,
                                thickness = 1.dp
                            )
                        }
                    }
                }
            }
        }

        // 4. BARRE DE TOTAL EN BAS DE LA FICHE
        Surface(
            color = Color.White,
            shadowElevation = 8.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "TOTAL FICH",
                        color = PlaceholderColor,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = "${String.format("%.2f", grandTotalAmount)} HTG",
                        color = TopBarPurple,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        fontFamily = FontFamily.Monospace
                    )
                    if (selectedDraws.size > 1) {
                        Text(
                            text = "${String.format("%.2f", unitTotalAmount)} G x ${selectedDraws.size} tiraj",
                            color = Color(0xFF616161),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "${allGrids.size} jwèt",
                        color = TextDarkColor,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )

                    Button(
                        onClick = {
                            val validGrids = getAllValidGrids()
                            if (validGrids.isEmpty()) {
                                Toast.makeText(context, if (isCreole) "Tanpri antre omwen yon nimewo ak montan" else "Entrez au moins un numéro et montant", Toast.LENGTH_SHORT).show()
                            } else if (selectedDraws.isEmpty()) {
                                Toast.makeText(context, if (isCreole) "Chwazi omwen yon tiraj ouvè" else "Choisissez au moins un tirage ouvert", Toast.LENGTH_SHORT).show()
                            } else {
                                showPreValidationPreview = true
                            }
                        },
                        enabled = allGrids.isNotEmpty() && !isSubmitting,
                        colors = ButtonDefaults.buttonColors(containerColor = TopBarPurple),
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
                    ) {
                        Text(
                            text = if (isSubmitting) "Vant..." else "FÈ FICH LA",
                            color = Color.White,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Black
                        )
                    }
                }
            }
        }
    }

    // Modal de sélection Multi-Tirages (Georgia, New York, Florida) - Tendance Bleu & Blanc
    if (showDrawPicker) {
        AlertDialog(
            onDismissRequest = { showDrawPicker = false },
            containerColor = Color.White,
            shape = RoundedCornerShape(16.dp),
            title = {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = Strings.t("multi_draws_select", currentLanguage),
                        fontWeight = FontWeight.Black,
                        fontSize = 17.sp,
                        color = Color(0xFF1E3A8A) // Bleu Royal Profond
                    )
                }
            },
            text = {
                if (openDraws.isEmpty()) {
                    Text(
                        text = if (isCreole) "Pa gen okenn tiraj ki ouvè pou kounye a." else "Aucun tirage ouvert actuellement.",
                        color = Color(0xFF475569),
                        fontSize = 13.sp
                    )
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            TextButton(
                                onClick = {
                                    selectedDrawIds = openDraws.map { it.id }.toSet()
                                }
                            ) {
                                Text(
                                    text = if (isCreole) "Tout chwazi" else "Tout sélectionner",
                                    color = Color(0xFF2563EB),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                            }

                            Text(
                                text = "${selectedDrawIds.size} / ${openDraws.size}",
                                color = Color(0xFF64748B),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        openDraws.forEach { draw ->
                            val isChecked = selectedDrawIds.contains(draw.id)
                            Surface(
                                color = if (isChecked) Color(0xFFEFF6FF) else Color(0xFFF8FAFC),
                                shape = RoundedCornerShape(10.dp),
                                border = androidx.compose.foundation.BorderStroke(
                                    width = if (isChecked) 2.dp else 1.dp,
                                    color = if (isChecked) Color(0xFF2563EB) else Color(0xFFCBD5E1)
                                ),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        selectedDrawIds = if (isChecked) {
                                            if (selectedDrawIds.size > 1) selectedDrawIds - draw.id else selectedDrawIds
                                        } else {
                                            selectedDrawIds + draw.id
                                        }
                                    }
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = draw.game.name,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 15.sp,
                                            color = if (isChecked) Color(0xFF1E3A8A) else Color(0xFF0F172A)
                                        )
                                        Text(
                                            text = "Tiraj N° ${draw.drawNumber} • Clôture : ${(draw.salesClosingAt ?: "").take(16).replace("T", " ")}",
                                            fontSize = 12.sp,
                                            color = Color(0xFF475569)
                                        )
                                    }

                                    Checkbox(
                                        checked = isChecked,
                                        onCheckedChange = { checked ->
                                            selectedDrawIds = if (checked) {
                                                selectedDrawIds + draw.id
                                            } else {
                                                if (selectedDrawIds.size > 1) selectedDrawIds - draw.id else selectedDrawIds
                                            }
                                        },
                                        colors = CheckboxDefaults.colors(
                                            checkedColor = Color(0xFF2563EB),
                                            uncheckedColor = Color(0xFF94A3B8),
                                            checkmarkColor = Color.White
                                        )
                                    )
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { showDrawPicker = false },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = if (isCreole) "Valide & Fèmen" else "Confirmer & Fermer",
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        )
    }

    // Modal Reçu Ticket Vendu Multi-Tirages ("Fich yo reyisi")
    if (!soldTicketResults.isNullOrEmpty()) {
        val totalSoldAmount = soldTicketResults.sumOf { it.totalAmount }
        AlertDialog(
            onDismissRequest = {
                clearAllLines()
                onDismissReceipt()
            },
            containerColor = Color.White,
            shape = RoundedCornerShape(16.dp),
            title = {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = if (soldTicketResults.size == 1) "FICH LA ENPRIME AK SIKSE !" else "${soldTicketResults.size} FICH ENPRIME AK SIKSE !",
                            color = Color(0xFF2E7D32),
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Black
                        )
                        Text(
                            text = if (isCreole) "Tikè ofisyèl ki anrejistre sou sèvè a" else "Tickets officiels enregistrés sur le serveur",
                            color = Color.Gray,
                            fontSize = 11.sp
                        )
                    }
                    IconButton(
                        onClick = {
                            clearAllLines()
                            onDismissReceipt()
                        },
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(Icons.Default.Close, contentDescription = "Fèmen", tint = Color.Gray)
                    }
                }
            },
            text = {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 480.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    items(soldTicketResults) { ticket ->
                        Surface(
                            color = Color.White,
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(1.dp, Color(0xFFE0E0E0)),
                            shadowElevation = 2.dp,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                // 1. Logo & En-tête Loterie
                                LotteryLogoView(logoUrl = lotteryLogoUrl)
                                Text(
                                    text = lotteryHeaderNote,
                                    color = Color(0xFF616161),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp
                                )
                                Text(
                                    text = lotteryName.uppercase(),
                                    color = Color.Black,
                                    fontWeight = FontWeight.Black,
                                    fontSize = 15.sp,
                                    textAlign = TextAlign.Center
                                )
                                if (lotterySlogan.isNotEmpty()) {
                                    Text(
                                        text = lotterySlogan,
                                        color = Color(0xFF424242),
                                        fontWeight = FontWeight.Medium,
                                        fontSize = 11.sp
                                    )
                                }
                                Text(
                                    text = if (lotteryBankRef.isNotEmpty()) "$lotteryBankRef • Tel: $lotteryPhone" else "Tel: $lotteryPhone",
                                    color = Color(0xFF616161),
                                    fontSize = 10.sp
                                )
                                Text(
                                    text = "POS: ${ticket.vendorCode ?: deviceUuid.take(16)}",
                                    color = Color(0xFF757575),
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                                val ticketDate = ticket.createdAt?.take(19)?.replace("T", " ")
                                    ?: java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US).format(java.util.Date())
                                Text(
                                    text = "Dat & Lè: $ticketDate",
                                    color = Color(0xFF212121),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace
                                )

                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "********************************",
                                    color = Color(0xFFBDBDBD),
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold
                                )

                                // 2. Nom du Tirage & Identification MIDI / SOIR
                                val schedOrCreated = ticket.scheduledAt ?: ticket.createdAt
                                val drawDisplayName = TicketReceiptUtil.formatDrawDisplayName(
                                    ticket.gameName,
                                    ticket.drawNumber,
                                    schedOrCreated
                                )
                                val drawPeriod = TicketReceiptUtil.getDrawPeriod(ticket.gameName, schedOrCreated)

                                Text(
                                    text = drawDisplayName,
                                    color = Color.Black,
                                    fontWeight = FontWeight.Black,
                                    fontSize = 13.sp,
                                    textAlign = TextAlign.Center
                                )
                                DrawPeriodBadge(period = drawPeriod)
                                Text(
                                    text = "#Ticket: ${ticket.ticketNumber}",
                                    color = Color.Black,
                                    fontSize = 12.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Black
                                )

                                Text(
                                    text = "********************************",
                                    color = Color(0xFFBDBDBD),
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(3.dp))

                                // 3. Grilles jouées
                                val gridsToDisplay = ticket.playedGrids ?: getAllValidGrids()
                                val regularGrids = gridsToDisplay.filter { it.isGratis != true }
                                val gratisGrids = gridsToDisplay.filter { it.isGratis == true }

                                regularGrids.forEach { g ->
                                    val gameLabel = when ((g.gameType ?: "BORLETTE").uppercase()) {
                                        "MARIAGE", "MAR" -> "Mariage"
                                        "LOTTO3", "L3" -> "Lotto 3"
                                        "LOTTO4", "L4" -> "Lotto 4"
                                        "LOTTO5", "L5" -> "Lotto 5"
                                        else -> "Borlette"
                                    }
                                    val separator = if (g.gameType?.contains("MAR", true) == true) "*" else "-"
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 1.5.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "$gameLabel  ${g.numbers.joinToString(separator)}",
                                            color = Color.Black,
                                            fontSize = 12.sp,
                                            fontFamily = FontFamily.Monospace,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            text = "${String.format("%.0f", g.betAmount)} HTG",
                                            color = Color.Black,
                                            fontSize = 12.sp,
                                            fontFamily = FontFamily.Monospace,
                                            fontWeight = FontWeight.Black
                                        )
                                    }
                                }

                                if (gratisGrids.isNotEmpty()) {
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = "Mariage Gratuit",
                                        color = Color(0xFF424242),
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp
                                    )
                                    gratisGrids.forEach { g ->
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(vertical = 1.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                text = "Mariage  ${g.numbers.joinToString("*")}",
                                                color = Color(0xFF616161),
                                                fontSize = 11.sp,
                                                fontFamily = FontFamily.Monospace
                                            )
                                            Text(
                                                text = "xxxx HTG",
                                                color = Color(0xFF757575),
                                                fontSize = 11.sp,
                                                fontFamily = FontFamily.Monospace
                                            )
                                        }
                                    }
                                }

                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "********************************",
                                    color = Color(0xFFBDBDBD),
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold
                                )

                                // 4. Total
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(text = "TOTAL", color = Color.Black, fontWeight = FontWeight.Black, fontSize = 13.sp)
                                    Text(
                                        text = "${String.format("%.0f", ticket.totalAmount)} HTG",
                                        color = Color.Black,
                                        fontWeight = FontWeight.Black,
                                        fontSize = 15.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }

                                Text(
                                    text = "********************************",
                                    color = Color(0xFFBDBDBD),
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(6.dp))

                                // 5. Code-barres scannable officiel Code 128
                                Barcode128View(
                                    code = ticket.ticketNumber,
                                    height = 42.dp,
                                    showCodeText = true
                                )
                                Text(
                                    text = "Siyati : ${(ticket.secureChecksum).take(22)}...",
                                    color = Color.Gray,
                                    fontSize = 9.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                                Spacer(modifier = Modifier.height(4.dp))

                                // 6. Mentions légales & Footer
                                Text(
                                    text = lotteryFooterNote,
                                    color = Color(0xFF424242),
                                    fontSize = 9.sp,
                                    textAlign = TextAlign.Center,
                                    lineHeight = 12.sp,
                                    fontWeight = FontWeight.Medium
                                )
                                if (lotteryMariageGratis.isNotEmpty()) {
                                    Text(
                                        text = lotteryMariageGratis,
                                        color = Color(0xFF2E7D32),
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold,
                                        textAlign = TextAlign.Center
                                    )
                                }
                                Text(
                                    text = lotteryProvider,
                                    color = Color(0xFF757575),
                                    fontSize = 8.sp,
                                    fontWeight = FontWeight.Bold,
                                    textAlign = TextAlign.Center
                                )
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        clearAllLines()
                        onDismissReceipt()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = TopBarPurple),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, tint = Color.White)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        if (isCreole) "FÈ YON LÒT FICH" else "FAIRE UN AUTRE TICKET",
                        color = Color.White,
                        fontWeight = FontWeight.Black
                    )
                }
            }
        )
    }

    // MODAL APERÇU AVANT VALIDATION & IMPRESSION (Pre-validation Preview)
    if (showPreValidationPreview) {
        val validGrids = getAllValidGrids()
        AlertDialog(
            onDismissRequest = { showPreValidationPreview = false },
            containerColor = Color.White,
            shape = RoundedCornerShape(16.dp),
            title = {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = Strings.t("pre_validation_preview", currentLanguage),
                            color = TopBarPurple,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Black
                        )
                        Text(
                            text = Strings.t("verify_numbers_amounts", currentLanguage),
                            color = Color.Gray,
                            fontSize = 11.sp
                        )
                    }
                    IconButton(onClick = { showPreValidationPreview = false }, modifier = Modifier.size(28.dp)) {
                        Icon(Icons.Default.Close, contentDescription = "Fermer", tint = Color.Gray)
                    }
                }
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 2.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Logo & En-tête Loterie (Identique à la fiche Borlette réelle)
                    LotteryLogoView(logoUrl = lotteryLogoUrl)
                    Text(
                        text = lotteryHeaderNote,
                        color = Color(0xFF616161),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = lotteryName.uppercase(),
                        color = Color.Black,
                        fontWeight = FontWeight.Black,
                        fontSize = 16.sp,
                        textAlign = TextAlign.Center
                    )
                    if (lotterySlogan.isNotEmpty()) {
                        Text(
                            text = lotterySlogan,
                            color = Color(0xFF424242),
                            fontWeight = FontWeight.Medium,
                            fontSize = 12.sp
                        )
                    }
                    Text(
                        text = if (lotteryBankRef.isNotEmpty()) "$lotteryBankRef • Tel: $lotteryPhone" else "Tel: $lotteryPhone",
                        color = Color(0xFF616161),
                        fontSize = 11.sp
                    )
                    if (deviceUuid.isNotEmpty()) {
                        Text(
                            text = "POS: ${deviceUuid.take(16)}",
                            color = Color(0xFF757575),
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                    val nowFormatted = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US).format(java.util.Date())
                    Text(
                        text = "Dat & Lè: $nowFormatted",
                        color = Color(0xFF212121),
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )

                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "********************************",
                        color = Color(0xFFBDBDBD),
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )

                    // Nom du ou des Tirages avec Identification MIDI / SOIR
                    selectedDraws.forEach { d ->
                        val drawDisplayName = TicketReceiptUtil.formatDrawDisplayName(
                            d.game.name,
                            d.drawNumber,
                            d.scheduledAt
                        )
                        val drawPeriod = TicketReceiptUtil.getDrawPeriod(d.game.name, d.scheduledAt)
                        Text(
                            text = drawDisplayName,
                            color = Color.Black,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            textAlign = TextAlign.Center
                        )
                        DrawPeriodBadge(period = drawPeriod)
                    }

                    Text(
                        text = "********************************",
                        color = Color(0xFFBDBDBD),
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(3.dp))

                    // Grilles régulières
                    val regularGrids = validGrids.filter { it.isGratis != true }
                    val gratisGrids = validGrids.filter { it.isGratis == true }

                    regularGrids.forEach { g ->
                        val gameLabel = when ((g.gameType ?: "BORLETTE").uppercase()) {
                            "MARIAGE", "MAR" -> "Mariage"
                            "LOTTO3", "L3" -> "Lotto 3"
                            "LOTTO4", "L4" -> "Lotto 4"
                            "LOTTO5", "L5" -> "Lotto 5"
                            else -> "Borlette"
                        }
                        val separator = if (g.gameType?.contains("MAR", true) == true) "*" else "-"
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 1.5.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "$gameLabel  ${g.numbers.joinToString(separator)}",
                                color = Color.Black,
                                fontSize = 12.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "${String.format("%.0f", g.betAmount)} HTG",
                                color = Color.Black,
                                fontSize = 12.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Black
                            )
                        }
                    }

                    // Grilles gratuites (Mariage Gratuit)
                    if (gratisGrids.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Mariage Gratuit",
                            color = Color(0xFF424242),
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp
                        )
                        gratisGrids.forEach { g ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 1.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Mariage  ${g.numbers.joinToString("*")}",
                                    color = Color(0xFF616161),
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                                Text(
                                    text = "xxxx HTG",
                                    color = Color(0xFF757575),
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "********************************",
                        color = Color(0xFFBDBDBD),
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )

                    // Total
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(text = "TOTAL", color = Color.Black, fontWeight = FontWeight.Black, fontSize = 13.sp)
                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                text = "${String.format("%.0f", grandTotalAmount)} HTG",
                                color = Color.Black,
                                fontWeight = FontWeight.Black,
                                fontSize = 15.sp,
                                fontFamily = FontFamily.Monospace
                            )
                            if (selectedDraws.size > 1) {
                                Text(
                                    text = "${String.format("%.0f", unitTotalAmount)} G x ${selectedDraws.size} tiraj",
                                    color = Color.Gray,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }

                    Text(
                        text = "********************************",
                        color = Color(0xFFBDBDBD),
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(4.dp))

                    // Code-barres scannable officiel Code 128 (Aperçu)
                    Barcode128View(
                        code = "ROE-${java.text.SimpleDateFormat("yyyyMMdd", java.util.Locale.US).format(java.util.Date())}-PREVIEW",
                        height = 42.dp,
                        showCodeText = true
                    )
                    Text(
                        text = if (isCreole) "Apèsi kòd-bar avan enpresyon" else "Aperçu code-barres avant impression",
                        color = Color.Gray,
                        fontSize = 9.sp,
                        fontFamily = FontFamily.Monospace
                    )
                    Spacer(modifier = Modifier.height(4.dp))

                    // Mentions légales & Footer
                    Text(
                        text = lotteryFooterNote,
                        color = Color(0xFF424242),
                        fontSize = 9.sp,
                        textAlign = TextAlign.Center,
                        lineHeight = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                    if (lotteryMariageGratis.isNotEmpty()) {
                        Text(
                            text = lotteryMariageGratis,
                            color = Color(0xFF2E7D32),
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center
                        )
                    }
                    Text(
                        text = lotteryProvider,
                        color = Color(0xFF757575),
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showPreValidationPreview = false
                        onSubmitTicket(selectedDraws, validGrids)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2E7D32)),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
                ) {
                    Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = Strings.t("confirm_and_print", currentLanguage),
                        color = Color.White,
                        fontWeight = FontWeight.Black,
                        fontSize = 12.sp
                    )
                }
            },
            dismissButton = {
                OutlinedButton(
                    onClick = { showPreValidationPreview = false },
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = Strings.t("modify_ticket", currentLanguage),
                        color = Color(0xFF616161),
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp
                    )
                }
            }
        )
    }

    // MODAL DE RECHERCHE DE TICKET PAR CODE (POUR MODIFIER OU RÉIMPRIMER)
    if (showSearchCodeDialog && onSearchTicketByNumber != null) {
        AlertDialog(
            onDismissRequest = { if (!isSearchingCode) showSearchCodeDialog = false },
            containerColor = Color.White,
            shape = RoundedCornerShape(16.dp),
            title = {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = Strings.t("search_ticket_code_title", currentLanguage),
                            color = TopBarPurple,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Black
                        )
                        Text(
                            text = Strings.t("search_ticket_code_sub", currentLanguage),
                            color = Color.Gray,
                            fontSize = 11.sp
                        )
                    }
                    IconButton(onClick = { showSearchCodeDialog = false }, modifier = Modifier.size(28.dp)) {
                        Icon(Icons.Default.Close, contentDescription = "Fermer", tint = Color.Gray)
                    }
                }
            },
            text = {
                Column(modifier = Modifier.fillMaxWidth()) {
                    OutlinedTextField(
                        value = searchCodeInput,
                        onValueChange = {
                            searchCodeInput = it.uppercase()
                            searchCodeError = null
                        },
                        placeholder = { Text(Strings.t("ticket_code_placeholder", currentLanguage), fontSize = 12.sp) },
                        singleLine = true,
                        leadingIcon = {
                            Icon(Icons.Default.QrCodeScanner, contentDescription = null, tint = TopBarPurple)
                        },
                        trailingIcon = {
                            if (searchCodeInput.isNotEmpty()) {
                                IconButton(onClick = { searchCodeInput = "" }) {
                                    Icon(Icons.Default.Close, contentDescription = "Effacer", tint = Color.Gray)
                                }
                            }
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.Black,
                            unfocusedTextColor = Color.Black,
                            focusedBorderColor = TopBarPurple,
                            unfocusedBorderColor = Color(0xFFBDBDBD)
                        ),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )

                    if (searchCodeError != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = searchCodeError ?: "",
                            color = Color(0xFFD32F2F),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val code = searchCodeInput.trim()
                        if (code.isNotEmpty()) {
                            isSearchingCode = true
                            searchCodeError = null
                            onSearchTicketByNumber(code) { found ->
                                isSearchingCode = false
                                if (found != null) {
                                    loadTicketToEdit(found)
                                    showSearchCodeDialog = false
                                    Toast.makeText(
                                        context,
                                        Strings.t("ticket_loaded_for_modification", currentLanguage),
                                        Toast.LENGTH_LONG
                                    ).show()
                                } else {
                                    searchCodeError = Strings.t("ticket_not_found", currentLanguage)
                                }
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = TopBarPurple),
                    shape = RoundedCornerShape(8.dp),
                    enabled = !isSearchingCode && searchCodeInput.isNotBlank()
                ) {
                    if (isSearchingCode) {
                        CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(16.dp))
                    } else {
                        Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = Strings.t("modify_or_replay", currentLanguage),
                            color = Color.White,
                            fontWeight = FontWeight.Black
                        )
                    }
                }
            },
            dismissButton = {
                OutlinedButton(
                    onClick = { showSearchCodeDialog = false },
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = Strings.t("close", currentLanguage),
                        color = Color(0xFF616161),
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        )
    }
}
