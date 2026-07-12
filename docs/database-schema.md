# DeskLink Database Schema

## Desktop — persistence

**Implementation:** JSON file store at `{userData}/desklink-store.json` (Electron `app.getPath('userData')`).

The SQL schemas below describe the logical data model. Android uses Room/SQLite; desktop maps the same entities to JSON arrays.

### `devices`

Stores paired Android devices.

```sql
CREATE TABLE IF NOT EXISTS devices (
  id              TEXT PRIMARY KEY,
  device_name     TEXT NOT NULL,
  device_model    TEXT,
  android_version TEXT,
  paired_at       INTEGER NOT NULL,
  last_seen       INTEGER,
  trusted         INTEGER NOT NULL DEFAULT 1,
  auth_token      TEXT
);
```

### `notifications`

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id           TEXT PRIMARY KEY,
  device_id    TEXT NOT NULL,
  app_package  TEXT,
  app_name     TEXT,
  title        TEXT,
  body         TEXT,
  timestamp    INTEGER NOT NULL,
  raw_payload  TEXT,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_device ON notifications(device_id);
CREATE INDEX IF NOT EXISTS idx_notifications_timestamp ON notifications(timestamp DESC);
```

### `message_threads`

```sql
CREATE TABLE IF NOT EXISTS message_threads (
  id             TEXT PRIMARY KEY,
  device_id      TEXT NOT NULL,
  address        TEXT NOT NULL,
  display_name   TEXT,
  last_message   TEXT,
  last_timestamp INTEGER,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);
CREATE INDEX IF NOT EXISTS idx_threads_device ON message_threads(device_id);
```

### `messages`

```sql
CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  thread_id  TEXT NOT NULL,
  address    TEXT NOT NULL,
  body       TEXT NOT NULL,
  direction  TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
  timestamp  INTEGER NOT NULL,
  status     TEXT DEFAULT 'delivered',
  FOREIGN KEY (thread_id) REFERENCES message_threads(id)
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
```

### `photos`

```sql
CREATE TABLE IF NOT EXISTS photos (
  id               TEXT PRIMARY KEY,
  device_id        TEXT NOT NULL,
  remote_uri       TEXT,
  file_name        TEXT,
  mime_type        TEXT,
  created_at       INTEGER,
  thumbnail_path   TEXT,
  local_cache_path TEXT,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);
```

### `sync_logs`

```sql
CREATE TABLE IF NOT EXISTS sync_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  level      TEXT NOT NULL CHECK(level IN ('debug', 'info', 'warn', 'error')),
  event_type TEXT,
  message    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created ON sync_logs(created_at DESC);
```

### Desktop implementation

- Schema DDL: `desklink-desktop/electron/main/storage/schema.ts`
- Repository interfaces: `desklink-desktop/electron/main/storage/repositories.ts`
- Initialization runs on app startup in Stage 2+.

---

## Android — Room

Database name: `desklink.db`

### `paired_devices`

```kotlin
@Entity(tableName = "paired_devices")
data class PairedDeviceEntity(
    @PrimaryKey val id: String,
    val desktopName: String,
    val desktopHost: String,
    val desktopPort: Int,
    val sessionToken: String,
    val pairedAt: Long,
    val lastConnectedAt: Long?
)
```

### `pending_notifications`

Queue for notifications captured while offline.

```kotlin
@Entity(tableName = "pending_notifications")
data class PendingNotificationEntity(
    @PrimaryKey val id: String,
    val appPackage: String,
    val appName: String?,
    val title: String?,
    val body: String?,
    val timestamp: Long,
    val synced: Boolean = false
)
```

### `sync_logs`

```kotlin
@Entity(tableName = "sync_logs")
data class SyncLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val level: String,
    val eventType: String?,
    val message: String,
    val createdAt: Long
)
```

### `app_settings`

Key-value settings store.

```kotlin
@Entity(tableName = "app_settings")
data class AppSettingEntity(
    @PrimaryKey val key: String,
    val value: String
)
```

Default keys:

| Key | Default | Description |
|-----|---------|-------------|
| `notification_sync` | `true` | Forward notifications |
| `sms_sync` | `true` | Allow SMS sync |
| `photo_sync` | `true` | Allow photo sync |
| `clipboard_sync` | `true` | Allow clipboard sync |
| `auto_reconnect` | `true` | Reconnect on disconnect |

### Android implementation

- Entities: `desklink-android/.../data/entities/`
- DAOs: `desklink-android/.../data/dao/`
- Database: `desklink-android/.../data/db/DeskLinkDatabase.kt`
