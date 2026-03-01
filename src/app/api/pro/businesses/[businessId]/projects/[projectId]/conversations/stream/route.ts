import { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthBase } from '@/server/auth/requireAuthBase';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { deepSerialize } from '@/server/http/json';

const POLL_INTERVAL_MS = 3000;
const PING_INTERVAL_MS = 15000;

// GET /api/pro/businesses/:businessId/projects/:projectId/conversations/stream
// SSE stream for real-time messages
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string; projectId: string }> }
) {
  const { businessId: businessIdStr, projectId: projectIdStr } = await params;

  // Auth
  let userId: bigint;
  try {
    const auth = await requireAuthBase(req);
    userId = BigInt(auth.userId);
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }

  const businessId = BigInt(businessIdStr);
  const projectId = BigInt(projectIdStr);

  // Business role check
  const membership = await requireBusinessRole(businessId, userId, 'VIEWER');
  if (!membership) {
    return new Response('Forbidden', { status: 403 });
  }

  // Get user's conversation IDs in this project
  const myConversations = await prisma.conversationMember.findMany({
    where: {
      userId,
      conversation: { businessId, projectId },
    },
    select: { conversationId: true },
  });
  const conversationIds = myConversations.map((c) => c.conversationId);

  if (conversationIds.length === 0) {
    // No conversations — still open SSE but only ping
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const ping = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': ping\n\n'));
          } catch {
            clearInterval(ping);
          }
        }, PING_INTERVAL_MS);

        req.signal.addEventListener('abort', () => {
          clearInterval(ping);
          try { controller.close(); } catch { /* already closed */ }
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store',
        Connection: 'keep-alive',
      },
    });
  }

  let lastCheckedAt = new Date();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      function send(event: string, data: unknown) {
        if (closed) return;
        try {
          const serialized = JSON.stringify(deepSerialize(data));
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${serialized}\n\n`));
        } catch {
          // controller closed
        }
      }

      async function poll() {
        if (closed) return;
        try {
          const newMessages = await prisma.message.findMany({
            where: {
              conversationId: { in: conversationIds },
              createdAt: { gt: lastCheckedAt },
            },
            orderBy: { createdAt: 'asc' },
            include: {
              sender: { select: { id: true, name: true, email: true } },
              attachments: true,
            },
          });

          if (newMessages.length > 0) {
            lastCheckedAt = newMessages[newMessages.length - 1].createdAt;
            for (const msg of newMessages) {
              send('message', {
                id: msg.id,
                conversationId: msg.conversationId,
                senderUserId: msg.senderUserId,
                senderName: msg.sender.name || msg.sender.email,
                content: msg.content,
                taskId: msg.taskId,
                taskGroupIds: msg.taskGroupIds ? msg.taskGroupIds.split(',') : [],
                createdAt: msg.createdAt,
                attachments: msg.attachments.map((a) => ({
                  id: a.id,
                  filename: a.filename,
                  mimeType: a.mimeType,
                  sizeBytes: a.sizeBytes,
                })),
              });
            }
          }
        } catch (err) {
          console.error('[SSE poll]', err);
        }
      }

      // Initial connection event
      send('connected', { conversationIds });

      const pollTimer = setInterval(poll, POLL_INTERVAL_MS);
      const pingTimer = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          // closed
        }
      }, PING_INTERVAL_MS);

      req.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(pollTimer);
        clearInterval(pingTimer);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      Connection: 'keep-alive',
    },
  });
}
