package com.desklink.sync

import android.util.Base64
import com.desklink.data.models.EventTypes
import com.desklink.data.models.PhotoDownloadChunkPayload
import com.desklink.data.models.PhotoDownloadCompletePayload
import com.desklink.data.models.PhotoDownloadRequestPayload
import com.desklink.data.models.PhotosListRequestPayload
import com.desklink.data.models.PhotosListResponsePayload
import com.desklink.data.models.decodePayload
import com.desklink.data.models.encodeEvent
import com.desklink.data.models.parseEnvelope
import com.desklink.data.repository.PhotosRepository
import com.desklink.data.repository.SettingsRepository
import com.desklink.data.repository.SyncLogRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

class PhotosRequestHandler(
    private val scope: CoroutineScope,
    private val photosRepository: PhotosRepository,
    private val settingsRepository: SettingsRepository,
    private val syncLogRepository: SyncLogRepository,
    private val deviceId: String,
    private val send: (String) -> Boolean
) {
    fun handle(raw: String) {
        val envelope = parseEnvelope(raw) ?: return

        when (envelope.type) {
            EventTypes.PHOTOS_LIST_REQUEST -> scope.launch { handleListRequest(envelope) }
            EventTypes.PHOTO_DOWNLOAD_REQUEST -> scope.launch { handleDownloadRequest(envelope) }
        }
    }

    private suspend fun handleListRequest(envelope: com.desklink.data.models.EventEnvelope) {
        if (!settingsRepository.getBoolean(SettingsRepository.KEY_PHOTO_SYNC)) {
            sendError(envelope.correlationId, "Photo sync is disabled", EventTypes.PHOTOS_LIST_REQUEST)
            return
        }
        try {
            val payload = decodePayload<PhotosListRequestPayload>(envelope.payload)
            val photos = photosRepository.getRecentPhotos(payload.limit ?: 40)
            val response = encodeEvent(
                EventTypes.PHOTOS_LIST_RESPONSE,
                PhotosListResponsePayload(photos = photos),
                deviceId = deviceId,
                correlationId = envelope.correlationId
            )
            send(response)
        } catch (e: SecurityException) {
            sendError(envelope.correlationId, "Photo read permission not granted", EventTypes.PHOTOS_LIST_REQUEST)
            syncLogRepository.log("error", e.message ?: "Photo permission denied", EventTypes.PHOTOS_LIST_REQUEST)
        } catch (e: Exception) {
            sendError(envelope.correlationId, e.message ?: "Failed to load photos", EventTypes.PHOTOS_LIST_REQUEST)
        }
    }

    private suspend fun handleDownloadRequest(envelope: com.desklink.data.models.EventEnvelope) {
        if (!settingsRepository.getBoolean(SettingsRepository.KEY_PHOTO_SYNC)) {
            sendError(envelope.correlationId, "Photo sync is disabled", EventTypes.PHOTO_DOWNLOAD_REQUEST)
            return
        }
        try {
            val payload = decodePayload<PhotoDownloadRequestPayload>(envelope.payload)
            val meta = photosRepository.getPhotoMeta(payload.photoId)
                ?: run {
                    sendError(envelope.correlationId, "Photo not found", EventTypes.PHOTO_DOWNLOAD_REQUEST)
                    return
                }

            val bytes = photosRepository.readPhotoBytes(payload.photoId)
                ?: run {
                    sendError(envelope.correlationId, "Could not read photo file", EventTypes.PHOTO_DOWNLOAD_REQUEST)
                    return
                }

            val chunks = photosRepository.chunkBytes(bytes)
            val totalChunks = chunks.size.coerceAtLeast(1)

            chunks.forEachIndexed { index, chunk ->
                val chunkEvent = encodeEvent(
                    EventTypes.PHOTO_DOWNLOAD_CHUNK,
                    PhotoDownloadChunkPayload(
                        photoId = payload.photoId,
                        chunkIndex = index,
                        totalChunks = totalChunks,
                        data = Base64.encodeToString(chunk, Base64.NO_WRAP)
                    ),
                    deviceId = deviceId,
                    correlationId = envelope.correlationId
                )
                send(chunkEvent)
            }

            val completeEvent = encodeEvent(
                EventTypes.PHOTO_DOWNLOAD_COMPLETE,
                PhotoDownloadCompletePayload(
                    photoId = payload.photoId,
                    fileName = meta.fileName,
                    mimeType = meta.mimeType,
                    totalBytes = bytes.size.toLong()
                ),
                deviceId = deviceId,
                correlationId = envelope.correlationId
            )
            send(completeEvent)
            syncLogRepository.log("info", "Photo downloaded: ${meta.fileName}", EventTypes.PHOTO_DOWNLOAD_COMPLETE)
        } catch (e: SecurityException) {
            sendError(envelope.correlationId, "Photo read permission not granted", EventTypes.PHOTO_DOWNLOAD_REQUEST)
        } catch (e: Exception) {
            sendError(envelope.correlationId, e.message ?: "Photo download failed", EventTypes.PHOTO_DOWNLOAD_REQUEST)
        }
    }

    private fun sendError(correlationId: String?, message: String, relatedType: String) {
        val error = encodeEvent(
            EventTypes.SYNC_ERROR,
            com.desklink.data.models.SyncErrorPayload(
                code = "PHOTO_ERROR",
                message = message,
                relatedType = relatedType
            ),
            deviceId = deviceId,
            correlationId = correlationId
        )
        send(error)
    }
}
