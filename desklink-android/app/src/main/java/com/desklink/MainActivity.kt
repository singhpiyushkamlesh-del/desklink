package com.desklink

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.lifecycleScope
import com.desklink.data.db.DeskLinkDatabase
import com.desklink.data.repository.DeviceRepository
import com.desklink.services.SyncForegroundService
import com.desklink.ui.DeskLinkApp
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        lifecycleScope.launch {
            val db = DeskLinkDatabase.getInstance(applicationContext)
            val paired = DeviceRepository(db.pairedDeviceDao()).observePrimaryDevice().first()
            if (paired != null) {
                SyncForegroundService.start(applicationContext)
            }
        }

        setContent {
            DeskLinkApp(application)
        }
    }
}
