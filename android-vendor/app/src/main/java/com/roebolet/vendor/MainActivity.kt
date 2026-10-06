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
import com.roebolet.vendor.data.local.PreferencesManager
import com.roebolet.vendor.data.socket.SocketManager
import com.roebolet.vendor.ui.dashboard.DashboardScreen
import com.roebolet.vendor.ui.login.LoginScreen
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
    private val socketManager = SocketManager.instance

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        prefs = (application as RoeBoletApp).preferencesManager
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
        var vendorCode by remember { mutableStateOf(prefs.getVendorCode()) }
        var vendorName by remember { mutableStateOf(prefs.getVendorName()) }
        var balance by remember { mutableStateOf(prefs.getBalance()) }
        var isOnline by remember { mutableStateOf(socketManager.isConnected()) }
        var errorMessage by remember { mutableStateOf<String?>(null) }
        var isLoading by remember { mutableStateOf(false) }

        val deviceUuid = remember { prefs.getOrCreateDeviceUuid() }

        // Configuration de l'écouteur de KILL SWITCH
        LaunchedEffect(Unit) {
            socketManager.setOnForceLogoutListener { reason ->
                prefs.clearSession()
                isAuthenticated = false
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
            DashboardScreen(
                vendorCode = vendorCode,
                vendorName = vendorName,
                balance = balance,
                isOnline = isOnline,
                onMenuClick = { action ->
                    Toast.makeText(this, "Module $action sélectionné (Phase Suivante)", Toast.LENGTH_SHORT).show()
                },
                onLogoutClick = {
                    prefs.clearSession()
                    isAuthenticated = false
                    socketManager.disconnect()
                }
            )
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
