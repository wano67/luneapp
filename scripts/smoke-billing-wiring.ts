/**
 * Smoke test: project -> pricing -> quote PDF -> invoice PDF -> payment -> finance/dashboard.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 TEST_EMAIL=... TEST_PASSWORD=... pnpm smoke:billing
 *   (fallback env: ADMIN_EMAIL/ADMIN_PASSWORD)
 */

import { createRequester, getSmokeCreds, handleMissingCreds } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request, requestBinary, getLastRequestId } = createRequester(baseUrl);
const numberRegex = /^SF-(DEV|FAC)-\d{4}-\d{4}$/;

async function login(): Promise<void> {
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

function toBigInt(value: unknown) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'string') return BigInt(value);
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  throw new Error(`Invalid bigint: ${String(value)}`);
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);
  console.log('Login…');
  await login();

  console.log('Fetch businesses…');
  const { res: bizRes, json: bizJson } = await request('/api/pro/businesses');
  if (!bizRes.ok) throw new Error(`Businesses failed (${bizRes.status}) ref=${getLastRequestId()}`);
  const businessId =
    (bizJson as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business?.id;
  if (!businessId) throw new Error('No business found.');

  console.log(`Business ${businessId}`);

  console.log('Update billing legal texts…');
  const legalUpdate = await request(`/api/pro/businesses/${businessId}/settings`, {
    method: 'PATCH',
    body: {
      cgvText: 'CGV smoke: conditions générales applicables à toutes prestations.',
      paymentTermsText: 'Paiement sous 30 jours fin de mois.',
      lateFeesText: 'Pénalités de retard: 3x le taux légal.',
      fixedIndemnityText: 'Indemnité forfaitaire de 40€ pour frais de recouvrement.',
      legalMentionsText: 'TVA non applicable, art. 293B du CGI.',
    },
  });
  if (!legalUpdate.res.ok) {
    throw new Error(`Update legal texts failed (${legalUpdate.res.status}) ref=${getLastRequestId()}`);
  }

  console.log('Dashboard (before)…');
  const { res: dashBeforeRes, json: dashBefore } = await request(
    `/api/pro/businesses/${businessId}/dashboard`
  );
  if (!dashBeforeRes.ok) throw new Error(`Dashboard before failed (${dashBeforeRes.status}) ref=${getLastRequestId()}`);
  const beforeIncome = BigInt(
    (dashBefore as { kpis?: { mtdIncomeCents?: string } })?.kpis?.mtdIncomeCents ?? '0'
  );

  console.log('Fetch categories…');
  const { res: catRes, json: catJson } = await request(
    `/api/pro/businesses/${businessId}/references?type=CATEGORY`
  );
  if (!catRes.ok) throw new Error(`Categories failed (${catRes.status}) ref=${getLastRequestId()}`);
  let categoryId = (catJson as { items?: Array<{ id?: string }> })?.items?.[0]?.id ?? null;
  if (!categoryId) {
    console.log('No category found, creating a temporary one…');
    const { res: createCatRes, json: createCatJson } = await request(
      `/api/pro/businesses/${businessId}/references`,
      {
        method: 'POST',
        body: { type: 'CATEGORY', name: `Smoke catégorie ${Date.now()}` },
      }
    );
    if (!createCatRes.ok)
      throw new Error(`Create category failed (${createCatRes.status}) ref=${getLastRequestId()}`);
    categoryId = (createCatJson as { item?: { id?: string } })?.item?.id ?? null;
  }

  console.log('Create services…');
  const code = `SER-${Date.now()}`;
  const { res: createSvcRes, json: createSvcJson } = await request(
    `/api/pro/businesses/${businessId}/services`,
    {
      method: 'POST',
      body: {
        code,
        name: `Smoke Service ${Date.now()}`,
        description: 'Smoke billing',
        defaultPriceCents: 10000,
        durationHours: 2,
        categoryReferenceId: categoryId ?? undefined,
      },
    }
  );
  if (!createSvcRes.ok) throw new Error(`Create service failed (${createSvcRes.status}) ref=${getLastRequestId()}`);
  const serviceId = (createSvcJson as { id?: string })?.id;
  if (!serviceId) throw new Error('Service creation returned no id.');

  console.log('Create task template for service…');
  const tplRes = await request(`/api/pro/businesses/${businessId}/services/${serviceId}/templates`, {
    method: 'POST',
    body: { title: `Smoke task ${Date.now()}`, phase: 'DEV', defaultDueOffsetDays: 2 },
  });
  if (!tplRes.res.ok) throw new Error(`Template create failed (${tplRes.res.status}) ref=${getLastRequestId()}`);

  const code2 = `SER-${Date.now()}-B`;
  const { res: createSvcRes2, json: createSvcJson2 } = await request(
    `/api/pro/businesses/${businessId}/services`,
    {
      method: 'POST',
      body: {
        code: code2,
        name: `Smoke Service B ${Date.now()}`,
        description: 'Smoke billing B',
        defaultPriceCents: 15000,
        durationHours: 1,
        categoryReferenceId: categoryId ?? undefined,
      },
    }
  );
  if (!createSvcRes2.ok) throw new Error(`Create service B failed (${createSvcRes2.status}) ref=${getLastRequestId()}`);
  const serviceIdB = (createSvcJson2 as { id?: string })?.id;
  if (!serviceIdB) throw new Error('Service B creation returned no id.');

  console.log('Create project and attach services…');
  const name = `Billing Smoke ${Date.now()}`;
  const { res: createProjRes, json: createProjJson } = await request(
    `/api/pro/businesses/${businessId}/projects`,
    { method: 'POST', body: { name } }
  );
  if (!createProjRes.ok)
    throw new Error(`Create project failed (${createProjRes.status}) ref=${getLastRequestId()}`);
  const projectId = (createProjJson as { id?: string })?.id;
  if (!projectId) throw new Error('Project creation returned no id.');
  console.log('Deposit paid date guard…');
  const badDeposit = await request(`/api/pro/businesses/${businessId}/projects/${projectId}`, {
    method: 'PATCH',
    body: { depositPaidAt: new Date().toISOString() },
    allowError: true,
  });
  if (badDeposit.res.status !== 400) {
    throw new Error(`Expected 400 for depositPaidAt without PAID, got ${badDeposit.res.status}`);
  }
  const prestationsUpdate = await request(`/api/pro/businesses/${businessId}/projects/${projectId}`, {
    method: 'PATCH',
    body: {
      prestationsText:
        '1. Cadrage et définition du périmètre.\n2. Conception UX/UI et maquettes.\n3. Développement et tests.\n4. Mise en production et support.',
    },
  });
  if (!prestationsUpdate.res.ok) {
    throw new Error(`Update prestations failed (${prestationsUpdate.res.status}) ref=${getLastRequestId()}`);
  }
  const { res: attachRes, json: attachJson } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/services`,
    { method: 'POST', body: { serviceId, quantity: 1, priceCents: 10000, generateTasks: true } }
  );
  if (!attachRes.ok)
    throw new Error(`Attach service failed (${attachRes.status}) ref=${getLastRequestId()} json=${JSON.stringify(attachJson)}`);
  const projectServiceId = (attachJson as { id?: string })?.id;
  if (!projectServiceId) throw new Error('Project service id missing.');
  const { res: attachResB, json: attachJsonB } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/services`,
    { method: 'POST', body: { serviceId: serviceIdB, quantity: 1, priceCents: 15000, generateTasks: true } }
  );
  if (!attachResB.ok)
    throw new Error(`Attach service B failed (${attachResB.status}) ref=${getLastRequestId()} json=${JSON.stringify(attachJsonB)}`);

  console.log('Validate tasks linked to project service…');
  const { res: tasksRes, json: tasksJson } = await request(`/api/pro/businesses/${businessId}/tasks?projectId=${projectId}`);
  if (!tasksRes.ok) throw new Error(`Tasks list failed (${tasksRes.status}) ref=${getLastRequestId()}`);
  const linkedTasks =
    (tasksJson as { items?: Array<{ projectServiceId?: string }> }).items?.filter((t) => t.projectServiceId === projectServiceId) ?? [];
  if (!linkedTasks.length) throw new Error('Expected tasks linked to project service.');

  console.log('Reorder services…');
  const { res: listRes, json: listJson } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/services`
  );
  if (!listRes.ok) throw new Error(`List services failed (${listRes.status}) ref=${getLastRequestId()}`);
  const serviceItems = (listJson as { items?: Array<{ id?: string }> })?.items ?? [];
  if (serviceItems.length < 2) throw new Error('Expected at least 2 services for reorder.');
  const reordered = [...serviceItems].reverse().map((item, index) => ({ id: item.id, position: index }));
  const { res: reorderRes } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/services/reorder`,
    { method: 'PATCH', body: { items: reordered } }
  );
  if (!reorderRes.ok) throw new Error(`Reorder failed (${reorderRes.status}) ref=${getLastRequestId()}`);
  const { res: listResAfter, json: listJsonAfter } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/services`
  );
  if (!listResAfter.ok) throw new Error(`List services after failed (${listResAfter.status}) ref=${getLastRequestId()}`);
  const afterItems = (listJsonAfter as { items?: Array<{ id?: string }> })?.items ?? [];
  if (afterItems[0]?.id !== reordered[0]?.id) {
    throw new Error('Service reorder did not persist.');
  }

  console.log(`Project ${projectId}`);

  console.log('Pricing…');
  const { res: pricingRes, json: pricingJson } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/pricing`
  );
  if (!pricingRes.ok) throw new Error(`Pricing failed (${pricingRes.status}) ref=${getLastRequestId()}`);
  const totalCents = toBigInt((pricingJson as { pricing?: { totalCents?: string } })?.pricing?.totalCents ?? '0');
  if (totalCents <= BigInt(0)) throw new Error('Pricing total is zero or invalid.');

  console.log('Create quote…');
  const { res: quoteRes, json: quoteJson } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/quotes`,
    { method: 'POST' }
  );
  if (!quoteRes.ok) throw new Error(`Quote create failed (${quoteRes.status}) ref=${getLastRequestId()}`);
  const quoteId = (quoteJson as { quote?: { id?: string } })?.quote?.id;
  if (!quoteId) throw new Error('Quote id missing.');

  console.log('Verify quote line order…');
  const { res: quoteListRes, json: quoteListJson } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/quotes`
  );
  if (!quoteListRes.ok) throw new Error(`Quotes list failed (${quoteListRes.status}) ref=${getLastRequestId()}`);
  const createdQuote = (quoteListJson as { items?: Array<{ id?: string; items?: Array<{ label?: string }> }> })?.items?.find((q) => q.id === quoteId);
  if (!createdQuote || !createdQuote.items || createdQuote.items.length < 2) {
    throw new Error('Quote items missing for order check.');
  }
  const expectedFirstServiceId = afterItems[0]?.id;
  const expectedFirstService = afterItems.find((item) => item.id === expectedFirstServiceId) as { service?: { name?: string } };
  const expectedLabel = expectedFirstService?.service?.name;
  if (expectedLabel && !createdQuote.items[0].label?.includes(expectedLabel)) {
    throw new Error('Quote line order does not match service order.');
  }

  console.log('Remove a service line…');
  const removeId = afterItems[0]?.id ?? null;
  if (removeId) {
    const { res: deleteSvcRes } = await request(
      `/api/pro/businesses/${businessId}/projects/${projectId}/services/${removeId}`,
      { method: 'DELETE' }
    );
    if (!deleteSvcRes.ok)
      throw new Error(`Delete service failed (${deleteSvcRes.status}) ref=${getLastRequestId()}`);
  }

  console.log('Create staged invoice…');
  const { res: stagedRes, json: stagedJson } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/invoices/staged`,
    { method: 'POST', body: { mode: 'PERCENT', value: 25 } }
  );
  if (!stagedRes.ok)
    throw new Error(`Staged invoice failed (${stagedRes.status}) ref=${getLastRequestId()}`);
  const stagedInvoiceId = (stagedJson as { invoice?: { id?: string } })?.invoice?.id;
  if (!stagedInvoiceId) throw new Error('Staged invoice id missing.');
  const overInvoice = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/invoices/staged`,
    { method: 'POST', body: { mode: 'PERCENT', value: 90 }, allowError: true }
  );
  if (overInvoice.res.status !== 400) {
    throw new Error(`Expected 400 for over-invoicing, got ${overInvoice.res.status}`);
  }
  const delStaged = await request(
    `/api/pro/businesses/${businessId}/invoices/${stagedInvoiceId}`,
    { method: 'DELETE' }
  );
  if (!delStaged.res.ok)
    throw new Error(`Staged invoice delete failed (${delStaged.res.status}) ref=${getLastRequestId()}`);

  console.log('Create + delete draft quote…');
  const { res: deleteQuoteRes, json: deleteQuoteJson } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/quotes`,
    { method: 'POST' }
  );
  if (!deleteQuoteRes.ok)
    throw new Error(`Quote create (delete test) failed (${deleteQuoteRes.status}) ref=${getLastRequestId()}`);
  const deleteQuoteId = (deleteQuoteJson as { quote?: { id?: string } })?.quote?.id;
  if (!deleteQuoteId) throw new Error('Quote id missing (delete test).');
  const deleteQuote = await request(`/api/pro/businesses/${businessId}/quotes/${deleteQuoteId}`, { method: 'DELETE' });
  if (!deleteQuote.res.ok)
    throw new Error(`Quote delete failed (${deleteQuote.res.status}) ref=${getLastRequestId()}`);

  console.log('Quote PDF…');
  const { res: quotePdfRes, buf: quotePdfBuf } = await requestBinary(
    `/api/pro/businesses/${businessId}/quotes/${quoteId}/pdf`
  );
  if (!quotePdfRes.ok) throw new Error(`Quote PDF failed (${quotePdfRes.status}) ref=${getLastRequestId()}`);
  if (quotePdfBuf.byteLength < 1000) throw new Error('Quote PDF too small.');

  console.log('Mark quote SENT then SIGNED…');
  const signedAtGuard = await request(`/api/pro/businesses/${businessId}/quotes/${quoteId}`, {
    method: 'PATCH',
    body: { signedAt: new Date().toISOString() },
    allowError: true,
  });
  if (signedAtGuard.res.status !== 400) {
    throw new Error(`Expected 400 for signedAt when not SIGNED, got ${signedAtGuard.res.status}`);
  }
  const sentResp = await request(
    `/api/pro/businesses/${businessId}/quotes/${quoteId}`,
    { method: 'PATCH', body: { status: 'SENT' } }
  );
  if (!sentResp.res.ok) throw new Error(`Quote SENT failed (${sentResp.res.status}) ref=${getLastRequestId()}`);
  const quoteNumber =
    (sentResp.json as { quote?: { number?: string | null } })?.quote?.number ?? null;
  if (!quoteNumber || !numberRegex.test(quoteNumber)) {
    throw new Error(`Quote number format invalid (${quoteNumber}) ref=${getLastRequestId()}`);
  }
  const sentAgain = await request(
    `/api/pro/businesses/${businessId}/quotes/${quoteId}`,
    { method: 'PATCH', body: { status: 'SENT' } }
  );
  if (!sentAgain.res.ok) throw new Error(`Quote SENT (again) failed (${sentAgain.res.status}) ref=${getLastRequestId()}`);
  const numberAgain =
    (sentAgain.json as { quote?: { number?: string | null } })?.quote?.number ?? null;
  if (numberAgain !== quoteNumber) {
    throw new Error(`Quote number unstable on repeated SENT (${quoteNumber} -> ${numberAgain}) ref=${getLastRequestId()}`);
  }
  const toSigned2 = await request(
    `/api/pro/businesses/${businessId}/quotes/${quoteId}`,
    { method: 'PATCH', body: { status: 'SIGNED' } }
  );
  if (!toSigned2.res.ok) throw new Error(`Quote SIGNED failed (${toSigned2.res.status}) ref=${getLastRequestId()}`);
  const signedNumber =
    (toSigned2.json as { quote?: { number?: string | null } })?.quote?.number ?? null;
  if (signedNumber !== quoteNumber) {
    throw new Error(`Quote number changed after SIGNED (${quoteNumber} -> ${signedNumber}) ref=${getLastRequestId()}`);
  }

  console.log('Verify billing reference…');
  const { res: projectRes, json: projectJson } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}`
  );
  if (!projectRes.ok) throw new Error(`Project fetch failed (${projectRes.status}) ref=${getLastRequestId()}`);
  const billingQuoteId =
    (projectJson as { item?: { billingQuoteId?: string | null } })?.item?.billingQuoteId ?? null;
  if (billingQuoteId !== quoteId) {
    throw new Error(`Expected billingQuoteId=${quoteId}, got ${billingQuoteId ?? 'null'}`);
  }

  const signedAt = new Date().toISOString();
  const signedAtRes = await request(`/api/pro/businesses/${businessId}/quotes/${quoteId}`, {
    method: 'PATCH',
    body: { signedAt },
  });
  if (!signedAtRes.res.ok) throw new Error(`SignedAt update failed (${signedAtRes.res.status}) ref=${getLastRequestId()}`);

  console.log('Signed quote guards…');
  const editSigned = await request(`/api/pro/businesses/${businessId}/quotes/${quoteId}`, {
    method: 'PATCH',
    body: { note: 'Should not be editable when signed' },
    allowError: true,
  });
  if (editSigned.res.status !== 400) {
    throw new Error(`Expected 400 for editing signed quote, got ${editSigned.res.status}`);
  }
  const deleteSigned = await request(`/api/pro/businesses/${businessId}/quotes/${quoteId}`, {
    method: 'DELETE',
    allowError: true,
  });
  if (deleteSigned.res.status !== 400) {
    throw new Error(`Expected 400 for deleting signed quote, got ${deleteSigned.res.status}`);
  }

  console.log('Concurrent SENT on two quotes…');
  async function createDraftQuote(): Promise<string> {
    const { res, json } = await request(
      `/api/pro/businesses/${businessId}/projects/${projectId}/quotes`,
      { method: 'POST' }
    );
    if (!res.ok) throw new Error(`Quote create (concurrency) failed (${res.status}) ref=${getLastRequestId()}`);
    const id = (json as { quote?: { id?: string } })?.quote?.id;
    if (!id) throw new Error('Quote id missing (concurrency).');
    return id;
  }
  const [c1, c2] = await Promise.all([createDraftQuote(), createDraftQuote()]);
  const sentMany = await Promise.all(
    [c1, c2].map((id) =>
      request(`/api/pro/businesses/${businessId}/quotes/${id}`, { method: 'PATCH', body: { status: 'SENT' } })
    )
  );
  const sentNumbers = sentMany.map(
    (r) => (r.json as { quote?: { number?: string | null } })?.quote?.number ?? null
  );
  if (sentNumbers.some((n) => !n || !numberRegex.test(n))) {
    throw new Error(`Concurrent SENT numbers invalid (${sentNumbers.join(',')}) ref=${getLastRequestId()}`);
  }
  if (sentNumbers[0] === sentNumbers[1]) {
    throw new Error(`Concurrent SENT numbers collided (${sentNumbers[0]}) ref=${getLastRequestId()}`);
  }

  console.log('Create invoice from quote…');
  const { res: invRes, json: invJson } = await request(
    `/api/pro/businesses/${businessId}/quotes/${quoteId}/invoices`,
    { method: 'POST' }
  );
  if (!invRes.ok) throw new Error(`Invoice create failed (${invRes.status}) ref=${getLastRequestId()}`);
  const invoice = (invJson as { invoice?: { id?: string; totalCents?: string } })?.invoice;
  if (!invoice?.id) throw new Error('Invoice id missing.');
  const invoiceTotal = toBigInt(invoice.totalCents ?? '0');

  console.log('Cancel signed quote (reason required)…');
  const cancelGuard = await request(`/api/pro/businesses/${businessId}/quotes/${quoteId}`, {
    method: 'PATCH',
    body: { status: 'CANCELLED' },
    allowError: true,
  });
  if (cancelGuard.res.status !== 400) {
    throw new Error(`Expected 400 for cancel without reason, got ${cancelGuard.res.status}`);
  }
  const cancelOk = await request(`/api/pro/businesses/${businessId}/quotes/${quoteId}`, {
    method: 'PATCH',
    body: { status: 'CANCELLED', cancelReason: 'Client a changé de périmètre' },
  });
  if (!cancelOk.res.ok) {
    throw new Error(`Cancel signed quote failed (${cancelOk.res.status}) ref=${getLastRequestId()}`);
  }
  const deleteAfterCancel = await request(`/api/pro/businesses/${businessId}/quotes/${quoteId}`, {
    method: 'DELETE',
    allowError: true,
  });
  if (deleteAfterCancel.res.status !== 400) {
    throw new Error(`Expected 400 for deleting cancelled signed quote, got ${deleteAfterCancel.res.status}`);
  }

  console.log('Create + delete draft invoice…');
  const { res: delQuoteRes, json: delQuoteJson } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/quotes`,
    { method: 'POST' }
  );
  if (!delQuoteRes.ok)
    throw new Error(`Quote create (invoice delete) failed (${delQuoteRes.status}) ref=${getLastRequestId()}`);
  const delQuoteId = (delQuoteJson as { quote?: { id?: string } })?.quote?.id;
  if (!delQuoteId) throw new Error('Quote id missing (invoice delete).');
  const delQuoteSent = await request(
    `/api/pro/businesses/${businessId}/quotes/${delQuoteId}`,
    { method: 'PATCH', body: { status: 'SENT' } }
  );
  if (!delQuoteSent.res.ok)
    throw new Error(`Quote SENT (invoice delete) failed (${delQuoteSent.res.status}) ref=${getLastRequestId()}`);
  const { res: delInvRes, json: delInvJson } = await request(
    `/api/pro/businesses/${businessId}/quotes/${delQuoteId}/invoices`,
    { method: 'POST' }
  );
  if (!delInvRes.ok)
    throw new Error(`Invoice create (delete test) failed (${delInvRes.status}) ref=${getLastRequestId()}`);
  const delInvoiceId = (delInvJson as { invoice?: { id?: string } })?.invoice?.id;
  if (!delInvoiceId) throw new Error('Invoice id missing (delete test).');
  const delInvoice = await request(`/api/pro/businesses/${businessId}/invoices/${delInvoiceId}`, { method: 'DELETE' });
  if (!delInvoice.res.ok)
    throw new Error(`Invoice delete failed (${delInvoice.res.status}) ref=${getLastRequestId()}`);

  console.log('Invoice PDF…');
  const { res: invPdfRes, buf: invPdfBuf } = await requestBinary(
    `/api/pro/businesses/${businessId}/invoices/${invoice.id}/pdf`
  );
  if (!invPdfRes.ok) throw new Error(`Invoice PDF failed (${invPdfRes.status}) ref=${getLastRequestId()}`);
  if (invPdfBuf.byteLength < 1000) throw new Error('Invoice PDF too small.');

  console.log('Mark invoice SENT then PAID…');
  const invSent = await request(
    `/api/pro/businesses/${businessId}/invoices/${invoice.id}`,
    { method: 'PATCH', body: { status: 'SENT' } }
  );
  if (!invSent.res.ok) throw new Error(`Invoice SENT failed (${invSent.res.status}) ref=${getLastRequestId()}`);
  const paidAtGuard = await request(`/api/pro/businesses/${businessId}/invoices/${invoice.id}`, {
    method: 'PATCH',
    body: { paidAt: new Date().toISOString() },
    allowError: true,
  });
  if (paidAtGuard.res.status !== 400) {
    throw new Error(`Expected 400 for paidAt when not PAID, got ${paidAtGuard.res.status}`);
  }
  const invoiceNumber =
    (invSent.json as { invoice?: { number?: string | null } })?.invoice?.number ?? null;
  if (!invoiceNumber || !numberRegex.test(invoiceNumber)) {
    throw new Error(`Invoice number format invalid (${invoiceNumber}) ref=${getLastRequestId()}`);
  }
  const invPaid = await request(
    `/api/pro/businesses/${businessId}/invoices/${invoice.id}`,
    { method: 'PATCH', body: { status: 'PAID' } }
  );
  if (!invPaid.res.ok) throw new Error(`Invoice PAID failed (${invPaid.res.status}) ref=${getLastRequestId()}`);
  const paidAt = new Date().toISOString();
  const paidAtRes = await request(`/api/pro/businesses/${businessId}/invoices/${invoice.id}`, {
    method: 'PATCH',
    body: { paidAt },
  });
  if (!paidAtRes.res.ok) throw new Error(`PaidAt update failed (${paidAtRes.res.status}) ref=${getLastRequestId()}`);
  const paidNumber =
    (invPaid.json as { invoice?: { number?: string | null } })?.invoice?.number ?? null;
  if (paidNumber !== invoiceNumber) {
    throw new Error(`Invoice number changed after PAID (${invoiceNumber} -> ${paidNumber}) ref=${getLastRequestId()}`);
  }

  console.log('Payments aggregation…');
  const { res: paymentsRes, json: paymentsJson } = await request(
    `/api/pro/businesses/${businessId}/payments`
  );
  if (!paymentsRes.ok) throw new Error(`Payments list failed (${paymentsRes.status}) ref=${getLastRequestId()}`);
  const paymentItems =
    (paymentsJson as { items?: Array<{ invoiceId?: string }> })?.items ?? [];
  const paymentMatch = paymentItems.some((item) => item.invoiceId === invoice.id);
  if (!paymentMatch) {
    throw new Error('Paid invoice missing from payments list.');
  }

  console.log('Dashboard (after)…');
  const { res: dashAfterRes, json: dashAfter } = await request(
    `/api/pro/businesses/${businessId}/dashboard`
  );
  if (!dashAfterRes.ok) throw new Error(`Dashboard after failed (${dashAfterRes.status}) ref=${getLastRequestId()}`);
  const afterIncome = BigInt(
    (dashAfter as { kpis?: { mtdIncomeCents?: string } })?.kpis?.mtdIncomeCents ?? '0'
  );

  if (afterIncome - beforeIncome < invoiceTotal) {
    throw new Error(
      `MTD income did not increase enough (before ${beforeIncome}, after ${afterIncome}, invoice ${invoiceTotal}) ref=${getLastRequestId()}`
    );
  }

  console.log('Smoke billing wiring OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
