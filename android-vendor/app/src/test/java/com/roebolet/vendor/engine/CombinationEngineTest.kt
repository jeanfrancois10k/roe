package com.roebolet.vendor.engine

import com.roebolet.vendor.data.api.BetGrid
import com.roebolet.vendor.data.api.OpenDrawGame
import com.roebolet.vendor.data.api.OpenDrawItem
import org.junit.Assert.*
import org.junit.Test

class CombinationEngineTest {

    // 1. EXEMPLE OBLIGATOIRE LOTO 4
    @Test
    fun testGenerateLoto4_MandatoryExample() {
        val sources = listOf("02", "20", "22")
        val result = CombinationEngine.generateLoto4(sources)

        val numbers = result.map { it.number }
        assertEquals(6, numbers.size)

        val expected = listOf("0220", "2002", "0222", "2202", "2022", "2220")
        assertTrue(numbers.containsAll(expected))

        // Vérification de la conservation des zéros et de l'ordre de concaténation
        assertTrue(numbers.contains("0222"))
        assertTrue(numbers.contains("2202"))
        assertTrue(numbers.contains("2022"))
        assertTrue(numbers.contains("2220"))
        assertTrue(numbers.contains("0220"))
        assertTrue(numbers.contains("2002"))

        // Unicité absolue
        assertEquals(numbers.size, numbers.distinct().size)

        // Traçabilité des sources
        val comb0222 = result.first { it.number == "0222" }
        assertEquals(listOf("02", "22"), comb0222.sourceNumbers)
    }

    // 2. EXEMPLE OBLIGATOIRE MARIAGE
    @Test
    fun testGenerateMariage_MandatoryExample() {
        val sources = listOf("02", "20", "22")
        val result = CombinationEngine.generateMariage(sources, separator = "X")

        val numbers = result.map { it.number }
        assertEquals(3, numbers.size)

        val expected = listOf("02X20", "02X22", "20X22")
        assertTrue(numbers.containsAll(expected))

        // Chaque paire non ordonnée est produite une seule et unique fois
        assertEquals(3, numbers.distinct().size)
    }

    // 3. PRÉSERVATION STRICTE DES ZÉROS INITIAUX
    @Test
    fun testPreservationOfLeadingZeros() {
        val sources = listOf("00", "07", "09", "2") // "2" doit être normalisé en "02"
        val clean = CombinationEngine.extractCleanSources(sources)

        assertEquals(listOf("00", "07", "09", "02"), clean)

        val loto4 = CombinationEngine.generateLoto4(clean)
        assertTrue(loto4.any { it.number == "0007" })
        assertTrue(loto4.any { it.number == "0700" })
        assertTrue(loto4.any { it.number == "0002" })

        val mariage = CombinationEngine.generateMariage(clean, separator = "X")
        assertTrue(mariage.any { it.number == "00X07" })
        assertTrue(mariage.any { it.number == "00X02" })
    }

    // 4. DÉDUPLICATION DES NUMÉROS SOURCES RÉPÉTÉS
    @Test
    fun testDeduplicationOfRepeatedSources() {
        val sources = listOf("02", "02", "20", "20", "22")
        val clean = CombinationEngine.extractCleanSources(sources)
        assertEquals(listOf("02", "20", "22"), clean)

        val loto4 = CombinationEngine.generateLoto4(sources)
        assertEquals(6, loto4.size)

        val mariage = CombinationEngine.generateMariage(sources)
        assertEquals(3, mariage.size)
    }

    // 5. MODE 1 : MISE FIXE PAR COMBINAISON
    @Test
    fun testBetCalculationMode_UnitBet() {
        val sources = listOf("02", "20", "22")
        val loto4 = CombinationEngine.generateLoto4(sources) // 6 combinaisons

        val calculated = CombinationEngine.calculateBetAmounts(
            combinations = loto4,
            mode = BetCalculationMode.UNIT_BET,
            budgetOrUnitAmount = 10.0
        )

        assertEquals(6, calculated.size)
        calculated.forEach {
            assertEquals(10.0, it.betAmount, 0.001)
        }

        val total = calculated.sumOf { it.betAmount }
        assertEquals(60.0, total, 0.001)
    }

