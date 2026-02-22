# DB Audit Report

Date: 2026-02-17

## Contexte et périmètre
- Analyse du schéma Prisma (modèles, champs, relations, enums).
- Relevé des usages CRUD/agrégations dans `src/` (scan statique, hors `src/generated`).
- Vérifications DB via Prisma Client + requêtes SQL (comptages, orphelins, enums).

## Notes techniques (connexion DB)
- Prisma Client utilisé: `./src/generated/prisma` (l’import `@prisma/client` échoue car le client est généré dans `src/generated/prisma`).
- Détail échec `@prisma/client`: Cannot find module '.prisma/client/default'
- Audit run set NODE_TLS_REJECT_UNAUTHORIZED=0 and forced SSL rejectUnauthorized=false to bypass self-signed certificate errors. Do not use in production without validation.

## Enums (schéma)
- BusinessInviteStatus: PENDING, ACCEPTED, REVOKED, EXPIRED
- BusinessPermission: TEAM_EDIT, FINANCE_EDIT
- BusinessReferenceType: CATEGORY, TAG, NUMBERING, AUTOMATION
- BusinessRole: OWNER, ADMIN, MEMBER, VIEWER
- ClientStatus: ACTIVE, PAUSED, FORMER
- DocumentKind: FILE, INVOICE, QUOTE
- EmployeeStatus: ACTIVE, INACTIVE
- FinanceType: INCOME, EXPENSE
- InteractionType: CALL, MEETING, EMAIL, NOTE, MESSAGE
- InventoryMovementSource: MANUAL, PURCHASE, SALE
- InventoryMovementType: IN, OUT, ADJUST
- InventoryReservationStatus: ACTIVE, RELEASED, CONSUMED
- InvoiceStatus: DRAFT, SENT, PAID, CANCELLED
- LeadSource: UNKNOWN, OUTBOUND, INBOUND, REFERRAL, OTHER
- LedgerSourceType: INVENTORY_MOVEMENT, INVOICE_STOCK_CONSUMPTION, INVOICE_CASH_SALE
- PersonalAccountType: CURRENT, SAVINGS, INVEST, CASH
- PersonalTransactionType: INCOME, EXPENSE, TRANSFER
- ProcessStatus: ACTIVE, ARCHIVED
- ProductUnit: PIECE, KG, HOUR, LITER, OTHER
- ProjectDepositStatus: NOT_REQUIRED, PENDING, PAID
- ProjectQuoteStatus: DRAFT, SENT, ACCEPTED, SIGNED
- ProjectStatus: PLANNED, ACTIVE, ON_HOLD, COMPLETED, CANCELLED
- ProspectPipelineStatus: NEW, IN_DISCUSSION, OFFER_SENT, FOLLOW_UP, CLOSED
- ProspectStatus: NEW, FOLLOW_UP, WON, LOST
- QualificationLevel: COLD, WARM, HOT
- QuoteStatus: DRAFT, SENT, SIGNED, CANCELLED, EXPIRED
- TaskPhase: CADRAGE, UX, DESIGN, DEV, SEO, LAUNCH, FOLLOW_UP
- TaskStatus: TODO, IN_PROGRESS, DONE
- UserRole: USER, ADMIN

## Modèles (schéma)
### Business
Champs:
- id: BigInt @id @default(autoincrement())
- name: String
- websiteUrl: String?
- legalName: String?
- countryCode: String @default("FR")
- siret: String?
- vatNumber: String?
- addressLine1: String?
- addressLine2: String?
- postalCode: String?
- city: String?
- ownerId: BigInt
- owner: User @relation("BusinessOwner", fields: [ownerId], references: [id]) [relation n:1]
- memberships: BusinessMembership[] [relation 1:n (liste)]
- invites: BusinessInvite[] [relation 1:n (liste)]
- prospects: Prospect[] [relation 1:n (liste)]
- clients: Client[] [relation 1:n (liste)]
- projects: Project[] [relation 1:n (liste)]
- tasks: Task[] [relation 1:n (liste)]
- finances: Finance[] [relation 1:n (liste)]
- services: Service[] [relation 1:n (liste)]
- serviceProcessTemplates: ServiceProcessTemplate[] [relation 1:n (liste)]
- interactions: Interaction[] [relation 1:n (liste)]
- quotes: Quote[] [relation 1:n (liste)]
- invoices: Invoice[] [relation 1:n (liste)]
- documents: BusinessDocument[] [relation 1:n (liste)]
- productImages: ProductImage[] [relation 1:n (liste)]
- references: BusinessReference[] [relation 1:n (liste)]
- processes: Process[] [relation 1:n (liste)]
- settings: BusinessSettings? [relation n:1 (optionnelle)]
- products: Product[] [relation 1:n (liste)]
- inventoryMovements: InventoryMovement[] [relation 1:n (liste)]
- inventoryReservations: InventoryReservation[] [relation 1:n (liste)]
- ledgerEntries: LedgerEntry[] [relation 1:n (liste)]
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt

