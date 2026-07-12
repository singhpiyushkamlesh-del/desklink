# DeskLink Communication Protocol

## Transport

- **Protocol:** WebSocket (plain `ws://` on LAN for MVP)
- **Encoding:** UTF-8 JSON text frames
- **Default port:** `9847` (configurable in pairing QR payload)
- **Version:** `1`

## Message envelope

Every message is a JSON object:

```json
{
  "type": "notification:new",
  "version": 1,
  "correlationId": "optional-uuid-for-request-response",
  "timestamp": 1710000000000,
  "deviceId": "optional-device-uuid",
  "payload": { }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | yes | Event type identifier |
| `version` | number | yes | Protocol version (currently `1`) |
| `correlationId` | string | no | UUID linking request to response |
| `timestamp` | number | no | Unix epoch milliseconds |
| `deviceId` | string | no | Sender device UUID after pairing |
| `payload` | object | yes | Type-specific data |

## Pairing QR payload

The desktop QR code encodes a JSON string:

```json
{
  "host": "192.168.1.42",
  "port": 9847,
  "token": "one-time-pairing-token",
  "version": 1
}
```

## Event catalog

### Pairing / Auth

| Type | Direction | Description |
|------|-----------|-------------|
| `pair:init` | Desktop → Android | Pairing session started (optional broadcast) |
| `pair:request` | Android → Desktop | Pairing attempt with token + device info |
| `pair:accepted` | Desktop → Android | Pairing success with session token + desktop info |
| `auth:established` | Both | Session authenticated on reconnect |

**`pair:request` payload:**

```json
{
  "pairingToken": "from-qr",
  "deviceName": "Pixel 8",
  "deviceModel": "Pixel 8",
  "androidVersion": "14",
  "deviceId": "android-generated-uuid"
}
```

**`pair:accepted` payload:**

```json
{
  "sessionToken": "long-lived-token",
  "desktopName": "DESKTOP-PC",
  "desktopId": "desktop-uuid"
}
```

### Device status

| Type | Direction | Description |
|------|-----------|-------------|
| `device:status` | Android → Desktop | Battery, model, connection info |
| `heartbeat` | Both | Keep-alive ping |

**`device:status` payload:**

```json
{
  "batteryPercent": 85,
  "isCharging": true,
  "deviceModel": "Pixel 8",
  "androidVersion": "14",
  "connectionState": "connected"
}
```

### Notifications

| Type | Direction | Description |
|------|-----------|-------------|
| `notification:new` | Android → Desktop | New notification posted |

**`notification:new` payload:**

```json
{
  "id": "notification-uuid",
  "appPackage": "com.example.app",
  "appName": "Example",
  "title": "Hello",
  "body": "World",
  "timestamp": 1710000000000
}
```

### SMS

| Type | Direction | Description |
|------|-----------|-------------|
| `sms:list:request` | Desktop → Android | Request thread list |
| `sms:list:response` | Android → Desktop | Thread list |
| `sms:thread:request` | Desktop → Android | Request messages for thread |
| `sms:thread:response` | Android → Desktop | Messages in thread |
| `sms:send` | Desktop → Android | Send SMS reply |
| `sms:send:ack` | Android → Desktop | Send result |

### Photos

| Type | Direction | Description |
|------|-----------|-------------|
| `photos:list:request` | Desktop → Android | Request recent photos |
| `photos:list:response` | Android → Desktop | Photo metadata list |
| `photo:download:request` | Desktop → Android | Request full photo |
| `photo:download:chunk` | Android → Desktop | Base64 chunk |
| `photo:download:complete` | Android → Desktop | Transfer finished |

### Clipboard

| Type | Direction | Description |
|------|-----------|-------------|
| `clipboard:update` | Both | Plain text clipboard sync |

**`clipboard:update` payload:**

```json
{
  "text": "copied text",
  "origin": "desktop" | "android",
  "originTimestamp": 1710000000000
}
```

The `origin` field prevents infinite sync loops — receivers ignore updates they originated.

## mDNS discovery (pairing)

Desktop advertises `_desklink._tcp` on the LAN while the app is running.

| TXT key | Description |
|---------|-------------|
| `name` | Desktop display name |
| `version` | Protocol version (`1`) |
| `token` | Active pairing token (only while pairing session is open) |

Android discovers the service and can pair without scanning QR when `token` is present. QR pairing remains supported as fallback.

### Errors

| Type | Direction | Description |
|------|-----------|-------------|
| `sync:error` | Both | Error report |

**`sync:error` payload:**

```json
{
  "code": "PERMISSION_DENIED",
  "message": "SMS permission not granted",
  "relatedType": "sms:list:request"
}
```

## Request/response pattern

1. Requester sets `correlationId` to a new UUID.
2. Responder echoes the same `correlationId` in the response event.
3. Requester matches response by `correlationId`.

## Authentication after pairing

On reconnect, Android sends:

```json
{
  "type": "auth:established",
  "payload": {
    "sessionToken": "saved-token",
    "deviceId": "android-uuid"
  }
}
```

Desktop validates token against stored trusted device record. Invalid token → connection closed.

## Implementation references

- TypeScript: `desklink-desktop/electron/shared/protocol.ts`
- Kotlin: `desklink-android/.../data/models/ProtocolModels.kt`
