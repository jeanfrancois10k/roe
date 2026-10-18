package com.roebolet.vendor.data.api

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface RoeApiService {

    @POST("api/v1/auth/vendor-pin")
    suspend fun loginWithPin(
        @Body request: PinLoginRequest
    ): Response<LoginResponse>

    @POST("api/v1/auth/refresh")
    suspend fun refreshToken(
        @Body request: RefreshTokenRequest
    ): Response<RefreshTokenResponse>

    @GET("api/v1/auth/me")
    suspend fun getCurrentProfile(): Response<Map<String, Any>>

    @POST("api/v1/tickets/verify")
    suspend fun verifyTicket(
        @retrofit2.http.Header("Authorization") authHeader: String,
        @Body request: VerifyTicketRequest
    ): Response<VerifyTicketResponse>

    @POST("api/v1/tickets/pay")
    suspend fun payTicket(
        @retrofit2.http.Header("Authorization") authHeader: String,
        @Body request: PayTicketRequest
    ): Response<PayTicketResponse>

    @POST("api/v1/sync/batch")
    suspend fun syncBatch(
        @retrofit2.http.Header("Authorization") authHeader: String,
        @Body request: BatchSyncRequest
    ): Response<BatchSyncResponse>

    @POST("api/v1/tickets/sell")
    suspend fun sellTicket(
        @retrofit2.http.Header("Authorization") authHeader: String,
        @Body request: SellTicketRequest
    ): Response<SellTicketResponse>

    @GET("api/v1/draws/open")
    suspend fun getOpenDraws(): Response<List<OpenDrawItem>>

    @GET("api/v1/draws/today/results")
    suspend fun getTodayResults(): Response<List<DrawResultItem>>

    @GET("api/v1/tickets")
    suspend fun getVendorTickets(
        @retrofit2.http.Header("Authorization") authHeader: String,
        @retrofit2.http.Query("limit") limit: Int = 30
    ): Response<TicketsListResponse>

    @GET("api/v1/tickets/number/{ticketNumber}")
    suspend fun getTicketByNumber(
        @retrofit2.http.Header("Authorization") authHeader: String,
        @retrofit2.http.Path("ticketNumber") ticketNumber: String
    ): Response<VendorTicketItem>

    @POST("api/v1/tickets/cancel")
    suspend fun cancelTicket(
        @retrofit2.http.Header("Authorization") authHeader: String,
        @Body request: CancelTicketRequest
    ): Response<CancelTicketResponse>

    @GET("api/v1/settings/app/update")
    suspend fun checkAppUpdate(): Response<AppUpdateInfo>

    @GET("api/v1/vendors/control-summary")
    suspend fun getControlSummary(
        @retrofit2.http.Header("Authorization") authHeader: String,
        @retrofit2.http.Query("date") date: String? = null
    ): Response<ControlSummaryResponse>

    @GET("api/v1/reports/sales")
    suspend fun getSalesReport(
        @retrofit2.http.Header("Authorization") authHeader: String,
        @retrofit2.http.Query("period") period: String = "day",
        @retrofit2.http.Query("date") date: String? = null,
        @retrofit2.http.Query("vendorId") vendorId: String? = null
    ): Response<SalesReportResponse>

    @GET("api/v1/settings")
    suspend fun getSettings(): Response<SystemSettingsResponse>
}
