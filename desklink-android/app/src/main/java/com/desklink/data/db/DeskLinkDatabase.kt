package com.desklink.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.desklink.data.dao.AppSettingDao
import com.desklink.data.dao.PairedDeviceDao
import com.desklink.data.dao.PendingNotificationDao
import com.desklink.data.dao.SyncLogDao
import com.desklink.data.entities.AppSettingEntity
import com.desklink.data.entities.PairedDeviceEntity
import com.desklink.data.entities.PendingNotificationEntity
import com.desklink.data.entities.SyncLogEntity

@Database(
    entities = [
        PairedDeviceEntity::class,
        PendingNotificationEntity::class,
        SyncLogEntity::class,
        AppSettingEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class DeskLinkDatabase : RoomDatabase() {
    abstract fun pairedDeviceDao(): PairedDeviceDao
    abstract fun pendingNotificationDao(): PendingNotificationDao
    abstract fun syncLogDao(): SyncLogDao
    abstract fun appSettingDao(): AppSettingDao

    companion object {
        @Volatile
        private var INSTANCE: DeskLinkDatabase? = null

        fun getInstance(context: Context): DeskLinkDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    DeskLinkDatabase::class.java,
                    "desklink.db"
                ).build().also { INSTANCE = it }
            }
        }
    }
}
