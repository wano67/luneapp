"use client";

import { useRef, useEffect, useState, type FormEvent } from 'react';
import { Send, Loader2, ArrowUp, ListTodo, Paperclip, X, Download, MessageCircle, ArrowLeft } from 'lucide-react';
import type { MessageItem } from '@/components/pro/projects/hooks/useMessaging';

type ChatPanelProps = {
  messages: MessageItem[];
  currentUserId: string;
  sending: boolean;
  loading: boolean;
  hasMore: boolean;
  conversationName: string;
  businessId: string;
  onSend: (content: string, taskId?: string, taskGroupIds?: string[], files?: File[]) => void;
  onLoadOlder: () => void;
  onOpenTaskPicker?: () => void;
  // Thread support
  threadParentId?: string | null;
  threadReplies?: MessageItem[];
  loadingThread?: boolean;
  onOpenThread?: (parentMessageId: string) => void;
  onCloseThread?: () => void;
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function ChatPanel({
  messages,
  currentUserId,
  sending,
  loading,
  hasMore,
  conversationName,
  businessId,
  onSend,
  onLoadOlder,
  onOpenTaskPicker,
  threadParentId,
  threadReplies,
  loadingThread,
  onOpenThread,
  onCloseThread,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const isInThread = Boolean(threadParentId);
  const displayMessages = isInThread ? (threadReplies ?? []) : messages;
  const parentMessage = isInThread
    ? messages.find((m) => String(m.id) === threadParentId)
    : null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && pendingFiles.length === 0) || sending) return;
    // Type-safe cast: onSend accepts optional 5th param for parentMessageId
    const sendFn = onSend as (content: string, taskId?: string, taskGroupIds?: string[], files?: File[], parentMessageId?: string) => void;
    sendFn(trimmed, undefined, undefined, pendingFiles.length > 0 ? pendingFiles : undefined, threadParentId ?? undefined);
    setInput('');
    setPendingFiles([]);
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
        {isInThread ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCloseThread}
              className="rounded-lg p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">Thread</h4>
              {parentMessage ? (
                <p className="max-w-[200px] truncate text-xs text-[var(--text-secondary)]">
                  {parentMessage.senderName} : {parentMessage.content || 'Message'}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">{conversationName}</h4>
        )}
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

        {/* Thread parent message preview */}
        {isInThread && parentMessage ? (
          <div className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2">
            <p className="text-xs font-medium text-[var(--text-secondary)]">{parentMessage.senderName}</p>
            <p className="mt-0.5 text-sm text-[var(--text-primary)]">{parentMessage.content}</p>
            <p className="mt-1 text-[10px] text-[var(--text-secondary)]">{formatMessageTime(parentMessage.createdAt)}</p>
          </div>
        ) : null}

        {loadingThread ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-[var(--text-secondary)]" />
          </div>
        ) : null}

        {displayMessages.length === 0 && !loading && !loadingThread && (
          <div className="py-12 text-center text-sm text-[var(--text-secondary)]">
            {isInThread ? 'Aucune réponse. Répondez dans le thread !' : 'Aucun message. Envoyez le premier !'}
          </div>
        )}

        {displayMessages.map((msg, idx) => {
          const isOwn = String(msg.senderUserId) === currentUserId;
          const showDate = shouldShowDateSeparator(displayMessages, idx);
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
                        <a
                          key={String(att.id)}
                          href={`/api/pro/businesses/${businessId}/attachments/${att.id}/download`}
                          download={att.filename}
                          className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs transition-colors hover:bg-[var(--surface-hover)]"
                        >
                          <Download size={12} className="shrink-0 text-[var(--text-secondary)]" />
                          <span className="truncate text-[var(--text-primary)]">{att.filename}</span>
                          <span className="shrink-0 text-[var(--text-secondary)]">
                            {(att.sizeBytes / 1024).toFixed(0)} Ko
                          </span>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Time + thread reply button */}
                  <div className={`mt-0.5 flex items-center gap-2 ${isOwn ? 'justify-end' : ''}`}>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      {formatMessageTime(msg.createdAt)}
                    </p>
                    {!isInThread && onOpenThread ? (
                      <button
                        type="button"
                        onClick={() => onOpenThread(String(msg.id))}
                        className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--accent)]"
                      >
                        <MessageCircle size={10} />
                        {msg.replyCount > 0 ? (
                          <span className="font-medium text-[var(--accent)]">
                            {msg.replyCount} réponse{msg.replyCount > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span>Répondre</span>
                        )}
                      </button>
                    ) : null}
                  </div>
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
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (files) {
                setPendingFiles((prev) => [...prev, ...Array.from(files)]);
              }
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
            title="Joindre un fichier"
          >
            <Paperclip size={18} />
          </button>
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
            disabled={(!input.trim() && pendingFiles.length === 0) || sending}
            className="shrink-0 rounded-xl bg-[var(--primary)] p-2 text-white transition-opacity disabled:opacity-40"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>

        {/* Pending files preview strip */}
        {pendingFiles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {pendingFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-2 py-1 text-xs"
              >
                <Paperclip size={12} className="shrink-0 text-[var(--text-secondary)]" />
                <span className="max-w-[140px] truncate text-[var(--text-primary)]">{file.name}</span>
                <span className="shrink-0 text-[var(--text-secondary)]">{formatFileSize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                  className="shrink-0 rounded p-0.5 text-[var(--text-secondary)] transition-colors hover:text-[var(--danger)]"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}