### BusinessDocument
Champs:
- id: BigInt @id @default(autoincrement())
- businessId: BigInt
- clientId: BigInt?
- title: String
- filename: String
- mimeType: String
- sizeBytes: Int
- storageKey: String @unique
- sha256: String?
- kind: DocumentKind @default(FILE)
- createdByUserId: BigInt
- createdAt: DateTime @default(now())
- business: Business @relation(fields: [businessId], references: [id], onDelete: Cascade) [relation n:1]
- client: Client? @relation(fields: [clientId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- createdBy: User @relation("DocumentCreatedBy", fields: [createdByUserId], references: [id], onDelete: Restrict) [relation n:1]
Attributs de modèle:
- @@index([businessId, clientId, createdAt])
- @@index([businessId, createdAt])

### BusinessInvite
Champs:
- id: BigInt @id @default(autoincrement())
- businessId: BigInt
- email: String
- role: BusinessRole
- status: BusinessInviteStatus @default(PENDING)
- token: String @unique
- expiresAt: DateTime?
- createdAt: DateTime @default(now())
- business: Business @relation(fields: [businessId], references: [id]) [relation n:1]

### BusinessMemberPermission
Champs:
- id: BigInt @id @default(autoincrement())
- membershipId: BigInt
- permission: BusinessPermission
- createdAt: DateTime @default(now())
- membership: BusinessMembership @relation(fields: [membershipId], references: [id], onDelete: Cascade) [relation n:1]
Attributs de modèle:
- @@unique([membershipId, permission])
- @@index([permission])

### BusinessMembership
Champs:
- id: BigInt @id @default(autoincrement())
- businessId: BigInt
- userId: BigInt
- role: BusinessRole
- business: Business @relation(fields: [businessId], references: [id]) [relation n:1]
- user: User @relation(fields: [userId], references: [id]) [relation n:1]
- employeeProfile: EmployeeProfile? [relation n:1 (optionnelle)]
- permissions: BusinessMemberPermission[] [relation 1:n (liste)]
- createdAt: DateTime @default(now())
Attributs de modèle:
- @@unique([businessId, userId])

### BusinessReference
Champs:
- id: BigInt @id @default(autoincrement())
- businessId: BigInt
- type: BusinessReferenceType
- name: String
- value: String?
- isArchived: Boolean @default(false)
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
- business: Business @relation(fields: [businessId], references: [id], onDelete: Cascade) [relation n:1]
- projectCategories: Project[] @relation("ProjectCategoryReference") [relation 1:n (liste)]
- serviceCategories: Service[] @relation("ServiceCategoryReference") [relation 1:n (liste)]
- clientCategories: Client[] @relation("ClientCategoryReference") [relation 1:n (liste)]
- taskCategories: Task[] @relation("TaskCategoryReference") [relation 1:n (liste)]
- financeCategories: Finance[] @relation("FinanceCategoryReference") [relation 1:n (liste)]
- projectTags: ProjectTag[] @relation("ProjectTagReference") [relation 1:n (liste)]
- serviceTags: ServiceTag[] @relation("ServiceTagReference") [relation 1:n (liste)]
- clientTags: ClientTag[] @relation("ClientTagReference") [relation 1:n (liste)]
- taskTags: TaskTag[] @relation("TaskTagReference") [relation 1:n (liste)]
- financeTags: FinanceTag[] @relation("FinanceTagReference") [relation 1:n (liste)]
Attributs de modèle:
- @@unique([businessId, type, name])
- @@index([businessId, type])

### BusinessSettings
Champs:
- id: BigInt @id @default(autoincrement())
- businessId: BigInt @unique
- currency: String @default("EUR")
- invoicePrefix: String @default("INV-")
- quotePrefix: String @default("DEV-")
- nextInvoiceNumber: Int @default(1)
- nextQuoteNumber: Int @default(1)
- defaultDepositPercent: Int @default(30)
- paymentTermsDays: Int @default(30)
- enableAutoNumbering: Boolean @default(true)
- vatRatePercent: Int @default(20)
- vatEnabled: Boolean @default(false)
- allowMembersInvite: Boolean @default(true)
- allowViewerExport: Boolean @default(false)
- integrationStripeEnabled: Boolean @default(false)
- integrationStripePublicKey: String?
- accountInventoryCode: String @default("3700")
- accountCogsCode: String @default("6000")
- accountCashCode: String @default("5300")
- accountRevenueCode: String @default("7000")
- ledgerSalesAccountCode: String @default("706")
- ledgerVatCollectedAccountCode: String @default("44571")
- ledgerCashAccountCode: String @default("512")
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
- business: Business @relation(fields: [businessId], references: [id], onDelete: Cascade) [relation n:1]

### Client
Champs:
- id: BigInt @id @default(autoincrement())
- businessId: BigInt
- categoryReferenceId: BigInt?
- name: String
- websiteUrl: String?
- companyName: String?
- mainContactName: String?
- email: String?
- phone: String?
- address: String?
- sector: String?
- entryDate: DateTime?
- leadSource: LeadSource?
- needsType: String?
- estimatedBudget: Int?
- notes: String?
- status: ClientStatus @default(ACTIVE)
- archivedAt: DateTime?
- anonymizedAt: DateTime?
- anonymizedByUserId: BigInt?
- anonymizationReason: String?
- business: Business @relation(fields: [businessId], references: [id], onDelete: Cascade) [relation n:1]
- categoryReference: BusinessReference? @relation("ClientCategoryReference", fields: [categoryReferenceId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- anonymizedBy: User? @relation("ClientAnonymizedBy", fields: [anonymizedByUserId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- tags: ClientTag[] [relation 1:n (liste)]
- projects: Project[] [relation 1:n (liste)]
- interactions: Interaction[] [relation 1:n (liste)]
- quotes: Quote[] [relation 1:n (liste)]
- invoices: Invoice[] [relation 1:n (liste)]
- documents: BusinessDocument[] [relation 1:n (liste)]
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
Attributs de modèle:
- @@index([businessId, name])
- @@index([businessId, categoryReferenceId])
- @@index([businessId, archivedAt])
- @@index([businessId, anonymizedAt])

### ClientTag
Champs:
- id: BigInt @id @default(autoincrement())
- clientId: BigInt
- referenceId: BigInt
- client: Client @relation(fields: [clientId], references: [id], onDelete: Cascade) [relation n:1]
- reference: BusinessReference @relation("ClientTagReference", fields: [referenceId], references: [id], onDelete: Cascade) [relation n:1]
- createdAt: DateTime @default(now())
Attributs de modèle:
- @@unique([clientId, referenceId])
- @@index([referenceId])

### EmployeeProfile
Champs:
- id: BigInt @id @default(autoincrement())
- membershipId: BigInt @unique
- jobTitle: String?
- contractType: String?
- startDate: DateTime?
- endDate: DateTime?
- weeklyHours: Int?
- hourlyCostCents: BigInt?
- status: EmployeeStatus @default(ACTIVE)
- notes: String?
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
- membership: BusinessMembership @relation(fields: [membershipId], references: [id], onDelete: Cascade) [relation n:1]

### Finance
Champs:
- id: BigInt @id @default(autoincrement())
- businessId: BigInt
- projectId: BigInt?
- categoryReferenceId: BigInt?
- inventoryMovementId: BigInt? @unique
- inventoryProductId: BigInt?
- type: FinanceType
- amountCents: BigInt
- category: String
- date: DateTime
- note: String?
- business: Business @relation(fields: [businessId], references: [id]) [relation n:1]
- project: Project? @relation(fields: [projectId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- categoryReference: BusinessReference? @relation("FinanceCategoryReference", fields: [categoryReferenceId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- inventoryMovement: InventoryMovement? @relation("InventoryMovementFinance", fields: [inventoryMovementId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- inventoryProduct: Product? @relation("ProductFinance", fields: [inventoryProductId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- tags: FinanceTag[] [relation 1:n (liste)]
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
Attributs de modèle:
- @@index([businessId, date])
- @@index([businessId, type])
- @@index([businessId, categoryReferenceId])
- @@index([businessId, inventoryProductId])

### FinanceTag
Champs:
- id: BigInt @id @default(autoincrement())
- financeId: BigInt
- referenceId: BigInt
- finance: Finance @relation(fields: [financeId], references: [id], onDelete: Cascade) [relation n:1]
- reference: BusinessReference @relation("FinanceTagReference", fields: [referenceId], references: [id], onDelete: Cascade) [relation n:1]
- createdAt: DateTime @default(now())
Attributs de modèle:
- @@unique([financeId, referenceId])
- @@index([referenceId])

### Interaction
Champs:
- id: BigInt @id @default(autoincrement())
- businessId: BigInt
- clientId: BigInt?
- projectId: BigInt?
- type: InteractionType
- content: String
- happenedAt: DateTime
- nextActionDate: DateTime?
- createdByUserId: BigInt?
- createdAt: DateTime @default(now())
- business: Business @relation(fields: [businessId], references: [id], onDelete: Cascade) [relation n:1]
- client: Client? @relation(fields: [clientId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- project: Project? @relation(fields: [projectId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- createdBy: User? @relation("InteractionCreatedBy", fields: [createdByUserId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
Attributs de modèle:
- @@index([businessId, clientId])
- @@index([businessId, projectId])

### InventoryMovement
Champs:
- id: BigInt @id @default(autoincrement())
- businessId: BigInt
- productId: BigInt
- type: InventoryMovementType
- source: InventoryMovementSource @default(MANUAL)
- quantity: Int
- unitCostCents: BigInt?
- reason: String?
- date: DateTime
- createdByUserId: BigInt?
- financeEntry: Finance? @relation("InventoryMovementFinance") [relation n:1 (optionnelle)]
- business: Business @relation(fields: [businessId], references: [id], onDelete: Cascade) [relation n:1]
- product: Product @relation(fields: [productId], references: [id], onDelete: Cascade) [relation n:1]
- createdBy: User? @relation(fields: [createdByUserId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
Attributs de modèle:
- @@index([businessId, productId])
- @@index([businessId, date])

### InventoryReservation
Champs:
- id: BigInt @id @default(autoincrement())
- businessId: BigInt
- invoiceId: BigInt @unique
- status: InventoryReservationStatus @default(ACTIVE)
- items: InventoryReservationItem[] [relation 1:n (liste)]
- business: Business @relation(fields: [businessId], references: [id], onDelete: Cascade) [relation n:1]
- invoice: Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade) [relation n:1]
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
Attributs de modèle:
- @@index([businessId, status])

### InventoryReservationItem
Champs:
- id: BigInt @id @default(autoincrement())
- reservationId: BigInt
- productId: BigInt
- quantity: Int
- unitPriceCents: BigInt?
- createdAt: DateTime @default(now())
- reservation: InventoryReservation @relation(fields: [reservationId], references: [id], onDelete: Cascade) [relation n:1]
- product: Product @relation(fields: [productId], references: [id], onDelete: Cascade) [relation n:1]
Attributs de modèle:
- @@index([reservationId])
- @@index([productId])

### Invoice
Champs:
- id: BigInt @id @default(autoincrement())
- businessId: BigInt
- projectId: BigInt
- clientId: BigInt?
- quoteId: BigInt? @unique
- createdByUserId: BigInt
- status: InvoiceStatus @default(DRAFT)
- number: String?
- depositPercent: Int @default(30)
- currency: String @default("EUR")
- totalCents: BigInt
- depositCents: BigInt
- balanceCents: BigInt
- note: String?
- issuedAt: DateTime?
- dueAt: DateTime?
- paidAt: DateTime?
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
- business: Business @relation(fields: [businessId], references: [id], onDelete: Cascade) [relation n:1]
- project: Project @relation(fields: [projectId], references: [id], onDelete: Cascade) [relation n:1]
- client: Client? @relation(fields: [clientId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- quote: Quote? @relation("QuoteInvoice", fields: [quoteId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- createdBy: User @relation("InvoiceCreatedBy", fields: [createdByUserId], references: [id], onDelete: Restrict) [relation n:1]
- items: InvoiceItem[] [relation 1:n (liste)]
- reservation: InventoryReservation? [relation n:1 (optionnelle)]
Attributs de modèle:
- @@unique([businessId, number])

### InvoiceItem
Champs:
- id: BigInt @id @default(autoincrement())
- invoiceId: BigInt
- serviceId: BigInt?
- productId: BigInt?
- label: String
- quantity: Int
- unitPriceCents: BigInt
- totalCents: BigInt
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
- invoice: Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade) [relation n:1]
- service: Service? @relation(fields: [serviceId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- product: Product? @relation(fields: [productId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
Attributs de modèle:
- @@index([productId])

### LedgerEntry
Champs:
- id: BigInt @id @default(autoincrement())
- businessId: BigInt
- date: DateTime
- memo: String?
- sourceType: LedgerSourceType
- sourceId: BigInt?
- createdByUserId: BigInt?
- lines: LedgerLine[] [relation 1:n (liste)]
- business: Business @relation(fields: [businessId], references: [id], onDelete: Cascade) [relation n:1]
- createdBy: User? @relation(fields: [createdByUserId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
Attributs de modèle:
- @@index([businessId, date])
- @@index([sourceType, sourceId])
- @@unique([sourceType, sourceId])

### LedgerLine
Champs:
- id: BigInt @id @default(autoincrement())
- entryId: BigInt
- accountCode: String
- accountName: String?
- debitCents: BigInt?
- creditCents: BigInt?
- metadata: Json?
- entry: LedgerEntry @relation(fields: [entryId], references: [id], onDelete: Cascade) [relation n:1]
- createdAt: DateTime @default(now())
Attributs de modèle:
- @@index([entryId])

### PersonalAccount
Champs:
- id: BigInt @id @default(autoincrement())
- userId: BigInt
- user: User @relation(fields: [userId], references: [id], onDelete: Cascade) [relation n:1]
- name: String
- type: PersonalAccountType @default(CURRENT)
- currency: String @default("EUR")
- institution: String?
- iban: String?
- initialCents: BigInt @default(0)
- transactions: PersonalTransaction[] [relation 1:n (liste)]
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
Attributs de modèle:
- @@index([userId, createdAt])

### PersonalCategory
Champs:
- id: BigInt @id @default(autoincrement())
- userId: BigInt
- user: User @relation(fields: [userId], references: [id], onDelete: Cascade) [relation n:1]
- name: String
- createdAt: DateTime @default(now())
- transactions: PersonalTransaction[] [relation 1:n (liste)]
Attributs de modèle:
- @@unique([userId, name])

### PersonalTransaction
Champs:
- id: BigInt @id @default(autoincrement())
- userId: BigInt
- user: User @relation(fields: [userId], references: [id], onDelete: Cascade) [relation n:1]
- accountId: BigInt
- account: PersonalAccount @relation(fields: [accountId], references: [id], onDelete: Cascade) [relation n:1]
- categoryId: BigInt?
- category: PersonalCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- type: PersonalTransactionType
- date: DateTime
- amountCents: BigInt
- currency: String @default("EUR")
- label: String
- note: String?
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
Attributs de modèle:
- @@index([userId, date])
- @@index([accountId, date])

### Process
Champs:
- id: BigInt @id @default(autoincrement())
- businessId: BigInt
- name: String
- description: String?
- status: ProcessStatus @default(ACTIVE)
- business: Business @relation(fields: [businessId], references: [id], onDelete: Cascade) [relation n:1]
- steps: ProcessStep[] [relation 1:n (liste)]
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
Attributs de modèle:
- @@index([businessId])

### ProcessStep
Champs:
- id: BigInt @id @default(autoincrement())
- processId: BigInt
- title: String
- description: String?
- position: Int
- isDone: Boolean @default(false)
- process: Process @relation(fields: [processId], references: [id], onDelete: Cascade) [relation n:1]
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
Attributs de modèle:
- @@index([processId])

### Product
Champs:
- id: BigInt @id @default(autoincrement())
- businessId: BigInt
- business: Business @relation(fields: [businessId], references: [id], onDelete: Cascade) [relation n:1]
- sku: String
- skuLower: String
- name: String
- description: String?
- unit: ProductUnit @default(PIECE)
- salePriceCents: BigInt?
- purchasePriceCents: BigInt?
- isArchived: Boolean @default(false)
- productImages: ProductImage[] [relation 1:n (liste)]
- movements: InventoryMovement[] [relation 1:n (liste)]
- inventoryFinances: Finance[] @relation("ProductFinance") [relation 1:n (liste)]
- reservationItems: InventoryReservationItem[] [relation 1:n (liste)]
- invoiceItems: InvoiceItem[] [relation 1:n (liste)]
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
Attributs de modèle:
- @@unique([businessId, skuLower])
- @@index([businessId, isArchived])

### ProductImage
Champs:
- id: BigInt @id @default(autoincrement())
- businessId: BigInt
- productId: BigInt
- storageKey: String
- mimeType: String
- alt: String?
- position: Int @default(0)
- createdAt: DateTime @default(now())
- business: Business @relation(fields: [businessId], references: [id], onDelete: Cascade) [relation n:1]
- product: Product @relation(fields: [productId], references: [id], onDelete: Cascade) [relation n:1]
Attributs de modèle:
- @@index([productId])
- @@index([businessId, productId, position])

### Project
Champs:
- id: BigInt @id @default(autoincrement())
- businessId: BigInt
- clientId: BigInt?
- categoryReferenceId: BigInt?
- name: String
- status: ProjectStatus @default(PLANNED)
- quoteStatus: ProjectQuoteStatus @default(DRAFT)
- depositStatus: ProjectDepositStatus @default(PENDING)
- startedAt: DateTime?
- archivedAt: DateTime?
- startDate: DateTime?
- endDate: DateTime?
- business: Business @relation(fields: [businessId], references: [id]) [relation n:1]
- client: Client? @relation(fields: [clientId], references: [id]) [relation n:1 (optionnelle)]
- categoryReference: BusinessReference? @relation("ProjectCategoryReference", fields: [categoryReferenceId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- tasks: Task[] [relation 1:n (liste)]
- finances: Finance[] [relation 1:n (liste)]
- projectServices: ProjectService[] [relation 1:n (liste)]
- interactions: Interaction[] [relation 1:n (liste)]
- tags: ProjectTag[] [relation 1:n (liste)]
- quotes: Quote[] [relation 1:n (liste)]
- invoices: Invoice[] [relation 1:n (liste)]
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
Attributs de modèle:
- @@index([businessId, status])
- @@index([businessId, categoryReferenceId])

### ProjectService
Champs:
- id: BigInt @id @default(autoincrement())
- projectId: BigInt
- serviceId: BigInt
- quantity: Int @default(1)
- priceCents: BigInt?
- notes: String?
- createdAt: DateTime @default(now())
- project: Project @relation(fields: [projectId], references: [id], onDelete: Cascade) [relation n:1]
- service: Service @relation(fields: [serviceId], references: [id], onDelete: Cascade) [relation n:1]
- steps: ProjectServiceStep[] [relation 1:n (liste)]
- tasks: Task[] [relation 1:n (liste)]
Attributs de modèle:
- @@index([projectId, serviceId])

### ProjectServiceStep
Champs:
- id: BigInt @id @default(autoincrement())
- projectServiceId: BigInt
- name: String
- order: Int @default(0)
- phaseName: String?
- isBillableMilestone: Boolean @default(false)
- createdAt: DateTime @default(now())
- projectService: ProjectService @relation(fields: [projectServiceId], references: [id], onDelete: Cascade) [relation n:1]
- tasks: Task[] [relation 1:n (liste)]
Attributs de modèle:
- @@index([projectServiceId])
- @@index([projectServiceId, order])

### ProjectTag
Champs:
- id: BigInt @id @default(autoincrement())
- projectId: BigInt
- referenceId: BigInt
- project: Project @relation(fields: [projectId], references: [id], onDelete: Cascade) [relation n:1]
- reference: BusinessReference @relation("ProjectTagReference", fields: [referenceId], references: [id], onDelete: Cascade) [relation n:1]
- createdAt: DateTime @default(now())
Attributs de modèle:
- @@unique([projectId, referenceId])
- @@index([referenceId])

### Prospect
Champs:
- id: BigInt @id @default(autoincrement())
- businessId: BigInt
- business: Business @relation(fields: [businessId], references: [id], onDelete: Cascade) [relation n:1]
- name: String
- title: String?
- contactName: String?
- contactEmail: String?
- contactPhone: String?
- source: LeadSource?
- interestNote: String?
- qualificationLevel: QualificationLevel?
- projectIdea: String?
- estimatedBudget: Int?
- origin: String?
- probability: Int @default(0)
- nextActionDate: DateTime?
- firstContactAt: DateTime?
- pipelineStatus: ProspectPipelineStatus @default(NEW)
- status: ProspectStatus @default(NEW)
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt

### Quote
Champs:
- id: BigInt @id @default(autoincrement())
- businessId: BigInt
- projectId: BigInt
- clientId: BigInt?
- createdByUserId: BigInt
- status: QuoteStatus @default(DRAFT)
- number: String?
- depositPercent: Int @default(30)
- currency: String @default("EUR")
- totalCents: BigInt
- depositCents: BigInt
- balanceCents: BigInt
- note: String?
- issuedAt: DateTime?
- expiresAt: DateTime?
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
- business: Business @relation(fields: [businessId], references: [id], onDelete: Cascade) [relation n:1]
- project: Project @relation(fields: [projectId], references: [id], onDelete: Cascade) [relation n:1]
- client: Client? @relation(fields: [clientId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- createdBy: User @relation("QuoteCreatedBy", fields: [createdByUserId], references: [id], onDelete: Restrict) [relation n:1]
- items: QuoteItem[] [relation 1:n (liste)]
- invoice: Invoice? @relation("QuoteInvoice") [relation n:1 (optionnelle)]
Attributs de modèle:
- @@unique([businessId, number])

### QuoteItem
Champs:
- id: BigInt @id @default(autoincrement())
- quoteId: BigInt
- serviceId: BigInt?
- label: String
- quantity: Int
- unitPriceCents: BigInt
- totalCents: BigInt
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
- quote: Quote @relation(fields: [quoteId], references: [id], onDelete: Cascade) [relation n:1]
- service: Service? @relation(fields: [serviceId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]

### Service
Champs:
- id: BigInt @id @default(autoincrement())
- businessId: BigInt
- business: Business @relation(fields: [businessId], references: [id], onDelete: Cascade) [relation n:1]
- code: String @unique
- name: String
- categoryReferenceId: BigInt?
- type: String?
- description: String?
- defaultPriceCents: BigInt?
- tjmCents: BigInt?
- durationHours: Int?
- vatRate: Int?
- categoryReference: BusinessReference? @relation("ServiceCategoryReference", fields: [categoryReferenceId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- tags: ServiceTag[] [relation 1:n (liste)]
- taskTemplates: ServiceTaskTemplate[] [relation 1:n (liste)]
- serviceProcessTemplate: ServiceProcessTemplate? [relation n:1 (optionnelle)]
- projectServices: ProjectService[] [relation 1:n (liste)]
- quoteItems: QuoteItem[] [relation 1:n (liste)]
- invoiceItems: InvoiceItem[] [relation 1:n (liste)]
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
Attributs de modèle:
- @@index([businessId, code])
- @@index([businessId, categoryReferenceId])

### ServiceProcessPhaseTemplate
Champs:
- id: BigInt @id @default(autoincrement())
- templateId: BigInt
- name: String
- order: Int @default(0)
- template: ServiceProcessTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade) [relation n:1]
- steps: ServiceProcessStepTemplate[] [relation 1:n (liste)]
Attributs de modèle:
- @@index([templateId])
- @@index([templateId, order])

### ServiceProcessStepTemplate
Champs:
- id: BigInt @id @default(autoincrement())
- phaseId: BigInt
- name: String
- order: Int @default(0)
- isBillableMilestone: Boolean @default(false)
- phase: ServiceProcessPhaseTemplate @relation(fields: [phaseId], references: [id], onDelete: Cascade) [relation n:1]
- tasks: ServiceProcessTaskTemplate[] [relation 1:n (liste)]
Attributs de modèle:
- @@index([phaseId])
- @@index([phaseId, order])

### ServiceProcessTaskTemplate
Champs:
- id: BigInt @id @default(autoincrement())
- stepId: BigInt
- title: String
- order: Int @default(0)
- description: String?
- dueOffsetDays: Int?
- defaultAssigneeRole: String?
- step: ServiceProcessStepTemplate @relation(fields: [stepId], references: [id], onDelete: Cascade) [relation n:1]
Attributs de modèle:
- @@index([stepId])
- @@index([stepId, order])

### ServiceProcessTemplate
Champs:
- id: BigInt @id @default(autoincrement())
- businessId: BigInt
- serviceId: BigInt @unique
- name: String
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
- business: Business @relation(fields: [businessId], references: [id], onDelete: Cascade) [relation n:1]
- service: Service @relation(fields: [serviceId], references: [id], onDelete: Cascade) [relation n:1]
- phases: ServiceProcessPhaseTemplate[] [relation 1:n (liste)]
Attributs de modèle:
- @@index([businessId])

### ServiceTag
Champs:
- id: BigInt @id @default(autoincrement())
- serviceId: BigInt
- referenceId: BigInt
- service: Service @relation(fields: [serviceId], references: [id], onDelete: Cascade) [relation n:1]
- reference: BusinessReference @relation("ServiceTagReference", fields: [referenceId], references: [id], onDelete: Cascade) [relation n:1]
- createdAt: DateTime @default(now())
Attributs de modèle:
- @@unique([serviceId, referenceId])
- @@index([referenceId])

### ServiceTaskTemplate
Champs:
- id: BigInt @id @default(autoincrement())
- serviceId: BigInt
- service: Service @relation(fields: [serviceId], references: [id], onDelete: Cascade) [relation n:1]
- phase: TaskPhase?
- title: String
- defaultAssigneeRole: String?
- defaultDueOffsetDays: Int?
- estimatedMinutes: Int?
- position: Int @default(0)
- tasks: ServiceTemplateTask[] [relation 1:n (liste)]
- createdAt: DateTime @default(now())

### ServiceTemplateTask
Champs:
- id: BigInt @id @default(autoincrement())
- templateId: BigInt
- template: ServiceTaskTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade) [relation n:1]
- title: String
- description: String?
- role: String?
- estimatedMinutes: Int?
- position: Int @default(0)
- createdAt: DateTime @default(now())
Attributs de modèle:
- @@index([templateId])
- @@index([templateId, position])

### Task
Champs:
- id: BigInt @id @default(autoincrement())
- businessId: BigInt
- projectId: BigInt?
- projectServiceId: BigInt?
- projectServiceStepId: BigInt?
- assigneeUserId: BigInt?
- categoryReferenceId: BigInt?
- title: String
- status: TaskStatus @default(TODO)
- dueDate: DateTime?
- phase: TaskPhase?
- progress: Int @default(0)
- completedAt: DateTime?
- notes: String?
- business: Business @relation(fields: [businessId], references: [id]) [relation n:1]
- project: Project? @relation(fields: [projectId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- projectService: ProjectService? @relation(fields: [projectServiceId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- projectServiceStep: ProjectServiceStep? @relation(fields: [projectServiceStepId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- assignee: User? @relation(fields: [assigneeUserId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- categoryReference: BusinessReference? @relation("TaskCategoryReference", fields: [categoryReferenceId], references: [id], onDelete: SetNull) [relation n:1 (optionnelle)]
- tags: TaskTag[] [relation 1:n (liste)]
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
Attributs de modèle:
- @@index([businessId, status])
- @@index([businessId, projectId])
- @@index([projectServiceId])
- @@index([projectServiceStepId])
- @@index([projectId, projectServiceId])
- @@index([businessId, categoryReferenceId])

### TaskTag
Champs:
- id: BigInt @id @default(autoincrement())
- taskId: BigInt
- referenceId: BigInt
- task: Task @relation(fields: [taskId], references: [id], onDelete: Cascade) [relation n:1]
- reference: BusinessReference @relation("TaskTagReference", fields: [referenceId], references: [id], onDelete: Cascade) [relation n:1]
- createdAt: DateTime @default(now())
Attributs de modèle:
- @@unique([taskId, referenceId])
- @@index([referenceId])

### User
Champs:
- id: BigInt @id @default(autoincrement())
- email: String @unique
- passwordHash: String
- name: String?
- role: UserRole @default(USER)
- isActive: Boolean @default(true)
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt
- ownedBusinesses: Business[] @relation("BusinessOwner") [relation 1:n (liste)]
- businessMemberships: BusinessMembership[] [relation 1:n (liste)]
- assignedTasks: Task[] [relation 1:n (liste)]
- quotesCreated: Quote[] @relation("QuoteCreatedBy") [relation 1:n (liste)]
- invoicesCreated: Invoice[] @relation("InvoiceCreatedBy") [relation 1:n (liste)]
- personalAccounts: PersonalAccount[] [relation 1:n (liste)]
- personalTransactions: PersonalTransaction[] [relation 1:n (liste)]
- personalCategories: PersonalCategory[] [relation 1:n (liste)]
- interactionsCreated: Interaction[] @relation("InteractionCreatedBy") [relation 1:n (liste)]
- inventoryMovements: InventoryMovement[] [relation 1:n (liste)]
- ledgerEntriesCreated: LedgerEntry[] [relation 1:n (liste)]
- clientsAnonymized: Client[] @relation("ClientAnonymizedBy") [relation 1:n (liste)]
- documentsCreated: BusinessDocument[] @relation("DocumentCreatedBy") [relation 1:n (liste)]

## Usages des modèles dans le code (`src/`)
### Business
- Opérations: create, delete, findFirst, findUnique, update
- Fonctionnalités (heuristique): API pro/studio, server dev seed
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/clients/[clientId]/route.ts
  - src/app/api/pro/businesses/[businessId]/clients/route.ts
  - src/app/api/pro/businesses/[businessId]/dashboard/route.ts
  - src/app/api/pro/businesses/[businessId]/finances/route.ts
  - src/app/api/pro/businesses/[businessId]/invites/[inviteId]/route.ts
  - src/app/api/pro/businesses/[businessId]/invites/route.ts
  - src/app/api/pro/businesses/[businessId]/leave/route.ts
  - src/app/api/pro/businesses/[businessId]/members/route.ts
  - src/app/api/pro/businesses/[businessId]/processes/route.ts
  - src/app/api/pro/businesses/[businessId]/projects/route.ts
  - src/app/api/pro/businesses/[businessId]/prospects/[prospectId]/route.ts
  - src/app/api/pro/businesses/[businessId]/prospects/route.ts
  - src/app/api/pro/businesses/[businessId]/route.ts
  - src/app/api/pro/businesses/[businessId]/tasks/route.ts
  - src/app/api/pro/businesses/route.ts
  - src/server/dev/seed.ts

### BusinessDocument
- Opérations: create, findFirst, findMany
- Fonctionnalités (heuristique): API pro/studio
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/clients/[clientId]/documents/route.ts
  - src/app/api/pro/businesses/[businessId]/documents/[documentId]/download/route.ts
  - src/app/api/pro/businesses/[businessId]/documents/[documentId]/view/route.ts

### BusinessInvite
- Opérations: create, deleteMany, findFirst, findMany, findUnique, update, updateMany
- Fonctionnalités (heuristique): API pro/studio
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/invites/[inviteId]/route.ts
  - src/app/api/pro/businesses/[businessId]/invites/route.ts
  - src/app/api/pro/businesses/[businessId]/route.ts
  - src/app/api/pro/businesses/invites/accept/route.ts

### BusinessMemberPermission
- Opérations: createMany, deleteMany
- Fonctionnalités (heuristique): API pro/studio
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/members/[userId]/route.ts

### BusinessMembership
- Opérations: create, delete, deleteMany, findMany, findUnique, update, upsert
- Fonctionnalités (heuristique): API pro/studio, server auth, server dev seed
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/invites/route.ts
  - src/app/api/pro/businesses/[businessId]/leave/route.ts
  - src/app/api/pro/businesses/[businessId]/members/[userId]/route.ts
  - src/app/api/pro/businesses/[businessId]/members/route.ts
  - src/app/api/pro/businesses/[businessId]/route.ts
  - src/app/api/pro/businesses/[businessId]/tasks/[taskId]/route.ts
  - src/app/api/pro/businesses/[businessId]/tasks/route.ts
  - src/app/api/pro/businesses/invites/accept/route.ts
  - src/app/api/pro/businesses/route.ts
  - src/app/api/pro/overview/route.ts
  - src/server/auth/businessRole.ts
  - src/server/dev/seed.ts

### BusinessReference
- Opérations: create, delete, findFirst, findMany, update
- Fonctionnalités (heuristique): API pro/studio
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/clients/[clientId]/route.ts
  - src/app/api/pro/businesses/[businessId]/clients/route.ts
  - src/app/api/pro/businesses/[businessId]/finances/[financeId]/route.ts
  - src/app/api/pro/businesses/[businessId]/finances/route.ts
  - src/app/api/pro/businesses/[businessId]/projects/[projectId]/route.ts
  - src/app/api/pro/businesses/[businessId]/projects/route.ts
  - src/app/api/pro/businesses/[businessId]/references/[referenceId]/route.ts
  - src/app/api/pro/businesses/[businessId]/references/route.ts
  - src/app/api/pro/businesses/[businessId]/services/[serviceId]/route.ts
  - src/app/api/pro/businesses/[businessId]/services/import/route.ts
  - src/app/api/pro/businesses/[businessId]/services/route.ts
  - src/app/api/pro/businesses/[businessId]/tasks/[taskId]/route.ts
  - src/app/api/pro/businesses/[businessId]/tasks/route.ts

### BusinessSettings
- Opérations: update, upsert
- Fonctionnalités (heuristique): API pro/studio, server services
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/settings/route.ts
  - src/server/services/ledger.ts
  - src/server/services/numbering.ts

### Client
- Opérations: count, create, deleteMany, findFirst, findMany, update, updateMany
- Fonctionnalités (heuristique): API pro/studio
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/accounting/client/[clientId]/summary/route.ts
  - src/app/api/pro/businesses/[businessId]/clients/[clientId]/documents/route.ts
  - src/app/api/pro/businesses/[businessId]/clients/[clientId]/route.ts
  - src/app/api/pro/businesses/[businessId]/clients/bulk/route.ts
  - src/app/api/pro/businesses/[businessId]/clients/route.ts
  - src/app/api/pro/businesses/[businessId]/dashboard/route.ts
  - src/app/api/pro/businesses/[businessId]/interactions/route.ts
  - src/app/api/pro/businesses/[businessId]/projects/[projectId]/route.ts
  - src/app/api/pro/businesses/[businessId]/projects/route.ts
  - src/app/api/pro/businesses/[businessId]/prospects/[prospectId]/convert/route.ts
  - src/app/api/pro/businesses/[businessId]/route.ts

### ClientTag
- Opérations: aucune opération détectée
- Fonctionnalités (heuristique): aucun tag détecté
- Fichiers: aucun (aucune occurrence Prisma détectée)

### EmployeeProfile
- Opérations: upsert
- Fonctionnalités (heuristique): API pro/studio
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/members/[userId]/route.ts

### Finance
- Opérations: aggregate, create, delete, deleteMany, findFirst, findMany, groupBy, update, upsert
- Fonctionnalités (heuristique): API pro/studio
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/dashboard/route.ts
  - src/app/api/pro/businesses/[businessId]/finances/[financeId]/route.ts
  - src/app/api/pro/businesses/[businessId]/finances/forecasting/route.ts
  - src/app/api/pro/businesses/[businessId]/finances/route.ts
  - src/app/api/pro/businesses/[businessId]/finances/treasury/route.ts
  - src/app/api/pro/businesses/[businessId]/finances/vat/route.ts
  - src/app/api/pro/businesses/[businessId]/invoices/[invoiceId]/route.ts
  - src/app/api/pro/businesses/[businessId]/products/[productId]/movements/[movementId]/route.ts
  - src/app/api/pro/businesses/[businessId]/products/[productId]/movements/route.ts
  - src/app/api/pro/overview/route.ts

### FinanceTag
- Opérations: aucune opération détectée
- Fonctionnalités (heuristique): aucun tag détecté
- Fichiers: aucun (aucune occurrence Prisma détectée)

### Interaction
- Opérations: create, delete, findFirst, findMany, update
- Fonctionnalités (heuristique): API pro/studio
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/dashboard/route.ts
  - src/app/api/pro/businesses/[businessId]/interactions/[interactionId]/route.ts
  - src/app/api/pro/businesses/[businessId]/interactions/route.ts

### InventoryMovement
- Opérations: create, delete, findFirst, findMany, update
- Fonctionnalités (heuristique): API pro/studio, server services
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/products/[productId]/movements/[movementId]/route.ts
  - src/app/api/pro/businesses/[businessId]/products/[productId]/movements/route.ts
  - src/app/api/pro/businesses/[businessId]/products/[productId]/route.ts
  - src/server/services/inventoryReservations.ts
  - src/server/services/ledger.ts

### InventoryReservation
- Opérations: findUnique, update, updateMany, upsert
- Fonctionnalités (heuristique): server services
- Fichiers:
  - src/server/services/inventoryReservations.ts

### InventoryReservationItem
- Opérations: createMany, deleteMany, findMany
- Fonctionnalités (heuristique): API pro/studio, server services
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/inventory/summary/route.ts
  - src/server/services/inventoryReservations.ts

### Invoice
- Opérations: aggregate, create, findFirst, findMany, findUnique, groupBy, update
- Fonctionnalités (heuristique): API pro/studio
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/accounting/client/[clientId]/summary/route.ts
  - src/app/api/pro/businesses/[businessId]/clients/[clientId]/documents/route.ts
  - src/app/api/pro/businesses/[businessId]/clients/bulk/route.ts
  - src/app/api/pro/businesses/[businessId]/invoices/[invoiceId]/pdf/route.ts
  - src/app/api/pro/businesses/[businessId]/invoices/[invoiceId]/route.ts
  - src/app/api/pro/businesses/[businessId]/payments/route.ts
  - src/app/api/pro/businesses/[businessId]/projects/[projectId]/invoices/route.ts
  - src/app/api/pro/businesses/[businessId]/quotes/[quoteId]/invoices/route.ts

### InvoiceItem
- Opérations: findMany, update
- Fonctionnalités (heuristique): API pro/studio
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/invoices/[invoiceId]/route.ts

### LedgerEntry
- Opérations: create, deleteMany, findFirst, findMany, findUnique, upsert
- Fonctionnalités (heuristique): API pro/studio, server services
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/invoices/[invoiceId]/route.ts
  - src/app/api/pro/businesses/[businessId]/ledger/[entryId]/route.ts
  - src/app/api/pro/businesses/[businessId]/ledger/route.ts
  - src/app/api/pro/businesses/[businessId]/products/[productId]/movements/[movementId]/route.ts
  - src/server/services/ledger.ts

### LedgerLine
- Opérations: createMany, deleteMany
- Fonctionnalités (heuristique): server services
- Fichiers:
  - src/server/services/ledger.ts

### PersonalAccount
- Opérations: create, findFirst, findMany
- Fonctionnalités (heuristique): API personal wallet
- Fichiers:
  - src/app/api/personal/accounts/[accountId]/route.ts
  - src/app/api/personal/accounts/route.ts
  - src/app/api/personal/summary/route.ts
  - src/app/api/personal/transactions/[transactionId]/route.ts
  - src/app/api/personal/transactions/import/route.ts
  - src/app/api/personal/transactions/route.ts

### PersonalCategory
- Opérations: create, findFirst, findMany
- Fonctionnalités (heuristique): API personal wallet
- Fichiers:
  - src/app/api/personal/categories/route.ts
  - src/app/api/personal/transactions/import/route.ts
  - src/app/api/personal/transactions/route.ts

### PersonalTransaction
- Opérations: aggregate, create, createMany, deleteMany, findFirst, findMany, groupBy, updateMany
- Fonctionnalités (heuristique): API personal wallet
- Fichiers:
  - src/app/api/personal/accounts/[accountId]/route.ts
  - src/app/api/personal/accounts/route.ts
  - src/app/api/personal/summary/route.ts
  - src/app/api/personal/transactions/[transactionId]/route.ts
  - src/app/api/personal/transactions/bulk-delete/route.ts
  - src/app/api/personal/transactions/import/route.ts
  - src/app/api/personal/transactions/route.ts

### Process
- Opérations: create, delete, findFirst, findMany, update
- Fonctionnalités (heuristique): API pro/studio
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/processes/[processId]/route.ts
  - src/app/api/pro/businesses/[businessId]/processes/[processId]/steps/route.ts
  - src/app/api/pro/businesses/[businessId]/processes/route.ts

### ProcessStep
- Opérations: create, delete, findFirst, update
- Fonctionnalités (heuristique): API pro/studio
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/processes/[processId]/steps/[stepId]/route.ts
  - src/app/api/pro/businesses/[businessId]/processes/[processId]/steps/route.ts

### Product
- Opérations: create, findFirst, findMany, findUnique, update
- Fonctionnalités (heuristique): API pro/studio, server services
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/inventory/summary/route.ts
  - src/app/api/pro/businesses/[businessId]/invoices/[invoiceId]/route.ts
  - src/app/api/pro/businesses/[businessId]/products/[productId]/images/route.ts
  - src/app/api/pro/businesses/[businessId]/products/[productId]/movements/route.ts
  - src/app/api/pro/businesses/[businessId]/products/[productId]/route.ts
  - src/app/api/pro/businesses/[businessId]/products/route.ts
  - src/server/services/ledger.ts

### ProductImage
- Opérations: aggregate, create, delete, findFirst, findMany, update
- Fonctionnalités (heuristique): API pro/studio
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/products/[productId]/images/[imageId]/route.ts
  - src/app/api/pro/businesses/[businessId]/products/[productId]/images/reorder/route.ts
  - src/app/api/pro/businesses/[businessId]/products/[productId]/images/route.ts

### Project
- Opérations: count, create, delete, deleteMany, findFirst, findMany, update
- Fonctionnalités (heuristique): API pro/studio, server services
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/dashboard/route.ts
  - src/app/api/pro/businesses/[businessId]/finances/[financeId]/route.ts
  - src/app/api/pro/businesses/[businessId]/finances/route.ts
  - src/app/api/pro/businesses/[businessId]/interactions/route.ts
  - src/app/api/pro/businesses/[businessId]/projects/[projectId]/archive/route.ts
  - src/app/api/pro/businesses/[businessId]/projects/[projectId]/invoices/route.ts
  - src/app/api/pro/businesses/[businessId]/projects/[projectId]/quotes/route.ts
  - src/app/api/pro/businesses/[businessId]/projects/[projectId]/route.ts
  - src/app/api/pro/businesses/[businessId]/projects/[projectId]/services/route.ts
  - src/app/api/pro/businesses/[businessId]/projects/[projectId]/start/route.ts
  - src/app/api/pro/businesses/[businessId]/projects/[projectId]/unarchive/route.ts
  - src/app/api/pro/businesses/[businessId]/projects/route.ts
  - src/app/api/pro/businesses/[businessId]/prospects/[prospectId]/convert/route.ts
  - src/app/api/pro/businesses/[businessId]/route.ts
  - src/app/api/pro/businesses/[businessId]/tasks/[taskId]/route.ts
  - src/app/api/pro/businesses/[businessId]/tasks/route.ts
  - src/app/api/pro/overview/route.ts
  - src/server/services/pricing.ts

### ProjectService
- Opérations: create, delete, findFirst, findMany, update
- Fonctionnalités (heuristique): API pro/studio, server services
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/projects/[projectId]/services/[itemId]/route.ts
  - src/app/api/pro/businesses/[businessId]/projects/[projectId]/services/route.ts
  - src/app/api/pro/businesses/[businessId]/tasks/[taskId]/route.ts
  - src/server/services/process/applyServiceProcessTemplate.ts

### ProjectServiceStep
- Opérations: count, create
- Fonctionnalités (heuristique): server services
- Fichiers:
  - src/server/services/process/applyServiceProcessTemplate.ts

### ProjectTag
- Opérations: aucune opération détectée
- Fonctionnalités (heuristique): aucun tag détecté
- Fichiers: aucun (aucune occurrence Prisma détectée)

### Prospect
- Opérations: create, deleteMany, findFirst, findMany, update, updateMany
- Fonctionnalités (heuristique): API pro/studio, server dev seed
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/prospects/[prospectId]/convert/route.ts
  - src/app/api/pro/businesses/[businessId]/prospects/[prospectId]/route.ts
  - src/app/api/pro/businesses/[businessId]/prospects/route.ts
  - src/app/api/pro/businesses/[businessId]/route.ts
  - src/server/dev/seed.ts

### Quote
- Opérations: create, findFirst, findMany, groupBy, update
- Fonctionnalités (heuristique): API pro/studio
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/clients/[clientId]/documents/route.ts
  - src/app/api/pro/businesses/[businessId]/clients/bulk/route.ts
  - src/app/api/pro/businesses/[businessId]/projects/[projectId]/quotes/route.ts
  - src/app/api/pro/businesses/[businessId]/quotes/[quoteId]/invoices/route.ts
  - src/app/api/pro/businesses/[businessId]/quotes/[quoteId]/pdf/route.ts
  - src/app/api/pro/businesses/[businessId]/quotes/[quoteId]/route.ts

### QuoteItem
- Opérations: aucune opération détectée
- Fonctionnalités (heuristique): aucun tag détecté
- Fichiers: aucun (aucune occurrence Prisma détectée)

### Service
- Opérations: create, delete, findFirst, findMany, update
- Fonctionnalités (heuristique): API pro/studio, server dev seed
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/projects/[projectId]/services/route.ts
  - src/app/api/pro/businesses/[businessId]/services/[serviceId]/process-template/route.ts
  - src/app/api/pro/businesses/[businessId]/services/[serviceId]/route.ts
  - src/app/api/pro/businesses/[businessId]/services/[serviceId]/templates/route.ts
  - src/app/api/pro/businesses/[businessId]/services/[serviceId]/templates/seed/route.ts
  - src/app/api/pro/businesses/[businessId]/services/import/route.ts
  - src/app/api/pro/businesses/[businessId]/services/route.ts
  - src/server/dev/seed.ts

### ServiceProcessPhaseTemplate
- Opérations: aucune opération détectée
- Fonctionnalités (heuristique): aucun tag détecté
- Fichiers: aucun (aucune occurrence Prisma détectée)

### ServiceProcessStepTemplate
- Opérations: aucune opération détectée
- Fonctionnalités (heuristique): aucun tag détecté
- Fichiers: aucun (aucune occurrence Prisma détectée)

### ServiceProcessTaskTemplate
- Opérations: aucune opération détectée
- Fonctionnalités (heuristique): aucun tag détecté
- Fichiers: aucun (aucune occurrence Prisma détectée)

### ServiceProcessTemplate
- Opérations: create, delete, findFirst
- Fonctionnalités (heuristique): API pro/studio, server services
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/services/[serviceId]/process-template/route.ts
  - src/server/services/process/applyServiceProcessTemplate.ts

### ServiceTag
- Opérations: aucune opération détectée
- Fonctionnalités (heuristique): aucun tag détecté
- Fichiers: aucun (aucune occurrence Prisma détectée)

### ServiceTaskTemplate
- Opérations: create, createMany, delete, findFirst, findMany, update
- Fonctionnalités (heuristique): API pro/studio
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/services/[serviceId]/templates/[templateId]/route.ts
  - src/app/api/pro/businesses/[businessId]/services/[serviceId]/templates/route.ts
  - src/app/api/pro/businesses/[businessId]/services/[serviceId]/templates/seed/route.ts

### ServiceTemplateTask
- Opérations: aucune opération détectée
- Fonctionnalités (heuristique): aucun tag détecté
- Fichiers: aucun (aucune occurrence Prisma détectée)

### Task
- Opérations: count, create, createMany, delete, findFirst, findMany, update
- Fonctionnalités (heuristique): API pro/studio, server services
- Fichiers:
  - src/app/api/pro/businesses/[businessId]/dashboard/route.ts
  - src/app/api/pro/businesses/[businessId]/projects/[projectId]/route.ts
  - src/app/api/pro/businesses/[businessId]/projects/[projectId]/start/route.ts
  - src/app/api/pro/businesses/[businessId]/projects/route.ts
  - src/app/api/pro/businesses/[businessId]/tasks/[taskId]/route.ts
  - src/app/api/pro/businesses/[businessId]/tasks/route.ts
  - src/app/api/pro/overview/route.ts
  - src/server/services/process/applyServiceProcessTemplate.ts

### TaskTag
- Opérations: aucune opération détectée
- Fonctionnalités (heuristique): aucun tag détecté
- Fichiers: aucun (aucune occurrence Prisma détectée)

### User
- Opérations: create, findUnique, update
- Fonctionnalités (heuristique): API auth, API pro/studio, server auth, server dev seed
- Fichiers:
  - src/app/api/account/password/route.ts
  - src/app/api/account/profile/route.ts
  - src/app/api/auth/me/route.ts
  - src/app/api/pro/businesses/[businessId]/invites/route.ts
  - src/app/api/pro/businesses/invites/accept/route.ts
  - src/server/auth/auth.service.ts
  - src/server/auth/requireAuthBase.ts
  - src/server/dev/seed.ts

## Vérifications base de données
### Comptage par modèle
- Business: 2
- BusinessDocument: 1
- BusinessInvite: 1
- BusinessMemberPermission: 0
- BusinessMembership: 3
- BusinessReference: 0
- BusinessSettings: 2
- Client: 6
- ClientTag: 0
- EmployeeProfile: 0
- Finance: 0
- FinanceTag: 0
- Interaction: 0
- InventoryMovement: 0
- InventoryReservation: 0
- InventoryReservationItem: 0
- Invoice: 0
- InvoiceItem: 0
- LedgerEntry: 0
- LedgerLine: 0
- PersonalAccount: 0
- PersonalCategory: 0
- PersonalTransaction: 0
- Process: 0
- ProcessStep: 0
- Product: 0
- ProductImage: 0
- Project: 6
- ProjectService: 3
- ProjectServiceStep: 0
- ProjectTag: 0
- Prospect: 2
- Quote: 1
- QuoteItem: 1
- Service: 16
- ServiceProcessPhaseTemplate: 0
- ServiceProcessStepTemplate: 0
- ServiceProcessTaskTemplate: 0
- ServiceProcessTemplate: 0
- ServiceTag: 0
- ServiceTaskTemplate: 0
- ServiceTemplateTask: 0
- Task: 0
- TaskTag: 0
- User: 3

### Orphelins (FK non nulles sans cible)
- Aucun orphelin détecté (tous les comptages à 0).

### Nullité des clés étrangères (colonne *_Id IS NULL)
- Client.anonymizedByUserId: 6 (optionnel)
- Client.categoryReferenceId: 6 (optionnel)
- Project.categoryReferenceId: 6 (optionnel)
- Service.categoryReferenceId: 16 (optionnel)

### Valeurs d’enums observées en base
- BusinessDocument.kind (DocumentKind): FILE
- BusinessInvite.role (BusinessRole): MEMBER
- BusinessInvite.status (BusinessInviteStatus): ACCEPTED
- BusinessMemberPermission.permission (BusinessPermission): (aucune valeur)
- BusinessMembership.role (BusinessRole): OWNER, MEMBER
- BusinessReference.type (BusinessReferenceType): (aucune valeur)
- Client.leadSource (LeadSource): (aucune valeur)
- Client.status (ClientStatus): ACTIVE
- EmployeeProfile.status (EmployeeStatus): (aucune valeur)
- Finance.type (FinanceType): (aucune valeur)
- Interaction.type (InteractionType): (aucune valeur)
- InventoryMovement.source (InventoryMovementSource): (aucune valeur)
- InventoryMovement.type (InventoryMovementType): (aucune valeur)
- InventoryReservation.status (InventoryReservationStatus): (aucune valeur)
- Invoice.status (InvoiceStatus): (aucune valeur)
- LedgerEntry.sourceType (LedgerSourceType): (aucune valeur)
- PersonalAccount.type (PersonalAccountType): (aucune valeur)
- PersonalTransaction.type (PersonalTransactionType): (aucune valeur)
- Process.status (ProcessStatus): (aucune valeur)
- Product.unit (ProductUnit): (aucune valeur)
- Project.depositStatus (ProjectDepositStatus): PENDING
- Project.quoteStatus (ProjectQuoteStatus): DRAFT
- Project.status (ProjectStatus): PLANNED, ACTIVE
- Prospect.pipelineStatus (ProspectPipelineStatus): NEW, IN_DISCUSSION
- Prospect.qualificationLevel (QualificationLevel): (aucune valeur)
- Prospect.source (LeadSource): (aucune valeur)
- Prospect.status (ProspectStatus): NEW
- Quote.status (QuoteStatus): DRAFT
- ServiceTaskTemplate.phase (TaskPhase): (aucune valeur)
- Task.phase (TaskPhase): (aucune valeur)
- Task.status (TaskStatus): (aucune valeur)
- User.role (UserRole): USER

## Incohérences et points d’amélioration
- Modèles non détectés dans `src/` (scan Prisma): ProjectTag, ServiceTag, ServiceTemplateTask, ServiceProcessPhaseTemplate, ServiceProcessStepTemplate, ServiceProcessTaskTemplate, ClientTag, TaskTag, FinanceTag, QuoteItem
- Aucun croisement évident “perso/pro” détecté dans les usages (heuristique).
- Validations possibles à renforcer:
  - `PersonalTransaction.amountCents` et `Finance.amountCents` acceptent des montants négatifs via parsing (aucune contrainte de signe visible).
  - `PersonalTransaction.currency` est validé uniquement par longueur (pas de contrôle ISO 4217).
  - `Finance.note` sert parfois de stockage JSON (métadonnées), ce qui mélange note libre et structure; envisager un champ JSON dédié si usage intensif.

## Recommandations
- Ajouter une validation de signe sur les montants (et cohérence avec `type` INCOME/EXPENSE/TRANSFER).
- Normaliser/valider les devises (ISO 4217) côté API.
- Si les métadonnées de finance doivent être requêtables: créer un champ JSON dédié plutôt que surcharger `note`.
- Sécuriser la connexion DB en fournissant une chaîne SSL valide (CA) plutôt que `NODE_TLS_REJECT_UNAUTHORIZED=0`.