    // 6. MODE 2 : BUDGET RÉPARTI AVEC ET SANS RESTE (ZÉRO PERTE, STRICT RESPECT DU BUDGET)
    @Test
    fun testBetCalculationMode_DistributedBudgetExact() {
        val sources = listOf("02", "20", "22")
        val loto4 = CombinationEngine.generateLoto4(sources) // 6 combinaisons

        // 60 HTG répartis sur 6 combinaisons = 10 HTG chacune
        val calcExact = CombinationEngine.calculateBetAmounts(
            combinations = loto4,
            mode = BetCalculationMode.DISTRIBUTED_BUDGET,
            budgetOrUnitAmount = 60.0
        )
        calcExact.forEach { assertEquals(10.0, it.betAmount, 0.001) }
        assertEquals(60.0, calcExact.sumOf { it.betAmount }, 0.001)

        // Répartition avec reste : 50 HTG sur 6 combinaisons
        // 50 / 6 = 8.33...
        // 5000 centimes / 6 = 833 centimes de base, reste 2 centimes
        // 2 combinaisons auront 8.34 G, 4 combinaisons auront 8.33 G
        val calcWithRemainder = CombinationEngine.calculateBetAmounts(
            combinations = loto4,
            mode = BetCalculationMode.DISTRIBUTED_BUDGET,
            budgetOrUnitAmount = 50.0
        )

        val sum = calcWithRemainder.sumOf { it.betAmount }
        assertEquals(50.0, sum, 0.001) // EXACTEMENT 50.0 HTG, aucune perte ni dépassement !
    }

    // 7. MODE 3 : MISE CALCULÉE À PARTIR DES NUMÉROS SOURCES
    @Test
    fun testBetCalculationMode_SourceBased() {
        val sources = listOf("02", "20", "22")
        val sourceBets = mapOf(
            "02" to 10.0,
            "20" to 20.0,
            "22" to 30.0
        )

        val loto4 = CombinationEngine.generateLoto4(sources)

        // Règle MINIMUM
        val minResult = CombinationEngine.calculateBetAmounts(
            combinations = loto4,
            mode = BetCalculationMode.SOURCE_BASED,
            budgetOrUnitAmount = 5.0,
            sourceBets = sourceBets,
            sourceRule = SourceBetRule.MINIMUM
        )

        val comb0220 = minResult.first { it.number == "0220" }
        assertEquals(10.0, comb0220.betAmount, 0.001) // min(10, 20) = 10

        val comb2022 = minResult.first { it.number == "2022" }
        assertEquals(20.0, comb2022.betAmount, 0.001) // min(20, 30) = 20

        // Règle AVERAGE
        val avgResult = CombinationEngine.calculateBetAmounts(
            combinations = loto4,
            mode = BetCalculationMode.SOURCE_BASED,
            budgetOrUnitAmount = 5.0,
            sourceBets = sourceBets,
            sourceRule = SourceBetRule.AVERAGE
        )
        val comb0220Avg = avgResult.first { it.number == "0220" }
        assertEquals(15.0, comb0220Avg.betAmount, 0.001) // avg(10, 20) = 15
    }

