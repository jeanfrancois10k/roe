package com.roebolet.vendor.data.sync

import com.roebolet.vendor.data.api.BatchSyncRequest
import com.roebolet.vendor.data.api.BatchSyncResponse
import com.roebolet.vendor.data.api.RoeApiService
import com.roebolet.vendor.data.api.SellTicketRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.concurrent.ConcurrentLinkedQueue

enum class SyncStatus {
    IDLE,
    SYNCING,
    SUCCESS,
    ERROR
}

class SyncManager private constructor() {

    private val pendingQueue = ConcurrentLinkedQueue<SellTicketRequest>()

    private val _pendingCount = MutableStateFlow(0)
    val pendingCount: StateFlow<Int> = _pendingCount.asStateFlow()

    private val _syncStatus = MutableStateFlow(SyncStatus.IDLE)
    val syncStatus: StateFlow<SyncStatus> = _syncStatus.asStateFlow()

    private val _lastSyncSummary = MutableStateFlow<String?>(null)
    val lastSyncSummary: StateFlow<String?> = _lastSyncSummary.asStateFlow()

    companion object {
        val instance by lazy { SyncManager() }
    }

    /**
     * Enregistre un ticket préparé dans la file d'attente hors ligne
     */
    fun enqueueTicket(ticket: SellTicketRequest) {
        pendingQueue.add(ticket)
        _pendingCount.value = pendingQueue.size
    }

    /**
     * Déclenche la synchronisation de la file d'attente avec le serveur
     */
    suspend fun syncPendingBatch(
        apiService: RoeApiService,
        authToken: String,
        deviceUuid: String
    ): BatchSyncResponse? {
        val ticketsToSync = pendingQueue.toList()
        _syncStatus.value = SyncStatus.SYNCING

        try {
            val request = BatchSyncRequest(
                deviceUuid = deviceUuid,
                pendingTickets = ticketsToSync
            )

            val response = apiService.syncBatch("Bearer $authToken", request)
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!

                // Vider les tickets synchronisés avec succès ou doublons
                for (proc in body.processedTickets) {
                    if (proc.status == "SUCCESS" || proc.status == "ALREADY_SYNCED") {
                        pendingQueue.removeIf { it.idempotencyKey == proc.idempotencyKey }
                    }
                }

                _pendingCount.value = pendingQueue.size
                _syncStatus.value = SyncStatus.SUCCESS
                _lastSyncSummary.value = "${body.summary.success} validés, ${body.summary.duplicates} doublons, ${body.summary.rejected} rejetés"

                return body
            } else {
                _syncStatus.value = SyncStatus.ERROR
                _lastSyncSummary.value = "Erreur serveur HTTP ${response.code()}"
                return null
            }
        } catch (e: Exception) {
            _syncStatus.value = SyncStatus.ERROR
            _lastSyncSummary.value = "Échec de connexion : ${e.localizedMessage ?: "Réseau indisponible"}"
            return null
        }
    }
}
