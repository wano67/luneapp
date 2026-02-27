/**
 * Contract tests — Shape JSON des routes migrées.
 *
 * Vérifie que :
 *   1. Les réponses listes retournent { items: [] }
 *   2. Les réponses item retournent { item: {} }
 *   3. Aucun BigInt ne traverse le JSON (crash JSON.parse)
 *   4. Les IDs sont des strings (pas des numbers)
 *   5. Les dates sont des ISO strings (pas des Date objects)
 *
 * Exécution : pnpm tsx scripts/smoke-api-contracts.ts
 *
 * Prérequis : APP_URL + AUTH_TOKEN dans .env (ou variables d'env)
 *   APP_URL=http://localhost:8080
 *   SMOKE_TOKEN=<cookie auth-token value>
 *   SMOKE_BUSINESS_ID=<bigint id>
 */

import assert from 'node:assert/strict';
import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

const BASE_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:8080';
const TOKEN = process.env.SMOKE_TOKEN ?? '';
const BUSINESS_ID = process.env.SMOKE_BUSINESS_ID ?? '';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
let skipped = 0;

async function hit(
  path: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; body: unknown; raw: string }> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Cookie: `auth-token=${TOKEN}`,
      'Content-Type': 'application/json',
      Origin: BASE_URL,
      ...(options?.headers ?? {}),
    },
  });
  const raw = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body, raw };
}

function contract(name: string, fn: () => Promise<void>) {
  return fn()
    .then(() => {
      console.log(`  ✓ ${name}`);
      passed++;
    })
    .catch((err) => {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err instanceof Error ? err.message : err}`);
      failed++;
    });
}

function skip(name: string, reason: string) {
  console.log(`  ⊘ ${name} — ${reason}`);
  skipped++;
}

// ---------------------------------------------------------------------------
// Shape assertions
// ---------------------------------------------------------------------------

/** Vérifie qu'aucune valeur BigInt n'est dans l'objet sérialisé JSON. */
function assertNoBigInt(value: unknown, path = 'root') {
  if (typeof value === 'bigint') {
    throw new Error(`BigInt détecté à ${path} — la sérialisation est cassée.`);
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoBigInt(v, `${path}[${i}]`));
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      assertNoBigInt(v, `${path}.${k}`);
    }
  }
}

/** Vérifie que les IDs sont des strings quand présents. */
function assertIdsAreStrings(obj: Record<string, unknown>, path = 'root') {
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'id' || key.endsWith('Id')) {
      if (value !== null && value !== undefined) {
        assert.equal(
          typeof value,
          'string',
          `${path}.${key} devrait être une string, reçu: ${typeof value} (${value})`
        );
        // Un ID string ne doit pas être un nombre flottant
        if (typeof value === 'string') {
          assert.ok(
            /^\d+$/.test(value) || value === '',
            `${path}.${key} a un format ID inattendu: "${value}"`
          );
        }
      }
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      assertIdsAreStrings(value as Record<string, unknown>, `${path}.${key}`);
    }
  }
}

/** Vérifie que les champs *At sont des ISO strings quand non-null. */
function assertDatesAreStrings(obj: Record<string, unknown>, path = 'root') {
  for (const [key, value] of Object.entries(obj)) {
    if (key.endsWith('At') || key.endsWith('Date') || key === 'date') {
      if (value !== null && value !== undefined) {
        assert.equal(
          typeof value,
          'string',
          `${path}.${key} devrait être une ISO string, reçu: ${typeof value}`
        );
        // Vérifier format ISO basique
        if (typeof value === 'string') {
          assert.ok(
            /^\d{4}-\d{2}-\d{2}/.test(value),
            `${path}.${key} n'est pas une date ISO valide: "${value}"`
          );
        }
      }
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      assertDatesAreStrings(value as Record<string, unknown>, `${path}.${key}`);
    }
  }
}

/** Vérifie la shape { items: array }. */
function assertListShape(body: unknown, routeName: string) {
  assert.ok(body !== null && typeof body === 'object', `${routeName}: body doit être un objet`);
  const b = body as Record<string, unknown>;
  assert.ok('items' in b, `${routeName}: réponse liste doit avoir { items }`);
  assert.ok(Array.isArray(b.items), `${routeName}: items doit être un tableau`);
  assertNoBigInt(body, routeName);
  if ((b.items as unknown[]).length > 0) {
    const first = (b.items as Record<string, unknown>[])[0];
    assertIdsAreStrings(first, `${routeName}.items[0]`);
    assertDatesAreStrings(first, `${routeName}.items[0]`);
  }
}

