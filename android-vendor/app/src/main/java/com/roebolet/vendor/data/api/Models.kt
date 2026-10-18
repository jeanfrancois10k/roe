package com.roebolet.vendor.data.api

import com.google.gson.annotations.SerializedName

data class PinLoginRequest(
    @SerializedName("vendorCode") val vendorCode: String,
    @SerializedName("pin") val pin: String,
    @SerializedName("deviceUuid") val deviceUuid: String,
    @SerializedName("deviceModel") val deviceModel: String,
    @SerializedName("osVersion") val osVersion: String,
    @SerializedName("appVersion") val appVersion: String
)

data class LoginResponse(
    @SerializedName("accessToken") val accessToken: String,
    @SerializedName("refreshToken") val refreshToken: String,
    @SerializedName("expiresIn") val expiresIn: Long,
    @SerializedName("user") val user: UserInfo
)

data class UserInfo(
    @SerializedName("id") val id: String,
    @SerializedName("username") val username: String,
    @SerializedName("role") val role: String,
    @SerializedName("vendor") val vendor: VendorInfo?
)

data class VendorInfo(
    @SerializedName("id") val id: String,
    @SerializedName("vendorCode") val vendorCode: String,
    @SerializedName("fullName") val fullName: String,
    @SerializedName("status") val status: String,
    @SerializedName("currentBalance") val currentBalance: Double,
    @SerializedName("creditLimit") val creditLimit: Double,
    @SerializedName("dailySalesLimit") val dailySalesLimit: Double,
    @SerializedName("maxTicketAmount") val maxTicketAmount: Double,
    @SerializedName("defaultCommissionRate") val defaultCommissionRate: Double
)

data class HeartbeatEvent(
    val vendorId: String,
    val deviceUuid: String,
    val batteryLevel: Int,
    val appVersion: String
)

data class VerifyTicketRequest(
    @SerializedName("query") val query: String,
    @SerializedName("checksum") val checksum: String? = null
)

data class VerifyTicketResponse(
    @SerializedName("ticketId") val ticketId: String,
    @SerializedName("ticketNumber") val ticketNumber: String,
    @SerializedName("isAuthentic") val isAuthentic: Boolean,
    @SerializedName("gameName") val gameName: String,
    @SerializedName("drawNumber") val drawNumber: Int,
    @SerializedName("wonAmount") val wonAmount: Double,
    @SerializedName("isWinner") val isWinner: Boolean,
    @SerializedName("payoutStatus") val payoutStatus: String,
    @SerializedName("statusKey") val statusKey: String,
    @SerializedName("statusLabel") val statusLabel: String,
    @SerializedName("canBePaid") val canBePaid: Boolean
)

data class PayTicketRequest(
    @SerializedName("ticketId") val ticketId: String,
    @SerializedName("deviceUuid") val deviceUuid: String,
    @SerializedName("idempotencyKey") val idempotencyKey: String? = null
)

data class PayTicketResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String,
    @SerializedName("vendor") val vendor: PayVendorResult?
)

data class PayVendorResult(
    @SerializedName("id") val id: String,
    @SerializedName("newBalance") val newBalance: Double
)

data class BetGrid(
    @SerializedName("numbers") val numbers: List<String>,
    @SerializedName("betAmount") val betAmount: Double,
    @SerializedName("multiplier") val multiplier: Int? = 1,
    @SerializedName("option") val option: String? = null,
    @SerializedName("gameType") val gameType: String? = null,
    @SerializedName("isGratis") val isGratis: Boolean? = null
)

data class SellTicketRequest(
    @SerializedName("gameId") val gameId: String,
    @SerializedName("drawId") val drawId: String,
    @SerializedName("deviceUuid") val deviceUuid: String,
    @SerializedName("idempotencyKey") val idempotencyKey: String,
    @SerializedName("grids") val grids: List<BetGrid>
)

data class BatchSyncRequest(
    @SerializedName("deviceUuid") val deviceUuid: String,
    @SerializedName("lastSyncTimestamp") val lastSyncTimestamp: String? = null,
    @SerializedName("pendingTickets") val pendingTickets: List<SellTicketRequest>
)

data class BatchSyncResponse(
    @SerializedName("serverTime") val serverTime: String,
    @SerializedName("summary") val summary: SyncSummary,
    @SerializedName("processedTickets") val processedTickets: List<ProcessedSyncTicket>,
    @SerializedName("delta") val delta: SyncDelta
)

data class SyncSummary(
    @SerializedName("total") val total: Int,
    @SerializedName("success") val success: Int,
    @SerializedName("duplicates") val duplicates: Int,
    @SerializedName("rejected") val rejected: Int
)

