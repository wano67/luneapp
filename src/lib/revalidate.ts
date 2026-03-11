/**
 * Lightweight event-based revalidation system.
 *
 * After a mutation, call `revalidate('pro:tasks')` to notify all mounted
 * components that subscribe to that scope via `useRevalidation`.
 *
 * Scopes are coarse-grained by entity domain so a single event refreshes
 * every surface that displays that data (dashboard KPIs, lists, detail pages…).
 */

import { useEffect, useRef, useState } from 'react';

// ─── Scopes ─────────────────────────────────────────────────────────────────

export type RevalidationScope =
  // Pro
  | 'pro:tasks'
  | 'pro:projects'
  | 'pro:billing'
  | 'pro:finances'
  | 'pro:clients'
  | 'pro:stock'
  | 'pro:services'
  | 'pro:team'
  | 'pro:calendar'
  // Personal
  | 'personal:wallet'   // transactions + accounts + budgets + subscriptions
  | 'personal:savings'
  | 'personal:calendar';

// ─── Emit ───────────────────────────────────────────────────────────────────

const PREFIX = 'lune:rv:';

/** Emit revalidation events for the given scopes. Call after a successful mutation. */
export function revalidate(...scopes: RevalidationScope[]) {
  if (typeof window === 'undefined') return;
  for (const scope of scopes) {
    window.dispatchEvent(new Event(PREFIX + scope));
  }
}

// ─── Subscribe (hook) ───────────────────────────────────────────────────────

/**
 * Calls `handler` whenever one of the listed scopes is revalidated.
 *
 * The handler reference is kept in a ref so callers don't need to memoize it.
 */
export function useRevalidation(scopes: RevalidationScope[], handler: () => void) {
  const handlerRef = useRef(handler);
  useEffect(() => { handlerRef.current = handler; });

  const scopeKey = scopes.join(',');

  useEffect(() => {
    if (typeof window === 'undefined' || !scopeKey) return;
    const listener = () => handlerRef.current();
    const list = scopeKey.split(',');
    for (const s of list) window.addEventListener(PREFIX + s, listener);
    return () => { for (const s of list) window.removeEventListener(PREFIX + s, listener); };
  }, [scopeKey]);
}

/**
 * Returns a numeric key that increments every time one of the listed scopes
 * is revalidated.  Drop this into a useEffect dependency array so the effect
 * re-runs (with a fresh AbortController) on external changes.
 *
 * ```ts
 * const rv = useRevalidationKey(['pro:tasks']);
 * useEffect(() => { const c = new AbortController(); load(c.signal); return () => c.abort(); }, [businessId, rv]);
 * ```
 */
export function useRevalidationKey(scopes: RevalidationScope[]): number {
  const [key, setKey] = useState(0);
  useRevalidation(scopes, () => setKey(k => k + 1));
  return key;
}
