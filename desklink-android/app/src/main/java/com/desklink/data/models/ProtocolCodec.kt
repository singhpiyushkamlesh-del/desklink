package com.desklink.data.models

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement

val protocolJson = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
    explicitNulls = false
}

inline fun <reified T> encodePayload(payload: T): JsonElement =
    protocolJson.encodeToJsonElement(payload)

inline fun <reified T> decodePayload(element: JsonElement): T =
    protocolJson.decodeFromJsonElement(element)

inline fun <reified T> encodeEvent(
    type: String,
    payload: T,
    deviceId: String? = null,
    correlationId: String? = null
): String {
    val envelope = EventEnvelope(
        type = type,
        version = PROTOCOL_VERSION,
        timestamp = System.currentTimeMillis(),
        deviceId = deviceId,
        correlationId = correlationId,
        payload = encodePayload(payload)
    )
    return protocolJson.encodeToString(envelope)
}

fun parseEnvelope(raw: String): EventEnvelope? =
    try {
        protocolJson.decodeFromString<EventEnvelope>(raw)
    } catch (_: Exception) {
        null
    }
