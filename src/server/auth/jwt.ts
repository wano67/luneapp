import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export const AUTH_COOKIE_NAME = 'auth_token';
export const REFRESH_COOKIE_NAME = 'refresh_token';

const JWT_ISSUER = 'luneapp';
const JWT_AUDIENCE = 'luneapp';
const DEFAULT_EXPIRATION = '15m';

export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 15 * 60, // 15 minutes
};

export const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth/refresh',
  maxAge: 7 * 24 * 60 * 60, // 7 days
};

export const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export type AuthTokenPayload = JWTPayload & {
  sub: string;
  email: string;
  role: string;
  isActive?: boolean;
  emailVerified?: boolean;
};

function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error('AUTH_SECRET is not set');
  }

  return new TextEncoder().encode(secret);
}

export async function signAuthToken(params: {
  userId: bigint;
  email: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  expiresIn?: string;
}) {
  const { userId, email, role, isActive, emailVerified, expiresIn = DEFAULT_EXPIRATION } =
    params;

  return new SignJWT({ email, role, isActive, emailVerified })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId.toString())
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(expiresIn)
    .sign(getAuthSecret());
}

export async function verifyAuthToken(token: string) {
  return jwtVerify<AuthTokenPayload>(token, getAuthSecret(), {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}
