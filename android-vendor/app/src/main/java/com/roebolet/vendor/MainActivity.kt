package com.roebolet.vendor

import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.*
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import com.roebolet.vendor.data.api.*
import com.roebolet.vendor.data.local.PreferencesManager
import com.roebolet.vendor.data.network.NetworkMonitor
import com.roebolet.vendor.data.socket.SocketManager
import com.roebolet.vendor.ui.balance.BalanceScreen
import com.roebolet.vendor.ui.control.ControlScreen
import com.roebolet.vendor.ui.dashboard.DashboardScreen
import com.roebolet.vendor.ui.login.LoginScreen
import com.roebolet.vendor.ui.results.ResultsScreen
import com.roebolet.vendor.ui.reports.SalesReportScreen
import com.roebolet.vendor.ui.sell.SellTicketScreen
import com.roebolet.vendor.ui.settings.SettingsScreen
import com.roebolet.vendor.ui.tickets.TicketsListScreen
import com.roebolet.vendor.ui.verify.VerifyTicketScreen
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.roebolet.vendor.ui.theme.*
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.UUID
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {

    private lateinit var prefs: PreferencesManager
    private lateinit var apiService: RoeApiService
    private lateinit var networkMonitor: NetworkMonitor
    private val socketManager = SocketManager.instance
    private val syncManager = com.roebolet.vendor.data.sync.SyncManager.instance

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        prefs = (application as RoeBoletApp).preferencesManager
        networkMonitor = NetworkMonitor(applicationContext)
        initRetrofit()

        setContent {
            RoeBoletTheme {
                AppNavigator()
            }
        }
    }

    private fun initRetrofit() {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(logging)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl(prefs.getServerUrl())
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        apiService = retrofit.create(RoeApiService::class.java)
    }

    @Composable
    private fun AppNavigator() {
        var isAuthenticated by remember { mutableStateOf(prefs.getAccessToken() != null) }
        var currentScreen by remember { mutableStateOf("DASHBOARD") }
        var vendorCode by remember { mutableStateOf(prefs.getVendorCode()) }
        var vendorName by remember { mutableStateOf(prefs.getVendorName()) }
        var balance by remember { mutableStateOf(prefs.getBalance()) }
        val isNetworkAvailable by networkMonitor.isOnline.collectAsState()
        val pendingSyncCount by syncManager.pendingCount.collectAsState()
        var errorMessage by remember { mutableStateOf<String?>(null) }
        var isLoading by remember { mutableStateOf(false) }

        // Langue de l'application (Kreyòl par défaut, Français)
        var currentLanguage by remember {
            mutableStateOf(
                if (prefs.getLanguage() == "fr") com.roebolet.vendor.util.AppLanguage.FRENCH
                else com.roebolet.vendor.util.AppLanguage.CREOLE
            )
        }

        fun handleLanguageChange(newLang: com.roebolet.vendor.util.AppLanguage) {
            currentLanguage = newLang
            prefs.setLanguage(newLang.code)
        }

        // État Vérification de Tickets
        var verifyResult by remember { mutableStateOf<VerifyTicketResponse?>(null) }
        var verifyLoading by remember { mutableStateOf(false) }
        var verifyError by remember { mutableStateOf<String?>(null) }

        // État Vente de Tickets
        var openDraws by remember { mutableStateOf<List<OpenDrawItem>>(emptyList()) }
        var isLoadingDraws by remember { mutableStateOf(false) }
        var isSubmittingTicket by remember { mutableStateOf(false) }
        var sellTicketError by remember { mutableStateOf<String?>(null) }
        var soldTicketResults by remember { mutableStateOf<List<SellTicketResponse>?>(null) }
        var replayTicket by remember { mutableStateOf<VendorTicketItem?>(null) }

        // État Historique & Tickets
        var vendorTickets by remember { mutableStateOf<List<VendorTicketItem>>(emptyList()) }
        var isLoadingTickets by remember { mutableStateOf(false) }
        var isCancellingTicket by remember { mutableStateOf(false) }

        // État Résultats des Tirages
        var drawResults by remember { mutableStateOf<List<DrawResultItem>>(emptyList()) }
        var isLoadingResults by remember { mutableStateOf(false) }

        // État Mise à jour de l'application (OTA)
        var updateInfo by remember { mutableStateOf<AppUpdateInfo?>(null) }
        var showUpdateDialog by remember { mutableStateOf(false) }

        // État Contrôle Journalier & Règlement
        var controlSummary by remember { mutableStateOf<ControlSummaryResponse?>(null) }
        var isLoadingControl by remember { mutableStateOf(false) }
        var controlError by remember { mutableStateOf<String?>(null) }

        // État Rapport des Ventes
        var salesReport by remember { mutableStateOf<SalesReportResponse?>(null) }
        var selectedReportPeriod by remember { mutableStateOf("day") }
        var isLoadingReport by remember { mutableStateOf(false) }
        var reportError by remember { mutableStateOf<String?>(null) }

        val deviceUuid = remember { prefs.getOrCreateDeviceUuid() }

        suspend fun attemptTokenRefresh(): String? {
            val currentRefreshToken = prefs.getRefreshToken() ?: return null
            return try {
                val res = apiService.refreshToken(RefreshTokenRequest(currentRefreshToken))
                if (res.isSuccessful && res.body() != null) {
                    val body = res.body()!!
                    prefs.updateTokens(body.accessToken, body.refreshToken)
                    body.accessToken
                } else {
                    null
                }
            } catch (e: Exception) {
                null
            }
        }

        fun onSessionExpired() {
            prefs.clearSession()
            isAuthenticated = false
            currentScreen = "DASHBOARD"
            errorMessage = if (currentLanguage == com.roebolet.vendor.util.AppLanguage.CREOLE)
                "Sesyon w lan ekspire. Tanpri rekonekte ak PIN ou."
            else
                "Votre session a expiré. Veuillez vous reconnecter avec votre code et PIN."
        }

        fun fetchSalesReport(period: String = selectedReportPeriod) {
            selectedReportPeriod = period
            lifecycleScope.launch {
                isLoadingReport = true
                reportError = null
                try {
                    var token = prefs.getAccessToken() ?: return@launch
                    var res = apiService.getSalesReport("Bearer $token", period = period)
                    if (res.code() == 401) {
                        val refreshed = attemptTokenRefresh()
                        if (refreshed != null) {
                            token = refreshed
                            res = apiService.getSalesReport("Bearer $token", period = period)
                        } else {
                            onSessionExpired()
                            return@launch
                        }
                    }

                    if (res.isSuccessful && res.body() != null) {
                        salesReport = res.body()
                    } else {
                        reportError = "Erreur chargement rapport (HTTP ${res.code()})"
                    }
                } catch (e: Exception) {
                    reportError = "Erreur réseau : ${e.localizedMessage ?: "Rapport indisponible"}"
                } finally {
                    isLoadingReport = false
                }
            }
        }

        fun fetchControlSummary() {
            lifecycleScope.launch {
                isLoadingControl = true
                controlError = null
                try {
                    var token = prefs.getAccessToken() ?: return@launch
                    var res = apiService.getControlSummary("Bearer $token")
                    if (res.code() == 401) {
                        val refreshed = attemptTokenRefresh()
                        if (refreshed != null) {
                            token = refreshed
                            res = apiService.getControlSummary("Bearer $token")
                        } else {
                            onSessionExpired()
                            return@launch
                        }
                    }

                    if (res.isSuccessful && res.body() != null) {
                        controlSummary = res.body()
                    } else {
                        val errBody = res.errorBody()?.string() ?: ""
                        val msg = try {
                            org.json.JSONObject(errBody).optString("message", "Erreur lors du calcul du contrôle (HTTP ${res.code()})")
                        } catch (e: Exception) {
                            "Erreur lors du calcul du contrôle (HTTP ${res.code()})"
                        }
                        controlError = msg
                    }
                } catch (e: Exception) {
                    controlError = "Erreur réseau : ${e.message}"
                } finally {
                    isLoadingControl = false
                }
            }
        }

        fun fetchOpenDraws() {
            lifecycleScope.launch {
                isLoadingDraws = true
                try {
                    val res = apiService.getOpenDraws()
                    if (res.isSuccessful && res.body() != null) {
                        openDraws = res.body()!!
                    }
                } catch (e: Exception) {
                    // Erreur silencieuse
                } finally {
                    isLoadingDraws = false
                }
            }
        }

        fun fetchVendorTickets() {
            lifecycleScope.launch {
                isLoadingTickets = true
                try {
                    var token = prefs.getAccessToken() ?: return@launch
                    var res = apiService.getVendorTickets("Bearer $token", 40)
                    if (res.code() == 401) {
                        val refreshed = attemptTokenRefresh()
                        if (refreshed != null) {
                            token = refreshed
                            res = apiService.getVendorTickets("Bearer $token", 40)
                        } else {
                            onSessionExpired()
                            return@launch
                        }
                    }

                    if (res.isSuccessful && res.body() != null) {
                        vendorTickets = res.body()!!.items
                    }
                } catch (e: Exception) {
                    // Erreur silencieuse
                } finally {
                    isLoadingTickets = false
                }
            }
        }

        fun cancelTicket(ticketId: String) {
            lifecycleScope.launch {
                isCancellingTicket = true
                try {
                    var token = prefs.getAccessToken() ?: return@launch
                    var res = apiService.cancelTicket("Bearer $token", CancelTicketRequest(ticketId = ticketId))
                    if (res.code() == 401) {
                        val refreshed = attemptTokenRefresh()
                        if (refreshed != null) {
                            token = refreshed
                            res = apiService.cancelTicket("Bearer $token", CancelTicketRequest(ticketId = ticketId))
                        } else {
                            onSessionExpired()
                            return@launch
                        }
                    }

                    if (res.isSuccessful && res.body() != null) {
                        val body = res.body()!!
                        Toast.makeText(this@MainActivity, body.message, Toast.LENGTH_LONG).show()
                        if (body.newBalance != null) {
                            balance = body.newBalance
                            prefs.updateBalance(body.newBalance)
                        }
                        fetchVendorTickets()
                    } else {
                        val errBody = res.errorBody()?.string() ?: ""
                        val msg = try {
                            org.json.JSONObject(errBody).optString("message", "Erreur lors de l'annulation")
                        } catch (e: Exception) {
                            "Erreur lors de l'annulation (HTTP ${res.code()})"
                        }
                        Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show()
                    }
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "Erreur réseau : ${e.localizedMessage ?: "Annulation impossible"}", Toast.LENGTH_LONG).show()
                } finally {
                    isCancellingTicket = false
                }
            }
        }

        fun searchTicketByNumber(ticketNumber: String, onComplete: (VendorTicketItem?) -> Unit) {
            lifecycleScope.launch {
                try {
                    var token = prefs.getAccessToken()
                    if (token == null) {
                        onComplete(null)
                        return@launch
                    }
                    var res = apiService.getTicketByNumber("Bearer $token", ticketNumber.trim())
                    if (res.code() == 401) {
                        val refreshed = attemptTokenRefresh()
                        if (refreshed != null) {
                            token = refreshed
                            res = apiService.getTicketByNumber("Bearer $token", ticketNumber.trim())
                        } else {
                            onSessionExpired()
                            onComplete(null)
                            return@launch
                        }
                    }

                    if (res.isSuccessful && res.body() != null) {
                        onComplete(res.body())
                    } else {
                        onComplete(null)
                    }
                } catch (e: Exception) {
                    onComplete(null)
                }
            }
        }

        fun fetchDrawResults() {
            lifecycleScope.launch {
                isLoadingResults = true
                try {
                    val res = apiService.getTodayResults()
                    if (res.isSuccessful && res.body() != null) {
                        drawResults = res.body()!!
                    }
                } catch (e: Exception) {
                    // Erreur silencieuse
                } finally {
                    isLoadingResults = false
                }
            }
        }

        // Auto-synchronisation dès la reconnexion Internet
        LaunchedEffect(isNetworkAvailable, isAuthenticated) {
            if (isNetworkAvailable && isAuthenticated && pendingSyncCount > 0) {
                lifecycleScope.launch {
                    val token = prefs.getAccessToken() ?: return@launch
                    val syncRes = syncManager.syncPendingBatch(apiService, token, deviceUuid)
                    if (syncRes != null) {
                        balance = syncRes.delta.vendorBalance
                        Toast.makeText(
                            this@MainActivity,
                            "Auto-synchronisation terminée : ${syncRes.summary.success} tickets validés",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }
            }
        }

        // Configuration du KILL SWITCH
        LaunchedEffect(Unit) {
            socketManager.setOnForceLogoutListener { reason ->
                prefs.clearSession()
                isAuthenticated = false
                currentScreen = "DASHBOARD"
                errorMessage = "🚨 VERROUILLAGE SÉCURITÉ : $reason"
                Toast.makeText(this@MainActivity, reason, Toast.LENGTH_LONG).show()
            }
        }

        // Connexion WebSocket si authentifié
        LaunchedEffect(isAuthenticated) {
            if (isAuthenticated) {
                val vendorId = prefs.getVendorId()
                if (vendorId.isNotEmpty()) {
                    socketManager.connect(prefs.getServerUrl(), vendorId, deviceUuid)
                }
            } else {
                socketManager.disconnect()
            }
        }

        // Vérification automatique des mises à jour Over-The-Air (OTA)
        var isCheckingUpdateManual by remember { mutableStateOf(false) }

        fun checkUpdateManual() {
            lifecycleScope.launch {
                isCheckingUpdateManual = true
                try {
                    val updateRes = apiService.checkAppUpdate()
                    if (updateRes.isSuccessful && updateRes.body() != null) {
                        val info = updateRes.body()!!
                        val currentVersionCode = 4
                        if (info.latestVersionCode > currentVersionCode) {
                            updateInfo = info
                            showUpdateDialog = true
                        } else {
                            val msg = if (currentLanguage == com.roebolet.vendor.util.AppLanguage.CREOLE)
                                "Aplikasyon w lan ajou deja (v1.0.3)"
                            else
                                "Votre application est déjà à jour (v1.0.3)"
                            Toast.makeText(this@MainActivity, msg, Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        Toast.makeText(this@MainActivity, "Impossible de vérifier la mise à jour", Toast.LENGTH_SHORT).show()
                    }
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "Erreur réseau : ${e.localizedMessage ?: "Vérification impossible"}", Toast.LENGTH_SHORT).show()
                } finally {
                    isCheckingUpdateManual = false
                }
            }
        }

        LaunchedEffect(isNetworkAvailable) {
            if (isNetworkAvailable) {
                lifecycleScope.launch {
                    try {
                        val updateRes = apiService.checkAppUpdate()
                        if (updateRes.isSuccessful && updateRes.body() != null) {
                            val info = updateRes.body()!!
                            val currentVersionCode = 4
                            if (info.latestVersionCode > currentVersionCode) {
                                updateInfo = info
                                showUpdateDialog = true
                            }
                        }

                        val settingsRes = apiService.getSettings()
                        if (settingsRes.isSuccessful && settingsRes.body()?.lottery != null) {
                            val lot = settingsRes.body()!!.lottery!!
                            prefs.saveLotteryInfo(
                                companyName = lot.companyName,
                                companySlogan = lot.companySlogan ?: "Juétwèt",
                                phone = lot.companyPhone ?: "42327120",
                                bankRef = lot.bankRef ?: "bank 6",
                                headerNote = lot.ticketHeaderNote ?: "*** ORIGINAL FICHE ***",
                                footerNote = lot.ticketFooterNote ?: "FICH SA VALAB SELMAN POU 90 JOU, FICHE PAYABLE AU PORTEUR",
                                providerInfo = lot.ticketProviderInfo ?: "ROE-TECH",
                                mariageGratuitNote = lot.mariageGratuitNote ?: "MARYAJ GRATIS 1500 GDES"
                            )
                        }
                    } catch (e: Exception) {
                        // Ignorer silencieusement si hors-ligne
                    }
                }
            }
        }

        if (isAuthenticated) {
            when (currentScreen) {
                "SELL_TICKET" -> {
                    SellTicketScreen(
                        openDraws = openDraws,
                        isLoadingDraws = isLoadingDraws,
                        isSubmitting = isSubmittingTicket,
                        errorMessage = sellTicketError,
                        soldTicketResults = soldTicketResults,
                        currentLanguage = currentLanguage,
                        vendorCode = vendorCode,
                        vendorName = vendorName,
                        deviceUuid = deviceUuid,
                        initialTicketToReplay = replayTicket,
                        onResetReplay = { replayTicket = null },
                        onBackClick = {
                            currentScreen = "DASHBOARD"
                            sellTicketError = null
                        },
                        onSubmitTicket = { targetDraws, grids ->
                            lifecycleScope.launch {
                                isSubmittingTicket = true
                                sellTicketError = null
                                try {
                                    var token = prefs.getAccessToken() ?: return@launch
                                    val successfulSales = mutableListOf<SellTicketResponse>()
                                    var totalCharged = 0.0
                                    var lastErr = ""

                                    for (draw in targetDraws) {
                                        val idempotencyKey = UUID.randomUUID().toString()
                                        val request = SellTicketRequest(
                                            gameId = draw.game.id,
                                            drawId = draw.id,
                                            deviceUuid = deviceUuid,
                                            idempotencyKey = idempotencyKey,
                                            grids = grids
                                        )
                                        var response = apiService.sellTicket("Bearer $token", request)
                                        if (response.code() == 401) {
                                            val refreshed = attemptTokenRefresh()
                                            if (refreshed != null) {
                                                token = refreshed
                                                response = apiService.sellTicket("Bearer $token", request)
                                            } else {
                                                onSessionExpired()
                                                return@launch
                                            }
                                        }

                                        if (response.isSuccessful && response.body() != null) {
                                            val sold = response.body()!!
                                            successfulSales.add(sold)
                                            totalCharged += sold.totalAmount
                                        } else {
                                            val errBody = response.errorBody()?.string() ?: ""
                                            lastErr = try {
                                                org.json.JSONObject(errBody).optString("message", "Erreur de vente sur tirage ${draw.game.name}")
                                            } catch (e: Exception) {
                                                "Erreur sur tirage ${draw.game.name} (HTTP ${response.code()})"
                                            }
                                        }
                                    }

                                    if (successfulSales.isNotEmpty()) {
                                        val lastSale = successfulSales.lastOrNull()
                                        if (lastSale?.newBalance != null) {
                                            balance = lastSale.newBalance!!
                                        } else {
                                            val defaultComm = totalCharged * 0.05
                                            balance -= (totalCharged - defaultComm)
                                        }
                                        prefs.updateBalance(balance)
                                        soldTicketResults = successfulSales
                                        fetchVendorTickets()
                                    }

                                    if (lastErr.isNotEmpty()) {
                                        if (successfulSales.isEmpty()) {
                                            sellTicketError = lastErr
                                        } else {
                                            Toast.makeText(this@MainActivity, "Tiraj ki echwe : $lastErr", Toast.LENGTH_LONG).show()
                                        }
                                    }
                                } catch (e: Exception) {
                                    sellTicketError = "Erreur réseau : ${e.localizedMessage ?: "Vente impossible"}"
                                } finally {
                                    isSubmittingTicket = false
                                }
                            }
                        },
                        onDismissReceipt = {
                            soldTicketResults = null
                        },
                        onSearchTicketByNumber = { code, callback ->
                            searchTicketByNumber(code, callback)
                        }
                    )
                }

                "VERIFY_TICKET" -> {
                    VerifyTicketScreen(
                        isLoading = verifyLoading,
                        verificationResult = verifyResult,
                        errorMessage = verifyError,
                        onVerifyClick = { query ->
                            verifyLoading = true
                            verifyError = null
                            lifecycleScope.launch {
                                try {
                                    var token = prefs.getAccessToken() ?: ""
                                    var response = apiService.verifyTicket(
                                        "Bearer $token",
                                        VerifyTicketRequest(query = query.trim())
                                    )
                                    if (response.code() == 401) {
                                        val refreshed = attemptTokenRefresh()
                                        if (refreshed != null) {
                                            token = refreshed
                                            response = apiService.verifyTicket(
                                                "Bearer $token",
                                                VerifyTicketRequest(query = query.trim())
                                            )
                                        } else {
                                            onSessionExpired()
                                            return@launch
                                        }
                                    }

                                    if (response.isSuccessful && response.body() != null) {
                                        verifyResult = response.body()
                                    } else {
                                        verifyError = "Ticket introuvable ou invalide"
                                    }
                                } catch (e: Exception) {
                                    verifyError = "Erreur de connexion : ${e.localizedMessage ?: "Vérification impossible"}"
                                } finally {
                                    verifyLoading = false
                                }
                            }
                        },
                        onPayClick = { ticketId ->
                            verifyLoading = true
                            lifecycleScope.launch {
                                try {
                                    var token = prefs.getAccessToken() ?: ""
                                    var response = apiService.payTicket(
                                        "Bearer $token",
                                        PayTicketRequest(ticketId = ticketId, deviceUuid = deviceUuid)
                                    )
                                    if (response.code() == 401) {
                                        val refreshed = attemptTokenRefresh()
                                        if (refreshed != null) {
                                            token = refreshed
                                            response = apiService.payTicket(
                                                "Bearer $token",
                                                PayTicketRequest(ticketId = ticketId, deviceUuid = deviceUuid)
                                            )
                                        } else {
                                            onSessionExpired()
                                            return@launch
                                        }
                                    }

                                    if (response.isSuccessful && response.body() != null) {
                                        val body = response.body()!!
                                        Toast.makeText(this@MainActivity, body.message, Toast.LENGTH_LONG).show()
                                        if (body.vendor != null) {
                                            balance = body.vendor.newBalance
                                            prefs.updateBalance(body.vendor.newBalance)
                                        }
                                        verifyResult = verifyResult?.copy(
                                            canBePaid = false,
                                            statusKey = "ALREADY_PAID",
                                            statusLabel = "TICKET DÉJÀ PAYÉ"
                                        )
                                    } else {
                                        verifyError = "Erreur de paiement : ce ticket a peut-être déjà été payé."
                                    }
                                } catch (e: Exception) {
                                    verifyError = "Erreur : ${e.localizedMessage ?: "Impossible de finaliser le paiement"}"
                                } finally {
                                    verifyLoading = false
                                }
                            }
                        },
                        onBackClick = {
                            currentScreen = "DASHBOARD"
                            verifyResult = null
                            verifyError = null
                        }
                    )
                }

                "TICKETS_LIST" -> {
                    TicketsListScreen(
                        title = "MES TICKETS VENDUS",
                        tickets = vendorTickets,
                        isLoading = isLoadingTickets,
                        isCancelling = isCancellingTicket,
                        currentLanguage = currentLanguage,
                        vendorCode = vendorCode,
                        vendorName = vendorName,
                        deviceUuid = deviceUuid,
                        onBackClick = { currentScreen = "DASHBOARD" },
                        onRefreshClick = { fetchVendorTickets() },
                        onReplayTicket = { ticket ->
                            replayTicket = ticket
                            currentScreen = "SELL_TICKET"
                            fetchOpenDraws()
                        },
                        onCancelTicket = { ticketId ->
                            cancelTicket(ticketId)
                        },
                        onSearchServerTicket = { code, callback ->
                            searchTicketByNumber(code, callback)
                        }
                    )
                }

                "DRAWS_RESULTS" -> {
                    ResultsScreen(
                        results = drawResults,
                        isLoading = isLoadingResults,
                        onBackClick = { currentScreen = "DASHBOARD" },
                        onRefreshClick = { fetchDrawResults() }
                    )
                }

                "CONTROL", "CONTRÔLE" -> {
                    ControlScreen(
                        vendorCode = vendorCode,
                        vendorName = vendorName,
                        controlSummary = controlSummary,
                        salesReport = salesReport,
                        selectedPeriod = selectedReportPeriod,
                        isLoading = isLoadingControl || isLoadingReport,
                        errorMessage = controlError ?: reportError,
                        currentLanguage = currentLanguage,
                        onPeriodChange = { newPeriod ->
                            fetchSalesReport(newPeriod)
                        },
                        onRefreshClick = {
                            fetchControlSummary()
                            fetchSalesReport(selectedReportPeriod)
                        },
                        onBackClick = { currentScreen = "DASHBOARD" }
                    )
                }

                "REPORTS", "RAPÒ", "RAPÒ VANT", "RAPPORTS" -> {
                    SalesReportScreen(
                        report = salesReport,
                        isLoading = isLoadingReport,
                        errorMessage = reportError,
                        selectedPeriod = selectedReportPeriod,
                        currentLanguage = currentLanguage,
                        vendorCode = vendorCode,
                        vendorName = vendorName,
                        onPeriodChange = { newPeriod -> fetchSalesReport(newPeriod) },
                        onRefreshClick = { fetchSalesReport(selectedReportPeriod) },
                        onBackClick = { currentScreen = "DASHBOARD" }
                    )
                }

                "BALANCE_DETAILS" -> {
                    BalanceScreen(
                        vendorCode = vendorCode,
                        vendorName = vendorName,
                        balance = balance,
                        onBackClick = { currentScreen = "DASHBOARD" }
                    )
                }

                "SETTINGS" -> {
                    SettingsScreen(
                        currentServerUrl = prefs.getServerUrl(),
                        deviceUuid = deviceUuid,
                        isOnline = isNetworkAvailable,
                        currentLanguage = currentLanguage,
                        isCheckingUpdate = isCheckingUpdateManual,
                        onLanguageChange = { handleLanguageChange(it) },
                        onCheckUpdateClick = { checkUpdateManual() },
                        onBackClick = { currentScreen = "DASHBOARD" },
                        onSaveServerUrl = { newUrl ->
                            prefs.setServerUrl(newUrl)
                            initRetrofit()
                        }
                    )
                }

                else -> {
                    DashboardScreen(
                        vendorCode = vendorCode,
                        vendorName = vendorName,
                        balance = balance,
                        isOnline = isNetworkAvailable,
                        pendingSyncCount = pendingSyncCount,
                        currentLanguage = currentLanguage,
                        onLanguageChange = { handleLanguageChange(it) },
                        onMenuClick = { action ->
                            when (action) {
                                "SELL", "VENTE", "NOUVO VANT", "NOUVELLE VENTE" -> {
                                    currentScreen = "SELL_TICKET"
                                    fetchOpenDraws()
                                }
                                "VERIFY_TICKET", "VÉRIFIER TICKET", "VERIFYE FICH" -> {
                                    currentScreen = "VERIFY_TICKET"
                                    verifyResult = null
                                    verifyError = null
                                }
                                "TICKETS", "FICH YO" -> {
                                    currentScreen = "TICKETS_LIST"
                                    fetchVendorTickets()
                                }
                                "HISTORY", "HISTORIQUE", "ISTORIK" -> {
                                    currentScreen = "TICKETS_LIST"
                                    fetchVendorTickets()
                                }
                                "RESULTS", "RÉSULTATS", "REZILTA" -> {
                                    currentScreen = "DRAWS_RESULTS"
                                    fetchDrawResults()
                                }
                                "CONTROL", "CONTRÔLE", "SOLDE", "KONTWÒL" -> {
                                    currentScreen = "CONTROL"
                                    fetchControlSummary()
                                    fetchSalesReport(selectedReportPeriod)
                                }
                                "REPORTS", "RAPÒ", "RAPÒ VANT", "RAPPORTS" -> {
                                    currentScreen = "REPORTS"
                                    fetchSalesReport("day")
                                }
                                "SETTINGS", "PARAMÈTRES", "PARAMÈT" -> {
                                    currentScreen = "SETTINGS"
                                }
                                "SYNC", "SYNCHRO", "SENKWO" -> {
                                    lifecycleScope.launch {
                                        Toast.makeText(this@MainActivity, if (currentLanguage == com.roebolet.vendor.util.AppLanguage.CREOLE) "Senkwonizasyon ap fèt..." else "Synchronisation en cours...", Toast.LENGTH_SHORT).show()
                                        val token = prefs.getAccessToken() ?: return@launch
                                        val syncRes = syncManager.syncPendingBatch(apiService, token, deviceUuid)
                                        if (syncRes != null) {
                                            balance = syncRes.delta.vendorBalance
                                            prefs.updateBalance(balance)
                                            fetchOpenDraws()
                                            fetchVendorTickets()
                                            Toast.makeText(
                                                this@MainActivity,
                                                if (currentLanguage == com.roebolet.vendor.util.AppLanguage.CREOLE) "✅ Senkwonize : ${syncRes.summary.success} fich valide" else "✅ Synchronisé : ${syncRes.summary.success} validés",
                                                Toast.LENGTH_LONG
                                            ).show()
                                        } else {
                                            try {
                                                val ctrlRes = apiService.getControlSummary("Bearer $token")
                                                if (ctrlRes.isSuccessful && ctrlRes.body() != null) {
                                                    balance = ctrlRes.body()!!.currentBalance
                                                    prefs.updateBalance(balance)
                                                }
                                                fetchOpenDraws()
                                                fetchVendorTickets()
                                                Toast.makeText(this@MainActivity, if (currentLanguage == com.roebolet.vendor.util.AppLanguage.CREOLE) "✅ Done senkwonize avèk siksè" else "✅ Données synchronisées avec succès", Toast.LENGTH_SHORT).show()
                                            } catch (e: Exception) {
                                                Toast.makeText(this@MainActivity, if (currentLanguage == com.roebolet.vendor.util.AppLanguage.CREOLE) "Fini (Pa gen anyen pou senkwonize)" else "Terminé (Rien à synchroniser)", Toast.LENGTH_SHORT).show()
                                            }
                                        }
                                    }
                                }
                                else -> {
                                    Toast.makeText(this@MainActivity, "Module $action", Toast.LENGTH_SHORT).show()
                                }
                            }
                        },
                        onLogoutClick = {
                            prefs.clearSession()
                            isAuthenticated = false
                            socketManager.disconnect()
                        }
                    )
                }
            }
        } else {
            LoginScreen(
                initialVendorCode = vendorCode,
                deviceUuid = deviceUuid,
                errorMessage = errorMessage,
                isLoading = isLoading,
                currentLanguage = currentLanguage,
                onLanguageChange = { handleLanguageChange(it) },
                onLoginClick = { code, pin ->
                    isLoading = true
                    errorMessage = null

                    lifecycleScope.launch {
                        try {
                            val request = PinLoginRequest(
                                vendorCode = code,
                                pin = pin,
                                deviceUuid = deviceUuid,
                                deviceModel = "${Build.MANUFACTURER} ${Build.MODEL}",
                                osVersion = "Android ${Build.VERSION.RELEASE}",
                                appVersion = "1.0.0"
                            )

                            val response = apiService.loginWithPin(request)
                            if (response.isSuccessful && response.body() != null) {
                                val body = response.body()!!
                                val vendor = body.user.vendor

                                if (vendor != null) {
                                    vendorCode = vendor.vendorCode
                                    vendorName = vendor.fullName
                                    balance = vendor.currentBalance

                                    prefs.saveAuthData(
                                        token = body.accessToken,
                                        refreshToken = body.refreshToken,
                                        vendorId = vendor.id,
                                        vendorCode = vendor.vendorCode,
                                        fullName = vendor.fullName,
                                        balance = vendor.currentBalance
                                    )

                                    isAuthenticated = true
                                    currentScreen = "DASHBOARD"
                                    errorMessage = null
                                } else {
                                    errorMessage = "Le compte connecté n'est pas un profil Vendeur."
                                }
                            } else {
                                errorMessage = "Code Vendeur ou Code PIN incorrect."
                            }
                        } catch (e: Exception) {
                            errorMessage = "Impossible de joindre le serveur. Vérifiez votre connexion Internet."
                        } finally {
                            isLoading = false
                        }
                    }
                }
            )
        }

        // Dialogue modal de mise à jour Over-The-Air (OTA)
        if (showUpdateDialog && updateInfo != null) {
            val info = updateInfo!!
            AlertDialog(
                onDismissRequest = { if (!info.isMandatory) showUpdateDialog = false },
                containerColor = RoeSurface,
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.Info, contentDescription = null, tint = RoeGold)
                        Text(
                            text = "Mise à jour disponible (${info.latestVersionName})",
                            color = Color.White,
                            fontWeight = FontWeight.Black,
                            fontSize = 16.sp
                        )
                    }
                },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(text = info.changelog, color = Color.White, fontSize = 13.sp)
                        Text(
                            text = "Une nouvelle version officielle est disponible. Cliquez sur le bouton ci-dessous pour l'installer directement sur ce terminal.",
                            color = RoeTextMuted,
                            fontSize = 11.sp
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            try {
                                val intent = android.content.Intent(
                                    android.content.Intent.ACTION_VIEW,
                                    android.net.Uri.parse(info.apkUrl)
                                )
                                startActivity(intent)
                            } catch (e: Exception) {
                                Toast.makeText(this@MainActivity, "Erreur : ${e.message}", Toast.LENGTH_SHORT).show()
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = RoeGold),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(
                            text = "METTRE À JOUR MAINTENANT",
                            color = RoeBackground,
                            fontWeight = FontWeight.Black,
                            fontSize = 12.sp
                        )
                    }
                },
                dismissButton = if (!info.isMandatory) {
                    {
                        TextButton(onClick = { showUpdateDialog = false }) {
                            Text("Plus tard", color = RoeTextMuted)
                        }
                    }
                } else null
            )
        }
    }
}
