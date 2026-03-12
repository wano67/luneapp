# Plan : Wizard création d'entreprise multi-étapes + conformité formes juridiques

## Contexte

Le parcours de création d'entreprise ne respecte pas la réglementation française. Exemples :
- Un micro-entrepreneur peut activer la TVA (interdit)
- Aucune validation des contraintes par forme juridique (associés, capital, régime fiscal)
- Les champs `sector`, `size`, `goal` sont collectés mais jamais stockés
- Le wizard est un formulaire unique en 2 étapes sans adaptation au type d'entreprise
- L'identité complète n'est pas exploitée (devis, taxes, mentions légales)

**Objectif** : Wizard en 4 étapes adaptatif, conforme à chaque forme juridique, avec possibilité de passer les étapes non essentielles et notification pour compléter le profil.

---

## Phase 1 — Enrichir `taxation.ts`

**Fichier** : `src/config/taxation.ts`

### 1A. Étendre `LegalFormConfig`

Ajouter 3 champs au type :
```typescript
vatPolicy: 'FORBIDDEN' | 'OPTIONAL';      // MICRO = FORBIDDEN
capitalMinimumCents: number | null;        // SA = 3_700_000 (37k€)
irOptionYears: number | null;              // SAS/SASU = 5
```

### 1B. Corriger SAS/SASU

- `SAS.allowedTaxRegimes`: `['IS']` → `['IS', 'IR']` (option IR 5 ans max)
- `SASU.allowedTaxRegimes`: `['IS']` → `['IS', 'IR']`

### 1C. Ajouter les nouveaux champs à chaque config

| Forme | vatPolicy | capitalMinimumCents | irOptionYears |
|-------|-----------|-------------------|---------------|
| MICRO | FORBIDDEN | null | null |
| EI | OPTIONAL | null | null |
| EURL | OPTIONAL | null | null |
| SARL | OPTIONAL | null | null |
| SAS | OPTIONAL | null | 5 |
| SASU | OPTIONAL | null | 5 |
| SA | OPTIONAL | 3_700_000 | null |
| SCI | OPTIONAL | null | null |
| SNC | OPTIONAL | null | null |
| OTHER | OPTIONAL | null | null |

### 1D. Ajouter `getLegalFormConstraints(code)`

Retourne un tableau de strings décrivant les contraintes de la forme (TVA, capital, régime, associés, dirigeant).

---

## Phase 2 — Réécrire `CreateBusinessWizard.tsx`

**Fichier** : `src/app/app/pro/components/CreateBusinessWizard.tsx`

### Structure en 4 étapes

| Étape | Titre | Champs | Obligatoire ? |
|-------|-------|--------|--------------|
| 1 | Essentiel | nom *, pays *, forme juridique * | OUI |
| 2 | Activité | type d'activité, code NAF (SearchSelect autocomplete depuis `nafCodes.ts`) | Recommandé — bouton "Passer" |
| 3 | Identité légale | raison sociale, SIRET, TVA intracom (masqué MICRO), adresse | Skippable — bouton "Passer" |
| 4 | Configuration | devise, TVA (verrouillé si MICRO), préfixes factures/devis, résumé | Skippable — "Passer et créer" |

### Composants UI

- **Indicateur de progression** : 4 cercles numérotés avec barre de connexion (actif/fait/à venir)
- **Carte info** : Quand forme juridique sélectionnée → affiche contraintes (pills) via `getLegalFormConstraints()`
- **NAF SearchSelect** : Import `NAF_CODES` depuis `@/config/nafCodes`, items format `code — label`
- **TVA verrouillée** : Si `vatPolicy === 'FORBIDDEN'` → checkbox disabled + message explicatif

### Auto-configuration à la sélection de forme

Quand `legalForm` change → mettre à jour le draft :
- `vatEnabled` = `false` si vatPolicy FORBIDDEN, sinon garder
- `vatRate` = `'0'` si FORBIDDEN, sinon `'20'`

### Nettoyer le type `CreateBusinessDraft`

Supprimer `sector`, `size`, `goal` (jamais stockés en DB).

### Validation

- Étape 1 : `name.trim().length >= 2 && !!countryCode && !!legalForm`
- Étapes 2-4 : pas de champ obligatoire (skip possible)

---

## Phase 3 — Corriger l'API de création

**Fichier** : `src/app/api/pro/businesses/route.ts`

