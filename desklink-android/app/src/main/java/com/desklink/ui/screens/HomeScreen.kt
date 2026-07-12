package com.desklink.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.desklink.ui.components.ConnectionStatusChip

data class SyncToggleState(
    val notificationSync: Boolean = true,
    val smsSync: Boolean = true,
    val photoSync: Boolean = true,
    val clipboardSync: Boolean = true,
    val autoReconnect: Boolean = true
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    pairedDesktopName: String?,
    connectionState: String,
    lastSyncTime: String?,
    syncToggles: SyncToggleState,
    onToggleChange: (String, Boolean) -> Unit,
    onReconnect: () -> Unit,
    onUnpair: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("DeskLink") },
                actions = {
                    ConnectionStatusChip(connectionState = connectionState)
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Text(
                        text = pairedDesktopName ?: "No desktop paired",
                        style = MaterialTheme.typography.titleLarge
                    )
                    Text(
                        text = when (connectionState) {
                            "connected" -> "Connected — syncing with desktop"
                            "connecting" -> "Connecting to desktop…"
                            "paired" -> "Paired — establishing connection"
                            else -> lastSyncTime?.let { "Last sync: $it" } ?: "Not connected"
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                    if (connectionState == "connecting") {
                        Text(
                            text = "If this persists, check Wi‑Fi and that DeskLink desktop is running.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.tertiary,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    }
                    if (connectionState != "connected" && pairedDesktopName != null) {
                        Button(
                            onClick = onReconnect,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 12.dp)
                        ) {
                            Text("Reconnect now")
                        }
                    }
                }
            }

            Text(
                text = "Sync toggles",
                style = MaterialTheme.typography.titleMedium
            )

            SyncToggleRow(
                label = "Notification sync",
                checked = syncToggles.notificationSync,
                onCheckedChange = { onToggleChange("notification", it) }
            )
            SyncToggleRow(
                label = "SMS sync",
                checked = syncToggles.smsSync,
                onCheckedChange = { onToggleChange("sms", it) }
            )
            SyncToggleRow(
                label = "Photo sync",
                checked = syncToggles.photoSync,
                onCheckedChange = { onToggleChange("photo", it) }
            )
            SyncToggleRow(
                label = "Clipboard sync",
                checked = syncToggles.clipboardSync,
                onCheckedChange = { onToggleChange("clipboard", it) }
            )
            SyncToggleRow(
                label = "Auto-reconnect",
                description = "Retry connection when Wi‑Fi drops",
                checked = syncToggles.autoReconnect,
                onCheckedChange = { onToggleChange("auto_reconnect", it) }
            )

            if (pairedDesktopName != null) {
                OutlinedButton(
                    onClick = onUnpair,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("Unpair desktop")
                }
            }
        }
    }
}

@Composable
private fun SyncToggleRow(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    description: String? = null
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = label, style = MaterialTheme.typography.bodyLarge)
                if (description != null) {
                    Text(
                        text = description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
            }
            Switch(checked = checked, onCheckedChange = onCheckedChange)
        }
    }
}
