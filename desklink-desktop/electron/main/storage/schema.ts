export const SCHEMA_VERSION = 1;

export const CREATE_TABLES_SQL = `
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

CREATE TABLE IF NOT EXISTS sync_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  level      TEXT NOT NULL CHECK(level IN ('debug', 'info', 'warn', 'error')),
  event_type TEXT,
  message    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_created ON sync_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS schema_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export interface DeviceRow {
  id: string;
  device_name: string;
  device_model: string | null;
  android_version: string | null;
  paired_at: number;
  last_seen: number | null;
  trusted: number;
  auth_token: string | null;
}

export interface NotificationRow {
  id: string;
  device_id: string;
  app_package: string | null;
  app_name: string | null;
  title: string | null;
  body: string | null;
  timestamp: number;
  raw_payload: string | null;
}

export interface MessageThreadRow {
  id: string;
  device_id: string;
  address: string;
  display_name: string | null;
  last_message: string | null;
  last_timestamp: number | null;
}

export interface MessageRow {
  id: string;
  thread_id: string;
  address: string;
  body: string;
  direction: 'inbound' | 'outbound';
  timestamp: number;
  status: string | null;
}

export interface PhotoRow {
  id: string;
  device_id: string;
  remote_uri: string | null;
  file_name: string | null;
  mime_type: string | null;
  created_at: number | null;
  thumbnail_path: string | null;
  local_cache_path: string | null;
}

export interface SyncLogRow {
  id: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  event_type: string | null;
  message: string;
  created_at: number;
}
