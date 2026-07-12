package com.desklink.sync

import com.desklink.data.dao.PendingNotificationDao
import com.desklink.data.entities.PendingNotificationEntity
import com.desklink.data.models.NotificationNewPayload
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Routes captured notifications to the active WebSocket connection,
 * or queues them locally when offline.
 */
object NotificationSyncManager {
    private var sender: ((NotificationNewPayload) -> Boolean)? = null
    private var enabledChecker: (suspend () -> Boolean)? = null
    private val flushMutex = Mutex()

    fun registerSender(sender: (NotificationNewPayload) -> Boolean) {
        this.sender = sender
    }

    fun registerEnabledChecker(checker: suspend () -> Boolean) {
        this.enabledChecker = checker
    }

    fun clear() {
        sender = null
        enabledChecker = null
    }

    suspend fun dispatch(
        payload: NotificationNewPayload,
        pendingDao: PendingNotificationDao
    ) {
        if (enabledChecker?.invoke() == false) return

        val sent = sender?.invoke(payload) == true
        if (!sent) {
            pendingDao.insert(
                PendingNotificationEntity(
                    id = payload.id,
                    appPackage = payload.appPackage,
                    appName = payload.appName,
                    title = payload.title,
                    body = payload.body,
                    timestamp = payload.timestamp,
                    synced = false
                )
            )
        }
    }

    suspend fun flushPending(pendingDao: PendingNotificationDao) {
        flushMutex.withLock {
            if (enabledChecker?.invoke() == false) return
            val pending = pendingDao.getUnsynced()
            for (item in pending) {
                val payload = NotificationNewPayload(
                    id = item.id,
                    appPackage = item.appPackage,
                    appName = item.appName ?: item.appPackage,
                    title = item.title ?: "",
                    body = item.body ?: "",
                    timestamp = item.timestamp
                )
                val sent = sender?.invoke(payload) == true
                if (sent) {
                    pendingDao.markSynced(item.id)
                } else {
                    break
                }
            }
        }
    }
}
