package com.roebolet.vendor

import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.*
import androidx.lifecycle.lifecycleScope
import com.roebolet.vendor.data.api.*
import com.roebolet.vendor.data.local.PreferencesManager
import com.roebolet.vendor.data.network.NetworkMonitor
import com.roebolet.vendor.data.socket.SocketManager
import com.roebolet.vendor.ui.balance.BalanceScreen
import com.roebolet.vendor.ui.dashboard.DashboardScreen
import com.roebolet.vendor.ui.login.LoginScreen
import com.roebolet.vendor.ui.results.ResultsScreen
import com.roebolet.vendor.ui.sell.SellTicketScreen
import com.roebolet.vendor.ui.settings.SettingsScreen
import com.roebolet.vendor.ui.tickets.TicketsListScreen
import com.roebolet.vendor.ui.verify.VerifyTicketScreen
import com.roebolet.vendor.ui.theme.RoeBoletTheme
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

        // État Vérification de Tickets
        var verifyResult by remember { mutableStateOf<VerifyTicketResponse?>(null) }
        var verifyLoading by remember { mutableStateOf(false) }
        var verifyError by remember { mutableStateOf<String?>(null) }

        // État Vente de Tickets
        var openDraws by remember { mutableStateOf<List<OpenDrawItem>>(emptyList()) }
        var isLoadingDraws by remember { mutableStateOf(false) }
        var isSubmittingTicket by remember { mutableStateOf(false) }
        var sellTicketError by remember { mutableStateOf<String?>(null) }
        var soldTicketResult by remember { mutableStateOf<SellTicketResponse?>(null) }

        // État Historique & Tickets
        var vendorTickets by remember { mutableStateOf<List<VendorTicketItem>>(emptyList()) }
        var isLoadingTickets by remember { mutableStateOf(false) }

        // État Résultats des Tirages
        var drawResults by remember { mutableStateOf<List<DrawResultItem>>(emptyList()) }
        var isLoadingResults by remember { mutableStateOf(false) }

        val deviceUuid = remember { prefs.getOrCreateDeviceUuid() }

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
                    val token = prefs.getAccessToken() ?: return@launch
                    val res = apiService.getVendorTickets("Bearer $token", 40)
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

        if (isAuthenticated) {
            when (currentScreen) {
                "SELL_TICKET" -> {
                    SellTicketScreen(
                        openDraws = openDraws,
                        isLoadingDraws = isLoadingDraws,
                        isSubmitting = isSubmittingTicket,
                        errorMessage = sellTicketError,
                        soldTicketResult = soldTicketResult,
                        onBackClick = {
                            currentScreen = "DASHBOARD"
                            sellTicketError = null
                        },
                        onSubmitTicket = { drawId, gameId, grids ->
                            lifecycleScope.launch {
                                isSubmittingTicket = true
                                sellTicketError = null
                                try {
                                    val token = prefs.getAccessToken() ?: return@launch
                                    val idempotencyKey = UUID.randomUUID().toString()
                                    val request = SellTicketRequest(
                                        gameId = gameId,
                                        drawId = drawId,
                                        deviceUuid = deviceUuid,
                                        idempotencyKey = idempotencyKey,
                                        grids = grids
                                    )
                                    val response = apiService.sellTicket("Bearer $token", request)
                                    if (response.isSuccessful && response.body() != null) {
                                        val sold = response.body()!!
                                        soldTicketResult = sold
                                        balance -= sold.totalAmount
                                        prefs.updateBalance(balance)
                                    } else {
                                        val errBody = response.errorBody()?.string() ?: ""
                                        sellTicketError = if (errBody.isNotEmpty()) {
                                            try {
                                                org.json.JSONObject(errBody).optString("message", errBody)
                                            } catch (e: Exception) {
                                                errBody
                                            }
                                        } else {
                                            "Erreur de vente (HTTP ${response.code()})"
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
                            soldTicketResult = null
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
                                    val token = prefs.getAccessToken() ?: ""
                                    val response = apiService.verifyTicket(
                                        "Bearer $token",
                                        VerifyTicketRequest(query = query.trim())
                                    )
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
                                    val token = prefs.getAccessToken() ?: ""
                                    val response = apiService.payTicket(
                                        "Bearer $token",
                                        PayTicketRequest(ticketId = ticketId, deviceUuid = deviceUuid)
                                    )
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
                        onBackClick = { currentScreen = "DASHBOARD" },
                        onRefreshClick = { fetchVendorTickets() }
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
                        onMenuClick = { action ->
                            when (action) {
                                "VENTE" -> {
                                    currentScreen = "SELL_TICKET"
                                    fetchOpenDraws()
                                }
                                "VÉRIFIER TICKET" -> {
                                    currentScreen = "VERIFY_TICKET"
                                    verifyResult = null
                                    verifyError = null
                                }
                                "TICKETS" -> {
                                    currentScreen = "TICKETS_LIST"
                                    fetchVendorTickets()
                                }
                                "HISTORIQUE" -> {
                                    currentScreen = "TICKETS_LIST"
                                    fetchVendorTickets()
                                }
                                "RÉSULTATS" -> {
                                    currentScreen = "DRAWS_RESULTS"
                                    fetchDrawResults()
                                }
                                "SOLDE" -> {
                                    currentScreen = "BALANCE_DETAILS"
                                }
                                "PARAMÈTRES" -> {
                                    currentScreen = "SETTINGS"
                                }
                                "SYNCHRO" -> {
                                    lifecycleScope.launch {
                                        Toast.makeText(this@MainActivity, "Synchronisation en cours...", Toast.LENGTH_SHORT).show()
                                        val token = prefs.getAccessToken() ?: return@launch
                                        val syncRes = syncManager.syncPendingBatch(apiService, token, deviceUuid)
                                        if (syncRes != null) {
                                            balance = syncRes.delta.vendorBalance
                                            prefs.updateBalance(balance)
                                            Toast.makeText(
                                                this@MainActivity,
                                                "✅ Synchronisé : ${syncRes.summary.success} validés",
                                                Toast.LENGTH_LONG
                                            ).show()
                                        } else {
                                            Toast.makeText(this@MainActivity, "Terminé (Rien à synchroniser)", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                }
                                else -> {
                                    Toast.makeText(this@MainActivity, "Module $action ouvert", Toast.LENGTH_SHORT).show()
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
    }
}
