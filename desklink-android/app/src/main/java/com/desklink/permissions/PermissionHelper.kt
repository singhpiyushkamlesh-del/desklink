package com.desklink.permissions

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat

data class PermissionItem(
    val id: String,
    val title: String,
    val description: String,
    val granted: Boolean,
    val requiresSettings: Boolean = false
)

object PermissionHelper {

    fun getRequiredPermissions(context: Context): List<PermissionItem> {
        return listOf(
            PermissionItem(
                id = "notification",
                title = "Notification access",
                description = "Required to forward phone notifications to your PC.",
                granted = isNotificationListenerEnabled(context),
                requiresSettings = true
            ),
            PermissionItem(
                id = "sms",
                title = "SMS read & send",
                description = "Required to view and reply to messages from your PC.",
                granted = hasSmsPermissions(context),
                requiresSettings = true
            ),
            PermissionItem(
                id = "photos",
                title = "Photos access",
                description = "Required to browse and download recent photos.",
                granted = hasPhotoPermission(context),
                requiresSettings = true
            ),
            PermissionItem(
                id = "camera",
                title = "Camera",
                description = "Required to scan the desktop pairing QR code.",
                granted = ContextCompat.checkSelfPermission(
                    context, Manifest.permission.CAMERA
                ) == PackageManager.PERMISSION_GRANTED
            ),
            PermissionItem(
                id = "battery",
                title = "Battery optimization",
                description = "Exclude DeskLink from battery restrictions for stable sync.",
                granted = isIgnoringBatteryOptimizations(context),
                requiresSettings = true
            )
        )
    }

    fun notificationListenerSettingsIntent(): Intent =
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)

    fun batteryOptimizationIntent(context: Context): Intent =
        Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:${context.packageName}")
        }

    fun appDetailsSettingsIntent(context: Context): Intent =
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", context.packageName, null)
        }

    private fun isNotificationListenerEnabled(context: Context): Boolean {
        val flat = Settings.Secure.getString(
            context.contentResolver,
            "enabled_notification_listeners"
        ) ?: return false
        return flat.contains(context.packageName)
    }

    private fun hasSmsPermissions(context: Context): Boolean {
        val read = ContextCompat.checkSelfPermission(
            context, Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED
        val send = ContextCompat.checkSelfPermission(
            context, Manifest.permission.SEND_SMS
        ) == PackageManager.PERMISSION_GRANTED
        return read && send
    }

    private fun hasPhotoPermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.READ_MEDIA_IMAGES
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.READ_EXTERNAL_STORAGE
            ) == PackageManager.PERMISSION_GRANTED
        }
    }

    private fun isIgnoringBatteryOptimizations(context: Context): Boolean {
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        return pm.isIgnoringBatteryOptimizations(context.packageName)
    }
}
