export function computeOutstanding(invoicedCents: number, paidCents: number) {
  const invoiced = Number.isFinite(invoicedCents) ? invoicedCents : 0;
  const paid = Number.isFinite(paidCents) ? paidCents : 0;
  return Math.max(invoiced - paid, 0);
}
