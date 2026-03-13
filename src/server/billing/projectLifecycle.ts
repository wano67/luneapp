import { Prisma, ProjectStatus, ProjectDepositStatus, ProjectQuoteStatus, InvoiceStatus } from '@/generated/prisma';
import { prisma } from '@/server/db/client';

type TxClient = Prisma.TransactionClient | typeof prisma;

type LifecycleResult = {
  depositBecamePaid: boolean;
  projectBecameActive: boolean;
  projectBecameCompleted: boolean;
};

/**
 * Check whether deposit invoices have been fully paid.
 * If so, mark project.depositStatus = PAID.
 */
async function maybeMarkDepositPaid(
  tx: TxClient,
  projectId: bigint,
  businessId: bigint,
): Promise<boolean> {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: { depositStatus: true, billingQuoteId: true },
  });
  if (!project || project.depositStatus !== ProjectDepositStatus.PENDING) return false;

  // Find deposit invoices for this project (invoices generated from a quote with depositCents > 0)
  const depositInvoices = await tx.invoice.findMany({
    where: {
      projectId,
      businessId,
      depositCents: { gt: 0 },
      status: { not: InvoiceStatus.CANCELLED },
    },
    select: { id: true, totalCents: true },
  });

  if (depositInvoices.length === 0) return false;

  // Sum payments on these deposit invoices
  const invoiceIds = depositInvoices.map((inv) => inv.id);
  const paymentAgg = await tx.payment.aggregate({
    where: { invoiceId: { in: invoiceIds } },
    _sum: { amountCents: true },
  });

  const totalPaid = paymentAgg._sum.amountCents ?? 0n;
  const totalDeposit = depositInvoices.reduce((sum, inv) => sum + inv.totalCents, 0n);

  if (totalPaid < totalDeposit) return false;

  await tx.project.update({
    where: { id: projectId },
    data: { depositStatus: ProjectDepositStatus.PAID, depositPaidAt: new Date() },
  });

  return true;
}

/**
 * If quote is signed AND deposit is paid (or not required),
 * activate the project (PLANNED → ACTIVE).
 */
async function maybeActivateProject(
  tx: TxClient,
  projectId: bigint,
): Promise<boolean> {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: { status: true, quoteStatus: true, depositStatus: true },
  });
  if (!project) return false;
  if (project.status !== ProjectStatus.PLANNED) return false;
  if (project.quoteStatus !== ProjectQuoteStatus.SIGNED) return false;
  if (
    project.depositStatus !== ProjectDepositStatus.PAID &&
    project.depositStatus !== ProjectDepositStatus.NOT_REQUIRED
  ) {
    return false;
  }

  await tx.project.update({
    where: { id: projectId },
    data: { status: ProjectStatus.ACTIVE, startedAt: new Date() },
  });

  return true;
}

/**
 * If all invoices are paid (none DRAFT/SENT) and at least one PAID invoice exists,
 * complete the project (ACTIVE → COMPLETED).
 */
async function maybeCompleteProject(
  tx: TxClient,
  projectId: bigint,
  businessId: bigint,
): Promise<boolean> {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: { status: true },
  });
  if (!project || project.status !== ProjectStatus.ACTIVE) return false;

  const unpaidCount = await tx.invoice.count({
    where: {
      projectId,
      businessId,
      status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.SENT] },
    },
  });
  if (unpaidCount > 0) return false;

  const paidCount = await tx.invoice.count({
    where: {
      projectId,
      businessId,
      status: InvoiceStatus.PAID,
    },
  });
  if (paidCount === 0) return false;

  await tx.project.update({
    where: { id: projectId },
    data: { status: ProjectStatus.COMPLETED },
  });

  return true;
}

/**
 * Master orchestrator — runs all lifecycle checks in sequence.
 */
export async function evaluateProjectLifecycle(
  tx: TxClient,
  projectId: bigint,
  businessId: bigint,
): Promise<LifecycleResult> {
  const depositBecamePaid = await maybeMarkDepositPaid(tx, projectId, businessId);
  const projectBecameActive = await maybeActivateProject(tx, projectId);
  const projectBecameCompleted = await maybeCompleteProject(tx, projectId, businessId);

  return { depositBecamePaid, projectBecameActive, projectBecameCompleted };
}
