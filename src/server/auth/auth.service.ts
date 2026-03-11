import crypto from 'crypto';
import { type User } from '@/generated/prisma';
import { prisma } from '@/server/db/client';
import bcrypt from 'bcryptjs';
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
  REFRESH_TOKEN_EXPIRY_MS,
  signAuthToken,
} from './jwt';
import { normalizeEmail } from '@/lib/validation/email';

type RegisterInput = {
  email: string;
  password: string;
  name?: string;
};

type LoginInput = {
  email: string;
  password: string;
};

export type PublicUser = Omit<User, 'passwordHash' | 'id' | 'emailVerificationToken' | 'emailVerificationExpiry' | 'pendingInviteToken' | 'passwordResetToken' | 'passwordResetExpiry'> & { id: string };

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function registerUser(input: RegisterInput) {
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const name = input.name?.trim() || undefined;

  return prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
    },
  });
}

export async function authenticateUser(input: LoginInput) {
  const email = normalizeEmail(input.email);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.isActive) {
    return null;
  }

  const passwordIsValid = await verifyPassword(input.password, user.passwordHash);

  if (!passwordIsValid) {
    return null;
  }

  return user;
}

export async function createSessionToken(user: User) {
  return signAuthToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
  });
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    language: user.language,
    theme: user.theme,
    defaultCurrency: user.defaultCurrency,
    defaultTransactionType: user.defaultTransactionType,
    defaultBudgetPeriod: user.defaultBudgetPeriod,
    defaultSubscriptionFrequency: user.defaultSubscriptionFrequency,
    dashboardPeriodDays: user.dashboardPeriodDays,
    itemsPerPage: user.itemsPerPage,
    onboardingPersonalDone: user.onboardingPersonalDone,
    onboardingProDone: user.onboardingProDone,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// ── Refresh tokens ──────────────────────────────────────────────────────────

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('base64url');
}

/**
 * Create a new refresh token for the given user, store hash in DB, return raw token.
 */
export async function createRefreshToken(userId: bigint): Promise<string> {
  const raw = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await prisma.refreshToken.create({
    data: { tokenHash, userId, expiresAt },
  });

  return raw;
}

/**
 * Validate a raw refresh token, delete it (rotation), return the user if valid.
 * Returns null if token is invalid/expired.
 */
export async function validateAndRotateRefreshToken(
  rawToken: string,
): Promise<{ user: User; newRawToken: string } | null> {
  const tokenHash = hashToken(rawToken);

  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  // Always delete the used token (one-time use)
  if (record) {
    await prisma.refreshToken.delete({ where: { id: record.id } });
  }

  if (!record || record.expiresAt < new Date()) {
    return null;
  }

  if (!record.user.isActive) {
    return null;
  }

  // Issue a new refresh token (rotation)
  const newRawToken = await createRefreshToken(record.userId);

  return { user: record.user, newRawToken };
}

/**
 * Delete all refresh tokens for a user (logout from all devices).
 */
export async function deleteUserRefreshTokens(userId: bigint): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

/**
 * Lazy cleanup: delete expired refresh tokens (call periodically).
 */
export async function cleanupExpiredRefreshTokens(): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

export { AUTH_COOKIE_NAME, authCookieOptions, REFRESH_COOKIE_NAME, refreshCookieOptions };
