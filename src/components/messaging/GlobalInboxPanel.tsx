'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, ArrowLeft, Send, Plus, Users, User, MessageSquare, FolderKanban, Hash } from 'lucide-react';
import { useGlobalMessaging } from './hooks/useGlobalMessaging';
import type { ConversationItem, MessageItem } from './hooks/useGlobalMessaging';
import { fetchJson } from '@/lib/apiClient';

type Props = {
  businessId: string;
  open: boolean;
  onClose: () => void;
};

type TeamMember = {
  userId: string;
  name: string | null;
  email: string;
  role: string;
};

type ProjectItem = {
  id: string;
  name: string;
  clientName: string | null;
};

type Tab = 'messages' | 'projets';

export default function GlobalInboxPanel({ businessId, open, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [showNewConv, setShowNewConv] = useState(false);
  const [tab, setTab] = useState<Tab>('messages');

  // Business-level conversations
  const messaging = useGlobalMessaging({
    businessId,
    enabled: open,
    onError: setError,
  });

  // Project conversations state
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [activeProject, setActiveProject] = useState<ProjectItem | null>(null);
  const [projectConversations, setProjectConversations] = useState<ConversationItem[]>([]);
  const [loadingProjectConvs, setLoadingProjectConvs] = useState(false);
  const [projectMessages, setProjectMessages] = useState<MessageItem[]>([]);
  const [loadingProjectMessages, setLoadingProjectMessages] = useState(false);
  const [sendingProject, setSendingProject] = useState(false);
  const [activeProjectConvId, setActiveProjectConvId] = useState<string | null>(null);
  const [projectHasMore, setProjectHasMore] = useState(false);
  const [projectNextCursor, setProjectNextCursor] = useState<string | null>(null);

  // Load projects when Projets tab is active
  useEffect(() => {
    if (!open || tab !== 'projets') return;
    setLoadingProjects(true);
    const ctrl = new AbortController();
    fetchJson<{ items: Array<{ id: string; name: string; clientName: string | null }> }>(
      `/api/pro/businesses/${businessId}/projects`,
      {},
      ctrl.signal
    ).then((res) => {
      if (res.ok && res.data?.items) {
        setProjects(res.data.items);
      }
    }).finally(() => setLoadingProjects(false));
    return () => ctrl.abort();
  }, [open, tab, businessId]);

  // Load conversations for selected project
  const loadProjectConversations = useCallback(async (projectId: string) => {
    setLoadingProjectConvs(true);
    try {
      const res = await fetchJson<{ items: ConversationItem[] }>(
        `/api/pro/businesses/${businessId}/projects/${projectId}/conversations`
      );
      if (res.ok && res.data?.items) {
        setProjectConversations(res.data.items);
      }
    } finally {
      setLoadingProjectConvs(false);
    }
  }, [businessId]);

  // Open a project -> load its conversations
  const openProject = useCallback((project: ProjectItem) => {
    setActiveProject(project);
    setActiveProjectConvId(null);
    setProjectMessages([]);
    loadProjectConversations(project.id);
  }, [loadProjectConversations]);

  // Load messages for a project conversation
  const loadProjectMsgs = useCallback(async (projectId: string, convId: string, cursor?: string) => {
    setLoadingProjectMessages(true);
    try {
      const qs = cursor ? `?cursor=${cursor}&limit=50` : '?limit=50';
      const res = await fetchJson<{ items: MessageItem[]; hasMore: boolean; nextCursor: string | null }>(
        `/api/pro/businesses/${businessId}/projects/${projectId}/conversations/${convId}/messages${qs}`
      );
      if (res.ok && res.data) {
        const ordered = [...res.data.items].reverse();
        if (cursor) {
          setProjectMessages((prev) => [...ordered, ...prev]);
        } else {
          setProjectMessages(ordered);
        }
        setProjectHasMore(!!res.data.hasMore);
        setProjectNextCursor(res.data.nextCursor ?? null);
      }
    } finally {
      setLoadingProjectMessages(false);
    }
  }, [businessId]);

  const openProjectConversation = useCallback((convId: string) => {
    if (!activeProject) return;
    setActiveProjectConvId(convId);
    setProjectMessages([]);
    setProjectNextCursor(null);
    setProjectHasMore(false);
    loadProjectMsgs(activeProject.id, convId);
  }, [activeProject, loadProjectMsgs]);

  const sendProjectMessage = useCallback(async (content: string) => {
    if (!activeProject || !activeProjectConvId) return;
    setSendingProject(true);
    try {
      const res = await fetchJson<{ item: MessageItem }>(
        `/api/pro/businesses/${businessId}/projects/${activeProject.id}/conversations/${activeProjectConvId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: content || null }),
        }
      );
      if (res.ok && res.data?.item) {
        setProjectMessages((prev) => [...prev, res.data!.item]);
      }
      loadProjectConversations(activeProject.id);
    } finally {
      setSendingProject(false);
    }
  }, [activeProject, activeProjectConvId, businessId, loadProjectConversations]);

  // Create a project conversation (auto GROUP with project name)
  const createProjectConversation = useCallback(async (project: ProjectItem) => {
    try {
      const res = await fetchJson<{ item: { id: string } }>(
        `/api/pro/businesses/${businessId}/projects/${project.id}/conversations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'GROUP',
            memberUserIds: [],
            name: `Discussion — ${project.name}`,
          }),
        }
      );
      if (res.ok && res.data?.item?.id) {
        await loadProjectConversations(project.id);
        openProjectConversation(String(res.data.item.id));
      }
    } catch {
      // silent
    }
  }, [businessId, loadProjectConversations, openProjectConversation]);

  const handleBack = useCallback(() => {
    if (tab === 'messages') {
      messaging.setActiveConversationId(null);
    } else {
      if (activeProjectConvId) {
        setActiveProjectConvId(null);
        setProjectMessages([]);
      } else {
        setActiveProject(null);
        setProjectConversations([]);
      }
    }
  }, [tab, messaging, activeProjectConvId]);

  const activeConv = messaging.conversations.find(
    (c) => String(c.id) === messaging.activeConversationId
  );

  // Determine if we're in a "deep" view (showing back button)
  const isDeep =
    tab === 'messages'
      ? !!messaging.activeConversationId
      : !!activeProject;

  // Header title
  const headerTitle = (() => {
    if (tab === 'messages') {
      if (messaging.activeConversationId) {
        return activeConv?.name || activeConv?.members.map((m) => m.name || m.email).slice(0, 2).join(', ') || 'Conversation';
      }
      return 'Messages';
    }
    if (activeProjectConvId) {
      const conv = projectConversations.find((c) => String(c.id) === activeProjectConvId);
      return conv?.name || 'Discussion';
    }
    if (activeProject) return activeProject.name;
    return 'Projets';
  })();

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-60 bg-black/20" onClick={onClose} />
      )}

      {/* Panel */}
      <div
        className="fixed right-0 top-0 z-70 flex h-full flex-col transition-transform duration-200"
        style={{
          width: 420,
          maxWidth: '100vw',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isDeep && (
              <button type="button" onClick={handleBack} className="shrink-0 hover:opacity-70">
                <ArrowLeft size={18} style={{ color: 'var(--text)' }} />
              </button>
            )}
            <h2 className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
              {headerTitle}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {tab === 'messages' && !messaging.activeConversationId && (
              <button
                type="button"
                onClick={() => setShowNewConv(true)}
                className="flex items-center justify-center rounded-lg hover:opacity-70"
                style={{ width: 30, height: 30, background: 'var(--shell-accent)', color: 'white' }}
              >
                <Plus size={14} />
              </button>
            )}
            {tab === 'projets' && activeProject && !activeProjectConvId && projectConversations.length === 0 && !loadingProjectConvs && (
              <button
                type="button"
                onClick={() => createProjectConversation(activeProject)}
                className="flex items-center justify-center rounded-lg hover:opacity-70"
                style={{ width: 30, height: 30, background: 'var(--shell-accent)', color: 'white' }}
              >
                <Plus size={14} />
              </button>
            )}
            <button type="button" onClick={onClose} className="hover:opacity-70">
              <X size={18} style={{ color: 'var(--text-faint)' }} />
            </button>
          </div>
        </div>

        {/* Tabs (only when not in a deep view) */}
        {!isDeep && (
          <div className="flex shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
            <TabButton active={tab === 'messages'} onClick={() => setTab('messages')} icon={<MessageSquare size={14} />} label="Messages" badge={messaging.totalUnread} />
            <TabButton active={tab === 'projets'} onClick={() => setTab('projets')} icon={<FolderKanban size={14} />} label="Projets" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-5 py-2 text-xs" style={{ color: 'var(--danger)', background: 'var(--danger-light)' }}>
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {tab === 'messages' ? (
            messaging.activeConversationId ? (
              <ChatView
                messages={messaging.messages}
                loading={messaging.loadingMessages}
                sending={messaging.sending}
                hasMore={messaging.hasMoreMessages}
                onLoadMore={messaging.loadOlderMessages}
                onSend={messaging.sendMessage}
              />
            ) : (
              <ConversationList
                conversations={messaging.conversations}
                loading={messaging.loadingConversations}
                onOpen={(id) => messaging.openConversation(String(id))}
                emptyLabel="Aucune conversation. Créez-en une pour commencer."
              />
            )
          ) : activeProjectConvId ? (
            <ChatView
              messages={projectMessages}
              loading={loadingProjectMessages}
              sending={sendingProject}
              hasMore={projectHasMore}
              onLoadMore={() => {
                if (activeProject && projectNextCursor && projectHasMore) {
                  loadProjectMsgs(activeProject.id, activeProjectConvId, projectNextCursor);
                }
              }}
              onSend={sendProjectMessage}
            />
          ) : activeProject ? (
            projectConversations.length > 0 ? (
              <ConversationList
                conversations={projectConversations}
                loading={loadingProjectConvs}
                onOpen={openProjectConversation}
                emptyLabel="Aucune discussion pour ce projet."
              />
            ) : loadingProjectConvs ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Chargement…</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8">
                <Hash size={32} style={{ color: 'var(--text-faint)' }} />
                <p className="text-sm text-center" style={{ color: 'var(--text-faint)' }}>
                  Aucune discussion pour ce projet.
                </p>
                <button
                  type="button"
                  onClick={() => createProjectConversation(activeProject)}
                  className="rounded-lg text-xs font-semibold px-4 py-2"
                  style={{ background: 'var(--shell-accent)', color: 'white' }}
                >
                  Créer une discussion
                </button>
              </div>
            )
          ) : (
            <ProjectList
              projects={projects}
              loading={loadingProjects}
              onOpen={openProject}
            />
          )}
        </div>

        {/* New conversation modal */}
        {showNewConv && (
          <NewConversationOverlay
            businessId={businessId}
            onCreate={async (type, memberIds, name) => {
              await messaging.createConversation(type, memberIds, name);
              setShowNewConv(false);
            }}
            onClose={() => setShowNewConv(false)}
          />
        )}
      </div>
    </>
  );
}

