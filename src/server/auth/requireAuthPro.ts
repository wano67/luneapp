import type { NextRequest } from 'next/server';
import { requireAuthBase } from '@/server/auth/requireAuthBase';

export async function requireAuthPro(req: NextRequest): Promise<{ userId: string }> {
  try {
    const { userId } = await requireAuthBase(req);
    return { userId };
  } catch {
    throw new Error('UNAUTHORIZED');
  }
}
