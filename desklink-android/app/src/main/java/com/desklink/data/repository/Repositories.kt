package com.desklink.data.repository

import com.desklink.data.dao.AppSettingDao
import com.desklink.data.dao.PairedDeviceDao
import com.desklink.data.dao.SyncLogDao
import com.desklink.data.entities.AppSettingEntity
import com.desklink.data.entities.PairedDeviceEntity
import com.desklink.data.entities.SyncLogEntity
import kotlinx.coroutines.flow.Flow

class DeviceRepository(private val pairedDeviceDao: PairedDeviceDao) {
    fun observePrimaryDevice(): Flow<PairedDeviceEntity?> = pairedDeviceDao.observePrimary()

    suspend fun getPairedDevices(): List<PairedDeviceEntity> = pairedDeviceDao.getAll()

    suspend fun savePairedDevice(device: PairedDeviceEntity) = pairedDeviceDao.upsert(device)

    suspend fun removeDevice(id: String) = pairedDeviceDao.deleteById(id)
}

class SettingsRepository(private val appSettingDao: AppSettingDao) {
    companion object {
        const val KEY_NOTIFICATION_SYNC = "notification_sync"
        const val KEY_SMS_SYNC = "sms_sync"
        const val KEY_PHOTO_SYNC = "photo_sync"
        const val KEY_CLIPBOARD_SYNC = "clipboard_sync"
        const val KEY_AUTO_RECONNECT = "auto_reconnect"
    }

    fun observeSettings(): Flow<List<AppSettingEntity>> = appSettingDao.observeAll()

    suspend fun getBoolean(key: String, default: Boolean = true): Boolean {
        val setting = appSettingDao.get(key)
        return setting?.value?.toBooleanStrictOrNull() ?: default
    }

    suspend fun setBoolean(key: String, value: Boolean) {
        appSettingDao.upsert(AppSettingEntity(key, value.toString()))
    }
}

class SyncLogRepository(private val syncLogDao: SyncLogDao) {
    fun observeRecent(limit: Int = 100): Flow<List<SyncLogEntity>> =
        syncLogDao.observeRecent(limit)

    suspend fun log(level: String, message: String, eventType: String? = null) {
        syncLogDao.insert(
            SyncLogEntity(
                level = level,
                eventType = eventType,
                message = message,
                createdAt = System.currentTimeMillis()
            )
        )
    }
}
