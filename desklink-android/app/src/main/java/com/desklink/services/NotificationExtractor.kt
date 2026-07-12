package com.desklink.services

import android.app.Notification
import android.content.Context
import android.service.notification.StatusBarNotification
import com.desklink.data.models.NotificationNewPayload
import java.util.UUID

object NotificationExtractor {

    private val ignoredPackages = setOf(
        "com.desklink",
        "android",
        "com.android.systemui"
    )

    fun extract(context: Context, sbn: StatusBarNotification): NotificationNewPayload? {
        val pkg = sbn.packageName
        if (pkg in ignoredPackages) return null

        val extras = sbn.notification.extras ?: return null
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
        val body = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim()
            ?: extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()?.trim()
            ?: extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT)?.toString()?.trim()
            ?: ""

        if (title.isEmpty() && body.isEmpty()) return null

        val appName = try {
            val appInfo = context.packageManager.getApplicationInfo(pkg, 0)
            context.packageManager.getApplicationLabel(appInfo).toString()
        } catch (_: Exception) {
            pkg
        }

        val stableId = "${pkg}:${sbn.id}:${sbn.postTime}"

        return NotificationNewPayload(
            id = stableId.ifBlank { UUID.randomUUID().toString() },
            appPackage = pkg,
            appName = appName,
            title = title.ifEmpty { appName },
            body = body,
            timestamp = sbn.postTime
        )
    }
}
