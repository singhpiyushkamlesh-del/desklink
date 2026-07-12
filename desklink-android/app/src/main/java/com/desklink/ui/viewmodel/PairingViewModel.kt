package com.desklink.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.desklink.data.db.DeskLinkDatabase
import com.desklink.data.models.PairingQrPayload
import com.desklink.data.repository.DeviceRepository
import com.desklink.data.repository.SyncLogRepository
import com.desklink.device.DeviceInfoProvider
import com.desklink.discovery.DesktopDiscoveryManager
import com.desklink.discovery.DiscoveredDesktop
import com.desklink.pairing.PairingManager
import com.desklink.pairing.PairingResult
import com.desklink.security.SecureTokenStore
import com.desklink.websocket.WebSocketManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class PairingUiState(
    val isPairing: Boolean = false,
    val pairingError: String? = null,
    val pairingSuccess: String? = null,
    val scannedPayloadSummary: String? = null,
    val discoveredDesktops: List<DiscoveredDesktop> = emptyList(),
    val isDiscovering: Boolean = false
)

class PairingViewModel(application: Application) : AndroidViewModel(application) {

    private val db = DeskLinkDatabase.getInstance(application)
    private val pairingManager = PairingManager(
        context = application,
        deviceRepository = DeviceRepository(db.pairedDeviceDao()),
        syncLogRepository = SyncLogRepository(db.syncLogDao()),
        secureTokenStore = SecureTokenStore(application),
        webSocketManager = WebSocketManager(),
        deviceInfoProvider = DeviceInfoProvider(application)
    )
    private val discoveryManager = DesktopDiscoveryManager(application)

    private val _uiState = MutableStateFlow(PairingUiState())
    val uiState: StateFlow<PairingUiState> = _uiState.asStateFlow()

    fun startDiscovery() {
        _uiState.update { it.copy(isDiscovering = true, pairingError = null) }
        discoveryManager.startDiscovery { desktops ->
            _uiState.update {
                it.copy(discoveredDesktops = desktops, isDiscovering = true)
            }
        }
    }

    fun stopDiscovery() {
        discoveryManager.stopDiscovery()
        _uiState.update { it.copy(isDiscovering = false, discoveredDesktops = emptyList()) }
    }

    fun onQrScanned(rawContent: String) {
        val payload = pairingManager.parseQrPayload(rawContent)
        if (payload == null) {
            _uiState.update {
                it.copy(
                    pairingError = "Invalid QR code. Scan the code shown on your desktop DeskLink app.",
                    pairingSuccess = null
                )
            }
            return
        }
        pairWithPayload(payload, "${payload.host}:${payload.port}")
    }

    fun pairWithDiscovered(desktop: DiscoveredDesktop) {
        val token = desktop.pairingToken
        if (token.isNullOrBlank()) {
            _uiState.update {
                it.copy(
                    pairingError = "Desktop is not ready to pair. Open DeskLink on your PC and wait for the Pair Device screen.",
                    pairingSuccess = null
                )
            }
            return
        }
        val payload = PairingQrPayload(
            host = desktop.host,
            port = desktop.port,
            token = token,
            version = desktop.protocolVersion
        )
        pairWithPayload(payload, desktop.name)
    }

    private fun pairWithPayload(payload: PairingQrPayload, summary: String) {
        _uiState.update {
            it.copy(
                isPairing = true,
                pairingError = null,
                pairingSuccess = null,
                scannedPayloadSummary = summary
            )
        }

        viewModelScope.launch {
            when (val result = pairingManager.initiatePairing(payload)) {
                is PairingResult.Success -> {
                    stopDiscovery()
                    _uiState.update {
                        it.copy(
                            isPairing = false,
                            pairingSuccess = result.desktopName,
                            pairingError = null
                        )
                    }
                }
                is PairingResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            isPairing = false,
                            pairingError = result.message,
                            pairingSuccess = null
                        )
                    }
                }
            }
        }
    }

    fun clearMessages() {
        _uiState.update { it.copy(pairingError = null, pairingSuccess = null) }
    }

    override fun onCleared() {
        stopDiscovery()
        super.onCleared()
    }
}

class PairingViewModelFactory(
    private val application: Application
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(PairingViewModel::class.java)) {
            return PairingViewModel(application) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
