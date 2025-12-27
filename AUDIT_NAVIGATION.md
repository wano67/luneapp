# Audit Navigation & CTA (PRO refonte)

## Pages vérifiées
- `/app/pro/[businessId]` Dashboard
- `/app/pro/[businessId]/agenda`
- `/app/pro/[businessId]/projects`
- `/app/pro/[businessId]/projects/[projectId]`
- `/app/pro/[businessId]/catalog`
- `/app/pro/[businessId]/catalog/services/[serviceId]`
- `/app/pro/[businessId]/catalog/products/[productId]`

## Synthèse
- Headers alignés (retour + CTA principal) sur dashboard, projets liste/détail, catalogue et pages détail catalogue.
- Sidebar Pro inclut désormais “Catalogue” (route existante).
- CTAs checklist projet ouvrent des modals actionnables (client/date/services/tâches/invite/document) et refetch sur succès.
- Catalogue : boutons Voir/Modifier pointent vers détails ou modal d’édition (query `tab`, `editService/editProduct`).

## Détails par page (CTA vérifiés)
| Page | Bouton/CTA | Destination/Action | Statut | Correction appliquée |
| --- | --- | --- | --- | --- |
| Dashboard `/app/pro/[biz]` | Header menu Projets/Clients/Finances/Catalogue, QuickLinks | Routes dédiées existantes | OK | Catalogue ajouté au menu. |
| Agenda | Retour Dashboard, Tabs Clients/Prospects, “Ajouter contact/prospect” (modal) | Charges listes via API clients/prospects, modals internes | OK | Aucun lien générique. |
| Projets liste | Retour Dashboard, “Nouveau projet”, click carte -> détail | `/app/pro/[biz]`, `/projects/new`, `/projects/[id]` | OK | Tabs En cours/Terminés ok. |
| Projet détail | Retour projets, Modifier, Tabs Vue d’ensemble/Travail/Équipe/Facturation/Documents, Checklist (associer client/date/services/tâches/membre/doc) | Boutons ouvrent modals, appellent PATCH projet, POST services, PATCH tasks, POST invites, POST documents | OK | Checklist refetch après succès; aucune redirection générique. |
| Catalogue liste | Retour Dashboard, CTA Nouveau (modal selon tab), Cartes Voir/Modifier | `/catalog`, modals create/edit, `/catalog/services/[id]`, `/catalog/products/[id]` | OK | Queries `tab`+`editService/ editProduct` gérées. |
| Détail service | Retour Catalogue, Modifier | `/catalog?tab=services&editService=id` | OK | Header aligné, infos facturation visibles. |
| Détail produit | Retour Catalogue, Modifier | `/catalog?tab=products&editProduct=id` | OK | Prix/sku/unité visibles. |

## Endpoints utilisés (vérifiés)
- Services : `GET/POST /api/pro/businesses/{biz}/services`, `GET/PATCH /services/{serviceId}`
- Produits : `GET/POST /api/pro/businesses/{biz}/products`, `GET/PATCH /products/{productId}`
- Projet checklist : `PATCH /projects/{projectId}`, `POST /projects/{projectId}/services`, `GET/PATCH /tasks`, `POST /invites`, `GET /members`, `GET /clients`, `POST /clients/{clientId}/documents`

## Actions correctives appliquées
- Suppression de la dépendance `babel-plugin-react-compiler` pour éviter le loader manquant “next-flight-client-entry-loader”.
- Sidebar Pro : ajout entrée Catalogue (route `/app/pro/[biz]/catalog`).
- Catalogue : liens Modifier redirigent vers tab adéquat via query, modals create/edit réutilisent fetchJson, billingType/recur UI conservée mais payload optionnel.
- Pages détail service/produit : headers cohérents, infos facturation/sku visibles.
