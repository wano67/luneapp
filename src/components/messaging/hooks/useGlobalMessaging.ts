import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';

// Re-export shared types from project-level hook
export type { ConversationMember, ConversationItem, MessageItem } from '@/components/pro/projects/hooks/useMessaging';
import type { ConversationItem, MessageItem } from '@/components/pro/projects/hooks/useMessaging';

interface UseGlobalMessagingParams {
  businessId: string;
  enabled: boolean;
  onError: (msg: string | null) => void;
}

export function useGlobalMessaging({ businessId, enabled, onError }: UseGlobalMessagingParams) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const basePath = `/api/pro/businesses/${businessId}/conversations`;

  const totalUnread = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  // ------- Load conversations -------
  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const res = await fetchJson<{ items: ConversationItem[] }>(basePath);
      if (res.ok && res.data?.items) {
        setConversations(res.data.items);
      }
    } catch (err) {
      onError(getErrorMessage(err));
    } finally {
      setLoadingConversations(false);
    }
  }, [basePath, onError]);

  // ------- Load messages for a conversation -------
  const loadMessages = useCallback(
    async (conversationId: string, cursor?: string) => {
      setLoadingMessages(true);
      try {
        const qs = cursor ? `?cursor=${cursor}&limit=50` : '?limit=50';
        const res = await fetchJson<{ items: MessageItem[]; hasMore: boolean; nextCursor: string | null }>(
          `${basePath}/${conversationId}/messages${qs}`
        );
        if (res.ok && res.data) {
          const ordered = [...res.data.items].reverse();
          if (cursor) {
            setMessages((prev) => [...ordered, ...prev]);
          } else {
            setMessages(ordered);
          }
          setHasMoreMessages(!!res.data.hasMore);
          setNextCursor(res.data.nextCursor ?? null);
        }
      } catch (err) {
        onError(getErrorMessage(err));
      } finally {
        setLoadingMessages(false);
      }
    },
    [basePath, onError]
  );

  // ------- Open a conversation -------
  const openConversation = useCallback(
    (conversationId: string) => {
      setActiveConversationId(conversationId);
      setMessages([]);
      setNextCursor(null);
      setHasMoreMessages(false);
      loadMessages(conversationId);
    },
    [loadMessages]
  );

  // ------- Load older messages -------
  const loadOlderMessages = useCallback(() => {
    if (activeConversationId && nextCursor && hasMoreMessages) {
      loadMessages(activeConversationId, nextCursor);
    }
  }, [activeConversationId, nextCursor, hasMoreMessages, loadMessages]);

  // ------- Send message -------
  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeConversationId) return;
      setSending(true);
      onError(null);
      try {
        const res = await fetchJson<{ item: MessageItem }>(`${basePath}/${activeConversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: content || null }),
        });
        if (!res.ok) {
          onError(res.error ?? 'Impossible d\'envoyer le message.');
          return;
        }
        if (res.data?.item) {
          setMessages((prev) => [...prev, res.data!.item]);
        }
        loadConversations();
      } catch (err) {
        onError(getErrorMessage(err));
      } finally {
        setSending(false);
      }
    },
    [activeConversationId, basePath, onError, loadConversations]
  );

  // ------- Create conversation -------
  const createConversation = useCallback(
    async (type: 'PRIVATE' | 'GROUP', memberUserIds: string[], name?: string) => {
      onError(null);
      try {
        const res = await fetchJson<{ item: { id: string; alreadyExists?: boolean } }>(basePath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, memberUserIds, name: name || undefined }),
        });
        if (!res.ok) {
          onError(res.error ?? 'Impossible de créer la conversation.');
          return null;
        }
        await loadConversations();
        const id = res.data?.item?.id;
        if (id) openConversation(String(id));
        return id ? String(id) : null;
      } catch (err) {
        onError(getErrorMessage(err));
        return null;
      }
    },
    [basePath, onError, loadConversations, openConversation]
  );

  // ------- SSE connection -------
  useEffect(() => {
    if (!enabled) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    const es = new EventSource(`${basePath}/stream`);
    eventSourceRef.current = es;

    es.addEventListener('message', (e) => {
      try {
        const msg: MessageItem = JSON.parse(e.data);
        setActiveConversationId((currentId) => {
          if (currentId && String(msg.conversationId) === currentId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
          return currentId;
        });
        setConversations((prev) =>
          prev.map((c) =>
            String(c.id) === String(msg.conversationId)
              ? {
                  ...c,
                  lastMessage: {
                    id: msg.id,
                    content: msg.content,
                    createdAt: msg.createdAt,
                    senderUserId: msg.senderUserId,
                  },
                  totalMessages: c.totalMessages + 1,
                }
              : c
          )
        );
      } catch {
        // ignore parse errors
      }
    });

    es.onerror = () => {
      // EventSource will auto-reconnect
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [enabled, basePath]);

  // ------- Load conversations on mount when enabled -------
  useEffect(() => {
    if (enabled) {
      loadConversations();
    }
  }, [enabled, loadConversations]);

  return {
    conversations,
    activeConversationId,
    messages,
    loadingConversations,
    loadingMessages,
    sending,
    hasMoreMessages,
    totalUnread,
    loadConversations,
    openConversation,
    loadOlderMessages,
    sendMessage,
    createConversation,
    setActiveConversationId,
  };
}
