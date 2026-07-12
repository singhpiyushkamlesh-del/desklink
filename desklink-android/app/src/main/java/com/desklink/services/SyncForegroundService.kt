package com.desklink.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.desklink.MainActivity
import com.desklink.R
import com.desklink.data.db.DeskLinkDatabase
import com.desklink.data.models.ConnectionStates
import com.desklink.data.repository.DeviceRepository
import com.desklink.data.repository.PhotosRepository
import com.desklink.data.repository.SettingsRepository
import com.desklink.data.repository.SmsRepository
import com.desklink.data.repository.SyncLogRepository
import com.desklink.device.DeviceIdStore
import com.desklink.device.DeviceInfoProvider
import com.desklink.security.SecureTokenStore
import com.desklink.sync.ClipboardSyncManager
import com.desklink.sync.NotificationSyncManager
import com.desklink.sync.PhotosRequestHandler
import com.desklink.sync.SmsRequestHandler
import com.desklink.sync.SyncStateHolder
import com.desklink.websocket.SyncConnectionManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class SyncForegroundService : Service() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var connectionManager: SyncConnectionManager? = null
    private var smsRequestHandler: SmsRequestHandler? = null
    private var photosRequestHandler: PhotosRequestHandler? = null
    private var clipboardSyncManager: ClipboardSyncManager? = null
    private var clipboardMonitor: ClipboardMonitor? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        connectionManager = SyncConnectionManager(
            scope = serviceScope,
            deviceInfoProvider = DeviceInfoProvider(applicationContext)
        )
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createChannel()
        startForeground(NOTIFICATION_ID, buildNotification(ConnectionStates.CONNECTING))

        serviceScope.launch {
            val db = DeskLinkDatabase.getInstance(applicationContext)
            val deviceRepository = DeviceRepository(db.pairedDeviceDao())
            val syncLogRepository = SyncLogRepository(db.syncLogDao())
            val secureTokenStore = SecureTokenStore(applicationContext)
            val deviceIdStore = DeviceIdStore(applicationContext)

            val paired = deviceRepository.observePrimaryDevice().first()
            if (paired == null) {
                syncLogRepository.log("warn", "No paired desktop — sync service stopping", "auth:established")
                stopSelf()
                return@launch
            }

            val token = secureTokenStore.getSessionToken(paired.id) ?: paired.sessionToken
            val deviceId = deviceIdStore.getOrCreateDeviceId()
            val settingsRepository = SettingsRepository(db.appSettingDao())
            val pendingDao = db.pendingNotificationDao()
            val smsRepository = SmsRepository(applicationContext)
            val photosRepository = PhotosRepository(applicationContext)

            val manager = connectionManager ?: return@launch

            smsRequestHandler = SmsRequestHandler(
                scope = serviceScope,
                smsRepository = smsRepository,
                settingsRepository = settingsRepository,
                syncLogRepository = syncLogRepository,
                deviceId = deviceId,
                send = { json -> manager.sendMessage(json) }
            )
            photosRequestHandler = PhotosRequestHandler(
                scope = serviceScope,
                photosRepository = photosRepository,
                settingsRepository = settingsRepository,
                syncLogRepository = syncLogRepository,
                deviceId = deviceId,
                send = { json -> manager.sendMessage(json) }
            )
            manager.onIncomingMessage = { raw ->
                smsRequestHandler?.handle(raw)
                photosRequestHandler?.handle(raw)
            }

            clipboardMonitor = ClipboardMonitor(applicationContext)
            clipboardSyncManager = ClipboardSyncManager(
                scope = serviceScope,
                clipboardMonitor = clipboardMonitor!!,
                deviceId = deviceId,
                send = { json ->
                    if (manager.isAuthenticated()) manager.sendMessage(json) else false
                },
                enabledChecker = {
                    settingsRepository.getBoolean(SettingsRepository.KEY_CLIPBOARD_SYNC)
                }
            )
            manager.onClipboardUpdate = { payload ->
                clipboardSyncManager?.handleRemoteUpdate(payload)
            }
            manager.setAutoReconnectEnabled {
                settingsRepository.getBoolean(SettingsRepository.KEY_AUTO_RECONNECT)
            }
            manager.onAuthenticated = {
                serviceScope.launch {
                    NotificationSyncManager.flushPending(pendingDao)
                }
                clipboardSyncManager?.start()
            }

            NotificationSyncManager.registerEnabledChecker {
                settingsRepository.getBoolean(SettingsRepository.KEY_NOTIFICATION_SYNC)
            }
            NotificationSyncManager.registerSender { payload ->
                manager.sendNotification(payload)
            }

            syncLogRepository.log("info", "Connecting to ${paired.desktopName}", "auth:established")
            manager.start(
                host = paired.desktopHost,
                port = paired.desktopPort,
                token = token,
                deviceId = deviceId
            )
        }

        serviceScope.launch {
            SyncStateHolder.connectionState.collect { state ->
                val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.notify(NOTIFICATION_ID, buildNotification(state))
            }
        }

        return START_STICKY
    }

    override fun onDestroy() {
        clipboardSyncManager?.stop()
        clipboardSyncManager = null
        clipboardMonitor = null
        connectionManager?.stop()
        NotificationSyncManager.clear()
        serviceScope.cancel()
        SyncStateHolder.updateConnectionState(ConnectionStates.DISCONNECTED)
        super.onDestroy()
    }

    private fun buildNotification(connectionState: String): Notification {
        val label = when (connectionState) {
            ConnectionStates.CONNECTED -> "Connected to desktop"
            ConnectionStates.CONNECTING -> "Connecting to desktop…"
            ConnectionStates.PAIRED -> "Paired"
            else -> "Disconnected"
        }

        val openIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(label)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentIntent(openIntent)
            .setOngoing(true)
            .build()
    }

    private fun createChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "DeskLink Sync",
            NotificationManager.IMPORTANCE_LOW
        )
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(channel)
    }

    companion object {
        const val CHANNEL_ID = "desklink_sync"
        private const val NOTIFICATION_ID = 1001

        fun start(context: Context) {
            val intent = Intent(context, SyncForegroundService::class.java)
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, SyncForegroundService::class.java))
        }
    }
}
