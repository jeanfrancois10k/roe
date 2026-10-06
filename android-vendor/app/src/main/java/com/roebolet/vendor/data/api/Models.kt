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
