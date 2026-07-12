package com.desklink.pairing

import android.content.Context
import com.desklink.data.entities.PairedDeviceEntity
import com.desklink.data.models.PairAcceptedPayload
import com.desklink.data.models.PairRequestPayload
import com.desklink.data.models.PairingQrPayload
import com.desklink.data.repository.DeviceRepository
import com.desklink.data.repository.SyncLogRepository
import com.desklink.device.DeviceIdStore
import com.desklink.device.DeviceInfoProvider
import com.desklink.security.SecureTokenStore
import com.desklink.services.SyncForegroundService
import com.desklink.websocket.PairingWsResult
import com.desklink.websocket.WebSocketManager
import kotlinx.serialization.json.Json

class PairingManager(
    private val context: Context,
    private val deviceRepository: DeviceRepository,
    private val syncLogRepository: SyncLogRepository,
    private val secureTokenStore: SecureTokenStore,
    private val webSocketManager: WebSocketManager,
    private val deviceInfoProvider: DeviceInfoProvider,
    private val json: Json = Json { ignoreUnknownKeys = true }
) {
    private val deviceIdStore = DeviceIdStore(context)

    fun parseQrPayload(qrContent: String): PairingQrPayload? {
        return try {
            json.decodeFromString<PairingQrPayload>(qrContent.trim())
        } catch (_: Exception) {
            null
        }
    }

    suspend fun initiatePairing(payload: PairingQrPayload): PairingResult {
        val deviceId = deviceIdStore.getOrCreateDeviceId()
        val request = PairRequestPayload(
            pairingToken = payload.token,
            deviceName = deviceInfoProvider.getDeviceName(),
            deviceModel = deviceInfoProvider.getDeviceModel(),
            androidVersion = deviceInfoProvider.getAndroidVersion(),
            deviceId = deviceId
        )

        return when (val result = webSocketManager.pair(payload.host, payload.port, request)) {
            is PairingWsResult.Success -> {
                savePairedDesktop(result.payload, payload)
                syncLogRepository.log("info", "Paired with ${result.payload.desktopName}", "pair:accepted")
                SyncForegroundService.start(context)
                PairingResult.Success(result.payload.desktopName)
            }
            is PairingWsResult.Failure -> {
                syncLogRepository.log("error", result.message, "pair:request")
                PairingResult.Failure(result.message)
            }
        }
    }

    private suspend fun savePairedDesktop(accepted: PairAcceptedPayload, qr: PairingQrPayload) {
        secureTokenStore.saveSessionToken(accepted.desktopId, accepted.sessionToken)
        deviceRepository.savePairedDevice(
            PairedDeviceEntity(
                id = accepted.desktopId,
                desktopName = accepted.desktopName,
                desktopHost = qr.host,
                desktopPort = qr.port,
                sessionToken = accepted.sessionToken,
                pairedAt = System.currentTimeMillis(),
                lastConnectedAt = System.currentTimeMillis()
            )
        )
    }
}

sealed class PairingResult {
    data class Success(val desktopName: String) : PairingResult()
    data class Failure(val message: String) : PairingResult()
}
