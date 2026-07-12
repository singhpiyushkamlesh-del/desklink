package com.desklink.data.models

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/** Protocol version — keep in sync with desklink-desktop/electron/shared/protocol.ts */
const val PROTOCOL_VERSION = 1
const val DEFAULT_WS_PORT = 9847

// ---------------------------------------------------------------------------
// Pairing QR payload (encoded in QR, not WS envelope)
// ---------------------------------------------------------------------------

@Serializable
data class PairingQrPayload(
    val host: String,
    val port: Int,
    val token: String,
    val version: Int = PROTOCOL_VERSION
)

// ---------------------------------------------------------------------------
// Event envelope
// ---------------------------------------------------------------------------

@Serializable
data class EventEnvelope(
    val type: String,
    val version: Int = PROTOCOL_VERSION,
    val correlationId: String? = null,
    val timestamp: Long? = null,
    val deviceId: String? = null,
    val payload: JsonElement
)

// ---------------------------------------------------------------------------
// Event type constants
// ---------------------------------------------------------------------------

object EventTypes {
    const val PAIR_INIT = "pair:init"
    const val PAIR_REQUEST = "pair:request"
    const val PAIR_ACCEPTED = "pair:accepted"
    const val AUTH_ESTABLISHED = "auth:established"
    const val DEVICE_STATUS = "device:status"
    const val HEARTBEAT = "heartbeat"
    const val NOTIFICATION_NEW = "notification:new"
    const val SMS_LIST_REQUEST = "sms:list:request"
    const val SMS_LIST_RESPONSE = "sms:list:response"
    const val SMS_THREAD_REQUEST = "sms:thread:request"
    const val SMS_THREAD_RESPONSE = "sms:thread:response"
    const val SMS_SEND = "sms:send"
    const val SMS_SEND_ACK = "sms:send:ack"
    const val PHOTOS_LIST_REQUEST = "photos:list:request"
    const val PHOTOS_LIST_RESPONSE = "photos:list:response"
    const val PHOTO_DOWNLOAD_REQUEST = "photo:download:request"
    const val PHOTO_DOWNLOAD_CHUNK = "photo:download:chunk"
    const val PHOTO_DOWNLOAD_COMPLETE = "photo:download:complete"
    const val CLIPBOARD_UPDATE = "clipboard:update"
    const val SYNC_ERROR = "sync:error"
}

// ---------------------------------------------------------------------------
// Payload data classes
// ---------------------------------------------------------------------------

@Serializable
data class PairInitPayload(val sessionExpiresAt: Long)

@Serializable
data class PairRequestPayload(
    val pairingToken: String,
    val deviceName: String,
    val deviceModel: String,
    val androidVersion: String,
    val deviceId: String
)

@Serializable
data class PairAcceptedPayload(
    val sessionToken: String,
    val desktopName: String,
    val desktopId: String
)

@Serializable
data class AuthEstablishedPayload(
    val sessionToken: String,
    val deviceId: String
)

@Serializable
data class DeviceStatusPayload(
    val batteryPercent: Int,
    val isCharging: Boolean,
    val deviceModel: String,
    val androidVersion: String,
    val connectionState: String
)

@Serializable
data class HeartbeatPayload(val sequence: Int)

@Serializable
data class NotificationNewPayload(
    val id: String,
    val appPackage: String,
    val appName: String,
    val title: String,
    val body: String,
    val timestamp: Long
)

@Serializable
data class SmsThreadSummary(
    val threadId: String,
    val address: String,
    val displayName: String? = null,
    val lastMessage: String,
    val lastTimestamp: Long,
    val unreadCount: Int? = null
)

@Serializable
data class SmsListRequestPayload(val limit: Int? = null)

@Serializable
data class SmsListResponsePayload(val threads: List<SmsThreadSummary>)

@Serializable
data class SmsThreadRequestPayload(val threadId: String, val limit: Int? = null)

@Serializable
data class SmsMessage(
    val id: String,
    val address: String,
    val body: String,
    val direction: String,
    val timestamp: Long,
    val status: String? = null
)

@Serializable
data class SmsThreadResponsePayload(val threadId: String, val messages: List<SmsMessage>)

@Serializable
data class SmsSendPayload(val address: String, val body: String, val clientMessageId: String)

@Serializable
data class SmsSendAckPayload(
    val clientMessageId: String,
    val success: Boolean,
    val error: String? = null,
    val providerMessageId: String? = null
)

@Serializable
data class PhotoMetadata(
    val id: String,
    val fileName: String,
    val mimeType: String,
    val createdAt: Long,
    val width: Int? = null,
    val height: Int? = null,
    val thumbnailBase64: String? = null
)

@Serializable
data class PhotosListRequestPayload(val limit: Int? = null)

@Serializable
data class PhotosListResponsePayload(val photos: List<PhotoMetadata>)

@Serializable
data class PhotoDownloadRequestPayload(val photoId: String)

@Serializable
data class PhotoDownloadChunkPayload(
    val photoId: String,
    val chunkIndex: Int,
    val totalChunks: Int,
    val data: String
)

@Serializable
data class PhotoDownloadCompletePayload(
    val photoId: String,
    val fileName: String,
    val mimeType: String,
    val totalBytes: Long
)

@Serializable
data class ClipboardUpdatePayload(
    val text: String,
    val origin: String,
    val originTimestamp: Long
)

@Serializable
data class SyncErrorPayload(
    val code: String,
    val message: String,
    val relatedType: String? = null
)

/** Connection state values */
object ConnectionStates {
    const val CONNECTED = "connected"
    const val CONNECTING = "connecting"
    const val DISCONNECTED = "disconnected"
    const val PAIRED = "paired"
}
