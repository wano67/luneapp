"use client";

import { MessageSquarePlus, Users, Loader2 } from 'lucide-react';
import type { ConversationItem } from '@/components/pro/projects/hooks/useMessaging';

type ConversationListProps = {
  conversations: ConversationItem[];
  activeConversationId: string | null;
  loading: boolean;
  currentUserId: string;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
};

function getConversationLabel(conv: ConversationItem, currentUserId: string): string {
  if (conv.type === 'GROUP') return conv.name || 'Groupe';
  const other = conv.members.find((m) => m.userId !== currentUserId);
  if (other) {
    return other.name || other.email;
  }
  return 'Conversation';
}

function getInitials(conv: ConversationItem, currentUserId: string): string {
  if (conv.type === 'GROUP') return conv.name?.charAt(0).toUpperCase() || 'G';
  const other = conv.members.find((m) => m.userId !== currentUserId);
  if (other) {
    const label = other.name || other.email;
    const parts = label.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    return label.charAt(0).toUpperCase();
  }
  return '?';
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) {
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(d);
  }
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) {
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(d);
  }
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
}

export function ConversationList({
  conversations,
  activeConversationId,
  loading,
  currentUserId,
  onSelect,
  onNewConversation,
}: ConversationListProps) {
  return (
    <div className="flex h-full flex-col border-r border-[var(--border)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Messages</h3>
        <button
          onClick={onNewConversation}
          className="rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          title="Nouvelle conversation"
        >
          <MessageSquarePlus size={18} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-[var(--text-secondary)]" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
            Aucune conversation.<br />
            Cliquez sur + pour démarrer.
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = String(conv.id) === activeConversationId;
            const label = getConversationLabel(conv, currentUserId);
            const initials = getInitials(conv, currentUserId);

            return (
              <button
                key={String(conv.id)}
                onClick={() => onSelect(String(conv.id))}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                  isActive
                    ? 'bg-[var(--primary)]/10'
                    : 'hover:bg-[var(--surface-hover)]'
                }`}
              >
                {/* Avatar */}
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  conv.type === 'GROUP'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                }`}>
                  {conv.type === 'GROUP' ? <Users size={16} /> : initials}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                      {label}
                    </span>
                    {conv.lastMessage && (
                      <span className="ml-2 shrink-0 text-xs text-[var(--text-secondary)]">
                        {formatTime(conv.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <p className="truncate text-xs text-[var(--text-secondary)]">
                      {conv.lastMessage?.content || 'Aucun message'}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="ml-auto shrink-0 rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
