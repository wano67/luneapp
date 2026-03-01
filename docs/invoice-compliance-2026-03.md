# Audit factures generees - mars 2026

Ce document est un guide produit/technique (pas un avis juridique). Il sert a verifier les donnees necessaires pour produire des factures lisibles et administrativement conformes.

## References reglementaires (FR)

- Service-Public (maj 23/10/2025): mentions obligatoires sur une facture.
  - https://entreprendre.service-public.fr/vosdroits/F23208
- Entreprendre.Service-Public: generalites sur la facture.
  - https://entreprendre.service-public.fr/vosdroits/F31808

## Champs obligatoires verifies cote app

- Facture
  - Numero de facture (`invoice.number`)
  - Date d'emission (`invoice.issuedAt`)
  - Date limite de reglement (`invoice.dueAt`)
  - Lignes facture (`invoice.items[]`)
- Emetteur (business)
  - Identite legale (`business.legalName` / fallback `business.name`)
  - Adresse (`addressLine1`, `postalCode`, `city`, `countryCode`)
  - Immatriculation (`siret`)
- Client
  - Identite (`billingCompanyName`/`companyName` ou `billingContactName`/`name`)
  - Adresse de facturation (`billingAddressLine1`, `billingPostalCode`, `billingCity`, `billingCountryCode`; fallback `address`)

## Mentions recommandees (controlees)

- Conditions de paiement (`settings.paymentTermsText` ou `settings.paymentTermsDays`)
- Penalites de retard (`settings.lateFeesText`)
- Indemnite forfaitaire de recouvrement (`settings.fixedIndemnityText`)
- Contact facturation (`business.billingEmail` ou `business.billingPhone`)
- Coordonnees bancaires (`iban`, `bic`)
- TVA
  - Si TVA active: numero TVA vendeur/client recommande
  - Si TVA inactive: verifier la mention d'exoneration (ex: article 293 B CGI selon regime)

## Evolutions reglementaires a anticiper (2026/2027)

Selon Service-Public (maj 2025), de nouvelles mentions deviennent attendues dans le cadre de la reforme de facturation electronique (notamment SIREN du client, adresse de livraison, nature des operations, option paiement TVA sur les debits si concernee).

## Changements implementes dans le code

- Controle de conformite facture (serveur + UI detail facture):
  - `src/server/billing/invoiceCompliance.ts`
  - `src/app/api/pro/businesses/[businessId]/invoices/[invoiceId]/route.ts`
  - `src/app/app/pro/[businessId]/finances/invoices/[invoiceId]/page.tsx`
- Amelioration design PDF facture:
  - `src/server/pdf/invoicePdf.ts`

## Checklist de validation produit

- [ ] Une facture test affiche numero + date + echeance + lignes
- [ ] Bloc emetteur/client complet et lisible
- [ ] Totaux HT/TVA/TTC + solde lisibles
- [ ] Bloc "Mentions de reglement" present (conditions, penalites, indemnite)
- [ ] Carte "Conformite facture" dans la page detail pour corriger les manques
- [ ] PDF telechargeable sans debordement de texte sur les cas standards
