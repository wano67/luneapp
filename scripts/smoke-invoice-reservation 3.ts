import { createRequester, getSmokeCreds, handleMissingCreds } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request } = createRequester(baseUrl);

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

type SummaryRow = {
  productId: string;
  onHand?: number;
  reserved?: number;
  available?: number;
};

async function main() {
  console.log(`Base URL: ${baseUrl}`);
  await login();

  const { res: bizRes, json: bizJson } = await request('/api/pro/businesses');
  if (!bizRes.ok) throw new Error(`Businesses failed (${bizRes.status})`);
  const businessId =
    (bizJson as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business?.id;
  if (!businessId) throw new Error('No business found');
  console.log(`Business ${businessId}`);

  const sku = `SMK-INV-${Date.now()}`;
  const productName = `Smoke Product ${Date.now()}`;
  console.log('Create product…');
  const { res: prodRes, json: prodJson } = await request(`/api/pro/businesses/${businessId}/products`, {
    method: 'POST',
    body: { sku, name: productName, unit: 'PIECE', purchasePriceCents: 500 },
  });
  if (!prodRes.ok) throw new Error(`Product create failed (${prodRes.status}) ${JSON.stringify(prodJson)}`);
  const productId = (prodJson as { product?: { id?: string } })?.product?.id;
  if (!productId) throw new Error('Missing product id');

  console.log('Seed stock (+20)…');
  const { res: seedRes, json: seedJson } = await request(
    `/api/pro/businesses/${businessId}/products/${productId}/movements`,
    { method: 'POST', body: { type: 'IN', quantity: 20, unitCostCents: 500, reason: 'seed' } }
  );
  if (!seedRes.ok) throw new Error(`Seed movement failed (${seedRes.status}) ${JSON.stringify(seedJson)}`);

  console.log('Create service…');
  const serviceCode = `SER-${Date.now()}`;
  const { res: svcRes, json: svcJson } = await request(`/api/pro/businesses/${businessId}/services`, {
    method: 'POST',
    body: { code: serviceCode, name: 'Smoke Service', defaultPriceCents: 1500 },
  });
  if (!svcRes.ok) throw new Error(`Service create failed (${svcRes.status}) ${JSON.stringify(svcJson)}`);
  const serviceId = (svcJson as { service?: { id?: string }; id?: string })?.service?.id ?? (svcJson as { id?: string }).id;
  if (!serviceId) throw new Error('Missing service id');

  console.log('Create project…');
  const { res: projRes, json: projJson } = await request(`/api/pro/businesses/${businessId}/projects`, {
    method: 'POST',
    body: { name: `Smoke Project ${Date.now()}` },
  });
  if (!projRes.ok) throw new Error(`Project create failed (${projRes.status}) ${JSON.stringify(projJson)}`);
  const projectId = (projJson as { id?: string })?.id;
  if (!projectId) throw new Error('Missing project id');

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
  if (!quoteRes.ok) throw new Error(`Quote create failed (${quoteRes.status}) ${JSON.stringify(quoteJson)}`);
  const quoteId = (quoteJson as { quote?: { id?: string; items?: Array<{ id: string }> } })?.quote?.id;
  if (!quoteId) throw new Error('Missing quote id');

  console.log('Mark quote SENT…');
  const { res: quotePatchRes, json: quotePatchJson } = await request(
    `/api/pro/businesses/${businessId}/quotes/${quoteId}`,
    { method: 'PATCH', body: { status: 'SENT' } }
  );
  if (!quotePatchRes.ok) {
    throw new Error(`Quote patch failed (${quotePatchRes.status}) ${JSON.stringify(quotePatchJson)}`);
  }

  console.log('Create invoice from quote…');
  const { res: invRes, json: invJson } = await request(
    `/api/pro/businesses/${businessId}/quotes/${quoteId}/invoices`,
    { method: 'POST' }
  );
  if (!invRes.ok) throw new Error(`Invoice create failed (${invRes.status}) ${JSON.stringify(invJson)}`);
  const invoiceId = (invJson as { invoice?: { id?: string } })?.invoice?.id;
  if (!invoiceId) throw new Error('Missing invoice id');

  console.log('Fetch invoice items…');
  const { res: invGetRes, json: invGetJson } = await request(
    `/api/pro/businesses/${businessId}/invoices/${invoiceId}`
  );
  if (!invGetRes.ok) throw new Error(`Invoice get failed (${invGetRes.status}) ${JSON.stringify(invGetJson)}`);
  const invoiceItems =
    (invGetJson as { invoice?: { items?: Array<{ id?: string; quantity?: number }> } })?.invoice?.items ?? [];
  if (!invoiceItems.length) throw new Error('Invoice items missing');

  console.log('Patch invoice items with product…');
  const itemsPayload = invoiceItems.map((it) => ({ id: it.id!, productId }));
  const { res: invPatchRes, json: invPatchJson } = await request(
    `/api/pro/businesses/${businessId}/invoices/${invoiceId}`,
    { method: 'PATCH', body: { status: 'DRAFT', items: itemsPayload } }
  );
  if (!invPatchRes.ok) throw new Error(`Invoice patch failed (${invPatchRes.status}) ${JSON.stringify(invPatchJson)}`);

  const qty = invoiceItems.reduce((acc, it) => acc + (it.quantity ?? 0), 0);

  const summaryUrl = `/api/pro/businesses/${businessId}/inventory/summary`;
  const readSummary = async () => {
    const { res, json } = await request(summaryUrl);
    if (!res.ok) throw new Error(`Summary failed (${res.status}) ${JSON.stringify(json)}`);
    const items = (json as { items?: SummaryRow[] })?.items ?? [];
    const row = items.find((r) => r.productId === productId);
    if (!row) throw new Error('Summary row missing for product');
    return row;
  };

  console.log('Summary baseline…');
  const baseline = await readSummary();
  if ((baseline.onHand ?? baseline.stock ?? 0) < qty) throw new Error('Baseline stock too low');

  console.log('Mark invoice SENT (reserve)…');
  const { res: sentRes, json: sentJson } = await request(
    `/api/pro/businesses/${businessId}/invoices/${invoiceId}`,
    { method: 'PATCH', body: { status: 'SENT' } }
  );
  if (!sentRes.ok) throw new Error(`Invoice SENT failed (${sentRes.status}) ${JSON.stringify(sentJson)}`);
  const afterSent = await readSummary();
  const onHandAfterSent = afterSent.onHand ?? afterSent.stock ?? 0;
  if (onHandAfterSent !== (baseline.onHand ?? baseline.stock ?? 0)) {
    throw new Error('OnHand should not change on SENT');
  }
  if ((afterSent.reserved ?? 0) < qty) throw new Error('Reserved not increased on SENT');

  console.log('Mark invoice SENT again (idempotent)…');
  await request(`/api/pro/businesses/${businessId}/invoices/${invoiceId}`, {
    method: 'PATCH',
    body: { status: 'SENT' },
  });
  const afterSentAgain = await readSummary();
  if (afterSentAgain.reserved !== afterSent.reserved) {
    throw new Error('Reservation should be idempotent');
  }

  console.log('Mark invoice PAID (consume)…');
  const { res: paidRes, json: paidJson } = await request(
    `/api/pro/businesses/${businessId}/invoices/${invoiceId}`,
    { method: 'PATCH', body: { status: 'PAID' } }
  );
  if (!paidRes.ok) throw new Error(`Invoice PAID failed (${paidRes.status}) ${JSON.stringify(paidJson)}`);
  const afterPaid = await readSummary();
  const expectedOnHand = (baseline.onHand ?? baseline.stock ?? 0) - qty;
  if (afterPaid.onHand !== expectedOnHand && (afterPaid.stock ?? afterPaid.onHand) !== expectedOnHand) {
    throw new Error(`OnHand after PAID mismatch expected ${expectedOnHand}, got ${afterPaid.onHand}`);
  }
  if ((afterPaid.reserved ?? 0) !== 0) throw new Error('Reserved should be zero after PAID');

  console.log('Smoke invoice reservation OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