/* ═══ Tab Button ═══ */

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors"
      style={{
        color: active ? 'var(--shell-accent)' : 'var(--text-faint)',
        borderBottom: active ? '2px solid var(--shell-accent)' : '2px solid transparent',
      }}
    >
      {icon}
      {label}
      {badge && badge > 0 ? (
        <span
          className="flex items-center justify-center rounded-full text-[9px] font-bold text-white"
          style={{ width: 16, height: 16, background: 'var(--shell-accent)' }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

/* ═══ Project List ═══ */

function ProjectList({
  projects,
  loading,
  onOpen,
}: {
  projects: ProjectItem[];
  loading: boolean;
  onOpen: (project: ProjectItem) => void;
}) {
  if (loading && projects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Chargement…</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8">
        <FolderKanban size={32} style={{ color: 'var(--text-faint)' }} />
        <p className="text-sm text-center" style={{ color: 'var(--text-faint)' }}>
          Aucun projet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {projects.map((p) => (
        <button
          key={p.id}
          type="button"
          className="w-full flex items-center gap-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
          style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}
          onClick={() => onOpen(p)}
        >
          <div
            className="shrink-0 flex items-center justify-center rounded-lg"
            style={{ width: 36, height: 36, background: 'var(--shell-accent)', color: 'white' }}
          >
            <FolderKanban size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
              {p.name}
            </p>
            {p.clientName && (
              <p className="text-[11px] truncate" style={{ color: 'var(--text-faint)' }}>
                {p.clientName}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

/* ═══ Conversation List ═══ */

function ConversationList({
  conversations,
  loading,
  onOpen,
  emptyLabel,
}: {
  conversations: ConversationItem[];
  loading: boolean;
  onOpen: (id: string) => void;
  emptyLabel: string;
}) {
  if (loading && conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Chargement…</p>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8">
        <MessageSquare size={32} style={{ color: 'var(--text-faint)' }} />
        <p className="text-sm text-center" style={{ color: 'var(--text-faint)' }}>
          {emptyLabel}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conv) => {
        const lastMsg = conv.lastMessage;
        const isUnread = conv.unreadCount > 0;
        const displayName =
          conv.name ||
          conv.members
            .map((m) => m.name || m.email)
            .slice(0, 3)
            .join(', ');

        return (
          <button
            key={String(conv.id)}
            type="button"
            className="w-full flex items-start gap-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
            style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}
            onClick={() => onOpen(String(conv.id))}
          >
            <div
              className="shrink-0 flex items-center justify-center rounded-full"
              style={{
                width: 36,
                height: 36,
                background: conv.type === 'GROUP' ? 'var(--shell-accent)' : 'var(--surface-2)',
              }}
            >
              {conv.type === 'GROUP' ? (
                <Users size={16} style={{ color: 'white' }} />
              ) : (
                <User size={16} style={{ color: 'var(--text-faint)' }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p
                  className="text-sm truncate"
                  style={{ color: 'var(--text)', fontWeight: isUnread ? 600 : 400 }}
                >
                  {displayName}
                </p>
                {lastMsg && (
                  <span className="text-[10px] shrink-0" style={{ color: 'var(--text-faint)' }}>
                    {formatRelativeTime(lastMsg.createdAt)}
                  </span>
                )}
              </div>
              {lastMsg && (
                <p
                  className="text-xs truncate mt-0.5"
                  style={{ color: isUnread ? 'var(--text)' : 'var(--text-faint)' }}
                >
                  {lastMsg.content || '(pièce jointe)'}
                </p>
              )}
            </div>
            {isUnread && (
              <span
                className="shrink-0 flex items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ width: 18, height: 18, background: 'var(--shell-accent)' }}
              >
                {conv.unreadCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ═══ Chat View ═══ */

function ChatView({
  messages,
  loading,
  sending,
  hasMore,
  onLoadMore,
  onSend,
}: {
  messages: MessageItem[];
  loading: boolean;
  sending: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onSend: (content: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    onSend(trimmed);
    setDraft('');
  };

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '12px 20px' }}>
        {hasMore && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loading}
            className="w-full text-xs text-center py-2 hover:underline"
            style={{ color: 'var(--shell-accent)' }}
          >
            {loading ? 'Chargement…' : 'Charger les messages précédents'}
          </button>
        )}
        {messages.length === 0 && !loading && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-faint)' }}>
            Aucun message. Commencez la conversation !
          </p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={String(msg.id)} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 flex items-center gap-2"
        style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Écrire un message…"
          className="flex-1 rounded-lg text-sm outline-none"
          style={{
            padding: '8px 12px',
            background: 'var(--surface-2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          }}
          disabled={sending}
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="flex items-center justify-center rounded-lg disabled:opacity-40"
          style={{ width: 36, height: 36, background: 'var(--shell-accent)', color: 'white' }}
        >
          <Send size={16} />
        </button>
      </form>
    </>
  );
}

/* ═══ Message Bubble ═══ */

function MessageBubble({ message }: { message: MessageItem }) {
  return (
    <div className="mb-3">
      <div className="flex items-baseline gap-2 mb-0.5">
        <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
          {message.senderName}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
          {formatTime(message.createdAt)}
        </span>
      </div>
      {message.content && (
        <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text)', lineHeight: 1.5 }}>
          {message.content}
        </p>
      )}
      {message.attachments.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {message.attachments.map((a) => (
            <span
              key={String(a.id)}
              className="text-[10px] rounded px-1.5 py-0.5"
              style={{ background: 'var(--surface-2)', color: 'var(--text-faint)' }}
            >
              {a.filename}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ New Conversation Overlay ═══ */

function NewConversationOverlay({
  businessId,
  onCreate,
  onClose,
}: {
  businessId: string;
  onCreate: (type: 'PRIVATE' | 'GROUP', memberIds: string[], name?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchJson<{ items: Array<{ userId: string; name: string | null; email: string; role: string }> }>(
      `/api/pro/businesses/${businessId}/members`,
      {},
      ctrl.signal
    ).then((res) => {
      if (res.ok && res.data?.items) {
        setMembers(
          res.data.items.map((m) => ({
            userId: m.userId,
            name: m.name,
            email: m.email,
            role: m.role,
          }))
        );
      }
    });
    return () => ctrl.abort();
  }, [businessId]);

  const toggleMember = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleCreate = async () => {
    if (selected.size === 0) return;
    setCreating(true);
    const type = selected.size === 1 ? 'PRIVATE' : 'GROUP';
    const name = type === 'GROUP' ? (groupName.trim() || 'Groupe') : undefined;
    await onCreate(type, [...selected], name);
    setCreating(false);
  };

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col"
      style={{ background: 'var(--surface)' }}
    >
      <div
        className="flex items-center justify-between shrink-0"
        style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}
      >
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Nouvelle conversation
        </h3>
        <button type="button" onClick={onClose} className="hover:opacity-70">
          <X size={18} style={{ color: 'var(--text-faint)' }} />
        </button>
      </div>

      {selected.size > 1 && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Nom du groupe…"
            className="w-full rounded-lg text-sm outline-none"
            style={{ padding: '8px 12px', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {members.map((m) => (
          <button
            key={m.userId}
            type="button"
            className="w-full flex items-center gap-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
            style={{ padding: '10px 20px' }}
            onClick={() => toggleMember(m.userId)}
          >
            <div
              className="shrink-0 flex items-center justify-center rounded-full"
              style={{
                width: 32,
                height: 32,
                background: selected.has(m.userId) ? 'var(--shell-accent)' : 'var(--surface-2)',
                color: selected.has(m.userId) ? 'white' : 'var(--text-faint)',
              }}
            >
              <User size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate" style={{ color: 'var(--text)' }}>
                {m.name || m.email}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{m.role}</p>
            </div>
          </button>
        ))}
        {members.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-faint)' }}>
            Chargement des membres…
          </p>
        )}
      </div>

      <div className="shrink-0" style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={handleCreate}
          disabled={selected.size === 0 || creating}
          className="w-full rounded-lg text-sm font-semibold py-2.5 disabled:opacity-40 transition-opacity"
          style={{ background: 'var(--shell-accent)', color: 'white' }}
        >
          {creating ? 'Création…' : `Créer (${selected.size} membre${selected.size > 1 ? 's' : ''})`}
        </button>
      </div>
    </div>
  );
}

/* ═══ Helpers ═══ */

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'maintenant';
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}j`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
