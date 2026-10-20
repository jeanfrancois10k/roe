package com.roebolet.vendor.util

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.util.concurrent.TimeUnit

object OtaUpdateManager {

    private val httpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    /**
     * Télécharge directement l'APK avec suivi du pourcentage et déclenche l'installation officielle Android.
     */
    suspend fun downloadAndInstallApk(
        activity: Activity,
        apkUrl: String,
        onProgress: (percent: Int, message: String) -> Unit,
        onError: (message: String) -> Unit
    ) = withContext(Dispatchers.IO) {
        try {
            withContext(Dispatchers.Main) {
                onProgress(0, "Demann telechajman...")
            }

            val request = Request.Builder()
                .url(apkUrl)
                .build()

            val response = httpClient.newCall(request).execute()
            if (!response.isSuccessful || response.body == null) {
                withContext(Dispatchers.Main) {
                    onError("Erè telechajman sèvè (HTTP ${response.code})")
                }
                return@withContext
            }

            val body = response.body!!
            val contentLength = body.contentLength()

            val downloadDir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                ?: activity.filesDir
            if (!downloadDir.exists()) downloadDir.mkdirs()

            val apkFile = File(downloadDir, "roe-bolet-update.apk")
            if (apkFile.exists()) apkFile.delete()

            val inputStream: InputStream = body.byteStream()
            val outputStream = FileOutputStream(apkFile)

            val buffer = ByteArray(8 * 1024)
            var bytesRead: Int
            var totalRead: Long = 0
            var lastReportedPercent = -1

            while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                outputStream.write(buffer, 0, bytesRead)
                totalRead += bytesRead

                if (contentLength > 0) {
                    val percent = ((totalRead * 100) / contentLength).toInt().coerceIn(0, 100)
                    if (percent != lastReportedPercent) {
                        lastReportedPercent = percent
                        withContext(Dispatchers.Main) {
                            onProgress(percent, "Telechajman ap fèt : $percent %")
                        }
                    }
                }
            }

            outputStream.flush()
            outputStream.close()
            inputStream.close()

            withContext(Dispatchers.Main) {
                onProgress(100, "Telechajman fini ! Enstalasyon ap kòmanse...")
                installApkFile(activity, apkFile)
            }
        } catch (e: Exception) {
            withContext(Dispatchers.Main) {
                onError("Erè pandan telechajman an : ${e.localizedMessage ?: "Echèk rezo"}")
            }
        }
    }

    /**
     * Lance l'installateur d'applications officiel d'Android via FileProvider
     */
    fun installApkFile(activity: Activity, apkFile: File) {
        try {
            if (!apkFile.exists()) return

            // Vérification de la permission d'installation d'applications inconnues sur Android 8.0+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!activity.packageManager.canRequestPackageInstalls()) {
                    val settingsIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                        data = Uri.parse("package:${activity.packageName}")
                    }
                    activity.startActivity(settingsIntent)
                    return
                }
            }

            val apkUri: Uri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                apkFile
            )

            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }

            activity.startActivity(installIntent)
        } catch (e: Exception) {
            // Fallback si FileProvider direct échoue
            try {
                val intent = Intent(Intent.ACTION_INSTALL_PACKAGE).apply {
                    data = Uri.fromFile(apkFile)
                    putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                activity.startActivity(intent)
            } catch (_: Exception) {}
        }
    }
}