data class ProcessedSyncTicket(
    @SerializedName("idempotencyKey") val idempotencyKey: String,
    @SerializedName("status") val status: String,
    @SerializedName("ticketNumber") val ticketNumber: String?,
    @SerializedName("secureChecksum") val secureChecksum: String?,
    @SerializedName("totalAmount") val totalAmount: Double?,
    @SerializedName("reason") val reason: String?
)

data class SyncDelta(
    @SerializedName("vendorBalance") val vendorBalance: Double,
    @SerializedName("creditLimit") val creditLimit: Double,
    @SerializedName("openDraws") val openDraws: List<Map<String, Any>>,
    @SerializedName("activeGames") val activeGames: List<Map<String, Any>>
)

data class SellTicketResponse(
    @SerializedName("id") val id: String? = null,
    @SerializedName("ticketNumber") val rawTicketNumber: String? = null,
    @SerializedName("secureChecksum") val rawChecksum: String? = null,
    @SerializedName("totalAmount") val rawTotalAmount: Double? = null,
    @SerializedName("status") val status: String? = "CONFIRMED",
    @SerializedName("createdAt") val createdAt: String? = null,
    @SerializedName("ticket") val nestedTicket: NestedTicketInfo? = null
) {
    val ticketNumber: String
        get() = rawTicketNumber ?: nestedTicket?.ticketNumber ?: "ROE-TICKET"

    val secureChecksum: String
        get() = rawChecksum ?: nestedTicket?.secureChecksum ?: ""

    val totalAmount: Double
        get() = rawTotalAmount ?: nestedTicket?.totalAmount ?: 0.0
}

data class NestedTicketInfo(
    @SerializedName("id") val id: String? = null,
    @SerializedName("ticketNumber") val ticketNumber: String? = null,
    @SerializedName("secureChecksum") val secureChecksum: String? = null,
    @SerializedName("totalAmount") val totalAmount: Double? = null,
    @SerializedName("status") val status: String? = null
)


data class OpenDrawGame(
    @SerializedName("id") val id: String,
    @SerializedName("code") val code: String,
    @SerializedName("name") val name: String,
    @SerializedName("minBetAmount") val minBetAmount: Double? = 5.0,
    @SerializedName("maxBetAmount") val maxBetAmount: Double? = 1000.0
)

data class OpenDrawItem(
    @SerializedName("id") val id: String,
    @SerializedName("drawNumber") val drawNumber: Int,
    @SerializedName("status") val status: String,
    @SerializedName("salesClosingAt") val salesClosingAt: String,
    @SerializedName("scheduledAt") val scheduledAt: String,
    @SerializedName("game") val game: OpenDrawGame
)

data class DrawResultItem(
    @SerializedName("id") val id: String,
    @SerializedName("drawNumber") val drawNumber: Int,
    @SerializedName("gameCode") val gameCode: String,
    @SerializedName("gameName") val gameName: String,
    @SerializedName("publishedAt") val publishedAt: String?,
    @SerializedName("winningResults") val winningResults: Map<String, Any>?,
    @SerializedName("validationHash") val validationHash: String?
)

data class VendorTicketItem(
    @SerializedName("id") val id: String,
    @SerializedName("ticketNumber") val ticketNumber: String,
    @SerializedName("totalAmount") val totalAmount: Double,
    @SerializedName("status") val status: String,
    @SerializedName("isWinner") val isWinner: Boolean = false,
    @SerializedName("wonAmount") val wonAmount: Double = 0.0,
    @SerializedName("payoutStatus") val payoutStatus: String? = "UNPAID",
    @SerializedName("createdAt") val createdAt: String,
    @SerializedName("game") val game: Map<String, Any>? = null,
    @SerializedName("draw") val draw: Map<String, Any>? = null,
    @SerializedName("secureChecksum") val secureChecksum: String? = null,
    @SerializedName("playedGrids") val playedGrids: List<BetGrid>? = null,
    @SerializedName("cancelledAt") val cancelledAt: String? = null,
    @SerializedName("cancellationReason") val cancellationReason: String? = null
)

data class CancelTicketRequest(
    @SerializedName("ticketId") val ticketId: String,
    @SerializedName("reason") val reason: String = "Annulation demandée par le vendeur"
)

data class CancelTicketResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String,
    @SerializedName("newBalance") val newBalance: Double? = null
)

data class TicketsListResponse(
    @SerializedName("total") val total: Int,
    @SerializedName("page") val page: Int,
    @SerializedName("limit") val limit: Int,
    @SerializedName("items") val items: List<VendorTicketItem>
)

data class AppUpdateInfo(
    @SerializedName("latestVersionName") val latestVersionName: String,
    @SerializedName("latestVersionCode") val latestVersionCode: Int,
    @SerializedName("apkUrl") val apkUrl: String,
    @SerializedName("changelog") val changelog: String,
    @SerializedName("isMandatory") val isMandatory: Boolean = false
)

