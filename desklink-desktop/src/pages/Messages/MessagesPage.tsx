import { PageHeader, EmptyState } from '@/components/PageLayout';
import { useMessages } from '@/hooks/useMessages';
import { useAppStore } from '@/store/appStore';

function formatTime(timestamp: number | null): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString();
}

function statusLabel(status: string | null): string | null {
  if (!status || status === 'delivered' || status === 'sent') return null;
  if (status === 'sending') return 'Sending…';
  if (status === 'failed') return 'Failed';
  return status;
}

export function MessagesPage() {
  const activeDevice = useAppStore((s) => s.activeDevice);
  const {
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
  } = useMessages();

  if (!activeDevice) {
    return (
      <div>
        <PageHeader title="Messages" description="View SMS threads and send replies from your PC." />
        <EmptyState
          title="No paired device"
          description="Pair your Android phone first to sync SMS messages."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Messages"
        description={
          connectionState === 'connected'
            ? 'SMS synced from your phone. Replies are sent via your Android device.'
            : 'Connect your phone to load and send SMS messages.'
        }
        actions={
          <button
            type="button"
            onClick={() => loadThreads(true)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <aside className="flex w-80 shrink-0 flex-col border-r border-gray-200">
          <div className="border-b border-gray-200 px-4 py-3">
            <p className="text-sm font-medium text-gray-700">Threads</p>
            {loadingThreads && <p className="text-xs text-gray-400">Loading…</p>}
          </div>
          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 && !loadingThreads ? (
              <div className="p-4">
                <EmptyState
                  title="No SMS threads"
                  description="Tap Refresh to load threads from your phone. Ensure SMS sync is enabled and permissions are granted."
                />
              </div>
            ) : (
              <ul>
                {threads.map((thread) => (
                  <li key={thread.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedThreadId(thread.id)}
                      className={`w-full border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                        selectedThreadId === thread.id ? 'bg-desklink-accent/10' : ''
                      }`}
                    >
                      <p className="font-medium text-gray-900">
                        {thread.displayName ?? thread.address}
                      </p>
                      <p className="mt-1 truncate text-sm text-gray-600">
                        {thread.lastMessage ?? 'No messages'}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {formatTime(thread.lastTimestamp)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          {!selectedThread ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <p className="text-sm text-gray-400">Select a thread to view messages</p>
            </div>
          ) : (
            <>
              <div className="border-b border-gray-200 px-5 py-3">
                <p className="font-medium text-gray-900">
                  {selectedThread.displayName ?? selectedThread.address}
                </p>
                <p className="text-xs text-gray-500">{selectedThread.address}</p>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {loadingMessages && messages.length === 0 ? (
                  <p className="text-sm text-gray-500">Loading messages…</p>
                ) : (
                  messages.map((msg) => {
                    const isOutbound = msg.direction === 'outbound';
                    const status = statusLabel(msg.status);
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                            isOutbound
                              ? 'bg-desklink-accent text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <p>{msg.body}</p>
                          <div
                            className={`mt-1 flex items-center gap-2 text-xs ${
                              isOutbound ? 'text-blue-100' : 'text-gray-500'
                            }`}
                          >
                            <span>{formatTime(msg.timestamp)}</span>
                            {status && <span>{status}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-gray-200 p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={composeText}
                    onChange={(e) => setComposeText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                    placeholder="Type a reply…"
                    disabled={sending || connectionState !== 'connected'}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-desklink-accent focus:outline-none focus:ring-1 focus:ring-desklink-accent disabled:bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={sendReply}
                    disabled={sending || !composeText.trim() || connectionState !== 'connected'}
                    className="rounded-lg bg-desklink-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
                {connectionState !== 'connected' && (
                  <p className="mt-2 text-xs text-gray-500">
                    Phone must be connected to send SMS from desktop.
                  </p>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
