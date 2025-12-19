type ApiErrorShape = { error: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

export function isApiErrorShape(value: unknown): value is ApiErrorShape {
  return isRecord(value) && typeof value.error === 'string';
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  return 'Une erreur est survenue';
}

export async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export function getRequestIdFromResponse(res: Response): string | null {
  return res.headers.get('x-request-id')?.trim() || null;
}

export type FetchJsonResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  requestId: string | null;
  error?: string;
};

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  signal?: AbortSignal
): Promise<FetchJsonResult<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      credentials: init.credentials ?? 'include',
      signal: signal ?? init.signal,
    });

    const requestId = getRequestIdFromResponse(res);
    const data = await safeJson(res);

    if (res.ok) {
      return {
        ok: true,
        status: res.status,
        data: (data as T) ?? null,
        requestId,
      };
    }

    if (res.status === 401 && typeof window !== 'undefined') {
      const from = window.location.pathname + window.location.search;
      window.location.href = `/login?from=${encodeURIComponent(from)}`;
      return { ok: false, status: res.status, data: null, requestId, error: 'Unauthorized' };
    }

    if (res.status === 403) {
      return {
        ok: false,
        status: res.status,
        data: (data as T) ?? null,
        requestId,
        error: isApiErrorShape(data) ? data.error : 'Action réservée aux admins/owners.',
      };
    }

    return {
      ok: false,
      status: res.status,
      data: (data as T) ?? null,
      requestId,
      error: isApiErrorShape(data) ? data.error : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      requestId: null,
      error: getErrorMessage(error),
    };
  }
}
