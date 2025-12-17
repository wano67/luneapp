// src/server/auth/requireAuth.ts
import type { NextRequest } from 'next/server';
import { requireAuthBase, type RequireAuthResult } from '@/server/auth/requireAuthBase';

export async function requireAuthAsync(req: NextRequest): Promise<RequireAuthResult> {
  return requireAuthBase(req);
}
