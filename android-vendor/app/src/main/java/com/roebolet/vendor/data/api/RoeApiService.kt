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
}
