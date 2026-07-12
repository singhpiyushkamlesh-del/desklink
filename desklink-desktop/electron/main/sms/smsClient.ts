import { randomUUID } from 'crypto';
import type {
  EventEnvelope,
  EventType,
  SmsListResponsePayload,
  SmsSendAckPayload,
  SmsThreadResponsePayload,
} from '../../shared/protocol';
import { createEvent } from '../../shared/protocol';
import type { SessionHandler } from '../websocket/sessionHandler';

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  expectedType: EventType;
}

export class SmsClient {
  private pending = new Map<string, PendingRequest<unknown>>();
  private sessionHandler: SessionHandler | null = null;

  attach(sessionHandler: SessionHandler) {
    this.sessionHandler = sessionHandler;
  }

  handleIncomingEnvelope(envelope: EventEnvelope): boolean {
    if (!envelope.correlationId) return false;

    const pending = this.pending.get(envelope.correlationId);
    if (!pending) return false;

    if (envelope.type === 'sync:error') {
      const payload = envelope.payload as { message?: string };
      this.completePending(
        envelope.correlationId,
        undefined,
        new Error(payload.message ?? 'SMS request failed'),
      );
      return true;
    }

    if (envelope.type !== pending.expectedType) return false;

    this.completePending(envelope.correlationId, envelope.payload);
    return true;
  }

  async fetchThreads(limit = 50): Promise<SmsListResponsePayload> {
    return this.request('sms:list:request', { limit }, 'sms:list:response');
  }

  async fetchThreadMessages(threadId: string, limit = 100): Promise<SmsThreadResponsePayload> {
    return this.request('sms:thread:request', { threadId, limit }, 'sms:thread:response');
  }

  async sendMessage(address: string, body: string, clientMessageId: string): Promise<SmsSendAckPayload> {
    return this.request(
      'sms:send',
      { address, body, clientMessageId },
      'sms:send:ack',
      30_000,
    );
  }

  private request<TPayload, TResponse extends EventType>(
    requestType: EventType,
    payload: TPayload,
    responseType: TResponse,
    timeoutMs = 15_000,
  ): Promise<ExtractResponse<TResponse>> {
    const correlationId = randomUUID();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(correlationId);
        reject(new Error('SMS request timed out. Is your phone connected?'));
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

type ExtractResponse<T extends EventType> = T extends 'sms:list:response'
  ? SmsListResponsePayload
  : T extends 'sms:thread:response'
    ? SmsThreadResponsePayload
    : T extends 'sms:send:ack'
      ? SmsSendAckPayload
      : never;

let smsClientInstance: SmsClient | null = null;

export function getSmsClient(): SmsClient {
  if (!smsClientInstance) {
    smsClientInstance = new SmsClient();
  }
  return smsClientInstance;
}
