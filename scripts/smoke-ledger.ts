import { createRequester, getSmokeCreds, handleMissingCreds } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request } = createRequester(baseUrl);

type LedgerEntry = {
  id: string;
  sourceType?: string;
  sourceId?: string | null;
  lines?: Array<{ debitCents?: string | null; creditCents?: string | null }>;
};

async function login() {
  let creds;
  try {
    creds = getSmokeCreds({ preferAdmin: true });
  } catch (err) {
    handleMissingCreds((err as Error).message);
    return;
  }
  const { res, json } = await request('/api/auth/login', {
    method: 'POST',
    body: { email: creds.email, password: creds.password },
  });
  if (!res.ok) throw new Error(`Login failed (${res.status}) ${JSON.stringify(json)}`);
}

function sumCents(values: Array<string | null | undefined>) {
  return values.reduce((acc, v) => acc + BigInt(v ?? 0), BigInt(0));
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);
  await login();

  const { res: bizRes, json: bizJson } = await request('/api/pro/businesses');
  if (!bizRes.ok) throw new Error(`Businesses failed (${bizRes.status})`);
  const businessId =
    (bizJson as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business?.id;
  if (!businessId) throw new Error('No business found');
  console.log(`Business ${businessId}`);

  // Purchase movement -> ledger
  const sku = `LED-${Date.now()}`;
  console.log('Create product…');
  const { res: prodRes, json: prodJson } = await request(`/api/pro/businesses/${businessId}/products`, {
    method: 'POST',
    body: { sku, name: `Ledger Prod ${Date.now()}`, unit: 'PIECE', purchasePriceCents: 800 },
  });
  if (!prodRes.ok) throw new Error(`Product create failed (${prodRes.status}) ${JSON.stringify(prodJson)}`);
  const productId = (prodJson as { product?: { id?: string } })?.product?.id;
  if (!productId) throw new Error('Missing product id');

  console.log('Movement IN with cost…');
  const unitCost = 700;
  const qty = 5;
  const { res: mvRes, json: mvJson } = await request(
    `/api/pro/businesses/${businessId}/products/${productId}/movements`,
    { method: 'POST', body: { type: 'IN', quantity: qty, unitCostCents: unitCost, reason: 'purchase' } }
  );
  if (!mvRes.ok) throw new Error(`Movement failed (${mvRes.status}) ${JSON.stringify(mvJson)}`);
  const movementId = (mvJson as { movement?: { id?: string } })?.movement?.id;
  if (!movementId) throw new Error('Missing movement id');

  console.log('Check ledger entry for movement…');
  const { res: ledRes, json: ledJson } = await request(
    `/api/pro/businesses/${businessId}/ledger?sourceType=INVENTORY_MOVEMENT&sourceId=${movementId}`
  );
  if (!ledRes.ok) throw new Error(`Ledger list failed (${ledRes.status}) ${JSON.stringify(ledJson)}`);
  const entry = (ledJson as { items?: LedgerEntry[] })?.items?.[0];
  if (!entry) throw new Error('Ledger entry missing for movement');
  const debit = sumCents(entry.lines?.map((l) => l.debitCents) ?? []);
  const credit = sumCents(entry.lines?.map((l) => l.creditCents) ?? []);
  if (debit !== credit) throw new Error('Ledger entry not balanced for movement');

  // Invoice reservation & consumption -> ledger
  console.log('Create project…');
  const { res: projRes, json: projJson } = await request(`/api/pro/businesses/${businessId}/projects`, {
    method: 'POST',
    body: { name: `Ledger Project ${Date.now()}` },
  });
  if (!projRes.ok) throw new Error(`Project failed (${projRes.status}) ${JSON.stringify(projJson)}`);
  const projectId = (projJson as { id?: string })?.id;
  if (!projectId) throw new Error('Missing project id');

  console.log('Create service…');
  const { res: svcRes, json: svcJson } = await request(`/api/pro/businesses/${businessId}/services`, {
    method: 'POST',
    body: { code: `SER-${Date.now()}`, name: 'Ledger Service', defaultPriceCents: 1500 },
  });
  if (!svcRes.ok) throw new Error(`Service failed (${svcRes.status}) ${JSON.stringify(svcJson)}`);
  const serviceId = (svcJson as { service?: { id?: string }; id?: string })?.service?.id ?? (svcJson as { id?: string }).id;
  if (!serviceId) throw new Error('Missing service id');

  console.log('Attach service to project…');
  const { res: psRes, json: psJson } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/services`,
    { method: 'POST', body: { serviceId, quantity: 2 } }
  );
  if (!psRes.ok) throw new Error(`Project service failed (${psRes.status}) ${JSON.stringify(psJson)}`);

  console.log('Create quote…');
  const { res: quoteRes, json: quoteJson } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/quotes`,
    { method: 'POST' }
  );
  if (!quoteRes.ok) throw new Error(`Quote failed (${quoteRes.status}) ${JSON.stringify(quoteJson)}`);
  const quoteId = (quoteJson as { quote?: { id?: string } })?.quote?.id;
  if (!quoteId) throw new Error('Missing quote id');

  console.log('Mark quote SENT…');
  await request(`/api/pro/businesses/${businessId}/quotes/${quoteId}`, { method: 'PATCH', body: { status: 'SENT' } });

  console.log('Create invoice from quote…');
  const { res: invRes, json: invJson } = await request(
    `/api/pro/businesses/${businessId}/quotes/${quoteId}/invoices`,
    { method: 'POST' }
  );
  if (!invRes.ok) throw new Error(`Invoice failed (${invRes.status}) ${JSON.stringify(invJson)}`);
  const invoiceId = (invJson as { invoice?: { id?: string } })?.invoice?.id;
  if (!invoiceId) throw new Error('Missing invoice id');

  console.log('Patch invoice items with product…');
  const { res: invGetRes, json: invGetJson } = await request(
    `/api/pro/businesses/${businessId}/invoices/${invoiceId}`
  );
  if (!invGetRes.ok) throw new Error(`Invoice get failed (${invGetRes.status}) ${JSON.stringify(invGetJson)}`);
  const items =
    (invGetJson as { invoice?: { items?: Array<{ id?: string; quantity?: number }> } })?.invoice?.items ?? [];
  const itemsPayload = items.map((it) => ({ id: it.id!, productId }));
  await request(`/api/pro/businesses/${businessId}/invoices/${invoiceId}`, {
    method: 'PATCH',
    body: { status: 'DRAFT', items: itemsPayload },
  });

  console.log('Invoice SENT then PAID…');
  await request(`/api/pro/businesses/${businessId}/invoices/${invoiceId}`, { method: 'PATCH', body: { status: 'SENT' } });
  await request(`/api/pro/businesses/${businessId}/invoices/${invoiceId}`, { method: 'PATCH', body: { status: 'PAID' } });

  console.log('Check ledger entry for COGS…');
  const { res: ledCogRes, json: ledCogJson } = await request(
    `/api/pro/businesses/${businessId}/ledger?sourceType=INVOICE_STOCK_CONSUMPTION&sourceId=${invoiceId}`
  );
  if (!ledCogRes.ok) throw new Error(`Ledger COGS list failed (${ledCogRes.status}) ${JSON.stringify(ledCogJson)}`);
  const cogsEntry = (ledCogJson as { items?: LedgerEntry[] })?.items?.[0];
  if (!cogsEntry) throw new Error('COGS ledger entry missing');
  const debit2 = sumCents(cogsEntry.lines?.map((l) => l.debitCents) ?? []);
  const credit2 = sumCents(cogsEntry.lines?.map((l) => l.creditCents) ?? []);
  if (debit2 !== credit2) throw new Error('COGS ledger entry not balanced');

  console.log('Smoke ledger OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
