// src/app/app/page.tsx

export default function AppHomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-50">
        Bienvenue dans StudioFief OS
      </h1>
      <p className="text-sm text-slate-400">
        Utilise la barre du haut pour accéder à 🟦 PRO, 🟩 PERSO ou 🟥 PERFORMANCE.
      </p>
      <p className="text-xs text-slate-500">
        Ce tableau de bord d’accueil pourra ensuite montrer une vue d’ensemble globale
        (pro + perso + performance).
      </p>
    </div>
  );
}
