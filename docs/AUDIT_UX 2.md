## Frictions (Top 10)
1. CTA mutations exposés mais lecture seule silencieuse si rôle < ADMIN (risque Jakob/Error prevention) — ex: services, prospects, projets (pages pro).
2. Start projet/archiver échouent sans Origin (403 CSRF) sans feedback clair en UI; besoin d’indication d’environnement (APP_URL) — files: project detail.
3. Multiples pages placeholders visibles (process, references, finances*, personal budgets/épargne/dash-*), augmentent charge cognitive (Hick/Miller).
4. Pas de “next best action” sur hub /app : difficile de savoir où commencer (Jakob, Aesthetic-Usability).
5. Tâches globales: pas de filtre “mes tâches” par défaut, CTA création bloqué pour member sans explication (Fitts/Error prevention).
6. Clients detail: blocs finances/projets en stub, badge “stub” mais pas de redirection utile (Progressive disclosure manquante).
7. Prospects detail: conversion réservée admin mais CTA visible, message d’erreur tardif (Error prevention).
8. Services: templates modale affichée pour Viewer, erreurs seulement au clic (lourd feedback).
9. Interactions: pas de toast request-id en UI, user doit lire petite ligne (Visibility of status).
10. CSRF 403 en dev si APP_URL absent → expérience dégradée non guidée (Error prevention).

## Quick wins (≤1 jour)
1. Afficher bandeau rôle (déjà présent) avec lien “Demander accès” sur toutes pages pro et dupliquer message sous CTA désactivés.
2. Gérer CSRF dev: afficher alerte si Origin absent (check `process.env.APP_URL`) sur pages pro.
3. Masquer ou badge “Bientôt” + redir utile sur placeholders pro/perso (process, finances*, budgets, épargne).
4. Ajouter “Mes tâches” filtre par défaut sur /tasks (si assignee = me).
5. Ajouter “Prochaine étape” sur project detail quand quote/deposit non OK.
6. Sur prospects detail, conditionner CTA convertir à isAdmin (disabled + tooltip).
7. Sur services modal templates, afficher message read-only dès ouverture si !isAdmin.
8. Ajouter badges “lecture seule” sur tables (services/prospects/projects/clients/tasks) quand role != admin.
9. Hub /app : bloc “Commencer” avec liens vers comptes persos et pro business actif (pas de nouvelle sidebar).
10. Surfacer request-id dans toasts/alertes (réutiliser fetchJson.error) pour interactions/tasks/services modales.
