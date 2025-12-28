export function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

export function getErrorStack(err: unknown): string | undefined {
  if (err instanceof Error) return err.stack;
  return undefined;
}
