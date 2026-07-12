package com.desklink.services

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Handler
import android.os.Looper

/**
 * Monitors clipboard for cross-device text sync with loop prevention.
 */
class ClipboardMonitor(private val context: Context) {

    private val clipboardManager =
        context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    private val mainHandler = Handler(Looper.getMainLooper())

    private var onLocalChange: ((String) -> Unit)? = null
    private var suppressLocalEcho = false
    private var lastAppliedRemoteTimestamp = 0L
    private var lastSentText: String? = null

    private val listener = ClipboardManager.OnPrimaryClipChangedListener {
        if (suppressLocalEcho) return@OnPrimaryClipChangedListener
        val text = readPlainText() ?: return@OnPrimaryClipChangedListener
        if (text == lastSentText) return@OnPrimaryClipChangedListener
        onLocalChange?.invoke(text)
    }

    fun start(onLocalChange: (String) -> Unit) {
        this.onLocalChange = onLocalChange
        mainHandler.post {
            clipboardManager.removePrimaryClipChangedListener(listener)
            clipboardManager.addPrimaryClipChangedListener(listener)
        }
    }

    fun stop() {
        mainHandler.post {
            clipboardManager.removePrimaryClipChangedListener(listener)
        }
        onLocalChange = null
    }

    fun applyRemoteText(text: String, originTimestamp: Long) {
        mainHandler.post {
            if (originTimestamp <= lastAppliedRemoteTimestamp) return@post
            val current = readPlainText()
            if (current == text) {
                lastAppliedRemoteTimestamp = originTimestamp
                return@post
            }
            lastSentText = text
            lastAppliedRemoteTimestamp = originTimestamp
            suppressLocalEcho = true
            clipboardManager.setPrimaryClip(ClipData.newPlainText("DeskLink", text))
            mainHandler.postDelayed({ suppressLocalEcho = false }, 200)
        }
    }

    fun noteOutboundSent(text: String) {
        lastSentText = text
    }

    private fun readPlainText(): String? {
        val clip = clipboardManager.primaryClip ?: return null
        if (clip.itemCount == 0) return null
        return clip.getItemAt(0).coerceToText(context)?.toString()?.takeIf { it.isNotEmpty() }
    }
}
