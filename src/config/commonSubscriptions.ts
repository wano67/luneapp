/** Common subscription catalog organized by provider for quick entry. */

export type SubscriptionPlan = {
  /** Plan display name (e.g. "Standard", "Premium") */
  label: string;
  /** Price in euro-cents */
  defaultCents: number;
  frequency: 'MONTHLY' | 'YEARLY';
};

export type SubscriptionProvider = {
  name: string;
  websiteUrl: string;
  category: string;
  plans: SubscriptionPlan[];
};

export const SUBSCRIPTION_PROVIDERS: SubscriptionProvider[] = [
  // ── Streaming vidéo ──
  { name: 'Netflix', websiteUrl: 'https://netflix.com', category: 'Streaming', plans: [
    { label: 'Essentiel', defaultCents: 599, frequency: 'MONTHLY' },
    { label: 'Standard', defaultCents: 1399, frequency: 'MONTHLY' },
    { label: 'Premium', defaultCents: 1999, frequency: 'MONTHLY' },
  ]},
  { name: 'Disney+', websiteUrl: 'https://disneyplus.com', category: 'Streaming', plans: [
    { label: 'Avec pub', defaultCents: 599, frequency: 'MONTHLY' },
    { label: 'Standard', defaultCents: 899, frequency: 'MONTHLY' },
    { label: 'Premium', defaultCents: 1399, frequency: 'MONTHLY' },
  ]},
  { name: 'Amazon Prime', websiteUrl: 'https://amazon.fr', category: 'Streaming', plans: [
    { label: 'Annuel', defaultCents: 6990, frequency: 'YEARLY' },
  ]},
  { name: 'Canal+', websiteUrl: 'https://canalplus.com', category: 'Streaming', plans: [
    { label: 'Essentiel', defaultCents: 1599, frequency: 'MONTHLY' },
    { label: 'Ciné Séries', defaultCents: 2599, frequency: 'MONTHLY' },
    { label: 'Intégrale', defaultCents: 4499, frequency: 'MONTHLY' },
  ]},
  { name: 'Apple TV+', websiteUrl: 'https://tv.apple.com', category: 'Streaming', plans: [
    { label: 'Mensuel', defaultCents: 999, frequency: 'MONTHLY' },
  ]},
  { name: 'Paramount+', websiteUrl: 'https://paramountplus.com', category: 'Streaming', plans: [
    { label: 'Standard', defaultCents: 599, frequency: 'MONTHLY' },
    { label: 'Premium', defaultCents: 999, frequency: 'MONTHLY' },
  ]},
  { name: 'Crunchyroll', websiteUrl: 'https://crunchyroll.com', category: 'Streaming', plans: [
    { label: 'Fan', defaultCents: 599, frequency: 'MONTHLY' },
    { label: 'Méga Fan', defaultCents: 999, frequency: 'MONTHLY' },
  ]},
  { name: 'YouTube Premium', websiteUrl: 'https://youtube.com', category: 'Streaming', plans: [
    { label: 'Individuel', defaultCents: 1299, frequency: 'MONTHLY' },
    { label: 'Famille', defaultCents: 2399, frequency: 'MONTHLY' },
  ]},
  { name: 'Max', websiteUrl: 'https://max.com', category: 'Streaming', plans: [
    { label: 'Standard', defaultCents: 599, frequency: 'MONTHLY' },
    { label: 'Premium', defaultCents: 999, frequency: 'MONTHLY' },
  ]},
  { name: 'OCS', websiteUrl: 'https://ocs.fr', category: 'Streaming', plans: [
    { label: 'Mensuel', defaultCents: 999, frequency: 'MONTHLY' },
  ]},
  { name: 'Molotov', websiteUrl: 'https://molotov.tv', category: 'Streaming', plans: [
    { label: 'Plus', defaultCents: 499, frequency: 'MONTHLY' },
    { label: 'Extended', defaultCents: 999, frequency: 'MONTHLY' },
  ]},

  // ── Musique ──
  { name: 'Spotify', websiteUrl: 'https://spotify.com', category: 'Musique', plans: [
    { label: 'Étudiant', defaultCents: 599, frequency: 'MONTHLY' },
    { label: 'Individuel', defaultCents: 1099, frequency: 'MONTHLY' },
    { label: 'Duo', defaultCents: 1499, frequency: 'MONTHLY' },
    { label: 'Famille', defaultCents: 1799, frequency: 'MONTHLY' },
  ]},
  { name: 'Apple Music', websiteUrl: 'https://music.apple.com', category: 'Musique', plans: [
    { label: 'Étudiant', defaultCents: 599, frequency: 'MONTHLY' },
    { label: 'Individuel', defaultCents: 1099, frequency: 'MONTHLY' },
    { label: 'Famille', defaultCents: 1699, frequency: 'MONTHLY' },
  ]},
  { name: 'Deezer', websiteUrl: 'https://deezer.com', category: 'Musique', plans: [
    { label: 'Premium', defaultCents: 1099, frequency: 'MONTHLY' },
    { label: 'Famille', defaultCents: 1799, frequency: 'MONTHLY' },
  ]},
  { name: 'Tidal', websiteUrl: 'https://tidal.com', category: 'Musique', plans: [
    { label: 'HiFi', defaultCents: 1099, frequency: 'MONTHLY' },
  ]},

  // ── Gaming ──
  { name: 'PlayStation Plus', websiteUrl: 'https://playstation.com', category: 'Gaming', plans: [
    { label: 'Essential', defaultCents: 899, frequency: 'MONTHLY' },
    { label: 'Extra', defaultCents: 1399, frequency: 'MONTHLY' },
    { label: 'Premium', defaultCents: 1699, frequency: 'MONTHLY' },
  ]},
  { name: 'Xbox Game Pass', websiteUrl: 'https://xbox.com', category: 'Gaming', plans: [
    { label: 'Core', defaultCents: 699, frequency: 'MONTHLY' },
    { label: 'Standard', defaultCents: 1299, frequency: 'MONTHLY' },
    { label: 'Ultimate', defaultCents: 1799, frequency: 'MONTHLY' },
  ]},
  { name: 'Nintendo Switch Online', websiteUrl: 'https://nintendo.com', category: 'Gaming', plans: [
    { label: 'Individuel', defaultCents: 1999, frequency: 'YEARLY' },
    { label: '+ Pack additionnel', defaultCents: 3999, frequency: 'YEARLY' },
  ]},
  { name: 'EA Play', websiteUrl: 'https://ea.com', category: 'Gaming', plans: [
    { label: 'Standard', defaultCents: 499, frequency: 'MONTHLY' },
  ]},
  { name: 'Ubisoft+', websiteUrl: 'https://ubisoft.com', category: 'Gaming', plans: [
    { label: 'Standard', defaultCents: 799, frequency: 'MONTHLY' },
    { label: 'Premium', defaultCents: 1799, frequency: 'MONTHLY' },
  ]},
  { name: 'GeForce NOW', websiteUrl: 'https://nvidia.com', category: 'Gaming', plans: [
    { label: 'Prioritaire', defaultCents: 999, frequency: 'MONTHLY' },
    { label: 'Ultimate', defaultCents: 1999, frequency: 'MONTHLY' },
  ]},

  // ── Télécom ──
  { name: 'Free Mobile', websiteUrl: 'https://free.fr', category: 'Télécom', plans: [
    { label: '2€', defaultCents: 200, frequency: 'MONTHLY' },
    { label: '5,99€', defaultCents: 599, frequency: 'MONTHLY' },
    { label: '19,99€', defaultCents: 1999, frequency: 'MONTHLY' },
  ]},
  { name: 'RED by SFR', websiteUrl: 'https://red-by-sfr.fr', category: 'Télécom', plans: [
    { label: '100 Go', defaultCents: 999, frequency: 'MONTHLY' },
    { label: '200 Go', defaultCents: 1399, frequency: 'MONTHLY' },
  ]},
  { name: 'Sosh', websiteUrl: 'https://sosh.fr', category: 'Télécom', plans: [
    { label: '40 Go', defaultCents: 999, frequency: 'MONTHLY' },
    { label: '100 Go', defaultCents: 1599, frequency: 'MONTHLY' },
  ]},
  { name: 'B&You', websiteUrl: 'https://bouyguestelecom.fr', category: 'Télécom', plans: [
    { label: '100 Go', defaultCents: 999, frequency: 'MONTHLY' },
    { label: '200 Go', defaultCents: 1499, frequency: 'MONTHLY' },
  ]},
  { name: 'Orange Mobile', websiteUrl: 'https://orange.fr', category: 'Télécom', plans: [
    { label: '100 Go', defaultCents: 2499, frequency: 'MONTHLY' },
  ]},
  { name: 'SFR Mobile', websiteUrl: 'https://sfr.fr', category: 'Télécom', plans: [
    { label: '5G', defaultCents: 3499, frequency: 'MONTHLY' },
  ]},
  { name: 'Bouygues Sensation', websiteUrl: 'https://bouyguestelecom.fr', category: 'Télécom', plans: [
    { label: '100 Go', defaultCents: 2499, frequency: 'MONTHLY' },
  ]},
  { name: 'Prixtel', websiteUrl: 'https://prixtel.com', category: 'Télécom', plans: [
    { label: '100 Go', defaultCents: 999, frequency: 'MONTHLY' },
  ]},

  // ── Internet ──
  { name: 'Freebox', websiteUrl: 'https://free.fr', category: 'Internet', plans: [
    { label: 'Révolution Light', defaultCents: 2999, frequency: 'MONTHLY' },
    { label: 'Pop', defaultCents: 2999, frequency: 'MONTHLY' },
    { label: 'Ultra', defaultCents: 4999, frequency: 'MONTHLY' },
  ]},
  { name: 'RED Box', websiteUrl: 'https://red-by-sfr.fr', category: 'Internet', plans: [
    { label: 'Fibre', defaultCents: 2499, frequency: 'MONTHLY' },
  ]},
  { name: 'SFR Box', websiteUrl: 'https://sfr.fr', category: 'Internet', plans: [
    { label: 'Fibre', defaultCents: 3299, frequency: 'MONTHLY' },
  ]},
  { name: 'Livebox Orange', websiteUrl: 'https://orange.fr', category: 'Internet', plans: [
    { label: 'Fibre', defaultCents: 3299, frequency: 'MONTHLY' },
    { label: 'Max', defaultCents: 4499, frequency: 'MONTHLY' },
  ]},
  { name: 'Bbox Bouygues', websiteUrl: 'https://bouyguestelecom.fr', category: 'Internet', plans: [
    { label: 'Fit', defaultCents: 2599, frequency: 'MONTHLY' },
    { label: 'Must', defaultCents: 3499, frequency: 'MONTHLY' },
  ]},

  // ── Cloud ──
  { name: 'iCloud+', websiteUrl: 'https://apple.com', category: 'Cloud', plans: [
    { label: '50 Go', defaultCents: 99, frequency: 'MONTHLY' },
    { label: '200 Go', defaultCents: 299, frequency: 'MONTHLY' },
    { label: '2 To', defaultCents: 999, frequency: 'MONTHLY' },
    { label: '6 To', defaultCents: 2999, frequency: 'MONTHLY' },
    { label: '12 To', defaultCents: 5999, frequency: 'MONTHLY' },
  ]},
  { name: 'Apple One', websiteUrl: 'https://apple.com', category: 'Cloud', plans: [
    { label: 'Individuel', defaultCents: 1995, frequency: 'MONTHLY' },
    { label: 'Famille', defaultCents: 2595, frequency: 'MONTHLY' },
  ]},
  { name: 'Google One', websiteUrl: 'https://one.google.com', category: 'Cloud', plans: [
    { label: '100 Go', defaultCents: 199, frequency: 'MONTHLY' },
    { label: '2 To', defaultCents: 999, frequency: 'MONTHLY' },
  ]},
  { name: 'Microsoft 365', websiteUrl: 'https://microsoft.com', category: 'Cloud', plans: [
    { label: 'Personnel', defaultCents: 6900, frequency: 'YEARLY' },
    { label: 'Famille', defaultCents: 9900, frequency: 'YEARLY' },
  ]},
  { name: 'Dropbox', websiteUrl: 'https://dropbox.com', category: 'Cloud', plans: [
    { label: 'Plus', defaultCents: 1199, frequency: 'MONTHLY' },
    { label: 'Essentials', defaultCents: 2200, frequency: 'MONTHLY' },
  ]},
  { name: 'Notion', websiteUrl: 'https://notion.so', category: 'Cloud', plans: [
    { label: 'Plus', defaultCents: 1000, frequency: 'MONTHLY' },
  ]},

  // ── IA ──
  { name: 'ChatGPT', websiteUrl: 'https://openai.com', category: 'IA', plans: [
    { label: 'Plus', defaultCents: 2000, frequency: 'MONTHLY' },
    { label: 'Pro', defaultCents: 20000, frequency: 'MONTHLY' },
  ]},
  { name: 'Claude', websiteUrl: 'https://claude.ai', category: 'IA', plans: [
    { label: 'Pro', defaultCents: 2000, frequency: 'MONTHLY' },
    { label: 'Max', defaultCents: 10000, frequency: 'MONTHLY' },
  ]},
  { name: 'Midjourney', websiteUrl: 'https://midjourney.com', category: 'IA', plans: [
    { label: 'Basic', defaultCents: 1000, frequency: 'MONTHLY' },
    { label: 'Standard', defaultCents: 3000, frequency: 'MONTHLY' },
  ]},
  { name: 'GitHub Copilot', websiteUrl: 'https://github.com', category: 'IA', plans: [
    { label: 'Individual', defaultCents: 1000, frequency: 'MONTHLY' },
  ]},
  { name: 'Gemini Advanced', websiteUrl: 'https://gemini.google.com', category: 'IA', plans: [
    { label: 'Advanced', defaultCents: 2199, frequency: 'MONTHLY' },
  ]},
  { name: 'Perplexity', websiteUrl: 'https://perplexity.ai', category: 'IA', plans: [
    { label: 'Pro', defaultCents: 2000, frequency: 'MONTHLY' },
  ]},

  // ── Créatif ──
  { name: 'Adobe', websiteUrl: 'https://adobe.com', category: 'Créatif', plans: [
    { label: 'Lightroom', defaultCents: 1199, frequency: 'MONTHLY' },
    { label: 'Photoshop', defaultCents: 2399, frequency: 'MONTHLY' },
    { label: 'Creative Cloud', defaultCents: 5999, frequency: 'MONTHLY' },
  ]},
  { name: 'Canva', websiteUrl: 'https://canva.com', category: 'Créatif', plans: [
    { label: 'Pro', defaultCents: 1299, frequency: 'MONTHLY' },
    { label: 'Équipes', defaultCents: 2399, frequency: 'MONTHLY' },
  ]},
  { name: 'Figma', websiteUrl: 'https://figma.com', category: 'Créatif', plans: [
    { label: 'Professional', defaultCents: 1200, frequency: 'MONTHLY' },
  ]},

  // ── Sport ──
  { name: 'Basic-Fit', websiteUrl: 'https://basic-fit.com', category: 'Sport', plans: [
    { label: 'Basic', defaultCents: 2999, frequency: 'MONTHLY' },
    { label: 'Premium', defaultCents: 3999, frequency: 'MONTHLY' },
  ]},
  { name: 'Fitness Park', websiteUrl: 'https://fitnesspark.fr', category: 'Sport', plans: [
    { label: 'Standard', defaultCents: 2990, frequency: 'MONTHLY' },
  ]},
  { name: 'Neoness', websiteUrl: 'https://neoness.fr', category: 'Sport', plans: [
    { label: 'Standard', defaultCents: 2990, frequency: 'MONTHLY' },
  ]},
  { name: 'Strava', websiteUrl: 'https://strava.com', category: 'Sport', plans: [
    { label: 'Premium', defaultCents: 599, frequency: 'MONTHLY' },
  ]},

  // ── Presse ──
  { name: 'Le Monde', websiteUrl: 'https://lemonde.fr', category: 'Presse', plans: [
    { label: 'Numérique', defaultCents: 999, frequency: 'MONTHLY' },
  ]},
  { name: 'Le Figaro', websiteUrl: 'https://lefigaro.fr', category: 'Presse', plans: [
    { label: 'Numérique', defaultCents: 1590, frequency: 'MONTHLY' },
  ]},
  { name: 'Libération', websiteUrl: 'https://liberation.fr', category: 'Presse', plans: [
    { label: 'Numérique', defaultCents: 999, frequency: 'MONTHLY' },
  ]},
  { name: 'Les Échos', websiteUrl: 'https://lesechos.fr', category: 'Presse', plans: [
    { label: 'Numérique', defaultCents: 2500, frequency: 'MONTHLY' },
  ]},
  { name: 'Mediapart', websiteUrl: 'https://mediapart.fr', category: 'Presse', plans: [
    { label: 'Numérique', defaultCents: 1100, frequency: 'MONTHLY' },
  ]},
  { name: 'Cafeyn', websiteUrl: 'https://cafeyn.co', category: 'Presse', plans: [
    { label: 'Standard', defaultCents: 999, frequency: 'MONTHLY' },
  ]},

  // ── Services ──
  { name: 'Uber One', websiteUrl: 'https://uber.com', category: 'Services', plans: [
    { label: 'Mensuel', defaultCents: 999, frequency: 'MONTHLY' },
  ]},
  { name: 'Deliveroo Plus', websiteUrl: 'https://deliveroo.fr', category: 'Services', plans: [
    { label: 'Silver', defaultCents: 299, frequency: 'MONTHLY' },
    { label: 'Gold', defaultCents: 599, frequency: 'MONTHLY' },
  ]},
  { name: 'HelloFresh', websiteUrl: 'https://hellofresh.fr', category: 'Services', plans: [
    { label: '3 repas/sem', defaultCents: 4999, frequency: 'MONTHLY' },
  ]},

  // ── Sécurité ──
  { name: 'NordVPN', websiteUrl: 'https://nordvpn.com', category: 'Sécurité', plans: [
    { label: 'Standard', defaultCents: 499, frequency: 'MONTHLY' },
  ]},
  { name: 'ExpressVPN', websiteUrl: 'https://expressvpn.com', category: 'Sécurité', plans: [
    { label: 'Mensuel', defaultCents: 999, frequency: 'MONTHLY' },
  ]},
  { name: 'Proton', websiteUrl: 'https://proton.me', category: 'Sécurité', plans: [
    { label: 'VPN Plus', defaultCents: 999, frequency: 'MONTHLY' },
    { label: 'Unlimited', defaultCents: 1299, frequency: 'MONTHLY' },
  ]},
  { name: '1Password', websiteUrl: 'https://1password.com', category: 'Sécurité', plans: [
    { label: 'Individual', defaultCents: 299, frequency: 'MONTHLY' },
  ]},
  { name: 'Bitwarden', websiteUrl: 'https://bitwarden.com', category: 'Sécurité', plans: [
    { label: 'Premium', defaultCents: 1000, frequency: 'YEARLY' },
  ]},
  { name: 'Dashlane', websiteUrl: 'https://dashlane.com', category: 'Sécurité', plans: [
    { label: 'Premium', defaultCents: 499, frequency: 'MONTHLY' },
  ]},

  // ── Shopping ──
  { name: 'Cdiscount à volonté', websiteUrl: 'https://cdiscount.com', category: 'Shopping', plans: [
    { label: 'Annuel', defaultCents: 2900, frequency: 'YEARLY' },
  ]},
  { name: 'Fnac+', websiteUrl: 'https://fnac.com', category: 'Shopping', plans: [
    { label: 'Annuel', defaultCents: 4900, frequency: 'YEARLY' },
  ]},
  { name: 'Veepee Le Club', websiteUrl: 'https://veepee.fr', category: 'Shopping', plans: [
    { label: 'Annuel', defaultCents: 1800, frequency: 'YEARLY' },
  ]},

  // ── Éducation ──
  { name: 'Duolingo', websiteUrl: 'https://duolingo.com', category: 'Éducation', plans: [
    { label: 'Super', defaultCents: 1399, frequency: 'MONTHLY' },
  ]},
  { name: 'Babbel', websiteUrl: 'https://babbel.com', category: 'Éducation', plans: [
    { label: 'Standard', defaultCents: 1299, frequency: 'MONTHLY' },
  ]},
  { name: 'Audible', websiteUrl: 'https://audible.fr', category: 'Éducation', plans: [
    { label: 'Standard', defaultCents: 995, frequency: 'MONTHLY' },
  ]},
  { name: 'Kindle Unlimited', websiteUrl: 'https://amazon.fr', category: 'Éducation', plans: [
    { label: 'Mensuel', defaultCents: 999, frequency: 'MONTHLY' },
  ]},
  { name: 'MasterClass', websiteUrl: 'https://masterclass.com', category: 'Éducation', plans: [
    { label: 'Standard', defaultCents: 1400, frequency: 'MONTHLY' },
  ]},
  { name: 'Skillshare', websiteUrl: 'https://skillshare.com', category: 'Éducation', plans: [
    { label: 'Premium', defaultCents: 1399, frequency: 'MONTHLY' },
  ]},
];

/** Group providers by category. */
export function groupProvidersByCategory(
  providers: SubscriptionProvider[],
): Map<string, SubscriptionProvider[]> {
  const map = new Map<string, SubscriptionProvider[]>();
  for (const p of providers) {
    const group = map.get(p.category) ?? [];
    group.push(p);
    map.set(p.category, group);
  }
  return map;
}
