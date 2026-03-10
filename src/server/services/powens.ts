import { PersonalAccountType } from '@/generated/prisma';

// ─── Config ─────────────────────────────────────────────────

function getConfig() {
  const apiUrl = process.env.POWENS_API_URL;
  const clientId = process.env.POWENS_CLIENT_ID;
  const clientSecret = process.env.POWENS_CLIENT_SECRET;
  if (!apiUrl || !clientId || !clientSecret) {
    throw new Error('Missing POWENS_API_URL, POWENS_CLIENT_ID or POWENS_CLIENT_SECRET');
  }
  return { apiUrl: apiUrl.replace(/\/$/, ''), clientId, clientSecret };
}

// ─── Types ──────────────────────────────────────────────────

export interface PowensUser {
  id: number;
  auth_token: string;
}

export interface PowensAccount {
  id: number;
  id_connection: number;
  name: string;
  balance: number;
  type: string; // checking, savings, card, loan, deposit, market, lifeinsurance...
  currency: { id: string } | null;
  iban: string | null;
  disabled: boolean;
  last_update: string | null;
  company_name: string | null;
}

export interface PowensTransaction {
  id: number;
  id_account: number;
  date: string;       // YYYY-MM-DD
  rdate: string;      // date réelle
  value: number;      // signé (- = débit)
  original_wording: string;
  simplified_wording: string;
  id_category: number | null;
  coming: boolean;     // true = opération à venir
  type: string;        // transfer, order, check, withdrawal, card, ...
}

interface PowensListResponse<T> {
  accounts?: T[];
  transactions?: T[];
  connections?: PowensConnectionInfo[];
  total?: number;
}

export interface PowensConnectionInfo {
  id: number;
  id_connector: number;
  state: string;       // valid, wrongpass, bug, etc.
  last_update: string | null;
  connector: { name: string } | null;
}

// ─── HTTP helpers ───────────────────────────────────────────

async function powensFetch<T>(
  path: string,
  authToken?: string,
  options?: { method?: string; body?: Record<string, unknown> },
): Promise<T> {
  const { apiUrl, clientId, clientSecret } = getConfig();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const url = `${apiUrl}${path}`;
  const res = await fetch(url, {
    method: options?.method || 'GET',
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Powens ${options?.method || 'GET'} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.json() as Promise<T>;
}

// ─── API Functions ──────────────────────────────────────────

/**
 * Créer un utilisateur Powens anonyme.
 * POST /auth/init — authentifié par client_id + client_secret
 */
export async function powensInitUser(): Promise<PowensUser> {
  const { apiUrl, clientId, clientSecret } = getConfig();

  const res = await fetch(`${apiUrl}/auth/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Powens POST /auth/init → ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.json() as Promise<PowensUser>;
}

/**
 * Obtenir un code temporaire pour la webview.
 */
export async function powensGetTempCode(authToken: string): Promise<string> {
  const data = await powensFetch<{ code: string }>(
    '/auth/token/code',
    authToken,
    { method: 'GET' },
  );
  return data.code;
}

/**
 * Lister les connexions bancaires de l'utilisateur.
 */
export async function powensGetConnections(authToken: string): Promise<PowensConnectionInfo[]> {
  const data = await powensFetch<PowensListResponse<never>>(
    '/users/me/connections?expand=connector',
    authToken,
  );
  return data.connections || [];
}

/**
 * Récupérer tous les comptes de l'utilisateur.
 */
export async function powensFetchAccounts(authToken: string): Promise<PowensAccount[]> {
  const data = await powensFetch<PowensListResponse<PowensAccount>>(
    '/users/me/accounts',
    authToken,
  );
  return data.accounts || [];
}

/**
 * Récupérer les transactions (paginées).
 * @param minDate - Date ISO (YYYY-MM-DD) pour filtrer les transactions récentes
 */
export async function powensFetchTransactions(
  authToken: string,
  opts?: { minDate?: string; offset?: number; limit?: number },
): Promise<{ transactions: PowensTransaction[]; total: number }> {
  const params = new URLSearchParams();
  if (opts?.minDate) params.set('min_date', opts.minDate);
  params.set('offset', String(opts?.offset || 0));
  params.set('limit', String(opts?.limit || 1000));

  const data = await powensFetch<PowensListResponse<PowensTransaction>>(
    `/users/me/transactions?${params}`,
    authToken,
  );

  return {
    transactions: data.transactions || [],
    total: data.total || 0,
  };
}

/**
 * Supprimer l'utilisateur Powens (et toutes ses données).
 */
export async function powensDeleteUser(authToken: string): Promise<void> {
  await powensFetch<unknown>('/users/me', authToken, { method: 'DELETE' });
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Extraire le domaine API depuis POWENS_API_URL.
 * Ex: "https://luna-sandbox.biapi.pro/2.0" → "luna-sandbox.biapi.pro"
 */
function getApiDomain(): string {
  const { apiUrl } = getConfig();
  return new URL(apiUrl).hostname;
}

/**
 * URL de la webview Powens pour connecter une banque.
 * Format: https://webview.powens.com/connect?domain=...&client_id=...&code=...&redirect_uri=...
 */
export function buildPowensWebviewUrl(code: string, redirectUri: string): string {
  const { clientId } = getConfig();
  const params = new URLSearchParams({
    domain: getApiDomain(),
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    max_connections: '20',
  });
  return `https://webview.powens.com/fr/connect?${params}`;
}

/**
 * URL de la webview Powens pour reconnecter un accès expiré.
 */
export function buildPowensReconnectUrl(code: string, connectionId: number, redirectUri: string): string {
  const { clientId } = getConfig();
  const params = new URLSearchParams({
    domain: getApiDomain(),
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    connection_id: String(connectionId),
  });
  return `https://webview.powens.com/fr/reconnect?${params}`;
}

/**
 * Mapper le type de compte Powens → PersonalAccountType.
 */
export function mapPowensAccountType(powensType: string): PersonalAccountType {
  switch (powensType) {
    case 'checking':
    case 'card':
      return 'CURRENT';
    case 'savings':
    case 'deposit':
      return 'SAVINGS';
    case 'market':
    case 'lifeinsurance':
    case 'pea':
      return 'INVEST';
    case 'loan':
    case 'mortgage':
      return 'LOAN';
    default:
      return 'CURRENT';
  }
}

/**
 * Convertir un montant Powens (float en euros) → cents (BigInt).
 */
export function powensValueToCents(value: number): bigint {
  return BigInt(Math.round(value * 100));
}
