# Feuille de route - Ameliorations Wallet Personnel

Cette feuille de route centralise toutes les ameliorations prevues pour la section Wallet Personnel de l'application. Elle s'inspire des meilleures pratiques observees dans des apps comme Revolut et vise a ameliorer l'ergonomie, la coherence fonctionnelle, la securite, la performance, et le design global de l'experience personnelle de l'utilisateur.

## Ergonomie & Navigation

| Amelioration | Description | Impact Utilisateur | Effort Estime | Priorite | Status |
| --- | --- | --- | --- | --- | --- |
| Navigation vers Transactions | Ajouter un lien direct vers les transactions dans le menu principal | Moyen | Faible | Moyenne | Termine |
| Amelioration navigation mobile | Barre de navigation inferieure pour mobile inspiree de Revolut | Fort | Moyen | Haute | Termine |
| Acces CSV rapide | Declenchement automatique du panneau d'import si `import=1` | Moyen | Faible | Moyenne | Termine |
| Focus & accessibilite modale | Implementer le focus trap et les attributs aria | Moyen | Moyen | Moyenne | Termine |

## Fonctionnalites

| Amelioration | Description | Impact Utilisateur | Effort Estime | Priorite | Status |
| --- | --- | --- | --- | --- | --- |
| Objectifs d'epargne | Ajouter la page d'objectifs aujourd'hui vide | Fort | Eleve | Haute | Non demarre |
| Budgets par categorie | Permettre de fixer des limites de depenses mensuelles | Fort | Eleve | Haute | Non demarre |
| Visualisations & rapports | Graphiques d'analyse revenus/depenses par mois | Fort | Moyen | Haute | Non demarre |
| Transfert entre comptes | Ajouter un type de transaction transfert (2 comptes lies) | Fort | Eleve | Haute | Non demarre |
| Edition et fiabilite des comptes | Validation, feedback et robustesse du formulaire de creation de compte | Fort | Moyen | Moyenne | Termine |

## Fiabilite des donnees

| Amelioration | Description | Impact Utilisateur | Effort Estime | Priorite | Status |
| --- | --- | --- | --- | --- | --- |
| Agregation multi-devise | Convertir les soldes dans une devise de reference | Moyen | Moyen | Moyenne | Non demarre |
| Detection de doublons CSV | Empecher l'import en double par controle date+montant | Moyen | Moyen | Moyenne | Non demarre |
| Solde mis a jour en live | Mettre a jour le solde sans recharger la page | Fort | Moyen | Haute | Termine |

## Design & Esthetique

| Amelioration | Description | Impact Utilisateur | Effort Estime | Priorite | Status |
| --- | --- | --- | --- | --- | --- |
| Uniformisation UI | Harmoniser typographie, couleurs, composants | Moyen | Moyen | Moyenne | Non demarre |
| Theme auto | Utiliser le `prefers-color-scheme` du navigateur | Faible | Faible | Faible | Non demarre |

## Securite & Confidentialite

| Amelioration | Description | Impact Utilisateur | Effort Estime | Priorite | Status |
| --- | --- | --- | --- | --- | --- |
| Suppression de compte | Permettre a l'utilisateur de supprimer son compte | Fort | Moyen | Haute | Non demarre |
| Confidentialite visuelle | Masquer les montants sensibles (mode discret) | Moyen | Faible | Moyenne | Non demarre |
| 2FA | Activer une double authentification | Fort | Moyen | Haute | Non demarre |

## Performance

| Amelioration | Description | Impact Utilisateur | Effort Estime | Priorite | Status |
| --- | --- | --- | --- | --- | --- |
| SSR donnees wallet | Prerendre les donnees du resume utilisateur | Moyen | Moyen | Moyenne | Non demarre |
| Scroll virtuel | Charger dynamiquement les longues listes | Faible | Moyen | Faible | Non demarre |

## Suivi
- Derniere mise a jour: 2026-01-17
- Contributeurs: equipe produit + dev
- Version du plan: v1.0
- Notes: 2026-01-17 - Solde mis a jour en live via refresh events apres creation/modif/suppression et import CSV. Navigation Wallet: lien Transactions + bottom nav mobile. Import CSV: auto-ouverture via param import=1. Modals: focus trap + aria + focus restore + data-autofocus sur champs principaux. Comptes: validation + feedback creation + edition/suppression.
