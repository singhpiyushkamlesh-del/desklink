# DeskLink Android

Kotlin + Jetpack Compose companion app for DeskLink.

## Prerequisites

- Android Studio Hedgehog or newer
- JDK 17
- Android SDK 34
- Physical device or emulator (API 26+)

## Setup

1. Open `desklink-android` in Android Studio.
2. Let Gradle sync complete.
3. Run on a device or emulator.

If the Gradle wrapper JAR is missing, Android Studio will offer to download it, or run from Android Studio's terminal:

```bash
gradle wrapper
```

## Project layout

```
app/src/main/java/com/desklink/
  ui/           # Compose screens, navigation, theme
  data/         # Room DB, entities, repositories, protocol models
  services/     # Notification listener, foreground sync, clipboard
  pairing/      # QR pairing
  websocket/    # OkHttp WebSocket client
  security/     # EncryptedSharedPreferences token store
  device/       # Battery, model, Android version
```

## MVP complete

All 8 stages implemented.

- Sync toggles on Home (notifications, SMS, photos, clipboard, auto-reconnect)
- Unpair desktop from Home screen
- Permission helper with battery optimization check
- Foreground sync service with exponential backoff reconnect

## Testing

See [testing checklist](../docs/testing-checklist.md) and [architecture limitations](../docs/architecture.md#known-mvp-limitations).
