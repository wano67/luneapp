import { prisma } from '@/server/db/client';
import { decrypt } from '@/server/crypto/encryption';
import { POWENS_CATEGORY_MAP } from '@/config/powensCategories';
import {
  powensFetchAccounts,
  powensFetchTransactions,
  powensGetConnections,
  mapPowensAccountType,
  powensValueToCents,
  type PowensAccount,
  type PowensTransaction,
} from '@/server/services/powens';

export interface SyncResult {
  accountsSynced: number;
  transactionsAdded: number;
}

/**
 * Synchronise les comptes et transactions Powens pour un utilisateur.
 * Idempotent : les transactions existantes (par powensTransactionId) sont ignorées.
 */
export async function syncPowensData(userId: bigint): Promise<SyncResult> {
  // 1. Récupérer la connexion Powens
  const conn = await prisma.powensConnection.findUnique({ where: { userId } });
  if (!conn) throw new Error('Aucune connexion Powens');

  // 2. Décrypter le token
  const authToken = decrypt(conn.authTokenCipher, conn.authTokenIv, conn.authTokenTag);

  // 3. Récupérer les connexions pour obtenir le nom de la banque
  const connections = await powensGetConnections(authToken);
  // Map connectionId → nom du connecteur (banque)
  const connectorNames = new Map<number, string>();
  for (const c of connections) {
    if (c.connector?.name) connectorNames.set(c.id, c.connector.name);
  }

  // 4. Synchroniser les comptes (retourne le mapping powensAccountId → balanceCents)
  const powensAccounts = await powensFetchAccounts(authToken);
  const { synced: accountsSynced, balanceMap } = await syncAccounts(userId, powensAccounts, connectorNames);

  // 5. Synchroniser les transactions
  const transactionsAdded = await syncTransactions(userId, authToken, balanceMap);

  // 6. Mettre à jour lastSyncAt
  await prisma.powensConnection.update({
    where: { userId },
    data: { lastSyncAt: new Date() },
  });

  return { accountsSynced, transactionsAdded };
}

// ─── Comptes ────────────────────────────────────────────────

async function syncAccounts(
  userId: bigint,
  powensAccounts: PowensAccount[],
  connectorNames: Map<number, string>,
): Promise<{ synced: number; balanceMap: Map<number, bigint> }> {
  let synced = 0;
  // Mapping powensAccountId → solde Powens en cents (pour ajuster initialCents après import tx)
  const balanceMap = new Map<number, bigint>();

  for (const pa of powensAccounts) {
    if (pa.disabled) continue;

    const existing = await prisma.personalAccount.findUnique({
      where: { powensAccountId: pa.id },
    });

    // Nom de la banque : company_name > connector.name > "Banque"
    const bankName = pa.company_name
      || connectorNames.get(pa.id_connection)
      || 'Banque';
    const currency = pa.currency?.id || 'EUR';
    const accountType = mapPowensAccountType(pa.type);
    const isLoan = accountType === 'LOAN';

    // Pour les prêts, stocker le principal (valeur absolue du solde)
    const loanPrincipalCents = isLoan ? powensValueToCents(Math.abs(pa.balance)) : null;
    // Pour les comptes normaux, le solde Powens servira de base via initialCents
    const balanceCents = powensValueToCents(pa.balance);

    // Stocker le solde Powens pour ajuster initialCents après import tx
    if (!isLoan) {
      balanceMap.set(pa.id, balanceCents);
    }

    if (existing) {
      await prisma.personalAccount.update({
        where: { id: existing.id },
        data: {
          name: pa.name,
          institution: bankName,
          iban: pa.iban || existing.iban,
          powensLastSync: new Date(),
          powensDisabled: false,
          ...(isLoan ? { loanPrincipalCents } : {}),
        },
      });
    } else {
      await prisma.personalAccount.create({
        data: {
          userId,
          name: pa.name,
          type: accountType,
          currency,
          institution: bankName,
          iban: pa.iban,
          initialCents: isLoan ? 0n : balanceCents,
          powensAccountId: pa.id,
          powensLastSync: new Date(),
          ...(isLoan ? { loanPrincipalCents } : {}),
        },
      });
    }
    synced++;
  }

  return { synced, balanceMap };
}

// ─── Transactions ───────────────────────────────────────────

