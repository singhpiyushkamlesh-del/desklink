/**
 * DeskLink WebSocket protocol — shared between Electron main, preload, and renderer.
 * Keep in sync with desklink-android/.../data/models/ProtocolModels.kt
 */

export const PROTOCOL_VERSION = 1;
export const DEFAULT_WS_PORT = 9847;

// ---------------------------------------------------------------------------
// Event type literals
// ---------------------------------------------------------------------------

export type EventType =
  // Pairing / Auth
  | 'pair:init'
  | 'pair:request'
  | 'pair:accepted'
  | 'auth:established'
  // Device status
  | 'device:status'
  | 'heartbeat'
  // Notifications
  | 'notification:new'
  // SMS
  | 'sms:list:request'
  | 'sms:list:response'
  | 'sms:thread:request'
  | 'sms:thread:response'
  | 'sms:send'
  | 'sms:send:ack'
  // Photos
  | 'photos:list:request'
  | 'photos:list:response'
  | 'photo:download:request'
  | 'photo:download:chunk'
  | 'photo:download:complete'
  // Clipboard
  | 'clipboard:update'
  // Errors
  | 'sync:error';

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

export interface EventEnvelope<T = unknown> {
  type: EventType;
  version: number;
  correlationId?: string;
  timestamp?: number;
  deviceId?: string;
  payload: T;
}

// ---------------------------------------------------------------------------
// Pairing QR payload (encoded in QR code, not sent as WS envelope)
// ---------------------------------------------------------------------------

export interface PairingQrPayload {
  host: string;
  port: number;
  token: string;
  version: number;
}

// ---------------------------------------------------------------------------
// Payload types
// ---------------------------------------------------------------------------

export interface PairInitPayload {
  sessionExpiresAt: number;
}

export interface PairRequestPayload {
  pairingToken: string;
  deviceName: string;
  deviceModel: string;
  androidVersion: string;
  deviceId: string;
}

export interface PairAcceptedPayload {
  sessionToken: string;
  desktopName: string;
  desktopId: string;
}

export interface AuthEstablishedPayload {
  sessionToken: string;
  deviceId: string;
}

export interface DeviceStatusPayload {
  batteryPercent: number;
  isCharging: boolean;
  deviceModel: string;
  androidVersion: string;
  connectionState: ConnectionState;
}

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'paired';

export interface HeartbeatPayload {
  sequence: number;
}

export interface NotificationNewPayload {
  id: string;
  appPackage: string;
  appName: string;
  title: string;
  body: string;
  timestamp: number;
}

export interface SmsThreadSummary {
  threadId: string;
  address: string;
  displayName?: string;
  lastMessage: string;
  lastTimestamp: number;
  unreadCount?: number;
}

export interface SmsListRequestPayload {
  limit?: number;
}

export interface SmsListResponsePayload {
  threads: SmsThreadSummary[];
}

export interface SmsThreadRequestPayload {
  threadId: string;
  limit?: number;
}

export interface SmsMessage {
  id: string;
  address: string;
  body: string;
  direction: 'inbound' | 'outbound';
  timestamp: number;
  status?: string;
}

export interface SmsThreadResponsePayload {
  threadId: string;
  messages: SmsMessage[];
}

export interface SmsSendPayload {
  address: string;
  body: string;
  clientMessageId: string;
}

export interface SmsSendAckPayload {
  clientMessageId: string;
  success: boolean;
  error?: string;
  providerMessageId?: string;
}

export interface PhotoMetadata {
  id: string;
  fileName: string;
  mimeType: string;
  createdAt: number;
  width?: number;
  height?: number;
  thumbnailBase64?: string;
}

export interface PhotosListRequestPayload {
  limit?: number;
}

export interface PhotosListResponsePayload {
  photos: PhotoMetadata[];
}

export interface PhotoDownloadRequestPayload {
  photoId: string;
}

export interface PhotoDownloadChunkPayload {
  photoId: string;
  chunkIndex: number;
  totalChunks: number;
  data: string;
}

export interface PhotoDownloadCompletePayload {
  photoId: string;
  fileName: string;
  mimeType: string;
  totalBytes: number;
}

export interface ClipboardUpdatePayload {
  text: string;
  origin: 'desktop' | 'android';
  originTimestamp: number;
}

export interface SyncErrorPayload {
  code: string;
  message: string;
  relatedType?: EventType;
}

// ---------------------------------------------------------------------------
// Payload map (for typed dispatch)
// ---------------------------------------------------------------------------

export interface EventPayloadMap {
  'pair:init': PairInitPayload;
  'pair:request': PairRequestPayload;
  'pair:accepted': PairAcceptedPayload;
  'auth:established': AuthEstablishedPayload;
  'device:status': DeviceStatusPayload;
  heartbeat: HeartbeatPayload;
  'notification:new': NotificationNewPayload;
  'sms:list:request': SmsListRequestPayload;
  'sms:list:response': SmsListResponsePayload;
  'sms:thread:request': SmsThreadRequestPayload;
  'sms:thread:response': SmsThreadResponsePayload;
  'sms:send': SmsSendPayload;
  'sms:send:ack': SmsSendAckPayload;
  'photos:list:request': PhotosListRequestPayload;
  'photos:list:response': PhotosListResponsePayload;
  'photo:download:request': PhotoDownloadRequestPayload;
  'photo:download:chunk': PhotoDownloadChunkPayload;
  'photo:download:complete': PhotoDownloadCompletePayload;
  'clipboard:update': ClipboardUpdatePayload;
  'sync:error': SyncErrorPayload;
}

export type TypedEvent<T extends EventType> = EventEnvelope<EventPayloadMap[T]>;

export function createEvent<T extends EventType>(
  type: T,
  payload: EventPayloadMap[T],
  options?: { correlationId?: string; deviceId?: string; timestamp?: number },
): TypedEvent<T> {
  return {
    type,
    version: PROTOCOL_VERSION,
    payload,
    correlationId: options?.correlationId,
    deviceId: options?.deviceId,
    timestamp: options?.timestamp ?? Date.now(),
  };
}