/** Vérifie la shape { item: object }. */
function assertItemShape(body: unknown, routeName: string) {
  assert.ok(body !== null && typeof body === 'object', `${routeName}: body doit être un objet`);
  const b = body as Record<string, unknown>;
  assert.ok('item' in b, `${routeName}: réponse item doit avoir { item }`);
  assert.ok(b.item !== null && typeof b.item === 'object', `${routeName}: item doit être un objet`);
  assertNoBigInt(body, routeName);
  assertIdsAreStrings(b.item as Record<string, unknown>, `${routeName}.item`);
  assertDatesAreStrings(b.item as Record<string, unknown>, `${routeName}.item`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {

// ---------------------------------------------------------------------------
// Vérification de la config
// ---------------------------------------------------------------------------

if (!TOKEN || !BUSINESS_ID) {
  console.warn('\n⚠️  SMOKE_TOKEN ou SMOKE_BUSINESS_ID non configuré.');
  console.warn('   Ces tests nécessitent un serveur actif.');
  console.warn('   Définissez SMOKE_TOKEN et SMOKE_BUSINESS_ID dans .env.local');
  console.warn('\n   Pour tourner sans serveur, utiliser : pnpm tsx scripts/test-parsers.ts\n');
  console.warn('Mode offline : vérification des contracts statiques uniquement.\n');
}

const B = BUSINESS_ID;
const canHitServer = Boolean(TOKEN && BUSINESS_ID);

// ---------------------------------------------------------------------------
// Tests statiques (contrats JSON sans serveur)
// ---------------------------------------------------------------------------

console.log('\n[contract] Shape statique — { items }');

await contract('liste vide → { items: [] }', async () => {
  const body = { items: [] };
  assertListShape(body, 'liste vide');
});

await contract('liste avec IDs string → valide', async () => {
  const body = {
    items: [
      { id: '1', businessId: '42', createdAt: '2025-01-01T00:00:00.000Z', label: 'Test' },
      { id: '2', businessId: '42', createdAt: '2025-06-01T00:00:00.000Z', label: 'Test 2' },
    ],
  };
  assertListShape(body, 'liste avec items');
});

await contract('item avec ID string → valide', async () => {
  const body = {
    item: { id: '5', businessId: '10', createdAt: '2025-01-01T00:00:00.000Z', name: 'Test' },
  };
  assertItemShape(body, 'item simple');
});

console.log('\n[contract] Détection des violations');

await contract('BigInt dans body → détecté', async () => {
  let threw = false;
  try {
    assertNoBigInt({ id: BigInt(1) }, 'test');
  } catch {
    threw = true;
  }
  assert.ok(threw, 'Un BigInt doit être détecté');
});

await contract('ID number (pas string) → détecté', async () => {
  let threw = false;
  try {
    assertIdsAreStrings({ id: 42 }, 'test');
  } catch {
    threw = true;
  }
  assert.ok(threw, 'Un ID number doit être détecté');
});

await contract('date non-ISO → détectée', async () => {
  let threw = false;
  try {
    assertDatesAreStrings({ createdAt: 1720000000000 }, 'test');
  } catch {
    threw = true;
  }
  assert.ok(threw, 'Un timestamp number doit être détecté comme date invalide');
});

// ---------------------------------------------------------------------------
// Tests live (nécessitent un serveur actif)
// ---------------------------------------------------------------------------

console.log('\n[contract] Endpoints live' + (canHitServer ? '' : ' (⊘ skipped — pas de serveur)'));

if (canHitServer) {
  // Auth check
  await contract('GET /api/auth/me → { user }', async () => {
    const { ok, status, body } = await hit('/api/auth/me');
    assert.ok(ok, `Auth me retourne ${status}`);
    assert.ok((body as Record<string, unknown>).user, 'Doit avoir { user }');
  });

  // Settings (migré en PR1)
  await contract(`GET /settings → { item }`, async () => {
    const { ok, body } = await hit(`/api/pro/businesses/${B}/settings`);
    assert.ok(ok, 'Settings doit retourner 200');
    assertItemShape(body, 'settings');
  });

  // Clients (migré en PR1)
  await contract(`GET /clients → { items }`, async () => {
    const { ok, body } = await hit(`/api/pro/businesses/${B}/clients`);
    assert.ok(ok, 'Clients doit retourner 200');
    assertListShape(body, 'clients');
  });

  // Finances (migré en PR2)
  await contract(`GET /finances → { items }`, async () => {
    const { ok, body } = await hit(`/api/pro/businesses/${B}/finances`);
    assert.ok(ok, 'Finances doit retourner 200');
    assertListShape(body, 'finances');
  });

  // Projects (migré en PR2)
  await contract(`GET /projects → { items }`, async () => {
    const { ok, body } = await hit(`/api/pro/businesses/${B}/projects`);
    assert.ok(ok, 'Projects doit retourner 200');
    assertListShape(body, 'projects');
  });

  // Services (migré en PR2)
  await contract(`GET /services → { items }`, async () => {
    const { ok, body } = await hit(`/api/pro/businesses/${B}/services`);
    assert.ok(ok, 'Services doit retourner 200');
    assertListShape(body, 'services');
  });

  // Products (migré en PR2)
  await contract(`GET /products → { items }`, async () => {
    const { ok, body } = await hit(`/api/pro/businesses/${B}/products`);
    assert.ok(ok, 'Products doit retourner 200');
    assertListShape(body, 'products');
  });

  // Auth check — route non migrée ne doit pas avoir régressé
  await contract('GET /clients sans token → 401', async () => {
    const res = await fetch(`${BASE_URL}/api/pro/businesses/${B}/clients`);
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    assert.equal(res.status, 401, 'Sans token doit retourner 401');
    assert.ok('error' in body, 'Doit avoir { error }');
  });

  // Wrong business → 403
  await contract('GET /clients businessId=0 → 403 ou 400', async () => {
    const { status } = await hit(`/api/pro/businesses/0/clients`);
    assert.ok(status === 403 || status === 400, `Doit retourner 403 ou 400, reçu ${status}`);
  });
} else {
  ['GET /settings', 'GET /clients', 'GET /finances', 'GET /projects', 'GET /services', 'GET /products'].forEach(
    (name) => skip(name, 'SMOKE_TOKEN non configuré')
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const total = passed + failed;
console.log(`\n${'─'.repeat(50)}`);
console.log(`Contracts : ${passed}/${total} passés${failed > 0 ? ` | ${failed} ÉCHEC(S)` : ''}${skipped > 0 ? ` | ${skipped} skippés` : ''}`);

if (failed > 0) {
    process.exit(1);
  }
} // end main

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
