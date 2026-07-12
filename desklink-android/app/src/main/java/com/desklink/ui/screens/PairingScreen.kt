package com.desklink.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.desklink.discovery.DiscoveredDesktop
import com.desklink.ui.components.EmptyStateCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PairingScreen(
    pairedDesktopName: String?,
    discoveredDesktops: List<DiscoveredDesktop>,
    isDiscovering: Boolean,
    isPairing: Boolean,
    pairingError: String?,
    onStartDiscovery: () -> Unit,
    onStopDiscovery: () -> Unit,
    onPairWithDesktop: (DiscoveredDesktop) -> Unit,
    onScanQr: () -> Unit,
    onContinue: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Pair with Desktop") })
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "Connect DeskLink",
                style = MaterialTheme.typography.headlineMedium
            )
            Text(
                text = "Find your PC on the network or scan the QR code on the desktop Pair Device page.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            if (pairedDesktopName != null) {
                EmptyStateCard(
                    title = "Already paired",
                    description = "Paired with $pairedDesktopName. You can re-pair or continue to the home screen."
                )
            }

            pairingError?.let { error ->
                Text(
                    text = error,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium
                )
            }

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Nearby desktops",
                        style = MaterialTheme.typography.titleMedium
                    )
                    if (!isDiscovering) {
                        Text(
                            text = "Search for DeskLink on your Wi‑Fi network (no QR scan needed).",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Button(
                            onClick = onStartDiscovery,
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !isPairing
                        ) {
                            Text("Find nearby desktops")
                        }
                    } else {
                        if (discoveredDesktops.isEmpty()) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 8.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                CircularProgressIndicator()
                                Text(
                                    text = "Searching…",
                                    modifier = Modifier.padding(top = 8.dp),
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        } else {
                            LazyColumn(
                                modifier = Modifier.fillMaxWidth(),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                items(discoveredDesktops, key = { it.id }) { desktop ->
                                    OutlinedButton(
                                        onClick = { onPairWithDesktop(desktop) },
                                        modifier = Modifier.fillMaxWidth(),
                                        enabled = !isPairing
                                    ) {
                                        Column(modifier = Modifier.fillMaxWidth()) {
                                            Text(desktop.name)
                                            Text(
                                                text = if (desktop.pairingToken != null) {
                                                    "Ready to pair"
                                                } else {
                                                    "Waiting for desktop pairing mode"
                                                },
                                                style = MaterialTheme.typography.bodySmall
                                            )
                                        }
                                    }
                                }
                            }
                        }
                        OutlinedButton(
                            onClick = onStopDiscovery,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Stop searching")
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            OutlinedButton(
                onClick = onScanQr,
                modifier = Modifier.fillMaxWidth(),
                enabled = !isPairing
            ) {
                Text("Scan QR Code instead")
            }

            OutlinedButton(
                onClick = onContinue,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(if (pairedDesktopName != null) "Continue" else "Skip for now")
            }
        }
    }
}
