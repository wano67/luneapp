"use client";

import { useRef, useEffect, useState, type FormEvent } from 'react';
import { Send, Loader2, ArrowUp, ListTodo } from 'lucide-react';
import type { MessageItem } from '@/components/pro/projects/hooks/useMessaging';

type ChatPanelProps = {
  messages: MessageItem[];
  currentUserId: string;
  sending: boolean;
  loading: boolean;
  hasMore: boolean;
  conversationName: string;
  onSend: (content: string, taskId?: string, taskGroupIds?: string[]) => void;
  onLoadOlder: () => void;
  onOpenTaskPicker?: () => void;
};

function formatMessageTime(dateStr: string): string {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function formatMessageDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: diffDays > 365 ? 'numeric' : undefined,
  }).format(d);
}

function shouldShowDateSeparator(messages: MessageItem[], index: number): boolean {
  if (index === 0) return true;
  const curr = new Date(messages[index].createdAt).toDateString();
  const prev = new Date(messages[index - 1].createdAt).toDateString();
  return curr !== prev;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  return name.charAt(0).toUpperCase();
}

export function ChatPanel({
  messages,
  currentUserId,
  sending,
  loading,
  hasMore,
  conversationName,
  onSend,
  onLoadOlder,
  onOpenTaskPicker,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(messages.length);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  // Scroll to bottom on first load
  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-[var(--border)] px-4 py-3">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">{conversationName}</h4>
      </div>

      {/* Messages area */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-3">
        {/* Load more button */}
        {hasMore && (
          <button
            onClick={onLoadOlder}
            disabled={loading}
            className="mx-auto mb-3 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={14} />}
            Messages précédents
          </button>
        )}

        {messages.length === 0 && !loading && (
          <div className="py-12 text-center text-sm text-[var(--text-secondary)]">
            Aucun message. Envoyez le premier !
          </div>
        )}

        {messages.map((msg, idx) => {
          const isOwn = String(msg.senderUserId) === currentUserId;
          const showDate = shouldShowDateSeparator(messages, idx);
          const initials = getInitials(msg.senderName);

          return (
            <div key={String(msg.id)}>
              {showDate && (
                <div className="my-3 flex items-center gap-3">
                  <div className="flex-1 border-t border-[var(--border)]" />
                  <span className="text-xs text-[var(--text-secondary)]">
                    {formatMessageDate(msg.createdAt)}
                  </span>
                  <div className="flex-1 border-t border-[var(--border)]" />
                </div>
              )}
              <div className={`mb-2 flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                {/* Avatar (only for others) */}
                {!isOwn && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] text-xs font-semibold text-[var(--text-secondary)]">
                    {initials}
                  </div>
                )}

                <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
                  {/* Sender name (only for others) */}
                  {!isOwn && (
                    <p className="mb-0.5 text-xs font-medium text-[var(--text-secondary)]">
                      {msg.senderName}
                    </p>
                  )}

                  {/* Content bubble */}
                  {msg.content && (
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm ${
                        isOwn
                          ? 'bg-[var(--primary)] text-white'
                          : 'bg-[var(--surface-hover)] text-[var(--text-primary)]'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                  )}

                  {/* Task reference */}
                  {(msg.taskId || msg.taskGroupIds.length > 0) && (
                    <div className="mt-1 flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                      <ListTodo size={12} />
                      {msg.taskId && <span>Tâche soumise</span>}
                      {msg.taskGroupIds.length > 0 && (
                        <span>{msg.taskGroupIds.length} tâche{msg.taskGroupIds.length > 1 ? 's' : ''} soumise{msg.taskGroupIds.length > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  )}

                  {/* Attachments */}
                  {msg.attachments.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {msg.attachments.map((att) => (
                        <div
                          key={String(att.id)}
                          className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
                        >
                          <span className="truncate text-[var(--text-primary)]">{att.filename}</span>
                          <span className="shrink-0 text-[var(--text-secondary)]">
                            {(att.sizeBytes / 1024).toFixed(0)} Ko
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Time */}
                  <p className={`mt-0.5 text-[10px] text-[var(--text-secondary)] ${isOwn ? 'text-right' : ''}`}>
                    {formatMessageTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="border-t border-[var(--border)] p-3">
        <div className="flex items-end gap-2">
          {onOpenTaskPicker && (
            <button
              type="button"
              onClick={onOpenTaskPicker}
              className="shrink-0 rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              title="Soumettre une tâche"
            >
              <ListTodo size={18} />
            </button>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrire un message..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="shrink-0 rounded-xl bg-[var(--primary)] p-2 text-white transition-opacity disabled:opacity-40"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </form>
    </div>
  );
}
