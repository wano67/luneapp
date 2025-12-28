# Audit Rapide Pages PRO

- `/app/pro/[businessId]` (Dashboard) → OK, chargement via ProDashboard, CTA vers projets/finances existants.
- `/app/pro/[businessId]/agenda` → OK, PageHeaderPro + TabsPills, navigation interne stable.
- `/app/pro/[businessId]/projects` → OK, liste et CTA vers détail projet.
- `/app/pro/[businessId]/projects/[projectId]` → OK, tabs présentes, checklist modals utilisent endpoints clients/dates/services/tâches/équipe/documents.
- `/app/pro/[businessId]/accounting` → OK, tabs internes (écritures, paiements, trésorerie, TVA, prévisions, GL, rapports placeholder), redirect `/finances` → `/accounting`.
- `/app/pro/[businessId]/organization` → OK, placeholders propres.
- `/app/pro/[businessId]/catalog` → OK, ProPageShell, tabs services/produits, grid cliquable, modals create/edit.
- `/app/pro/[businessId]/catalog/services/[serviceId]` → OK, tabs Vue d’ensemble/Étapes/Paramètres, CRUD étapes via `/api/pro/businesses/:bid/services/:sid/templates` (+ PATCH service).
- `/app/pro/[businessId]/catalog/products/[productId]` → OK, tabs Vue d’ensemble/Médias (placeholder)/Paramètres, édition produit via `/api/pro/businesses/:bid/products/:pid`.
- `/app/pro/[businessId]/marketing` → OK, placeholders tabs campagnes/social/interactions.
- `/app/pro/[businessId]/settings` → OK, tabs général/équipe/facturation/intégrations/taxes; général branche BusinessInfoForm + SettingsForm.

Endpoints manquants/proposés :
- Médias produit : prévoir `/api/pro/businesses/:bid/products/:pid/images` (GET/POST/DELETE) pour remplacer le placeholder Médias.
- Automatisation service → projet : prévoir `/api/pro/businesses/:bid/projects/:pid/services/:sid/apply-template` ou équivalent pour générer les tâches.

Notes :
- Sidebar Pro alignée sur routes existantes (Dashboard, Agenda, Projets, Comptabilité, Organisation, Catalogue, Marketing, Réglages).
- `babel-plugin-react-compiler` supprimé du lock; `.npmrc` désactive auto-install-peers pour éviter le loader manquant.
