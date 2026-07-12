package com.desklink.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.desklink.data.entities.PairedDeviceEntity
import com.desklink.data.entities.PendingNotificationEntity
import com.desklink.data.entities.SyncLogEntity
import com.desklink.data.entities.AppSettingEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PairedDeviceDao {
    @Query("SELECT * FROM paired_devices LIMIT 1")
    fun observePrimary(): Flow<PairedDeviceEntity?>

    @Query("SELECT * FROM paired_devices")
    suspend fun getAll(): List<PairedDeviceEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(device: PairedDeviceEntity)

    @Query("DELETE FROM paired_devices WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM paired_devices")
    suspend fun deleteAll()
}

@Dao
interface PendingNotificationDao {
    @Query("SELECT * FROM pending_notifications WHERE synced = 0 ORDER BY timestamp ASC")
    suspend fun getUnsynced(): List<PendingNotificationEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(notification: PendingNotificationEntity)

    @Query("UPDATE pending_notifications SET synced = 1 WHERE id = :id")
    suspend fun markSynced(id: String)
}

@Dao
interface SyncLogDao {
    @Query("SELECT * FROM sync_logs ORDER BY createdAt DESC LIMIT :limit")
    fun observeRecent(limit: Int = 100): Flow<List<SyncLogEntity>>

    @Insert
    suspend fun insert(log: SyncLogEntity)
}

@Dao
interface AppSettingDao {
    @Query("SELECT * FROM app_settings WHERE `key` = :key")
    suspend fun get(key: String): AppSettingEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(setting: AppSettingEntity)

    @Query("SELECT * FROM app_settings")
    fun observeAll(): Flow<List<AppSettingEntity>>
}
