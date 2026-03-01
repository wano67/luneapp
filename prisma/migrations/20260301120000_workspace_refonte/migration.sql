-- Task: add startDate
ALTER TABLE "Task" ADD COLUMN "startDate" TIMESTAMP(3);

-- BusinessDocument: add projectId
ALTER TABLE "BusinessDocument" ADD COLUMN "projectId" BIGINT;
ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "BusinessDocument_businessId_projectId_createdAt_idx"
  ON "BusinessDocument"("businessId", "projectId", "createdAt");

-- ConversationType enum
CREATE TYPE "ConversationType" AS ENUM ('PRIVATE', 'GROUP');

-- Conversation
CREATE TABLE "Conversation" (
  "id" BIGSERIAL NOT NULL,
  "businessId" BIGINT NOT NULL,
  "projectId" BIGINT,
  "type" "ConversationType" NOT NULL,
  "name" TEXT,
  "createdByUserId" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON UPDATE CASCADE;
CREATE INDEX "Conversation_businessId_projectId_idx" ON "Conversation"("businessId", "projectId");
CREATE INDEX "Conversation_projectId_idx" ON "Conversation"("projectId");

-- ConversationMember
CREATE TABLE "ConversationMember" (
  "id" BIGSERIAL NOT NULL,
  "conversationId" BIGINT NOT NULL,
  "userId" BIGINT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastReadAt" TIMESTAMP(3),
  CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ConversationMember_conversationId_userId_key"
  ON "ConversationMember"("conversationId", "userId");
CREATE INDEX "ConversationMember_userId_idx" ON "ConversationMember"("userId");

-- Message
CREATE TABLE "Message" (
  "id" BIGSERIAL NOT NULL,
  "conversationId" BIGINT NOT NULL,
  "senderUserId" BIGINT NOT NULL,
  "content" TEXT,
  "taskId" BIGINT,
  "taskGroupIds" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "editedAt" TIMESTAMP(3),
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderUserId_fkey"
  FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX "Message_senderUserId_idx" ON "Message"("senderUserId");

-- MessageAttachment
CREATE TABLE "MessageAttachment" (
  "id" BIGSERIAL NOT NULL,
  "messageId" BIGINT NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "MessageAttachment_storageKey_key" ON "MessageAttachment"("storageKey");
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");
