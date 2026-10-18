package com.roebolet.vendor.data.local

import android.content.Context
import android.content.SharedPreferences
import java.util.UUID

class PreferencesManager(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("roe_vendor_secure_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_VENDOR_ID = "vendor_id"
        private const val KEY_VENDOR_CODE = "vendor_code"
        private const val KEY_VENDOR_NAME = "vendor_name"
        private const val KEY_CURRENT_BALANCE = "current_balance"
        private const val KEY_DEVICE_UUID = "device_uuid"
        private const val KEY_SERVER_URL = "server_url"
    }

    fun saveAuthData(
        token: String,
        refreshToken: String,
        vendorId: String,
        vendorCode: String,
        fullName: String,
        balance: Double
    ) {
        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, token)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .putString(KEY_VENDOR_ID, vendorId)
            .putString(KEY_VENDOR_CODE, vendorCode)
            .putString(KEY_VENDOR_NAME, fullName)
            .putFloat(KEY_CURRENT_BALANCE, balance.toFloat())
            .apply()
    }

    fun getAccessToken(): String? = prefs.getString(KEY_ACCESS_TOKEN, null)

    fun getRefreshToken(): String? = prefs.getString(KEY_REFRESH_TOKEN, null)

    fun getVendorCode(): String = prefs.getString(KEY_VENDOR_CODE, "") ?: ""

    fun getVendorName(): String = prefs.getString(KEY_VENDOR_NAME, "") ?: ""

    fun getVendorId(): String = prefs.getString(KEY_VENDOR_ID, "") ?: ""

    fun getBalance(): Double = prefs.getFloat(KEY_CURRENT_BALANCE, 0f).toDouble()

    fun updateBalance(newBalance: Double) {
        prefs.edit().putFloat(KEY_CURRENT_BALANCE, newBalance.toFloat()).apply()
    }

    fun clearSession() {
        prefs.edit()
            .remove(KEY_ACCESS_TOKEN)
            .remove(KEY_REFRESH_TOKEN)
            .remove(KEY_VENDOR_ID)
            .remove(KEY_VENDOR_NAME)
            .remove(KEY_CURRENT_BALANCE)
            .apply()
    }

    fun getOrCreateDeviceUuid(): String {
        var uuid = prefs.getString(KEY_DEVICE_UUID, null)
        if (uuid == null) {
            uuid = "POS-" + UUID.randomUUID().toString().uppercase().take(12)
            prefs.edit().putString(KEY_DEVICE_UUID, uuid).apply()
        }
        return uuid
    }

    fun getServerUrl(): String =
        prefs.getString(KEY_SERVER_URL, "https://roe-chi.vercel.app/") ?: "https://roe-chi.vercel.app/"

    fun setServerUrl(url: String) {
        prefs.edit().putString(KEY_SERVER_URL, url).apply()
    }

    fun getLanguage(): String = prefs.getString("app_language", "ht") ?: "ht"

    fun setLanguage(langCode: String) {
        prefs.edit().putString("app_language", langCode).apply()
    }

    fun saveLotteryInfo(
        companyName: String,
        companySlogan: String,
        phone: String,
        bankRef: String,
        headerNote: String,
        footerNote: String,
        providerInfo: String,
        mariageGratuitNote: String
    ) {
        prefs.edit()
            .putString("lottery_name", companyName)
            .putString("lottery_slogan", companySlogan)
            .putString("lottery_phone", phone)
            .putString("lottery_bank_ref", bankRef)
            .putString("lottery_header_note", headerNote)
            .putString("lottery_footer_note", footerNote)
            .putString("lottery_provider", providerInfo)
            .putString("lottery_mariage_gratis", mariageGratuitNote)
            .apply()
    }

    fun getLotteryName(): String = prefs.getString("lottery_name", "ROE BOLET") ?: "ROE BOLET"
    fun getLotterySlogan(): String = prefs.getString("lottery_slogan", "Juétwèt") ?: "Juétwèt"
    fun getLotteryPhone(): String = prefs.getString("lottery_phone", "42327120") ?: "42327120"
    fun getLotteryBankRef(): String = prefs.getString("lottery_bank_ref", "bank 6") ?: "bank 6"
    fun getLotteryHeaderNote(): String = prefs.getString("lottery_header_note", "*** ORIGINAL FICHE ***") ?: "*** ORIGINAL FICHE ***"
    fun getLotteryFooterNote(): String = prefs.getString("lottery_footer_note", "FICH SA VALAB SELMAN POU 90 JOU, FICHE PAYABLE AU PORTEUR") ?: "FICH SA VALAB SELMAN POU 90 JOU, FICHE PAYABLE AU PORTEUR"
    fun getLotteryProvider(): String = prefs.getString("lottery_provider", "ROE-TECH") ?: "ROE-TECH"
    fun getLotteryMariageGratis(): String = prefs.getString("lottery_mariage_gratis", "MARYAJ GRATIS 1500 GDES") ?: "MARYAJ GRATIS 1500 GDES"
}

