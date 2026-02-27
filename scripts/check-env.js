const fs = require('fs');
const os = require('os');
const path = require('path');

// ─── Guard : ~/package.json parasite ──────────────────────────────────────
// Ce fichier casse le module resolution de Next.js (upward walk depuis le projet).
// Symptôme : "Unexpected token 'm', mv ~/packa... is not valid JSON"
// Voir le commentaire dans README ou docs/dev.md section Troubleshooting.
const homePackage = path.join(os.homedir(), 'package.json');
const homePackageLock = path.join(os.homedir(), 'package-lock.json');

if (fs.existsSync(homePackage)) {
  console.error('\n❌  ~/package.json détecté — ce fichier casse Next.js (module resolution upward walk).');
  console.error(`   Supprime-le avec : rm ${homePackage}`);
  console.error('   Puis relance : pnpm dev\n');
  process.exit(1);
}

if (fs.existsSync(homePackageLock)) {
  console.warn(`⚠️   ~/package-lock.json détecté — supprime-le pour éviter des conflits : rm ${homePackageLock}`);
}

// ─── Guard : variables d'environnement (prod / Railway) ───────────────────
// En dev local, passer --skip-env-vars pour ne pas bloquer sur DATABASE_URL
// (Next.js charge .env automatiquement, pas besoin qu'elle soit dans process.env au moment du predev).
const skipEnvVars = process.argv.includes('--skip-env-vars');

if (!skipEnvVars) {
  const required = ['DATABASE_URL'];
  const missing = required.filter((key) => !process.env[key] || String(process.env[key]).trim() === '');
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}
