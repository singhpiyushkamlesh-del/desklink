package com.desklink.ui

import android.app.Application
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.desklink.ui.navigation.Routes
import com.desklink.ui.screens.HomeScreen
import com.desklink.ui.screens.PairingScreen
import com.desklink.ui.screens.PermissionsScreen
import com.desklink.ui.screens.QrScannerScreen
import com.desklink.ui.theme.DeskLinkTheme
import com.desklink.ui.viewmodel.MainViewModel
import com.desklink.ui.viewmodel.MainViewModelFactory
import com.desklink.ui.viewmodel.PairingViewModel
import com.desklink.ui.viewmodel.PairingViewModelFactory

@Composable
fun DeskLinkApp(application: Application) {
    DeskLinkTheme {
        val navController = rememberNavController()
        val mainViewModel: MainViewModel = viewModel(
            factory = MainViewModelFactory(application)
        )
        val pairingViewModel: PairingViewModel = viewModel(
            factory = PairingViewModelFactory(application)
        )
        val uiState by mainViewModel.uiState.collectAsState()
        val pairingState by pairingViewModel.uiState.collectAsState()

        NavHost(
            navController = navController,
            startDestination = Routes.PAIRING
        ) {
            composable(Routes.PAIRING) {
                PairingScreen(
                    pairedDesktopName = uiState.pairedDesktopName,
                    discoveredDesktops = pairingState.discoveredDesktops,
                    isDiscovering = pairingState.isDiscovering,
                    isPairing = pairingState.isPairing,
                    pairingError = pairingState.pairingError,
                    onStartDiscovery = pairingViewModel::startDiscovery,
                    onStopDiscovery = pairingViewModel::stopDiscovery,
                    onPairWithDesktop = pairingViewModel::pairWithDiscovered,
                    onScanQr = { navController.navigate(Routes.QR_SCANNER) },
                    onContinue = {
                        val dest = if (uiState.pairedDesktopName != null) {
                            Routes.HOME
                        } else {
                            Routes.PERMISSIONS
                        }
                        navController.navigate(dest)
                    }
                )
            }
            composable(Routes.QR_SCANNER) {
                QrScannerScreen(
                    isPairing = pairingState.isPairing,
                    pairingError = pairingState.pairingError,
                    pairingSuccess = pairingState.pairingSuccess,
                    onQrScanned = pairingViewModel::onQrScanned,
                    onBack = {
                        pairingViewModel.clearMessages()
                        navController.navigate(Routes.PERMISSIONS) {
                            popUpTo(Routes.PAIRING) { inclusive = false }
                        }
                    }
                )
            }
            composable(Routes.PERMISSIONS) {
                PermissionsScreen(
                    permissions = uiState.permissions,
                    onOpenSettings = mainViewModel::openPermissionSettings,
                    onContinue = { navController.navigate(Routes.HOME) }
                )
            }
            composable(Routes.HOME) {
                HomeScreen(
                    pairedDesktopName = uiState.pairedDesktopName,
                    connectionState = uiState.connectionState,
                    lastSyncTime = uiState.lastSyncTime,
                    syncToggles = uiState.syncToggles,
                    onToggleChange = mainViewModel::setSyncToggle,
                    onReconnect = mainViewModel::reconnectDesktop,
                    onUnpair = {
                        mainViewModel.unpairDesktop {
                            navController.navigate(Routes.PAIRING) {
                                popUpTo(Routes.PAIRING) { inclusive = true }
                            }
                        }
                    }
                )
            }
        }
    }
}
