// Persist the circuit state across hot reloads in dev.
const globalForDbCircuit = globalThis as unknown as {
  dbDownUntil?: number;
};

const DEFAULT_COOLDOWN_MS = 8_000;

export function isDbCircuitOpen(now = Date.now()): boolean {
  const until = globalForDbCircuit.dbDownUntil ?? 0;
  return until > now;
}

export function markDbDown(durationMs = DEFAULT_COOLDOWN_MS): number {
  const now = Date.now();
  const until = now + Math.max(0, durationMs);
  globalForDbCircuit.dbDownUntil = until;
  return until;
}
