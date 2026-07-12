package com.desklink.sync

import com.desklink.data.models.EventTypes
import com.desklink.data.models.SmsListRequestPayload
import com.desklink.data.models.SmsListResponsePayload
import com.desklink.data.models.SmsSendAckPayload
import com.desklink.data.models.SmsSendPayload
import com.desklink.data.models.SmsThreadRequestPayload
import com.desklink.data.models.SmsThreadResponsePayload
import com.desklink.data.models.decodePayload
import com.desklink.data.models.encodeEvent
import com.desklink.data.models.parseEnvelope
import com.desklink.data.repository.SettingsRepository
import com.desklink.data.repository.SmsRepository
import com.desklink.data.repository.SyncLogRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

class SmsRequestHandler(
    private val scope: CoroutineScope,
    private val smsRepository: SmsRepository,
    private val settingsRepository: SettingsRepository,
    private val syncLogRepository: SyncLogRepository,
    private val deviceId: String,
    private val send: (String) -> Boolean
) {
    fun handle(raw: String) {
        val envelope = parseEnvelope(raw) ?: return

        when (envelope.type) {
            EventTypes.SMS_LIST_REQUEST -> scope.launch { handleListRequest(envelope) }
            EventTypes.SMS_THREAD_REQUEST -> scope.launch { handleThreadRequest(envelope) }
            EventTypes.SMS_SEND -> scope.launch { handleSend(envelope) }
        }
    }

    private suspend fun handleListRequest(envelope: com.desklink.data.models.EventEnvelope) {
        if (!settingsRepository.getBoolean(SettingsRepository.KEY_SMS_SYNC)) {
            sendError(envelope.correlationId, "SMS sync is disabled", EventTypes.SMS_LIST_REQUEST)
            return
        }
        try {
            val payload = decodePayload<SmsListRequestPayload>(envelope.payload)
            val threads = smsRepository.getThreads(payload.limit ?: 50)
            val response = encodeEvent(
                EventTypes.SMS_LIST_RESPONSE,
                SmsListResponsePayload(threads = threads),
                deviceId = deviceId,
                correlationId = envelope.correlationId
            )
            send(response)
        } catch (e: SecurityException) {
            sendError(envelope.correlationId, "SMS read permission not granted", EventTypes.SMS_LIST_REQUEST)
            syncLogRepository.log("error", e.message ?: "SMS permission denied", EventTypes.SMS_LIST_REQUEST)
        } catch (e: Exception) {
            sendError(envelope.correlationId, e.message ?: "Failed to load SMS threads", EventTypes.SMS_LIST_REQUEST)
        }
    }

    private suspend fun handleThreadRequest(envelope: com.desklink.data.models.EventEnvelope) {
        if (!settingsRepository.getBoolean(SettingsRepository.KEY_SMS_SYNC)) {
            sendError(envelope.correlationId, "SMS sync is disabled", EventTypes.SMS_THREAD_REQUEST)
            return
        }
        try {
            val payload = decodePayload<SmsThreadRequestPayload>(envelope.payload)
            val messages = smsRepository.getThreadMessages(payload.threadId, payload.limit ?: 100)
            val response = encodeEvent(
                EventTypes.SMS_THREAD_RESPONSE,
                SmsThreadResponsePayload(threadId = payload.threadId, messages = messages),
                deviceId = deviceId,
                correlationId = envelope.correlationId
            )
            send(response)
        } catch (e: SecurityException) {
            sendError(envelope.correlationId, "SMS read permission not granted", EventTypes.SMS_THREAD_REQUEST)
        } catch (e: Exception) {
            sendError(envelope.correlationId, e.message ?: "Failed to load messages", EventTypes.SMS_THREAD_REQUEST)
        }
    }

    private suspend fun handleSend(envelope: com.desklink.data.models.EventEnvelope) {
        if (!settingsRepository.getBoolean(SettingsRepository.KEY_SMS_SYNC)) {
            sendSendAck(envelope, success = false, error = "SMS sync is disabled")
            return
        }
        val payload = decodePayload<SmsSendPayload>(envelope.payload)
        val result = smsRepository.sendSms(payload.address, payload.body)
        result.fold(
            onSuccess = {
                syncLogRepository.log("info", "SMS sent to ${payload.address}", EventTypes.SMS_SEND)
                sendSendAck(envelope, success = true)
            },
            onFailure = { error ->
                syncLogRepository.log("error", error.message ?: "SMS send failed", EventTypes.SMS_SEND)
                sendSendAck(envelope, success = false, error = error.message)
            }
        )
    }

    private fun sendSendAck(
        envelope: com.desklink.data.models.EventEnvelope,
        success: Boolean,
        error: String? = null
    ) {
        val payload = decodePayload<SmsSendPayload>(envelope.payload)
        val ack = encodeEvent(
            EventTypes.SMS_SEND_ACK,
            SmsSendAckPayload(
                clientMessageId = payload.clientMessageId,
                success = success,
                error = error
            ),
            deviceId = deviceId,
            correlationId = envelope.correlationId
        )
        send(ack)
    }

    private fun sendError(correlationId: String?, message: String, relatedType: String) {
        val error = encodeEvent(
            EventTypes.SYNC_ERROR,
            com.desklink.data.models.SyncErrorPayload(
                code = "SMS_ERROR",
                message = message,
                relatedType = relatedType
            ),
            deviceId = deviceId,
            correlationId = correlationId
        )
        send(error)
    }
}
