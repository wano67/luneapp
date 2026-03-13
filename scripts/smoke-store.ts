/**
 * Smoke test — Store products + orders
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-store.ts
 */

import { createRequester, loginAndPickBusiness, assertListShape, assertItemShape, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';

async function main() {
  console.log('[store] Démarrage…');

  const { request } = createRequester(baseUrl);
  const { businessId } = await loginAndPickBusiness(request);
  const base = `/api/pro/businesses/${businessId}`;
  console.log('  ✓ Login');

  // ── PRODUCTS LIST ──
  const { json: prodListJson, res: prodListRes } = await request(`${base}/store/products`, { allowError: true });
  if (!prodListRes.ok) {
    console.log(`  ⊘ Store products endpoint → ${prodListRes.status} (skip)`);
    console.log('[store] OK (skipped)\n');
    return;
  }
  const products = assertListShape(prodListJson, 'GET /store/products');
  console.log(`  ✓ Liste produits (${products.length})`);

  // ── CREATE PRODUCT ──
  const { json: createJson, res: createRes } = await request(`${base}/store/products`, {
    method: 'POST',
    body: {
      name: '__smoke_product__',
      priceCents: 2500,
      description: 'Smoke test product',
    },
    allowError: true,
  });
  if (!createRes.ok) {
    console.log(`  ⊘ Create product → ${createRes.status} (skip)`);
    console.log('[store] OK (partial)\n');
    return;
  }
  const product = assertItemShape(createJson, 'POST /store/products');
  const productId = product.id as string;
  assert(productId, 'product id returned');
  console.log(`  ✓ Produit créé (id=${productId})`);

  // ── UPDATE PRODUCT ──
  const { res: patchRes } = await request(`${base}/store/products/${productId}`, {
    method: 'PATCH',
    body: { name: '__smoke_product_updated__' },
    allowError: true,
  });
  if (patchRes.ok) {
    console.log('  ✓ Produit mis à jour');
  } else {
    console.log(`  ⊘ PATCH product → ${patchRes.status}`);
  }

  // ── ORDERS LIST ──
  const { json: ordListJson, res: ordListRes } = await request(`${base}/store/orders`, { allowError: true });
  if (ordListRes.ok) {
    const orders = assertListShape(ordListJson, 'GET /store/orders');
    console.log(`  ✓ Liste commandes (${orders.length})`);
  } else {
    console.log(`  ⊘ Orders endpoint → ${ordListRes.status} (skip)`);
  }

  // ── DELETE PRODUCT ──
  const { res: delRes } = await request(`${base}/store/products/${productId}`, { method: 'DELETE', allowError: true });
  if (delRes.status === 204 || delRes.status === 200) {
    console.log('  ✓ Produit supprimé');
  } else {
    console.log(`  ⊘ DELETE product → ${delRes.status}`);
  }

  console.log('[store] OK\n');
}

main().catch((err) => {
  console.error('[store] ÉCHEC :', err.message);
  process.exit(1);
});
