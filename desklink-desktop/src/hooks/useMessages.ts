import { useCallback, useEffect, useState } from 'react';
import { fetchSmsMessages, fetchSmsThreads, sendSmsMessage } from '@/services/smsApi';
import type { SmsMessageItem, SmsThreadItem } from '@/types';
import { useAppStore } from '@/store/appStore';

export function useMessages() {
  const connectionState = useAppStore((s) => s.connectionState);
  const setMessageCount = useAppStore((s) => s.setSummaryCounts);

  const [threads, setThreads] = useState<SmsThreadItem[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SmsMessageItem[]>([]);
  const [composeText, setComposeText] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null;

  const loadThreads = useCallback(async (forceRefresh = true) => {
    setLoadingThreads(true);
    setError(null);
    try {
      const items = await fetchSmsThreads(forceRefresh);
      setThreads(items);
      setMessageCount({ messageCount: items.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load threads');
    } finally {
      setLoadingThreads(false);
    }
  }, [setMessageCount]);

  const loadMessages = useCallback(async (threadId: string, forceRefresh = true) => {
    setLoadingMessages(true);
    setError(null);
    try {
      const items = await fetchSmsMessages(threadId, forceRefresh);
      setMessages(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadThreads(true);
  }, [loadThreads, connectionState]);

  useEffect(() => {
    if (selectedThreadId) {
      loadMessages(selectedThreadId, true);
    } else {
      setMessages([]);
    }
  }, [selectedThreadId, loadMessages]);

  const sendReply = useCallback(async () => {
    if (!selectedThread || !composeText.trim() || sending) return;

    const body = composeText.trim();
    const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const optimistic: SmsMessageItem = {
      id: clientMessageId,
      threadId: selectedThread.id,
      address: selectedThread.address,
      body,
      direction: 'outbound',
      timestamp: Date.now(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, optimistic]);
    setComposeText('');
    setSending(true);
    setError(null);

    try {
      await sendSmsMessage({
        threadId: selectedThread.id,
        address: selectedThread.address,
        body,
        clientMessageId,
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === clientMessageId ? { ...m, status: 'sent' } : m)),
      );
      setThreads((prev) =>
        prev.map((t) =>
          t.id === selectedThread.id
            ? { ...t, lastMessage: body, lastTimestamp: Date.now() }
            : t,
        ),
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === clientMessageId ? { ...m, status: 'failed' } : m)),
      );
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  }, [selectedThread, composeText, sending]);

  return {
    threads,
    selectedThreadId,
    setSelectedThreadId,
    selectedThread,
    messages,
    composeText,
    setComposeText,
    loadingThreads,
    loadingMessages,
    sending,
    error,
    loadThreads,
    sendReply,
    connectionState,
  };
}
