import { randomUUID } from 'crypto';
import type {
  EventEnvelope,
  EventType,
  PhotoDownloadChunkPayload,
  PhotoDownloadCompletePayload,
  PhotosListResponsePayload,
} from '../../shared/protocol';
import { createEvent } from '../../shared/protocol';
import type { SessionHandler } from '../websocket/sessionHandler';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  expectedType: EventType;
}

interface PendingDownload {
  chunks: Map<number, string>;
  totalChunks: number;
  meta: Partial<PhotoDownloadCompletePayload> | null;
  resolve: (value: DownloadResult) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface DownloadResult {
  photoId: string;
  fileName: string;
  mimeType: string;
  data: Buffer;
}

export class PhotosClient {
  private pending = new Map<string, PendingRequest>();
  private downloadPending = new Map<string, PendingDownload>();
  private sessionHandler: SessionHandler | null = null;

  attach(sessionHandler: SessionHandler) {
    this.sessionHandler = sessionHandler;
  }

  handleIncomingEnvelope(envelope: EventEnvelope): boolean {
    if (!envelope.correlationId) return false;

    if (envelope.type === 'photo:download:chunk') {
      return this.handleDownloadChunk(envelope);
    }

    if (envelope.type === 'photo:download:complete') {
      return this.handleDownloadComplete(envelope);
    }

    const pending = this.pending.get(envelope.correlationId);
    if (!pending) {
      return this.handleDownloadError(envelope);
    }

    if (envelope.type === 'sync:error') {
      const payload = envelope.payload as { message?: string };
      this.completePending(
        envelope.correlationId,
        undefined,
        new Error(payload.message ?? 'Photo request failed'),
      );
      return true;
    }

    if (envelope.type !== pending.expectedType) return false;

    this.completePending(envelope.correlationId, envelope.payload);
    return true;
  }

  async fetchPhotos(limit = 40): Promise<PhotosListResponsePayload> {
    return this.request('photos:list:request', { limit }, 'photos:list:response', 30_000);
  }

  async downloadPhoto(photoId: string): Promise<DownloadResult> {
    const correlationId = randomUUID();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.downloadPending.delete(correlationId);
        reject(new Error('Photo download timed out. Is your phone connected?'));
      }, 120_000);

      this.downloadPending.set(correlationId, {
        chunks: new Map(),
        totalChunks: 0,
        meta: null,
        resolve,
        reject,
        timeout,
      });

      const sent = this.sessionHandler?.sendToDevice(
        createEvent('photo:download:request', { photoId }, { correlationId }),
      );

      if (!sent) {
        clearTimeout(timeout);
        this.downloadPending.delete(correlationId);
        reject(new Error('Phone not connected. Open DeskLink on your Android device.'));
      }
    });
  }

  private handleDownloadChunk(envelope: EventEnvelope): boolean {
    const pending = this.downloadPending.get(envelope.correlationId!);
    if (!pending) return false;

    const payload = envelope.payload as PhotoDownloadChunkPayload;
    pending.chunks.set(payload.chunkIndex, payload.data);
    pending.totalChunks = payload.totalChunks;
    return true;
  }

  private handleDownloadComplete(envelope: EventEnvelope): boolean {
    const pending = this.downloadPending.get(envelope.correlationId!);
    if (!pending) return false;

    const payload = envelope.payload as PhotoDownloadCompletePayload;
    clearTimeout(pending.timeout);
    this.downloadPending.delete(envelope.correlationId!);

    try {
      const ordered: Buffer[] = [];
      for (let i = 0; i < pending.totalChunks; i++) {
        const chunk = pending.chunks.get(i);
        if (!chunk) throw new Error(`Missing photo chunk ${i}`);
        ordered.push(Buffer.from(chunk, 'base64'));
      }
      const data = Buffer.concat(ordered);
      pending.resolve({
        photoId: payload.photoId,
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        data,
      });
    } catch (error) {
      pending.reject(error instanceof Error ? error : new Error('Failed to assemble photo'));
    }
    return true;
  }

  private handleDownloadError(envelope: EventEnvelope): boolean {
    if (envelope.type !== 'sync:error' || !envelope.correlationId) return false;
    const download = this.downloadPending.get(envelope.correlationId);
    if (download) {
      const payload = envelope.payload as { message?: string };
      clearTimeout(download.timeout);
      this.downloadPending.delete(envelope.correlationId);
      download.reject(new Error(payload.message ?? 'Photo download failed'));
      return true;
    }
    return false;
  }

  private request<TPayload>(
    requestType: EventType,
    payload: TPayload,
    responseType: EventType,
    timeoutMs = 15_000,
  ): Promise<PhotosListResponsePayload> {
    const correlationId = randomUUID();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(correlationId);
        reject(new Error('Photo request timed out. Is your phone connected?'));
      }, timeoutMs);

      this.pending.set(correlationId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
        expectedType: responseType,
      });

      const sent = this.sessionHandler?.sendToDevice(
        createEvent(requestType, payload as never, { correlationId }),
      );

      if (!sent) {
        clearTimeout(timeout);
        this.pending.delete(correlationId);
        reject(new Error('Phone not connected. Open DeskLink on your Android device.'));
      }
    });
  }

  private completePending(correlationId: string, payload?: unknown, error?: Error) {
    const pending = this.pending.get(correlationId);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pending.delete(correlationId);

    if (error) {
      pending.reject(error);
    } else {
      pending.resolve(payload);
    }
  }
}

let photosClientInstance: PhotosClient | null = null;

export function getPhotosClient(): PhotosClient {
  if (!photosClientInstance) {
    photosClientInstance = new PhotosClient();
  }
  return photosClientInstance;
}