async function syncTransactions(userId: bigint, authToken: string, powensBalanceMap: Map<number, bigint>): Promise<number> {
  // Récupérer le mapping des comptes Powens → comptes locaux
  const localAccounts = await prisma.personalAccount.findMany({
    where: { userId, powensAccountId: { not: null } },
    select: { id: true, powensAccountId: true },
  });

  const accountMap = new Map<number, bigint>();
  for (const la of localAccounts) {
    if (la.powensAccountId !== null) {
      accountMap.set(la.powensAccountId, la.id);
    }
  }

  if (accountMap.size === 0) return 0;

  // Préparer le cache de catégories
  const categoryCache = new Map<string, bigint>();
  const existingCats = await prisma.personalCategory.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  for (const c of existingCats) {
    categoryCache.set(c.name.toLowerCase(), c.id);
  }

  let totalAdded = 0;
  let offset = 0;
  const PAGE_SIZE = 1000;

  // Pagination
  while (true) {
    const { transactions, total } = await powensFetchTransactions(authToken, {
      offset,
      limit: PAGE_SIZE,
    });

    if (transactions.length === 0) break;

    const txData = await buildTransactionData(
      userId,
      transactions,
      accountMap,
      categoryCache,
    );

    if (txData.length > 0) {
      const result = await prisma.personalTransaction.createMany({
        data: txData,
        skipDuplicates: true,
      });
      totalAdded += result.count;
    }

    offset += transactions.length;
    if (offset >= total) break;
  }

  // Ajuster initialCents pour que balance affichée = solde Powens réel
  await adjustInitialBalances(userId, accountMap, powensBalanceMap);

  return totalAdded;
}

async function buildTransactionData(
  userId: bigint,
  transactions: PowensTransaction[],
  accountMap: Map<number, bigint>,
  categoryCache: Map<string, bigint>,
) {
  const data: Array<{
    userId: bigint;
    accountId: bigint;
    categoryId: bigint | null;
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    date: Date;
    amountCents: bigint;
    currency: string;
    label: string;
    powensTransactionId: number;
  }> = [];

  for (const tx of transactions) {
    // Ignorer les opérations à venir
    if (tx.coming) continue;

    const accountId = accountMap.get(tx.id_account);
    if (!accountId) continue;

    const amountCents = powensValueToCents(tx.value);
    const type = tx.value >= 0 ? 'INCOME' : 'EXPENSE';
    const label = tx.simplified_wording || tx.original_wording || 'Transaction';

    // Résoudre la catégorie
    let categoryId: bigint | null = null;
    if (tx.id_category) {
      categoryId = await resolveCategory(userId, tx.id_category, categoryCache);
    }

    data.push({
      userId,
      accountId,
      categoryId,
      type,
      date: new Date(tx.date),
      amountCents,
      currency: 'EUR',
      label,
      powensTransactionId: tx.id,
    });
  }

  return data;
}

async function resolveCategory(
  userId: bigint,
  powensCategoryId: number,
  cache: Map<string, bigint>,
): Promise<bigint | null> {
  const name = POWENS_CATEGORY_MAP[powensCategoryId];
  if (!name) return null;

  const key = name.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  // Find-or-create
  const cat = await prisma.personalCategory.upsert({
    where: { userId_name: { userId, name } },
    create: { userId, name },
    update: {},
    select: { id: true },
  });

  cache.set(key, cat.id);
  return cat.id;
}

/**
 * Ajuste `initialCents` pour que balance affichée = solde Powens réel.
 *
 * Le solde affiché est calculé comme : initialCents + SUM(amountCents).
 * Powens ne retourne pas forcément l'historique complet des transactions,
 * donc on recale initialCents à chaque sync :
 *   initialCents = solde_Powens - SUM(transactions importées)
 */
async function adjustInitialBalances(
  userId: bigint,
  accountMap: Map<number, bigint>,
  powensBalanceMap: Map<number, bigint>,
) {
  const localAccounts = await prisma.personalAccount.findMany({
    where: { userId, powensAccountId: { not: null } },
    select: { id: true, powensAccountId: true, initialCents: true },
  });

  for (const la of localAccounts) {
    if (la.powensAccountId === null) continue;

    const powensBalance = powensBalanceMap.get(la.powensAccountId);
    if (powensBalance === undefined) continue;

    // Somme de toutes les transactions importées pour ce compte
    const agg = await prisma.personalTransaction.aggregate({
      where: { accountId: la.id },
      _sum: { amountCents: true },
    });
    const txSum = agg._sum.amountCents ?? 0n;

    // initialCents = solde Powens - somme des transactions
    // Ainsi balance affichée = initialCents + txSum = solde Powens
    const newInitialCents = powensBalance - txSum;

    if (newInitialCents !== la.initialCents) {
      await prisma.personalAccount.update({
        where: { id: la.id },
        data: { initialCents: newInitialCents },
      });
    }
  }
}
