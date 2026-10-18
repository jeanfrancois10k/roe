package com.roebolet.vendor.data.socket

import android.os.Handler
import android.os.Looper
import android.util.Log
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject

class SocketManager private constructor() {

    private var socket: Socket? = null
    private val handler = Handler(Looper.getMainLooper())
    private var heartbeatRunnable: Runnable? = null
    private var onForceLogoutListener: ((String) -> Unit)? = null
    private var onReactivatedListener: (() -> Unit)? = null

    companion object {
        private const val TAG = "RoeSocketManager"
        val instance: SocketManager by lazy { SocketManager() }
    }

    fun setOnForceLogoutListener(listener: (String) -> Unit) {
        this.onForceLogoutListener = listener
    }

    fun setOnReactivatedListener(listener: () -> Unit) {
        this.onReactivatedListener = listener
    }

    fun connect(baseUrl: String, vendorId: String, deviceUuid: String) {
        if (socket?.connected() == true) return

        try {
            val cleanUrl = baseUrl.trimEnd('/') + "/realtime"
            val options = IO.Options().apply {
                query = "vendorId=$vendorId&deviceUuid=$deviceUuid"
                transports = arrayOf("polling", "websocket")
                reconnection = true
                reconnectionDelay = 10000
                reconnectionAttempts = 5
            }

            socket = IO.socket(cleanUrl, options).apply {
                on(Socket.EVENT_CONNECT) {
                    Log.i(TAG, "⚡ Connecté au serveur ROE BOLET (Socket.io)")
                    startHeartbeat(vendorId, deviceUuid)
                }

                on(Socket.EVENT_CONNECT_ERROR) {
                    Log.d(TAG, "Mode veille Socket.IO (Serverless HTTP actif)")
                }

                on(Socket.EVENT_DISCONNECT) {
                    Log.w(TAG, "🔌 Déconnecté du serveur ROE BOLET")
                    stopHeartbeat()
                }

                // KILL SWITCH : Déconnexion forcée par l'administrateur
                on("FORCE_LOGOUT") { args ->
                    val reason = if (args.isNotEmpty() && args[0] is JSONObject) {
                        (args[0] as JSONObject).optString("reason", "Compte suspendu à distance")
                    } else {
                        "Compte suspendu par la direction"
                    }
                    Log.e(TAG, "🚨 ORDRE DE SUSPENSION REÇU : $reason")
                    handler.post {
                        onForceLogoutListener?.invoke(reason)
                    }
                }

                on("VENDOR_REACTIVATED") {
                    Log.i(TAG, "✅ Notification de réactivation reçue")
                    handler.post {
                        onReactivatedListener?.invoke()
                    }
                }

                connect()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erreur initialisation WebSocket", e)
        }
    }

    fun isConnected(): Boolean = socket?.connected() == true

    fun disconnect() {
        stopHeartbeat()
        socket?.disconnect()
        socket = null
    }

    private fun startHeartbeat(vendorId: String, deviceUuid: String) {
        stopHeartbeat()
        heartbeatRunnable = object : Runnable {
            override fun run() {
                if (socket?.connected() == true) {
                    val payload = JSONObject().apply {
                        put("vendorId", vendorId)
                        put("deviceUuid", deviceUuid)
                        put("batteryLevel", 85) // Ou extraction BatteryManager
                        put("appVersion", "1.0.0")
                    }
                    socket?.emit("vendor:heartbeat", payload)
                    Log.d(TAG, "💓 Heartbeat émis")
                }
                handler.postDelayed(this, 30_000) // Toutes les 30 secondes
            }
        }
        handler.post(heartbeatRunnable!!)
    }

    private fun stopHeartbeat() {
        heartbeatRunnable?.let { handler.removeCallbacks(it) }
        heartbeatRunnable = null
    }
}
