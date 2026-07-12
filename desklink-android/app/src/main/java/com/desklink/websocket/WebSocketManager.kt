package com.desklink.websocket

import com.desklink.data.models.ConnectionStates
import com.desklink.data.models.EventTypes
import com.desklink.data.models.PairAcceptedPayload
import com.desklink.data.models.PairRequestPayload
import com.desklink.data.models.SyncErrorPayload
import com.desklink.data.models.decodePayload
import com.desklink.data.models.encodeEvent
import com.desklink.data.models.parseEnvelope
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume

class WebSocketManager(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()
) {
    private var webSocket: WebSocket? = null
    private var connectionState: String = ConnectionStates.DISCONNECTED

    fun getConnectionState(): String = connectionState

    fun disconnect() {
        webSocket?.close(1000, "Client disconnect")
        webSocket = null
        connectionState = ConnectionStates.DISCONNECTED
    }

    suspend fun pair(
        host: String,
        port: Int,
        request: PairRequestPayload
    ): PairingWsResult = suspendCancellableCoroutine { cont ->
        connectionState = ConnectionStates.CONNECTING
        val url = "ws://$host:$port"
        val httpRequest = Request.Builder().url(url).build()
        var completed = false

        fun complete(result: PairingWsResult) {
            if (!completed) {
                completed = true
                if (cont.isActive) cont.resume(result)
            }
        }

        val socket = client.newWebSocket(httpRequest, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                connectionState = ConnectionStates.CONNECTING
                val message = encodeEvent(EventTypes.PAIR_REQUEST, request)
                webSocket.send(message)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val envelope = parseEnvelope(text) ?: run {
                    complete(PairingWsResult.Failure("Invalid server response"))
                    webSocket.close(1000, null)
                    return
                }

                when (envelope.type) {
                    EventTypes.PAIR_ACCEPTED -> {
                        val payload = decodePayload<PairAcceptedPayload>(envelope.payload)
                        connectionState = ConnectionStates.PAIRED
                        complete(PairingWsResult.Success(payload))
                        webSocket.close(1000, "Pairing complete")
                    }
                    EventTypes.SYNC_ERROR -> {
                        val payload = decodePayload<SyncErrorPayload>(envelope.payload)
                        connectionState = ConnectionStates.DISCONNECTED
                        complete(PairingWsResult.Failure(payload.message))
                        webSocket.close(1000, null)
                    }
                    else -> {
                        // ignore other events during pairing
                    }
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                connectionState = ConnectionStates.DISCONNECTED
                complete(
                    PairingWsResult.Failure(
                        t.message ?: "Could not connect to desktop. Check Wi-Fi and firewall."
                    )
                )
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                if (!completed) {
                    connectionState = ConnectionStates.DISCONNECTED
                    complete(PairingWsResult.Failure("Connection closed before pairing completed"))
                }
            }
        })

        webSocket = socket

        cont.invokeOnCancellation {
            socket.cancel()
            connectionState = ConnectionStates.DISCONNECTED
        }
    }

    fun sendMessage(json: String) {
        webSocket?.send(json)
    }
}

sealed class PairingWsResult {
    data class Success(val payload: PairAcceptedPayload) : PairingWsResult()
    data class Failure(val message: String) : PairingWsResult()
}
