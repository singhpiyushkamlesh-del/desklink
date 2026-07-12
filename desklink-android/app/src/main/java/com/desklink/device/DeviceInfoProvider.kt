package com.desklink.device

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import com.desklink.data.models.ConnectionStates
import com.desklink.data.models.DeviceStatusPayload

/**
 * Provides device battery, model, and Android version info.
 * Connection state injected from sync layer in Stage 3.
 */
class DeviceInfoProvider(private val context: Context) {

    fun getDeviceStatus(connectionState: String = ConnectionStates.DISCONNECTED): DeviceStatusPayload {
        val battery = getBatteryInfo()
        return DeviceStatusPayload(
            batteryPercent = battery.first,
            isCharging = battery.second,
            deviceModel = Build.MODEL,
            androidVersion = Build.VERSION.RELEASE,
            connectionState = connectionState
        )
    }

    fun getDeviceName(): String = Build.MODEL

    fun getDeviceModel(): String = "${Build.MANUFACTURER} ${Build.MODEL}".trim()

    fun getAndroidVersion(): String = Build.VERSION.RELEASE

    private fun getBatteryInfo(): Pair<Int, Boolean> {
        val filter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        val batteryStatus = context.registerReceiver(null, filter)
        val level = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = batteryStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val percent = if (level >= 0 && scale > 0) (level * 100 / scale) else 0
        val status = batteryStatus?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val charging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
            status == BatteryManager.BATTERY_STATUS_FULL
        return percent to charging
    }
}
