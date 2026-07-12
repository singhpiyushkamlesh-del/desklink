package com.desklink.discovery

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import java.nio.charset.StandardCharsets

data class DiscoveredDesktop(
    val id: String,
    val name: String,
    val host: String,
    val port: Int,
    val pairingToken: String?,
    val protocolVersion: Int
)

/**
 * Discovers DeskLink desktops on the local network via mDNS (_desklink._tcp).
 */
class DesktopDiscoveryManager(context: Context) {

    private val nsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager
    private val serviceType = "_desklink._tcp."
    private var discoveryListener: NsdManager.DiscoveryListener? = null
    private val discovered = linkedMapOf<String, DiscoveredDesktop>()
    private var onUpdate: ((List<DiscoveredDesktop>) -> Unit)? = null
    private var isRunning = false

    fun startDiscovery(onUpdate: (List<DiscoveredDesktop>) -> Unit) {
        this.onUpdate = onUpdate
        if (isRunning) {
            emit()
            return
        }

        discoveryListener = object : NsdManager.DiscoveryListener {
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                isRunning = false
            }

            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {
                isRunning = false
            }

            override fun onDiscoveryStarted(regType: String) {
                isRunning = true
            }

            override fun onDiscoveryStopped(serviceType: String) {
                isRunning = false
            }

            override fun onServiceFound(service: NsdServiceInfo) {
                if (!service.serviceType.equals(serviceType, ignoreCase = true)) return
                nsdManager.resolveService(service, createResolveListener())
            }

            override fun onServiceLost(service: NsdServiceInfo) {
                discovered.remove(service.serviceName)
                emit()
            }
        }

        nsdManager.discoverServices(serviceType, NsdManager.PROTOCOL_DNS_SD, discoveryListener)
    }

    fun stopDiscovery() {
        discoveryListener?.let { listener ->
            try {
                nsdManager.stopServiceDiscovery(listener)
            } catch (_: Exception) {
            }
        }
        discoveryListener = null
        isRunning = false
        discovered.clear()
        onUpdate = null
    }

    private fun createResolveListener() = object : NsdManager.ResolveListener {
        override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
            // Ignore — service may have disappeared
        }

        override fun onServiceResolved(serviceInfo: NsdServiceInfo) {
            val attrs = serviceInfo.attributes ?: emptyMap()
            val token = attrs["token"]?.toString(StandardCharsets.UTF_8)?.takeIf { it.isNotBlank() }
            val version = attrs["version"]?.toString(StandardCharsets.UTF_8)?.toIntOrNull() ?: 1
            val name = attrs["name"]?.toString(StandardCharsets.UTF_8) ?: serviceInfo.serviceName
            val host = serviceInfo.host?.hostAddress ?: return

            discovered[serviceInfo.serviceName] = DiscoveredDesktop(
                id = serviceInfo.serviceName,
                name = name,
                host = host,
                port = serviceInfo.port,
                pairingToken = token,
                protocolVersion = version
            )
            emit()
        }
    }

    private fun emit() {
        onUpdate?.invoke(discovered.values.toList())
    }
}
