package com.desklink.websocket

import com.desklink.data.models.NotificationNewPayload
import com.desklink.data.models.ClipboardUpdatePayload
import com.desklink.data.models.AuthEstablishedPayload
import com.desklink.data.models.ConnectionStates
import com.desklink.data.models.DeviceStatusPayload
import com.desklink.data.models.EventTypes
import com.desklink.data.models.HeartbeatPayload
import com.desklink.data.models.SyncErrorPayload
import com.desklink.data.models.decodePayload
import com.desklink.data.models.encodeEvent
import com.desklink.data.models.parseEnvelope
import com.desklink.device.DeviceInfoProvider
import com.desklink.sync.SyncStateHolder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.min

class SyncConnectionManager(
    private val scope: CoroutineScope,
    private val deviceInfoProvider: DeviceInfoProvider,
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MINUTES)
        .pingInterval(30, TimeUnit.SECONDS)
        .build()
) {
    private var webSocket: WebSocket? = null
    private var heartbeatJob: Job? = null
    private var statusJob: Job? = null
    private val heartbeatSequence = AtomicInteger(0)
    private val authenticated = AtomicBoolean(false)
    private val shouldRun = AtomicBoolean(false)

    private var currentHost: String = ""
    private var currentPort: Int = 0
    private var sessionToken: String = ""
    private var deviceId: String = ""

    var onAuthenticated: (() -> Unit)? = null
    var onIncomingMessage: ((String) -> Unit)? = null
    var onClipboardUpdate: (suspend (ClipboardUpdatePayload) -> Unit)? = null
    private var autoReconnectEnabled: suspend () -> Boolean = { true }

    fun isAuthenticated(): Boolean = authenticated.get()

    fun setAutoReconnectEnabled(checker: suspend () -> Boolean) {
        autoReconnectEnabled = checker
    }

    fun start(host: String, port: Int, token: String, deviceId: String) {
        this.currentHost = host
        this.currentPort = port
        this.sessionToken = token
        this.deviceId = deviceId
        shouldRun.set(true)
        connect()
    }

    private var reconnectJob: Job? = null

    fun stop() {
        shouldRun.set(false)
        reconnectJob?.cancel()
        heartbeatJob?.cancel()
        statusJob?.cancel()
        webSocket?.close(1000, "Service stopped")
        webSocket = null
        authenticated.set(false)
        SyncStateHolder.updateConnectionState(ConnectionStates.DISCONNECTED)
    }

    private fun connect() {
        if (!shouldRun.get()) return

        SyncStateHolder.updateConnectionState(ConnectionStates.CONNECTING)
        val url = "ws://$currentHost:$currentPort"
        val request = Request.Builder().url(url).build()

        webSocket?.cancel()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                val auth = encodeEvent(
                    EventTypes.AUTH_ESTABLISHED,
                    AuthEstablishedPayload(sessionToken = sessionToken, deviceId = deviceId)
                )
                webSocket.send(auth)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val envelope = parseEnvelope(text) ?: return

                when (envelope.type) {
                    EventTypes.AUTH_ESTABLISHED -> {
                        authenticated.set(true)
                        reconnectJob?.cancel()
                        SyncStateHolder.updateConnectionState(ConnectionStates.CONNECTED)
                        sendDeviceStatus(webSocket)
                        startPeriodicTasks(webSocket)
                        onAuthenticated?.invoke()
                    }
                    EventTypes.HEARTBEAT -> {
                        SyncStateHolder.updateLastSync(System.currentTimeMillis())
                    }
                    EventTypes.SYNC_ERROR -> {
                        val payload = decodePayload<SyncErrorPayload>(envelope.payload)
                        if (payload.code == "AUTH_FAILED") {
                            authenticated.set(false)
                            webSocket.close(1008, payload.message)
                        }
                    }
                    EventTypes.SMS_LIST_REQUEST,
                    EventTypes.SMS_THREAD_REQUEST,
                    EventTypes.SMS_SEND,
                    EventTypes.PHOTOS_LIST_REQUEST,
                    EventTypes.PHOTO_DOWNLOAD_REQUEST -> {
                        onIncomingMessage?.invoke(text)
                    }
                    EventTypes.CLIPBOARD_UPDATE -> {
                        val payload = decodePayload<ClipboardUpdatePayload>(envelope.payload)
                        scope.launch {
                            onClipboardUpdate?.invoke(payload)
                        }
                    }
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                authenticated.set(false)
                heartbeatJob?.cancel()
                statusJob?.cancel()
                SyncStateHolder.updateConnectionState(ConnectionStates.DISCONNECTED)
                scheduleReconnect()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                authenticated.set(false)
                heartbeatJob?.cancel()
                statusJob?.cancel()
                SyncStateHolder.updateConnectionState(ConnectionStates.DISCONNECTED)
                if (shouldRun.get()) scheduleReconnect()
            }
        })
    }

    private fun scheduleReconnect() {
        if (!shouldRun.get() || reconnectJob?.isActive == true) return
        reconnectJob = scope.launch {
            if (!autoReconnectEnabled()) {
                SyncStateHolder.updateConnectionState(ConnectionStates.DISCONNECTED)
                return@launch
            }
            var delayMs = 1000L
            while (shouldRun.get() && !authenticated.get()) {
                if (!autoReconnectEnabled()) {
                    SyncStateHolder.updateConnectionState(ConnectionStates.DISCONNECTED)
                    return@launch
                }
                SyncStateHolder.updateConnectionState(ConnectionStates.CONNECTING)
                delay(delayMs)
                if (!shouldRun.get()) return@launch
                connect()
                delay(5000)
                if (authenticated.get()) return@launch
                delayMs = min(delayMs * 2, 60_000L)
            }
        }
    }

    private fun startPeriodicTasks(socket: WebSocket) {
        heartbeatJob?.cancel()
        statusJob?.cancel()

        heartbeatJob = scope.launch {
            while (isActive && authenticated.get()) {
                delay(30_000)
                val seq = heartbeatSequence.incrementAndGet()
                socket.send(encodeEvent(EventTypes.HEARTBEAT, HeartbeatPayload(sequence = seq)))
            }
        }

        statusJob = scope.launch {
            while (isActive && authenticated.get()) {
                delay(45_000)
                sendDeviceStatus(socket)
            }
        }
    }

    private fun sendDeviceStatus(socket: WebSocket) {
        val status = deviceInfoProvider.getDeviceStatus(ConnectionStates.CONNECTED)
        socket.send(encodeEvent(EventTypes.DEVICE_STATUS, status))
        SyncStateHolder.updateLastSync(System.currentTimeMillis())
    }

    fun sendNotification(payload: NotificationNewPayload): Boolean {
        if (!authenticated.get()) return false
        val socket = webSocket ?: return false
        val message = encodeEvent(EventTypes.NOTIFICATION_NEW, payload, deviceId = deviceId)
        return socket.send(message)
    }

    fun sendMessage(json: String): Boolean {
        val socket = webSocket ?: return false
        return socket.send(json)
    }
}