### 3A. Auto-set mentions légales MICRO

```typescript
const legalMentionsText = legalFormRaw === 'MICRO'
  ? 'TVA non applicable, art. 293 B du CGI'
  : undefined;
```

Ajouter dans `settings.create` : `legalMentionsText`.

### 3B. Enforcement config-driven

Remplacer le check hardcodé `legalFormRaw === 'MICRO'` par :
```typescript
const effectiveVatEnabled = legalFormConfig?.vatPolicy === 'FORBIDDEN' ? false : vatEnabled;
const effectiveVatRegime = legalFormConfig?.vatPolicy === 'FORBIDDEN' ? 'FRANCHISE' : vatRegime;
const effectiveVatRate = legalFormConfig?.vatPolicy === 'FORBIDDEN' ? 0 : vatRatePercent;
```

### 3C. Nettoyer ProHomeClient.tsx

Supprimer `sector`, `size`, `goal` du body envoyé à l'API (lignes ~291-293).

---

## Phase 4 — TaxesSection : verrouiller TVA pour MICRO

**Fichier** : `src/app/app/pro/[businessId]/settings/sections/TaxesSection.tsx`

- Récupérer `legalForm` depuis `useActiveBusiness()` (déjà disponible dans le context)
- Si `getLegalFormConfig(legalForm)?.vatPolicy === 'FORBIDDEN'` :
  - Checkbox TVA : disabled + "Non applicable pour les micro-entreprises"
  - Dropdown régime TVA : disabled, forcé à FRANCHISE
  - Masquer le bloc IS (non pertinent pour IR uniquement)
  - Afficher bloc info MICRO : "Regime IR uniquement. Mention obligatoire : TVA non applicable, art. 293 B du CGI"

---

## Phase 5 — Bannière de complétude profil

### 5A. Nouveau fichier : `src/lib/profileCompleteness.ts`

Fonction pure `computeProfileCompleteness(business)` :
- Champs pondérés : nom (20), pays (15), forme juridique (15), SIRET (15), type activité (10), adresse (10), ville (5), code postal (5), NAF (5) = 100%
- Retourne `{ percent, missingFields: string[] }`

### 5B. Bannière dans `ProDashboard.tsx`

**Fichier** : `src/components/pro/ProDashboard.tsx`

- Fetch parallèle de `GET /api/pro/businesses/${businessId}` (profil complet)
- Si `percent < 100` et user admin/owner → afficher bannière :
  - Barre de progression colorée (amber < 80%, green >= 80%)
  - Lien "Compléter" → `/app/pro/${businessId}/settings?section=identite`
  - Liste des champs manquants

---

## Phase 6 — Schema + DB push

**Fichier** : `prisma/schema.prisma`

- Ajouter `PROFILE_INCOMPLETE` à `NotificationType` enum
- `npx prisma db push`

(La logique de notification 24h après création est différée — le type d'enum est prêt pour plus tard.)

---

## Fichiers modifiés

| Fichier | Action |
|---------|--------|
| `src/config/taxation.ts` | Étendre LegalFormConfig, corriger SAS/SASU, ajouter getLegalFormConstraints |
| `src/app/app/pro/components/CreateBusinessWizard.tsx` | Réécriture complète : 4 étapes, skip, NAF autocomplete, auto-config |
| `src/app/api/pro/businesses/route.ts` | Auto-set legalMentionsText MICRO, enforcement config-driven |
| `src/app/app/pro/ProHomeClient.tsx` | Supprimer sector/size/goal du body API |
| `src/app/app/pro/[businessId]/settings/sections/TaxesSection.tsx` | Verrouiller TVA MICRO, masquer IS |
| `src/components/pro/ProDashboard.tsx` | Bannière complétude profil |
| `src/lib/profileCompleteness.ts` | NOUVEAU — calcul complétude |
| `prisma/schema.prisma` | Ajouter PROFILE_INCOMPLETE enum |

## Vérification

1. Créer une micro-entreprise : TVA forcée off, mentions légales auto-remplies, étapes skippables
2. Créer une SAS : TVA activable, régime IS/IR proposé, capital non bloquant
3. Vérifier que TaxesSection est verrouillé pour un business MICRO existant
4. Vérifier la bannière de complétude sur le dashboard (champs manquants listés)
5. `npx tsc --noEmit` + `npx next build` passent
