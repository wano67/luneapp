# Catalogue – Médias produit

## Modèle
- `ProductImage`: `id`, `businessId`, `productId`, `storageKey`, `mimeType`, `alt?`, `position` (int), `createdAt`.
- Sécurité : vérification businessId/productId sur chaque accès.

## Endpoints
- `GET /api/pro/businesses/:bid/products/:pid/images`
  - Retour `{ items: [{id,url,alt,position,mimeType,createdAt}] }`, tri par `position`, `createdAt`.
- `POST /api/pro/businesses/:bid/products/:pid/images` (multipart)
  - Champs: `file` (png/jpg/webp, max 5MB), `alt?`.
  - Stockage local via `saveLocalFile` (uploads/<business>/<product>…), position auto `max+1`.
- `GET /api/pro/businesses/:bid/products/:pid/images/:imageId`
  - Sert le binaire avec le mime stocké.
- `DELETE /api/pro/businesses/:bid/products/:pid/images/:imageId`
  - Supprime DB + fichier.
- `PATCH /api/pro/businesses/:bid/products/:pid/images/:imageId`
  - Payload: `{ alt?: string, position?: number }`.
- `PATCH /api/pro/businesses/:bid/products/:pid/images/reorder`
  - Payload: `{ orderedIds: string[] }` pour réordonner les positions.

## Front (ProductDetailPage)
- Galerie : prévisualisation large + miniatures (sélection, montée/descente, suppression).
- Upload via input file (`data-testid="product-upload"`), rafraîchit la liste.
- Infos produit: description, SKU, statut, prix, coût, marge (affichés dans KPIs + fiche).
- Bloc “À compléter” si description/cost/photos manquants.
