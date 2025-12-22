import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export const AUTH_COOKIE_NAME = 'auth_token';

const JWT_ISSUER = 'luneapp';
const JWT_AUDIENCE = 'luneapp';
const DEFAULT_EXPIRATION = '1d';

export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24, // 1 day
};

export type AuthTokenPayload = JWTPayload & {
  sub: string;
  email: string;
  role: string;
  isActive?: boolean;
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
  expiresIn?: string;
}) {
  const { userId, email, role, isActive, expiresIn = DEFAULT_EXPIRATION } =
    params;

  return new SignJWT({ email, role, isActive })
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
