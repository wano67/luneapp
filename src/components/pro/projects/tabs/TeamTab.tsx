"use client";

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InitialsAvatar, SectionCard, SectionHeader } from '@/components/pro/projects/workspace-ui';
import { GuidedCtaCard } from '@/components/pro/shared/GuidedCtaCard';
import { ConversationList } from '@/components/pro/projects/messaging/ConversationList';
import { ChatPanel } from '@/components/pro/projects/messaging/ChatPanel';
import { NewConversationModal } from '@/components/pro/projects/messaging/NewConversationModal';
import { TaskSubmitPicker } from '@/components/pro/projects/messaging/TaskSubmitPicker';
import type { ConversationItem, MessageItem } from '@/components/pro/projects/hooks/useMessaging';
import type { TaskItem } from '@/components/pro/projects/hooks/useProjectDataLoaders';

type TeamMember = {
  membershipId: string;
  userId: string;
  email: string;
  name?: string | null;
  role: string;
};

type MemberGroup = {
  key: string;
  label: string;
  members: TeamMember[];
};

export type TeamTabProps = {
  membersByUnit: MemberGroup[];
  teamInfo: string | null;
  isAdmin: boolean;
  onOpenUnitsModal: () => void;
  businessId: string;
  // Messaging props
  currentUserId: string | null;
  conversations: ConversationItem[];
  activeConversationId: string | null;
  messages: MessageItem[];
  loadingConversations: boolean;
  loadingMessages: boolean;
  sending: boolean;
  hasMoreMessages: boolean;
  tasks: TaskItem[];
  members: TeamMember[];
  onOpenConversation: (id: string) => void;
  onSendMessage: (content: string, taskId?: string, taskGroupIds?: string[]) => void;
  onLoadOlderMessages: () => void;
  onCreateConversation: (type: 'PRIVATE' | 'GROUP', memberUserIds: string[], name?: string) => Promise<string | null>;
};

type SubTab = 'members' | 'messages';

function getConversationName(conv: ConversationItem, currentUserId: string): string {
  if (conv.type === 'GROUP') return conv.name || 'Groupe';
  const other = conv.members.find((m) => m.userId !== currentUserId);
  if (other) {
    return other.name || other.email;
  }
  return 'Conversation';
}

