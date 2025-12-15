# Audit Lisibilité & Accessibilité

## Constats
- Focus visible limité : boutons/inputs natifs ok, mais AppShell (dock, pull-down menu, toggles) n’expose pas de styles focus ni de gestion clavier dédiée.  
- Modal (`src/components/ui/modal.tsx`) : pas de `aria-modal`, pas de focus trap, overlay clic-ferme, tab peut sortir du dialog.  
- Navigation : AppSidebar/AppShell utilisent principalement `Link`/`button` mais sans gestion clavier pour ouverture mobile menu ou dock; gestures pointer (pull-down) non accessibles.  
- Contrastes : palette sombre forte (`text-slate-400` sur `bg-slate-900/60`) parfois < WCAG AA pour petit texte; tokens non vérifiés.  
- Forms : labels présents mais `Input` ne relie pas explicitement `id` au label quand label non fourni; selects natifs sans styles focus (bordure par défaut).  
- State feedback : erreurs inline en texte rouge (#fca5a5) sur fond sombre peuvent manquer de contraste; pas d’ARIA `role="alert"` sauf login.  
- Animations : transitions légères, pas de motion préférences respectées.

## Priorités (P0/P1)
- P0  
  - Ajouter focus visible cohérent sur nav/dock/menus; rendre le toggle mobile accessible via clavier.  
  - Modal : ajouter `role="dialog"`, `aria-modal="true"`, focus trap, bouton close focusable, empêcher tab de sortir.  
  - Contraste : re-mapper textes secondaires/surfaces via tokens (vérifier AA sur texte 12–14px).  
- P1  
  - Gérer `prefers-reduced-motion` sur animations AppShell/dock.  
  - Normaliser les messages d’erreur avec `role="alert"`, icônes/contrastes suffisants.  
  - Ajouter navigation clavier pour la Sidebar (flèches/Tab) et les listes d’actions (transactions).  
- P2  
  - Ajouter tests automatiques axe/lighthouse sur pages clés (/, /login, /app/personal, /app/personal/transactions).  
