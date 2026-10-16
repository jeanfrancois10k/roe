package com.roebolet.vendor.ui.sell

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.MoreVert
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
import com.roebolet.vendor.ui.theme.*

data class LineItem(
    val number: String = "",
    val amount: String = "",
    val option: String = "TOUT", // "TOUT", "OP 1", "OP 2", "OP 3", "GRATIS"
    val isGratis: Boolean = false
)

private val TopBarPurple = Color(0xFF6236FF) // Violet vibrant correspondant à la photo
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
    soldTicketResult: SellTicketResponse?,
    onBackClick: () -> Unit,
    onSubmitTicket: (drawId: String, gameId: String, grids: List<BetGrid>) -> Unit,
    onDismissReceipt: () -> Unit
) {
    val context = LocalContext.current
    val focusManager = LocalFocusManager.current

    // Sélection du tirage actif
    var selectedDrawIndex by remember { mutableStateOf(0) }
    var showDrawPicker by remember { mutableStateOf(false) }
    var showOptionsMenu by remember { mutableStateOf(false) }

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

    val currentDraw = openDraws.getOrNull(selectedDrawIndex)
    val lotteryTitle = currentDraw?.let { "${it.game.name} - Bòlet" } ?: "Georgia - Bòlet"

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

        // 3. LOTO 4 (avec Options: TOUT, OP 1, OP 2, OP 3)
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
                list.add(
                    BetGrid(
                        numbers = listOf(num),
                        betAmount = amt,
                        multiplier = 1,
                        option = optClean,
                        gameType = "LOTO4"
                    )
                )
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

        // 5. MARYAJ (avec Découpage 2 numéros, Options & Maryaj Gratis)
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

                list.add(
                    BetGrid(
                        numbers = parts,
                        betAmount = amt,
                        multiplier = 1,
                        option = optClean,
                        gameType = "MARIAGE",
                        isGratis = isGratis
                    )
                )
            }
        }

        return list
    }

    val allGrids = getAllValidGrids()
    val totalAmount = allGrids.sumOf { it.betAmount * (it.multiplier ?: 1) }

    fun clearAllLines() {
        for (i in 0 until 10) {
            boletLines[i] = LineItem()
            loto3Lines[i] = LineItem()
            loto4Lines[i] = LineItem()
            loto5Lines[i] = LineItem()
            maryajLines[i] = LineItem()
        }
        defaultLoto4Option = "TOUT"
        defaultMaryajOption = "TOUT"
        Toast.makeText(context, "Fich la efase nèt", Toast.LENGTH_SHORT).show()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BodyBg)
    ) {
        // 1. TOP APP BAR (Violet avec titre et boutons ✕, ✓, ⋮)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(TopBarPurple)
                .statusBarsPadding()
                .padding(horizontal = 12.dp, vertical = 10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
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
                        fontSize = 19.sp,
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

                    // Bouton ✓ (Valider et Imprimer la fiche)
                    IconButton(
                        onClick = {
                            val validGrids = getAllValidGrids()
                            if (validGrids.isEmpty()) {
                                Toast.makeText(context, "Tanpri antre omwen yon niméwo ak montan", Toast.LENGTH_SHORT).show()
                            } else if (currentDraw == null) {
                                Toast.makeText(context, "Chwazi yon tiraj ouvè avan", Toast.LENGTH_SHORT).show()
                            } else {
                                onSubmitTicket(currentDraw.id, currentDraw.game.id, validGrids)
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
                                text = { Text("Efase fich la (Vide)") },
                                onClick = {
                                    showOptionsMenu = false
                                    clearAllLines()
                                },
                                leadingIcon = {
                                    Icon(Icons.Default.Delete, contentDescription = null, tint = RoeDanger)
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("Chanje Tiraj") },
                                onClick = {
                                    showOptionsMenu = false
                                    showDrawPicker = true
                                }
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
                if (selectedTabIndex < tabPositions.size) {
                    TabRowDefaults.SecondaryIndicator(
                        Modifier.tabIndicatorOffset(tabPositions[selectedTabIndex]),
                        color = Color.White,
                        height = 3.dp
                    )
                }
            },
            divider = {}
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
                            color = if (selectedTabIndex == index) Color.White else Color.White.copy(alpha = 0.7f),
                            letterSpacing = 0.5.sp
                        )
                    }
                )
            }
        }

        // Bannière Erreur si nécessaire
        if (errorMessage != null) {
            Surface(
                color = RoeDanger.copy(alpha = 0.15f),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
                shape = RoundedCornerShape(8.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, RoeDanger)
            ) {
                Text(
                    text = errorMessage,
                    color = RoeDanger,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(8.dp)
                )
            }
        }

        // 2.5 BARRE DE SÉLECTION D'OPTIONS RAPIDE (Pour Loto 4 et Maryaj)
        if (selectedTabIndex == 2) {
            Surface(
                color = Color.White,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                shape = RoundedCornerShape(8.dp),
                shadowElevation = 1.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Opsyon Lòt 4 :",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = TopBarPurple
                    )
                    listOf("TOUT", "OP 1", "OP 2", "OP 3").forEach { opt ->
                        val isSelected = defaultLoto4Option == opt
                        Surface(
                            color = if (isSelected) TopBarPurple else Color(0xFFF0F0F0),
                            shape = RoundedCornerShape(12.dp),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (isSelected) TopBarPurple else Color(0xFFCCCCCC)
                            ),
                            modifier = Modifier.clickable {
                                defaultLoto4Option = opt
                                for (i in 0 until 10) {
                                    loto4Lines[i] = loto4Lines[i].copy(option = opt)
                                }
                            }
                        ) {
                            Text(
                                text = opt,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isSelected) Color.White else TextDarkColor,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                            )
                        }
                    }
                }
            }
        } else if (selectedTabIndex == 4) {
            Surface(
                color = Color.White,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                shape = RoundedCornerShape(8.dp),
                shadowElevation = 1.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "Opsyon :",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = TopBarPurple
                    )
                    listOf("TOUT", "OP 1", "OP 2", "OP 3", "GRATIS").forEach { opt ->
                        val isSelected = defaultMaryajOption == opt
                        val isGratisOpt = opt == "GRATIS"
                        val activeColor = if (isGratisOpt) Color(0xFF2E7D32) else TopBarPurple
                        Surface(
                            color = if (isSelected) activeColor else Color(0xFFF0F0F0),
                            shape = RoundedCornerShape(12.dp),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (isSelected) activeColor else Color(0xFFCCCCCC)
                            ),
                            modifier = Modifier.clickable {
                                defaultMaryajOption = opt
                                for (i in 0 until 10) {
                                    maryajLines[i] = maryajLines[i].copy(option = opt, isGratis = isGratisOpt)
                                }
                            }
                        ) {
                            Text(
                                text = if (isGratisOpt) "🎁 GRATIS" else opt,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isSelected) Color.White else (if (isGratisOpt) Color(0xFF2E7D32) else TextDarkColor),
                                modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp)
                            )
                        }
                    }
                }
            }
        }

        // 3. TABLEAU DE SAISIE DE FICHE : LIGNES [ Niméwo | Opsyon | Montan ] (Exactement comme dans la photo)
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            items(10) { rowIndex ->
                val line = currentLines[rowIndex]

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // COLONNE 1 : Niméwo
                    Box(
                        modifier = Modifier.weight(1f)
                    ) {
                        Column {
                            BasicTextField(
                                value = line.number,
                                onValueChange = { newVal ->
                                    val cleaned = newVal.filter { c -> c.isDigit() || c == 'x' || c == 'X' || c == '-' || c == ' ' }
                                    if (cleaned.length <= maxDigits) {
                                        currentLines[rowIndex] = line.copy(number = cleaned)
                                    }
                                },
                                singleLine = true,
                                textStyle = TextStyle(
                                    color = TextDarkColor,
                                    fontSize = 17.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace
                                ),
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
                                                text = if (selectedTabIndex == 4) "12 × 34" else "Niméwo",
                                                color = PlaceholderColor,
                                                fontSize = 15.sp,
                                                fontWeight = FontWeight.Medium
                                            )
                                        }
                                        innerTextField()
                                    }
                                }
                            )
                            // Ligne de soulignement
                            HorizontalDivider(
                                color = if (line.number.isNotEmpty()) TopBarPurple else LineDividerColor,
                                thickness = 1.dp
                            )
                        }
                    }

                    // BADGE OPSYON INTERACTIF (Pour Loto 4 et Maryaj)
                    if (selectedTabIndex == 2 || selectedTabIndex == 4) {
                        val isGratisRow = line.isGratis || line.option == "GRATIS"
                        Surface(
                            color = if (isGratisRow) Color(0xFF2E7D32).copy(alpha = 0.15f) else TopBarPurple.copy(alpha = 0.12f),
                            shape = RoundedCornerShape(6.dp),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (isGratisRow) Color(0xFF2E7D32) else TopBarPurple
                            ),
                            modifier = Modifier
                                .clickable {
                                    if (selectedTabIndex == 2) {
                                        val next = when (line.option) {
                                            "TOUT" -> "OP 1"
                                            "OP 1" -> "OP 2"
                                            "OP 2" -> "OP 3"
                                            else -> "TOUT"
                                        }
                                        currentLines[rowIndex] = line.copy(option = next)
                                    } else {
                                        val next = when (line.option) {
                                            "TOUT" -> "OP 1"
                                            "OP 1" -> "OP 2"
                                            "OP 2" -> "OP 3"
                                            "OP 3" -> "GRATIS"
                                            else -> "TOUT"
                                        }
                                        currentLines[rowIndex] = line.copy(option = next, isGratis = next == "GRATIS")
                                    }
                                }
                                .padding(horizontal = 6.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = if (isGratisRow) "🎁 GRATIS" else line.option,
                                color = if (isGratisRow) Color(0xFF2E7D32) else TopBarPurple,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    // COLONNE 2 : Montan
                    Box(
                        modifier = Modifier.weight(1f)
                    ) {
                        val isGratisRow = line.isGratis || line.option == "GRATIS"
                        Column {
                            if (isGratisRow) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp)
                                ) {
                                    Text(
                                        text = "GRATIS (0 G)",
                                        color = Color(0xFF2E7D32),
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            } else {
                                BasicTextField(
                                    value = line.amount,
                                    onValueChange = { newVal ->
                                        val cleaned = newVal.filter { c -> c.isDigit() }
                                        if (cleaned.length <= 6) {
                                            currentLines[rowIndex] = line.copy(amount = cleaned)
                                        }
                                    },
                                    singleLine = true,
                                    textStyle = TextStyle(
                                        color = TextDarkColor,
                                        fontSize = 17.sp,
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = FontFamily.Monospace
                                    ),
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
                                            if (line.amount.isEmpty()) {
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
                            // Ligne de soulignement
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
                        text = "${String.format("%.2f", totalAmount)} HTG",
                        color = TopBarPurple,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        fontFamily = FontFamily.Monospace
                    )
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
                                Toast.makeText(context, "Tanpri antre omwen yon niméwo ak montan", Toast.LENGTH_SHORT).show()
                            } else if (currentDraw == null) {
                                Toast.makeText(context, "Chwazi yon tiraj ouvè avan", Toast.LENGTH_SHORT).show()
                            } else {
                                onSubmitTicket(currentDraw.id, currentDraw.game.id, validGrids)
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

    // Modal de sélection de tirage / loterie (Georgia, New York, Florida)
    if (showDrawPicker) {
        AlertDialog(
            onDismissRequest = { showDrawPicker = false },
            title = {
                Text(
                    text = "Chwazi yon Tiraj / Loterie",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
            },
            text = {
                if (openDraws.isEmpty()) {
                    Text("Pa gen okenn tiraj ki ouvè pou kounye a.")
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        openDraws.forEachIndexed { index, draw ->
                            Surface(
                                color = if (selectedDrawIndex == index) TopBarPurple.copy(alpha = 0.15f) else Color.Transparent,
                                shape = RoundedCornerShape(8.dp),
                                border = androidx.compose.foundation.BorderStroke(
                                    1.dp,
                                    if (selectedDrawIndex == index) TopBarPurple else Color(0xFFE0E0E0)
                                ),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        selectedDrawIndex = index
                                        showDrawPicker = false
                                    }
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
                                            text = draw.game.name,
                                            fontWeight = FontWeight.Bold,
                                            color = if (selectedDrawIndex == index) TopBarPurple else Color.Black
                                        )
                                        Text(
                                            text = "Tiraj N° ${draw.drawNumber}",
                                            fontSize = 11.sp,
                                            color = Color.Gray
                                        )
                                    }

                                    if (selectedDrawIndex == index) {
                                        Icon(Icons.Default.Check, contentDescription = null, tint = TopBarPurple)
                                    }
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showDrawPicker = false }) {
                    Text("Fèmen", color = TopBarPurple)
                }
            }
        )
    }

    // Modal Reçu Ticket Vendu ("Fich la reyisi")
    if (soldTicketResult != null) {
        AlertDialog(
            onDismissRequest = {
                clearAllLines()
                onDismissReceipt()
            },
            containerColor = Color.White,
            title = {
                Text(
                    text = "FICH LA ENPRIME AK SIKSE !",
                    color = Color(0xFF2E7D32),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Black
                )
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(text = "ROE BOLET OFISYÈL", color = TopBarPurple, fontWeight = FontWeight.Black, fontSize = 16.sp)
                    Text(text = soldTicketResult.ticketNumber, color = Color.Black, fontWeight = FontWeight.Black, fontSize = 15.sp, fontFamily = FontFamily.Monospace)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = "Total Peye : ${String.format("%.2f", soldTicketResult.totalAmount)} HTG", color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text(text = "Siyati Sekirite : ${soldTicketResult.secureChecksum.take(16)}...", color = Color.Gray, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(text = "Tikè sa anrejistre epi sele sou sèvè a.", color = Color.Gray, fontSize = 11.sp, textAlign = TextAlign.Center)
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        clearAllLines()
                        onDismissReceipt()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = TopBarPurple),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("FÈ YON LÒT FICH", color = Color.White, fontWeight = FontWeight.Black)
                }
            }
        )
    }
}
