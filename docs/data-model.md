# Data Model (Prisma)

## Tables & relations
- User: `id BigInt pk`, `email unique`, `passwordHash`, `role UserRole (USER/ADMIN)`, `isActive`, timestamps. Relations: ownedBusinesses (Business.ownerId), businessMemberships, personalAccounts/Transactions/Categories.  
- Business: `id`, `name`, `ownerId -> User`, memberships, invites, prospects, clients, projects.  
- BusinessMembership: unique `(businessId,userId)`, role BusinessRole (OWNER/ADMIN/MEMBER/VIEWER).  
- BusinessInvite: businessId -> Business, `email`, role, status (PENDING/ACCEPTED/REVOKED/EXPIRED), `token unique`, expiresAt.  
- Prospect: businessId -> Business (cascade), contact info, source/qualification/pipelineStatus, project idea, budget, dates.  
- Client: businessId -> Business (cascade), contact info, status, budget; index `(businessId,name)`.  
- Project: businessId -> Business, clientId -> Client (nullable), status, dates; index `(businessId,status)`.  
- PersonalAccount: userId -> User (cascade), name/type/currency/iban/institution, `initialCents BigInt`, index `(userId,createdAt)`.  
- PersonalCategory: userId -> User (cascade), unique `(userId,name)`.  
- PersonalTransaction: userId -> User (cascade), accountId -> PersonalAccount (cascade), categoryId -> PersonalCategory (SetNull), type (INCOME/EXPENSE/TRANSFER), `date`, `amountCents BigInt`, currency, label/note; indexes `(userId,date)` et `(accountId,date)`.

## Invariants / règles actuelles
- IDs et montants stockés en BigInt; conversions en string côté API/UI.  
- Montant signe : endpoints transactions et import appliquent signe selon type (EXPENSE -> négatif, INCOME -> positif); validation rejette zero.  
- Devise : champ string libre (default EUR). Pas de conversion multi-devises; agrégations additionnent les devises telles quelles (`/api/personal/summary`, `/accounts`).  
- Dates : stockées en UTC; agrégations mois utilisent début/fin de mois UTC.

## Risques & propositions (money/BigInt)
- Agrégations multi-devises faussées (summary/accounts). Proposition P1: séparer par devise ou convertir via table FX; exposer devise dans KPIs.  
- Absence de vérif signe côté lecture (modification patch/POST contrôlée mais rester vigilants). Ajouter util helpers pour enforce signe et monnaie max length.  
- Parsing import CSV : limite 5000 lignes, 2MB, currency fallback compte; toujours vérifier currency length (actuel ok).  

## Index / migrations sensibles
- Index existants : Client `(businessId,name)`, Project `(businessId,status)`, PersonalAccount `(userId,createdAt)`, PersonalTransaction `(userId,date)` et `(accountId,date)`.  
- Manquants potentiels : BusinessMembership (query par `businessId,userId` déjà unique), BusinessInvite (email/biz for queries), PersonalTransaction filtres par `accountId` + date + type -> index composite `(userId,accountId,date)` possible pour filtres fréquents; prospects search/name/status -> index `(businessId,name)` / `(businessId,pipelineStatus)`.  
- Migrations présentes (2025…) pour schema; client généré dans `src/generated/prisma`.
