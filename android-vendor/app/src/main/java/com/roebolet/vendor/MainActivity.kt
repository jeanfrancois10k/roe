package com.roebolet.vendor

import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.*
import androidx.lifecycle.lifecycleScope
import com.roebolet.vendor.data.api.PinLoginRequest
import com.roebolet.vendor.data.api.RoeApiService
import com.roebolet.vendor.data.api.VerifyTicketRequest
import com.roebolet.vendor.data.api.VerifyTicketResponse
import com.roebolet.vendor.data.api.PayTicketRequest
import com.roebolet.vendor.data.local.PreferencesManager
import com.roebolet.vendor.data.socket.SocketManager
import com.roebolet.vendor.ui.dashboard.DashboardScreen
import com.roebolet.vendor.ui.login.LoginScreen
import com.roebolet.vendor.ui.verify.VerifyTicketScreen
import com.roebolet.vendor.ui.theme.RoeBoletTheme
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
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
        networkMonitor = com.roebolet.vendor.data.network.NetworkMonitor(applicationContext)
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

        // État spécifique pour l'écran de vérification de tickets
        var verifyResult by remember { mutableStateOf<VerifyTicketResponse?>(null) }
        var verifyLoading by remember { mutableStateOf(false) }
        var verifyError by remember { mutableStateOf<String?>(null) }

        val deviceUuid = remember { prefs.getOrCreateDeviceUuid() }

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

        // Configuration de l'écouteur de KILL SWITCH
        LaunchedEffect(Unit) {
            socketManager.setOnForceLogoutListener { reason ->
                prefs.clearSession()
                isAuthenticated = false
                currentScreen = "DASHBOARD"
                errorMessage = "🚨 VERROUILLAGE SÉCURITÉ : $reason"
                Toast.makeText(this@MainActivity, reason, Toast.LENGTH_LONG).show()
            }
        }

        // Connexion WebSocket si déjà authentifié
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
                                    val token = "Bearer ${prefs.getAccessToken()}"
                                    val response = apiService.verifyTicket(token, VerifyTicketRequest(query = query))
                                    if (response.isSuccessful && response.body() != null) {
                                        verifyResult = response.body()
                                    } else {
                                        val err = response.errorBody()?.string() ?: "Ticket introuvable"
                                        verifyError = "Ticket introuvable ou numéro invalide"
                                        verifyResult = null
                                    }
                                } catch (e: Exception) {
                                    verifyError = "Erreur de communication : ${e.localizedMessage ?: "Vérifiez la connexion"}"
                                    verifyResult = null
                                } finally {
                                    verifyLoading = false
                                }
                            }
                        },
                        onPayClick = { ticketId ->
                            verifyLoading = true
                            verifyError = null
                            lifecycleScope.launch {
                                try {
                                    val token = "Bearer ${prefs.getAccessToken()}"
                                    val response = apiService.payTicket(
                                        token,
                                        PayTicketRequest(ticketId = ticketId, deviceUuid = deviceUuid)
                                    )
                                    if (response.isSuccessful && response.body() != null) {
                                        val body = response.body()!!
                                        Toast.makeText(this@MainActivity, body.message, Toast.LENGTH_LONG).show()
                                        if (body.vendor != null) {
                                            balance = body.vendor.newBalance
                                            prefs.saveAuthData(
                                                token = prefs.getAccessToken() ?: "",
                                                refreshToken = prefs.getRefreshToken() ?: "",
                                                vendorId = prefs.getVendorId(),
                                                vendorCode = vendorCode,
                                                fullName = vendorName,
                                                balance = body.vendor.newBalance
                                            )
                                        }
                                        // Mise à jour de l'affichage en DÉJÀ PAYÉ
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
                else -> {
                    DashboardScreen(
                        vendorCode = vendorCode,
                        vendorName = vendorName,
                        balance = balance,
                        isOnline = isNetworkAvailable,
                        pendingSyncCount = pendingSyncCount,
                        onMenuClick = { action ->
                            when (action) {
                                "VÉRIFIER TICKET" -> {
                                    currentScreen = "VERIFY_TICKET"
                                    verifyResult = null
                                    verifyError = null
                                }
                                "SYNCHRO" -> {
                                    lifecycleScope.launch {
                                        Toast.makeText(this@MainActivity, "Synchronisation manuelle en cours...", Toast.LENGTH_SHORT).show()
                                        val token = prefs.getAccessToken() ?: return@launch
                                        val syncRes = syncManager.syncPendingBatch(apiService, token, deviceUuid)
                                        if (syncRes != null) {
                                            balance = syncRes.delta.vendorBalance
                                            Toast.makeText(
                                                this@MainActivity,
                                                "✅ Synchronisé : ${syncRes.summary.success} validés, ${syncRes.summary.duplicates} doublons",
                                                Toast.LENGTH_LONG
                                            ).show()
                                        } else {
                                            Toast.makeText(this@MainActivity, "❌ Échec de la synchronisation", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                }
                                else -> {
                                    Toast.makeText(this, "Module $action sélectionné (Phase Suivante)", Toast.LENGTH_SHORT).show()
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
                                    prefs.saveAuthData(
                                        token = body.accessToken,
                                        refreshToken = body.refreshToken,
                                        vendorId = vendor.id,
                                        vendorCode = vendor.vendorCode,
                                        fullName = vendor.fullName,
                                        balance = vendor.currentBalance
                                    )
                                    vendorCode = vendor.vendorCode
                                    vendorName = vendor.fullName
                                    balance = vendor.currentBalance
                                    isAuthenticated = true
                                    Toast.makeText(this@MainActivity, "Connexion réussie", Toast.LENGTH_SHORT).show()
                                } else {
                                    errorMessage = "Profil vendeur manquant"
                                }
                            } else {
                                val errorBody = response.errorBody()?.string()
                                errorMessage = if (errorBody?.contains("suspendu") == true) {
                                    "Ce compte vendeur est SUSPENDU par l’administrateur."
                                } else {
                                    "Code vendeur ou PIN incorrect."
                                }
                            }
                        } catch (e: Exception) {
                            errorMessage = "Erreur de connexion au serveur : ${e.localizedMessage ?: "Vérifiez le réseau"}"
                        } finally {
                            isLoading = false
                        }
                    }
                }
            )
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        socketManager.disconnect()
    }
}