export function TeamTab({
  membersByUnit,
  teamInfo,
  isAdmin,
  onOpenUnitsModal,
  businessId,
  currentUserId,
  conversations,
  activeConversationId,
  messages,
  loadingConversations,
  loadingMessages,
  sending,
  hasMoreMessages,
  tasks,
  members,
  onOpenConversation,
  onSendMessage,
  onLoadOlderMessages,
  onCreateConversation,
}: TeamTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('members');
  const [showNewConv, setShowNewConv] = useState(false);
  const [showTaskPicker, setShowTaskPicker] = useState(false);

  const activeConv = conversations.find((c) => String(c.id) === activeConversationId) ?? null;
  const conversationName = activeConv && currentUserId
    ? getConversationName(activeConv, currentUserId)
    : 'Conversation';

  // Convert members for NewConversationModal
  const membersList = members.map((m) => ({
    userId: m.userId,
    name: m.name ?? null,
    email: m.email,
  }));

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-xl bg-[var(--surface-2)]/60 p-1">
        <button
          onClick={() => setSubTab('members')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            subTab === 'members'
              ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Membres
        </button>
        <button
          onClick={() => setSubTab('messages')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            subTab === 'messages'
              ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Messages
          {conversations.some((c) => c.unreadCount > 0) && (
            <span className="ml-1.5 inline-flex h-2 w-2 rounded-full bg-[var(--primary)]" />
          )}
        </button>
      </div>

      {/* Members sub-tab */}
      {subTab === 'members' && (
        <>
          <SectionCard>
            <SectionHeader
              title="Équipe"
              subtitle="Membres par pôle/secteur."
              actions={
                isAdmin ? (
                  <Button size="sm" variant="outline" onClick={onOpenUnitsModal}>
                    Gérer les pôles
                  </Button>
                ) : null
              }
            />
            {teamInfo ? <p className="mt-2 text-sm text-[var(--success)]">{teamInfo}</p> : null}
          </SectionCard>

          {membersByUnit.length ? (
            <div className="space-y-3">
              {membersByUnit.map((group) => (
                <Card
                  key={group.key}
                  className="rounded-2xl border border-[var(--border)]/70 bg-[var(--surface)]/80 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{group.label}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{group.members.length} membres</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {group.members.map((member) => (
                      <div
                        key={member.membershipId}
                        className="flex items-center gap-2 rounded-full border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs text-[var(--text-secondary)]"
                      >
                        <InitialsAvatar name={member.name} email={member.email} size={22} />
                        <span className="max-w-[160px] truncate text-[var(--text-primary)]">
                          {member.name ?? member.email}
                        </span>
                        <span className="text-[11px] text-[var(--text-secondary)]">{member.role}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <GuidedCtaCard
              title="Aucun membre disponible."
              description="Invitez un membre pour commencer."
              primary={{ label: 'Ajouter un membre', href: `/app/pro/${businessId}/settings/team` }}
            />
          )}
        </>
      )}

      {/* Messages sub-tab */}
      {subTab === 'messages' && currentUserId && (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]" style={{ height: '600px' }}>
          <div className="flex h-full">
            {/* Conversation list — 30% desktop */}
            <div className="hidden w-[280px] shrink-0 md:block">
              <ConversationList
                conversations={conversations}
                activeConversationId={activeConversationId}
                loading={loadingConversations}
                currentUserId={currentUserId}
                onSelect={onOpenConversation}
                onNewConversation={() => setShowNewConv(true)}
              />
            </div>

            {/* Mobile: show list or chat */}
            <div className="flex flex-1 flex-col md:hidden">
              {!activeConversationId ? (
                <ConversationList
                  conversations={conversations}
                  activeConversationId={activeConversationId}
                  loading={loadingConversations}
                  currentUserId={currentUserId}
                  onSelect={onOpenConversation}
                  onNewConversation={() => setShowNewConv(true)}
                />
              ) : (
                <div className="flex h-full flex-col">
                  <button
                    onClick={() => onOpenConversation('')}
                    className="border-b border-[var(--border)] px-4 py-2 text-left text-xs text-[var(--primary)]"
                  >
                    ← Retour
                  </button>
                  <div className="flex-1">
                    <ChatPanel
                      messages={messages}
                      currentUserId={currentUserId}
                      sending={sending}
                      loading={loadingMessages}
                      hasMore={hasMoreMessages}
                      conversationName={conversationName}
                      onSend={onSendMessage}
                      onLoadOlder={onLoadOlderMessages}
                      onOpenTaskPicker={() => setShowTaskPicker(true)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Desktop chat area */}
            <div className="hidden flex-1 md:block">
              {activeConversationId ? (
                <ChatPanel
                  messages={messages}
                  currentUserId={currentUserId}
                  sending={sending}
                  loading={loadingMessages}
                  hasMore={hasMoreMessages}
                  conversationName={conversationName}
                  onSend={onSendMessage}
                  onLoadOlder={onLoadOlderMessages}
                  onOpenTaskPicker={() => setShowTaskPicker(true)}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[var(--text-secondary)]">
                  Sélectionnez une conversation
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {subTab === 'messages' && !currentUserId && (
        <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
          Chargement...
        </div>
      )}

      {/* Modals */}
      <NewConversationModal
        open={showNewConv}
        members={membersList}
        currentUserId={currentUserId ?? ''}
        onClose={() => setShowNewConv(false)}
        onCreate={onCreateConversation}
      />

      <TaskSubmitPicker
        open={showTaskPicker}
        tasks={tasks}
        onClose={() => setShowTaskPicker(false)}
        onSubmit={onSendMessage}
      />
    </div>
  );
}
