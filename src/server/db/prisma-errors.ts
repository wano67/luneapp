import { Prisma } from '@/generated/prisma';

const TRANSIENT_ERROR_CODES = new Set(['P1017', 'P1001', 'P1002']);
const CONNECTION_CLOSED_MESSAGE = 'Server has closed the connection';

export function isTransientDbError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return TRANSIENT_ERROR_CODES.has(error.code);
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Error) {
    return error.message.includes(CONNECTION_CLOSED_MESSAGE);
  }

  return false;
}