data class ControlSummaryResponse(
    @SerializedName("vendorId") val vendorId: String,
    @SerializedName("vendorCode") val vendorCode: String,
    @SerializedName("vendorName") val vendorName: String,
    @SerializedName("posAddress") val posAddress: String? = null,
    @SerializedName("date") val date: String,
    @SerializedName("totalSales") val totalSales: Double,
    @SerializedName("ticketsCount") val ticketsCount: Int,
    @SerializedName("commissionRate") val commissionRate: Double,
    @SerializedName("commissionAmount") val commissionAmount: Double,
    @SerializedName("prizesPaid") val prizesPaid: Double,
    @SerializedName("prizesPaidCount") val prizesPaidCount: Int,
    @SerializedName("netDueToOwner") val netDueToOwner: Double,
    @SerializedName("cashInHand") val cashInHand: Double,
    @SerializedName("currentBalance") val currentBalance: Double,
    @SerializedName("currency") val currency: String = "HTG"
)

data class SalesReportResponse(
    @SerializedName("period") val period: String,
    @SerializedName("startDate") val startDate: String,
    @SerializedName("endDate") val endDate: String,
    @SerializedName("currency") val currency: String = "HTG",
    @SerializedName("global") val global: SalesReportGlobal,
    @SerializedName("byDraw") val byDraw: List<DrawSalesReportItem>,
    @SerializedName("byVendor") val byVendor: List<VendorSalesReportItem>? = null
)

data class SalesReportGlobal(
    @SerializedName("totalSales") val totalSales: Double,
    @SerializedName("ticketsCount") val ticketsCount: Int,
    @SerializedName("winningTicketsCount") val winningTicketsCount: Int,
    @SerializedName("totalWonAmount") val totalWonAmount: Double,
    @SerializedName("prizesPaid") val prizesPaid: Double,
    @SerializedName("prizesPaidCount") val prizesPaidCount: Int,
    @SerializedName("netRevenue") val netRevenue: Double
)

data class DrawSalesReportItem(
    @SerializedName("drawId") val drawId: String,
    @SerializedName("drawNumber") val drawNumber: Int,
    @SerializedName("scheduledAt") val scheduledAt: String,
    @SerializedName("gameId") val gameId: String,
    @SerializedName("gameName") val gameName: String,
    @SerializedName("gameCode") val gameCode: String,
    @SerializedName("ticketsCount") val ticketsCount: Int,
    @SerializedName("totalSales") val totalSales: Double,
    @SerializedName("winningTicketsCount") val winningTicketsCount: Int,
    @SerializedName("wonAmount") val wonAmount: Double
)

data class VendorSalesReportItem(
    @SerializedName("vendorId") val vendorId: String,
    @SerializedName("vendorCode") val vendorCode: String,
    @SerializedName("vendorName") val vendorName: String,
    @SerializedName("currentBalance") val currentBalance: Double,
    @SerializedName("ticketsCount") val ticketsCount: Int,
    @SerializedName("totalSales") val totalSales: Double,
    @SerializedName("winningTicketsCount") val winningTicketsCount: Int,
    @SerializedName("wonAmount") val wonAmount: Double
)

data class SystemSettingsResponse(
    @SerializedName("defaultCurrency") val defaultCurrency: String? = "HTG",
    @SerializedName("currencySymbol") val currencySymbol: String? = "G",
    @SerializedName("lottery") val lottery: LotteryInfo? = null
)

data class LotteryInfo(
    @SerializedName("companyName") val companyName: String = "ROE BOLET",
    @SerializedName("companySlogan") val companySlogan: String? = "Juétwèt",
    @SerializedName("companyPhone") val companyPhone: String? = "42327120",
    @SerializedName("companyAddress") val companyAddress: String? = "Port-au-Prince, Haïti",
    @SerializedName("bankRef") val bankRef: String? = "Bank 6",
    @SerializedName("logoUrl") val logoUrl: String? = "",
    @SerializedName("ticketHeaderNote") val ticketHeaderNote: String? = "*** ORIGINAL FICHE ***",
    @SerializedName("ticketFooterNote") val ticketFooterNote: String? = "FICH SA VALAB SELMAN POU 90 JOU. FICHE PAYABLE AU PORTEUR.",
    @SerializedName("ticketProviderInfo") val ticketProviderInfo: String? = "ROE-TECH",
    @SerializedName("ticketValidityDays") val ticketValidityDays: Int = 90,
    @SerializedName("mariageGratuitNote") val mariageGratuitNote: String? = "MARYAJ GRATIS 1500 GDES"
)


