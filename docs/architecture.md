# DeskLink Architecture

## Overview

DeskLink is a local-network companion system with two clients:

- **desklink-desktop** — Electron app acting as pairing host, WebSocket server, and sync endpoint.
- **desklink-android** — Android app capturing device data and forwarding it to the desktop.

There is no cloud backend in the MVP. All communication happens over the local LAN using JSON events over WebSocket.

## High-level diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    desklink-desktop                          │
│  ┌──────────────┐   IPC    ┌──────────────┐                 │
│  │ React UI     │◄────────►│ Electron     │                 │
│  │ (Zustand)    │  preload │ Main Process │                 │
│  └──────────────┘          │              │                 │
│                             │ • WebSocket  │                 │
│                             │ • JSON store │                 │
│                             │ • Pairing    │                 │
│                             │ • Security   │                 │
│                             └──────┬───────┘                 │
└────────────────────────────────────┼──────────────────────────┘
                                     │ WebSocket (JSON events)
                                     │ same Wi-Fi / LAN
┌────────────────────────────────────┼──────────────────────────┐
│                    desklink-android                          │
│                             ┌──────▼───────┐                 │
│                             │ SyncForeground│                │
│                             │ Service       │                │
│                             └──────┬───────┘                 │
│  ┌──────────────┐          ┌──────▼───────┐                 │
│  │ Compose UI   │◄────────►│ Repositories │                 │
│  │ (ViewModels) │          │ + Room DB    │                 │
│  └──────────────┘          └──────────────┘                 │
│                             │                                │
│  NotificationListenerService, SMS, MediaStore, Clipboard     │
└─────────────────────────────────────────────────────────────┘
```

## Desktop process model

| Layer | Responsibility |
|-------|----------------|
| **Renderer (React)** | UI, routing, Zustand state. No direct WebSocket or filesystem access. |
| **Preload** | Typed `window.desklink` bridge exposing safe IPC methods. |
| **Main process** | Window management, WebSocket server, JSON persistence, pairing tokens, clipboard monitor. |

### Desktop module layout

```
electron/main/
├── main.ts              # App entry, window creation
├── windows/             # BrowserWindow factory
├── websocket/           # WS server + client session management
├── ipc/                 # IPC handler registration
├── storage/             # JSON file store + repositories
└── security/            # Token generation, device trust

electron/shared/
└── protocol.ts          # Event types shared with renderer

src/
├── pages/               # Route-level page components
├── components/          # Reusable UI
├── store/               # Zustand stores
└── services/            # Renderer-side helpers (IPC wrappers)
```

## Android module layout

| Layer | Responsibility |
|-------|----------------|
| **UI (Compose)** | Screens, navigation, observes ViewModel state. |
| **ViewModels** | UI state, calls repositories. |
| **Repositories** | Business logic, data orchestration. |
| **Services** | Background sync, notification capture, clipboard. |
| **Room** | Local persistence for paired devices, logs, queued events. |

### Key Android components

- `SyncForegroundService` — maintains WebSocket connection, heartbeat, reconnect.
- `NotificationCaptureService` — `NotificationListenerService` subclass.
- `ClipboardMonitor` — watches clipboard for cross-device sync.
- `DeviceInfoProvider` — battery, model, Android version.
- `SecureTokenStore` — EncryptedSharedPreferences for auth tokens.

## Communication protocol

All messages use a JSON envelope with a `type` field. See [protocol.md](protocol.md).

Request/response flows use a `correlationId` to match replies.

## Security model (MVP)

1. Desktop generates a **one-time pairing token** displayed in a QR code.
2. Android scans QR, connects via WebSocket, sends `pair:request` with the token.
3. On success, desktop issues a **session token** stored on both sides.
4. Future connections authenticate with the saved session token.
5. Unknown devices are rejected; user can unpair/revoke from Settings.

No PKI or cloud identity in MVP — appropriate for same-LAN trusted pairing.

## Data persistence

| Platform | Store | Purpose |
|----------|-------|---------|
| Desktop | SQLite | Devices, notifications, messages, photos metadata, logs |
| Android | Room | Paired devices, pending notifications, settings, logs |

See [database-schema.md](database-schema.md).

## Stage roadmap

| Stage | Deliverable |
|-------|-------------|
| 1 | Shells, contracts, schema design |
| 2 | QR pairing end-to-end |
| 3 | Auth session, heartbeat, device dashboard |
| 4 | Notification sync |
| 5 | SMS sync + reply |
| 6 | Photos list + download |
| 7 | Clipboard sync |
| 8 | Settings, logs, polish — **complete** |

## Known MVP limitations

- Same Wi-Fi / LAN only — no internet relay.
- SMS requires `READ_SMS` / `SEND_SMS` permissions; some OEMs restrict background SMS.
- Notification access requires user to enable in system settings.
- Photo transfer uses chunked base64 over WebSocket — not optimized for large libraries.
- No screen mirroring, calls, or iOS support.

## Future (Phase 2)

- Optional cloud relay for remote access.
- End-to-end encryption beyond LAN trust.
- Call notifications (not full call handling).
- Contact name resolution for SMS threads.
