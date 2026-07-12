package com.desklink.security

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Secure storage for session tokens using EncryptedSharedPreferences.
 * Full read/write in Stage 2 pairing flow.
 */
class SecureTokenStore(context: Context) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        PREFS_NAME,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun saveSessionToken(deviceId: String, token: String) {
        prefs.edit().putString(keyFor(deviceId), token).apply()
    }

    fun getSessionToken(deviceId: String): String? =
        prefs.getString(keyFor(deviceId), null)

    fun clearSessionToken(deviceId: String) {
        prefs.edit().remove(keyFor(deviceId)).apply()
    }

    fun clearAll() {
        prefs.edit().clear().apply()
    }

    private fun keyFor(deviceId: String) = "session_token_$deviceId"

    companion object {
        private const val PREFS_NAME = "desklink_secure_tokens"
    }
}
