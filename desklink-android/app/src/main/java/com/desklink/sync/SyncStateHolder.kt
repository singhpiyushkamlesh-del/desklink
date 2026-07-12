package com.desklink.sync

import com.desklink.data.models.ConnectionStates
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

object SyncStateHolder {
    private val _connectionState = MutableStateFlow(ConnectionStates.DISCONNECTED)
    val connectionState: StateFlow<String> = _connectionState.asStateFlow()

    private val _lastSyncTime = MutableStateFlow<Long?>(null)
    val lastSyncTime: StateFlow<Long?> = _lastSyncTime.asStateFlow()

    fun updateConnectionState(state: String) {
        _connectionState.value = state
    }

    fun updateLastSync(timestamp: Long) {
        _lastSyncTime.value = timestamp
    }
}
