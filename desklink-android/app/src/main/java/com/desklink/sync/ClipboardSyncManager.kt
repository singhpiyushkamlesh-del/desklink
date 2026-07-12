package com.desklink.sync

import com.desklink.data.models.ClipboardUpdatePayload
import com.desklink.data.models.EventTypes
import com.desklink.data.models.encodeEvent
import com.desklink.services.ClipboardMonitor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * Bridges local clipboard changes to the WebSocket and applies remote updates.
 */
class ClipboardSyncManager(
    private val scope: CoroutineScope,
    private val clipboardMonitor: ClipboardMonitor,
    private val deviceId: String,
    private val send: (String) -> Boolean,
    private val enabledChecker: suspend () -> Boolean
) {
    fun start() {
        clipboardMonitor.start { text ->
            scope.launch {
                if (!enabledChecker()) return@launch
                val timestamp = System.currentTimeMillis()
                clipboardMonitor.noteOutboundSent(text)
                val event = encodeEvent(
                    EventTypes.CLIPBOARD_UPDATE,
                    ClipboardUpdatePayload(
                        text = text,
                        origin = "android",
                        originTimestamp = timestamp
                    ),
                    deviceId = deviceId
                )
                send(event)
            }
        }
    }

    fun stop() {
        clipboardMonitor.stop()
    }

    suspend fun handleRemoteUpdate(payload: ClipboardUpdatePayload) {
        if (payload.origin != "desktop") return
        if (!enabledChecker()) return
        clipboardMonitor.applyRemoteText(payload.text, payload.originTimestamp)
    }
}