    // 8. CALCUL DES TOTAUX DU TICKET (MULTI-TIRAGES ET PRÉCISION MONÉTAIRE)
    @Test
    fun testCalculateTicketTotal() {
        val grids = listOf(
            BetGrid(numbers = listOf("02"), betAmount = 10.0, gameType = "BORLETTE"),
            BetGrid(numbers = listOf("20"), betAmount = 10.0, gameType = "BORLETTE"),
            BetGrid(numbers = listOf("02X20"), betAmount = 5.0, gameType = "MARIAGE"),
            BetGrid(numbers = listOf("0220"), betAmount = 5.0, gameType = "LOTO4"),
            BetGrid(numbers = listOf("102"), betAmount = 5.0, gameType = "LOTO3")
        )

        // 1 tirage
        val singleDrawTotal = CombinationEngine.calculateTicketTotal(grids, drawCount = 1)
        assertEquals(20.0, singleDrawTotal.boletTotal, 0.001)
        assertEquals(5.0, singleDrawTotal.mariageTotal, 0.001)
        assertEquals(5.0, singleDrawTotal.loto4Total, 0.001)
        assertEquals(5.0, singleDrawTotal.loto3Total, 0.001)
        assertEquals(35.0, singleDrawTotal.unitTotal, 0.001)
        assertEquals(35.0, singleDrawTotal.grandTotal, 0.001)
        assertEquals(5, singleDrawTotal.totalCombinationCount)

        // 3 tirages en multi-sélection
        val multiDrawTotal = CombinationEngine.calculateTicketTotal(grids, drawCount = 3)
        assertEquals(35.0, multiDrawTotal.unitTotal, 0.001)
        assertEquals(105.0, multiDrawTotal.grandTotal, 0.001) // 35 * 3 = 105
        assertEquals(3, multiDrawTotal.drawCount)
    }

    // 9. VALIDATION DU TICKET AVANT CONFIRMATION
    @Test
    fun testValidateTicket() {
        val openDraw = OpenDrawItem(
            id = "draw-1",
            drawNumber = 101,
            status = "OPEN",
            salesClosingAt = "2026-10-18T22:00:00",
            scheduledAt = "2026-10-18T22:30:00",
            game = OpenDrawGame(id = "g-1", code = "BOLET_NY", name = "New York")
        )

        val closedDraw = openDraw.copy(status = "CLOSED")

        val validGrids = listOf(
            BetGrid(numbers = listOf("12"), betAmount = 10.0, gameType = "BORLETTE")
        )

        // 1. Valide sur tirage OPEN
        val resOk = CombinationEngine.validateTicket(
            grids = validGrids,
            selectedDraws = listOf(openDraw)
        )
        assertTrue(resOk.isValid)
        assertTrue(resOk.errors.isEmpty())

        // 2. Refus sur tirage CLOSED
        val resClosed = CombinationEngine.validateTicket(
            grids = validGrids,
            selectedDraws = listOf(closedDraw)
        )
        assertFalse(resClosed.isValid)
        assertTrue(resClosed.errors.any { it.contains("pa ouvè") })

        // 3. Détection de doublons (Avertissement)
        val duplicateGrids = listOf(
            BetGrid(numbers = listOf("12"), betAmount = 10.0, gameType = "BORLETTE"),
            BetGrid(numbers = listOf("12"), betAmount = 15.0, gameType = "BORLETTE")
        )
        val resDup = CombinationEngine.validateTicket(
            grids = duplicateGrids,
            selectedDraws = listOf(openDraw)
        )
        assertTrue(resDup.warnings.any { it.contains("repete") })
    }

    // 10. GÉNÉRATION LOTO 3 ET LOTO 5 AVEC PRÉFIXES
    @Test
    fun testGenerateLoto3AndLoto5() {
        val sources = listOf("02", "20")

        val loto3 = CombinationEngine.generateLoto3(sources, prefixes = listOf("1", "4"))
        assertEquals(4, loto3.size)
        val l3Numbers = loto3.map { it.number }
        assertTrue(l3Numbers.containsAll(listOf("102", "120", "402", "420")))

        val loto5 = CombinationEngine.generateLoto5(sources, prefixes = listOf("7"))
        assertEquals(2, loto5.size) // Loto 4 a 2 permutations: 0220, 2002. Avec préfixe 7 -> 70220, 72002
        val l5Numbers = loto5.map { it.number }
        assertTrue(l5Numbers.containsAll(listOf("70220", "72002")))
    }

