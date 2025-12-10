import { type User } from '@/generated/prisma/client';
import { prisma } from '@/server/db/client';
import bcrypt from 'bcryptjs';
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  signAuthToken,
} from './jwt';

type RegisterInput = {
  email: string;
  password: string;
  name?: string;
};

type LoginInput = {
  email: string;
  password: string;
};

export type PublicUser = Omit<User, 'passwordHash' | 'id'> & { id: string };

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

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
  });
}

export function toPublicUser(user: User): PublicUser {
  const { passwordHash, id, ...rest } = user;

  return {
    ...rest,
    id: id.toString(),
  };
}

export { AUTH_COOKIE_NAME, authCookieOptions };
