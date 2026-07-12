import type { SmsMessageItem, SmsThreadItem } from '@/types';

export async function fetchSmsThreads(forceRefresh = false): Promise<SmsThreadItem[]> {
  if (!window.desklink?.getSmsThreads) return [];
  return window.desklink.getSmsThreads(forceRefresh);
}

export async function fetchSmsMessages(
  threadId: string,
  forceRefresh = false,
): Promise<SmsMessageItem[]> {
  if (!window.desklink?.getSmsMessages) return [];
  return window.desklink.getSmsMessages(threadId, forceRefresh);
}

export async function sendSmsMessage(payload: {
  threadId: string;
  address: string;
  body: string;
  clientMessageId: string;
}) {
  if (!window.desklink?.sendSms) {
    throw new Error('DeskLink API not available');
  }
  return window.desklink.sendSms(payload);
}
