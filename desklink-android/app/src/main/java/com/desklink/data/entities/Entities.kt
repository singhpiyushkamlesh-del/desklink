package com.desklink.data.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "paired_devices")
data class PairedDeviceEntity(
    @PrimaryKey val id: String,
    val desktopName: String,
    val desktopHost: String,
    val desktopPort: Int,
    val sessionToken: String,
    val pairedAt: Long,
    val lastConnectedAt: Long? = null
)

@Entity(tableName = "pending_notifications")
data class PendingNotificationEntity(
    @PrimaryKey val id: String,
    val appPackage: String,
    val appName: String?,
    val title: String?,
    val body: String?,
    val timestamp: Long,
    val synced: Boolean = false
)

@Entity(tableName = "sync_logs")
data class SyncLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val level: String,
    val eventType: String?,
    val message: String,
    val createdAt: Long
)

@Entity(tableName = "app_settings")
data class AppSettingEntity(
    @PrimaryKey val key: String,
    val value: String
)