    // 11. LES CINQ MARIAGES GRATUITS : RÈGLE DES 10 BOULES DISTINCTES
    @Test
    fun testGenerateFiveFreeMarriages_TenDistinctBalls() {
        val playedGrids = listOf(
            BetGrid(numbers = listOf("22"), betAmount = 50.0, gameType = "BORLETTE"),
            BetGrid(numbers = listOf("10"), betAmount = 25.0, gameType = "BORLETTE")
        )

        val freeMarriages = CombinationEngine.generateFiveFreeMarriages(playedGrids)

        // Exactement 5 mariages gratuits
        assertEquals(5, freeMarriages.size)

        // Tous les mariages doivent avoir la mise à 0 HTG et le flag isGratis
        freeMarriages.forEach {
            assertEquals(0.0, it.betAmount, 0.0001)
            assertTrue(it.isGratis == true)
            assertEquals("GRATIS", it.option)
            assertEquals("MARIAGE", it.gameType)
            assertEquals(2, it.numbers.size)
        }

        // Récupérer les 10 boules au total
        val allTenBalls = freeMarriages.flatMap { it.numbers }
        assertEquals(10, allTenBalls.size)

        // RÈGLE OBLIGATOIRE : Les 10 boules doivent être TOUTES DISTINCTES les unes des autres (zéro doublon)
        assertEquals(10, allTenBalls.distinct().size)
    }

    // 12. LES CINQ MARIAGES GRATUITS : RÈGLE D'EXCLUSION ABSOLUE DES NUMÉROS JOUÉS
    @Test
    fun testGenerateFiveFreeMarriages_StrictExclusionOfPlayedNumbers() {
        // Le client joue Borlette 22, Loto 3 145, Loto 4 0220, Mariage 08X19
        val playedGrids = listOf(
            BetGrid(numbers = listOf("22"), betAmount = 50.0, gameType = "BORLETTE"),
            BetGrid(numbers = listOf("145"), betAmount = 20.0, gameType = "LOTO3"),
            BetGrid(numbers = listOf("0220"), betAmount = 20.0, gameType = "LOTO4"),
            BetGrid(numbers = listOf("08", "19"), betAmount = 10.0, gameType = "MARIAGE")
        )

        val playedBalls = CombinationEngine.extractAllPlayedBalls(playedGrids)
        // Vérifier que tous les numéros joués sont bien répertoriés
        assertTrue(playedBalls.contains("22"))
        assertTrue(playedBalls.contains("45")) // de 145
        assertTrue(playedBalls.contains("02")) // de 0220
        assertTrue(playedBalls.contains("20")) // de 0220
        assertTrue(playedBalls.contains("08")) // de 08
        assertTrue(playedBalls.contains("19")) // de 19

        val freeMarriages = CombinationEngine.generateFiveFreeMarriages(playedGrids)
        val allTenBalls = freeMarriages.flatMap { it.numbers }

        // RÈGLE OBLIGATOIRE : Aucune des 10 boules ne peut figurer parmi les numéros joués !
        for (ball in allTenBalls) {
            assertFalse(
                "La boule gratuite $ball ne doit JAMAIS faire partie des numéros joués !",
                playedBalls.contains(ball)
            )
        }
    }

    // 13. LES CINQ MARIAGES GRATUITS : STABILITÉ ET DÉTERMINISME
    @Test
    fun testGenerateFiveFreeMarriages_Stability() {
        val playedGrids1 = listOf(
            BetGrid(numbers = listOf("22"), betAmount = 50.0, gameType = "BORLETTE"),
            BetGrid(numbers = listOf("16"), betAmount = 20.0, gameType = "BORLETTE")
        )

        // Même ticket mais avec une mise différente
        val playedGrids2 = listOf(
            BetGrid(numbers = listOf("22"), betAmount = 100.0, gameType = "BORLETTE"),
            BetGrid(numbers = listOf("16"), betAmount = 50.0, gameType = "BORLETTE")
        )

        val run1 = CombinationEngine.generateFiveFreeMarriages(playedGrids1)
        val run2 = CombinationEngine.generateFiveFreeMarriages(playedGrids2)

        val pairs1 = run1.map { it.numbers.joinToString("X") }
        val pairs2 = run2.map { it.numbers.joinToString("X") }

        // La génération doit être stable et reproductible
        assertEquals(pairs1, pairs2)
    }
}
