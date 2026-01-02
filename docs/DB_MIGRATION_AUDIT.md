## État actuel DB
- Source: `DB_INSPECT_INSECURE_TLS=1 pnpm -s db:inspect` (Railway, self-signed TLS toléré via env).
- Base détectée: `railway`, schéma `public`.
- Migrations appliquées (haut de pile): `20250310120000_fix_schema_drift`, `20251229190452_fix_missing_business_document`, `20251226000000_business_onboarding`, …, `20240502120000_add_business_document`.
- Inventaire tables (public, extrait): Business, BusinessDocument, BusinessInvite, BusinessMemberPermission, BusinessMembership, BusinessReference, BusinessSettings, Client, ClientTag, EmployeeProfile, Finance, FinanceTag, Interaction, InventoryMovement, InventoryReservation, InventoryReservationItem, Invoice, InvoiceItem, LedgerEntry, LedgerLine, PersonalAccount, PersonalCategory, PersonalTransaction, Process, ProcessStep, Product, ProductImage, Project, ProjectService, ProjectServiceStep, ProjectTag, Prospect, Quote, QuoteItem, Service, ServiceProcess* tables, ServiceTag, ServiceTaskTemplate, ServiceTemplateTask, Task, TaskTag, User, _prisma_migrations.
- Sanity check `DB_INSPECT_INSECURE_TLS=1 pnpm -s db:smoke`: ok (`Business.legalName` présent, business sample id=1).

## Drift détecté (avant correction)
- Prisma models affectés en prod: `BusinessDocument` (P2021 risque table absente), `ProductImage` (table absente), `ServiceTemplateTask` (table absente), `ServiceTaskTemplate` (colonnes `estimatedMinutes`, `position` manquantes → P2022 possibles).
- Relevés manuels:
  - Avant migration corrective: `ProductImage` absente, `ServiceTemplateTask` absente, `ServiceTaskTemplate` sans `estimatedMinutes`/`position`, `BusinessDocument` sans precision/fks complètes → erreurs P2021/P2022 possibles.
  - Après migration corrective (état actuel DB Inspect):
    - `ProductImage` présent.
    - `ServiceTemplateTask` présent.
    - `ServiceTaskTemplate`: colonnes `estimatedMinutes` (nullable) et `position` (NOT NULL default 0) présentes.
    - `BusinessDocument`: `createdAt` en `timestamp(3)`, `storageKey` unique, FKs (businessId cascade, clientId set null, createdByUserId restrict) présents.
- `pnpm prisma migrate diff --from-schema prisma/schema.prisma --to-config-datasource --script` → vide (drift résorbé par la migration idempotente ajoutée).

## Ce que la migration va faire (idempotent)
Fichier: `prisma/migrations/20250310120000_fix_schema_drift/migration.sql`
- Crée `BusinessDocument` si absente; ajoute toutes les colonnes attendues si manquantes; force `createdAt` en `timestamp(3)` + défaut `CURRENT_TIMESTAMP`; rétablit l’unicité sur `storageKey`; remet les FKs (`businessId` → Business cascade, `clientId` → Client set null, `createdByUserId` → User restrict) et recrée les index business/client/date avec renommage conditionnel.
- Ajoute sur `ServiceTaskTemplate` les colonnes `estimatedMinutes` et `position` (avec défaut 0 et NOT NULL).
- Crée `ProductImage` si absente, avec index et FKs vers Business/Product (cascade) et position par défaut 0.
- Crée `ServiceTemplateTask` si absente, avec index et FK vers `ServiceTaskTemplate` (cascade).
- Tous les statements sont protégés (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, drops/renames sous guards) pour être rejouables sans casser une DB partiellement corrigée.

## Comment valider
1) Avant migration (prod/Railway) : `DB_INSPECT_INSECURE_TLS=1 pnpm -s db:inspect` et `DB_INSPECT_INSECURE_TLS=1 pnpm -s db:smoke` (attendre warning TLS, ok).  
2) Appliquer : `pnpm -s db:migrate` (avec `DATABASE_URL` pointant sur Railway).  
3) Après : `DB_INSPECT_INSECURE_TLS=1 pnpm -s db:inspect` doit montrer `20250310120000_fix_schema_drift` appliquée; vérifier manuellement que `ProductImage` et `ServiceTemplateTask` existent et que `ServiceTaskTemplate.position/estimatedMinutes` sont là si nécessaire.  
4) App côté Next : `pnpm -s lint && pnpm -s typecheck && pnpm -s build`.

## Risques & rollback
- Migration uniquement additive (créations/alter add, index/FK rétablissement). Pas de drop de colonnes/données → faible risque de perte.  
- Risque principal: si la DB cible n’a pas les types/enum `DocumentKind`, exécution échouera; dans ce cas, créer l’enum d’abord ou réappliquer une migration manquante.  
- Rollback minimal: si problème, supprimer les tables nouvellement créées (`ProductImage`, `ServiceTemplateTask`, `BusinessDocument` si créées) et restaurer FKs/index, ou restaurer depuis backup Railway avant migration.

## Commandes à exécuter
- Local (validation code) :  
  `pnpm -s lint && pnpm -s typecheck && pnpm -s build`
- Audit DB avant/après (Railway, self-signed) :  
  `DB_INSPECT_INSECURE_TLS=1 pnpm -s db:inspect`  
  `DB_INSPECT_INSECURE_TLS=1 pnpm -s db:smoke`
- Appliquer migration sur Railway :  
  `DATABASE_URL="postgres://..." pnpm -s db:migrate`
- Vérifier le drift Prisma (optionnel) :  
  `DATABASE_URL="postgres://..." pnpm prisma migrate diff --from-schema prisma/schema.prisma --to-config-datasource --script`
