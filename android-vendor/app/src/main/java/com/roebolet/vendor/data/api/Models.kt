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
