package com.desklink.ui.viewmodel

import android.app.Application
import android.content.Intent
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.desklink.data.db.DeskLinkDatabase
import com.desklink.data.models.ConnectionStates
import com.desklink.data.repository.DeviceRepository
import com.desklink.data.repository.SettingsRepository
import com.desklink.permissions.PermissionHelper
import com.desklink.permissions.PermissionItem
import com.desklink.security.SecureTokenStore
import com.desklink.services.SyncForegroundService
import com.desklink.sync.SyncStateHolder
import com.desklink.ui.screens.SyncToggleState
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MainUiState(
    val pairedDesktopName: String? = null,
    val connectionState: String = ConnectionStates.DISCONNECTED,
    val lastSyncTime: String? = null,
    val permissions: List<PermissionItem> = emptyList(),
    val syncToggles: SyncToggleState = SyncToggleState()
)

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val db = DeskLinkDatabase.getInstance(application)
    private val deviceRepository = DeviceRepository(db.pairedDeviceDao())
    private val settingsRepository = SettingsRepository(db.appSettingDao())
    private val secureTokenStore = SecureTokenStore(application)

    private val _uiState = MutableStateFlow(MainUiState())
    val uiState: StateFlow<MainUiState> = _uiState.asStateFlow()

    init {
        refreshPermissions()
        observePairedDevice()
        observeSyncState()
        loadSyncToggles()
    }

    private fun observeSyncState() {
        viewModelScope.launch {
            combine(
                SyncStateHolder.connectionState,
                SyncStateHolder.lastSyncTime
            ) { connection, lastSync ->
                connection to lastSync
            }.collect { (connection, lastSync) ->
                _uiState.update {
                    it.copy(
                        connectionState = connection,
                        lastSyncTime = lastSync?.let { ts ->
                            java.text.DateFormat.getDateTimeInstance().format(java.util.Date(ts))
                        }
                    )
                }
            }
        }
    }

    private fun observePairedDevice() {
        viewModelScope.launch {
            deviceRepository.observePrimaryDevice().collect { device ->
                _uiState.update {
                    it.copy(pairedDesktopName = device?.desktopName)
                }
            }
        }
    }

    private fun loadSyncToggles() {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    syncToggles = SyncToggleState(
                        notificationSync = settingsRepository.getBoolean(
                            SettingsRepository.KEY_NOTIFICATION_SYNC
                        ),
                        smsSync = settingsRepository.getBoolean(
                            SettingsRepository.KEY_SMS_SYNC
                        ),
                        photoSync = settingsRepository.getBoolean(
                            SettingsRepository.KEY_PHOTO_SYNC
                        ),
                        clipboardSync = settingsRepository.getBoolean(
                            SettingsRepository.KEY_CLIPBOARD_SYNC
                        ),
                        autoReconnect = settingsRepository.getBoolean(
                            SettingsRepository.KEY_AUTO_RECONNECT
                        )
                    )
                )
            }
        }
    }

    fun refreshPermissions() {
        _uiState.update {
            it.copy(permissions = PermissionHelper.getRequiredPermissions(getApplication()))
        }
    }

    fun openPermissionSettings(item: PermissionItem) {
        val context = getApplication<Application>()
        val intent = when (item.id) {
            "notification" -> PermissionHelper.notificationListenerSettingsIntent()
            "battery" -> PermissionHelper.batteryOptimizationIntent(context)
            else -> PermissionHelper.appDetailsSettingsIntent(context)
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    fun setSyncToggle(key: String, enabled: Boolean) {
        viewModelScope.launch {
            val settingKey = when (key) {
                "notification" -> SettingsRepository.KEY_NOTIFICATION_SYNC
                "sms" -> SettingsRepository.KEY_SMS_SYNC
                "photo" -> SettingsRepository.KEY_PHOTO_SYNC
                "clipboard" -> SettingsRepository.KEY_CLIPBOARD_SYNC
                "auto_reconnect" -> SettingsRepository.KEY_AUTO_RECONNECT
                else -> return@launch
            }
            settingsRepository.setBoolean(settingKey, enabled)
            loadSyncToggles()
        }
    }

    fun unpairDesktop(onComplete: () -> Unit) {
        viewModelScope.launch {
            val devices = deviceRepository.getPairedDevices()
            val device = devices.firstOrNull() ?: run {
                onComplete()
                return@launch
            }
            deviceRepository.removeDevice(device.id)
            secureTokenStore.clearAll()
            SyncForegroundService.stop(getApplication())
            SyncStateHolder.updateConnectionState(ConnectionStates.DISCONNECTED)
            _uiState.update { it.copy(pairedDesktopName = null) }
            onComplete()
        }
    }

    fun reconnectDesktop() {
        val context = getApplication<Application>()
        SyncForegroundService.stop(context)
        SyncForegroundService.start(context)
    }
}

class MainViewModelFactory(
    private val application: Application
) : ViewModelProvider.Factory {
  @Suppress("UNCHECKED_CAST")
  override fun <T : ViewModel> create(modelClass: Class<T>): T {
    if (modelClass.isAssignableFrom(MainViewModel::class.java)) {
      return MainViewModel(application) as T
    }
    throw IllegalArgumentException("Unknown ViewModel class")
  }
}
