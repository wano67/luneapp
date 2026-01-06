## Audit Invitations Équipe

- Routes backend existantes :
  - `GET /api/pro/businesses/{businessId}/invites` : retourne les invitations (role, email, status, expiresAt, inviteLink/tokenPreview). Auth: requireAuthPro + requireBusinessRole ADMIN.
  - `POST /api/pro/businesses/{businessId}/invites` : crée/renouvelle une invitation PENDING avec role fourni, token + expiresAt 7 jours. Auth: requireAuthPro + requireBusinessRole ADMIN. Payload attendu `{ email, role }`. Gère déjà les doublons (membre existant => 409).
  - `DELETE /api/pro/businesses/{businessId}/invites/{inviteId}` : révoque (status REVOKED) une invite PENDING.
  - `POST /api/pro/businesses/invites/accept` : accepte une invitation (hash token) et crée la membership avec `invite.role`.

- RBAC helpers :
  - `requireAuthPro`, `requireBusinessRole(businessId, userId, role)` utilisé sur toutes les routes invites (ADMIN).
  - Roles Prisma : `BusinessRole` (OWNER/ADMIN/MEMBER/VIEWER) dans `@/generated/prisma`.

- UI Équipe :
  - Page Team : `src/app/app/pro/[businessId]/settings/team/page.tsx` (client component) liste les membres via `/api/pro/businesses/{businessId}/members`, permet changement de rôle et suppression.
  - Tabs “Paramètres” : `src/app/app/pro/[businessId]/settings/page.tsx` redirige vers cette page pour l’onglet “Équipe”.
- Acceptation :
  - Endpoint `POST /api/pro/businesses/invites/accept` attend `token` dans le body JSON (CSRF protégé).
  - Lien recommandé : `/app/invites/accept?token=...` qui appelle ce POST côté client.
  - BASE_URL peut être utilisé pour construire le lien dans les réponses API, sinon fallback sur l’origine de la requête.

- Composants / patterns :
  - Form helpers : `Button`, `Card`, `Input`, `Select`, `Modal`, `fetchJson`, `getErrorMessage`.
  - Active business role disponible via `useActiveBusiness`.

Décision : Ajouter un bloc “Inviter un collaborateur” (email + rôle ADMIN/MEMBER/VIEWER) sur la page Team, afficher la liste des invitations (statut, email, rôle, dates) avec action “Révoquer” sur PENDING. Côté backend, bloquer l’invitation en rôle OWNER.
