package com.desklink.services

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.desklink.data.db.DeskLinkDatabase
import com.desklink.sync.NotificationSyncManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class NotificationCaptureService : NotificationListenerService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return
        val payload = NotificationExtractor.extract(this, sbn) ?: return

        scope.launch {
            val db = DeskLinkDatabase.getInstance(applicationContext)
            NotificationSyncManager.dispatch(payload, db.pendingNotificationDao())
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        super.onNotificationRemoved(sbn)
    }
}
