package com.roebolet.vendor

import android.app.Application
import com.roebolet.vendor.data.local.PreferencesManager
import com.roebolet.vendor.data.socket.SocketManager

class RoeBoletApp : Application() {

    lateinit var preferencesManager: PreferencesManager
        private set

    override fun onCreate() {
        super.onCreate()
        preferencesManager = PreferencesManager(this)

        // Initialisation de l'UUID unique terminal au tout premier lancement
        preferencesManager.getOrCreateDeviceUuid()
    }
}
