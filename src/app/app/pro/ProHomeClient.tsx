'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';

type PublicUser = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  isActive: boolean;
};

type BusinessSummary = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

type AuthMeResponse = {
  user: PublicUser;
  memberships: {
    business: BusinessSummary;
    role: string;
  }[];
};

type BusinessesResponse = {
  items: {
    business: BusinessSummary;
    role: string;
  }[];
};

export default function ProHomeClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [businesses, setBusinesses] = useState<BusinessesResponse | null>(null);

  // création entreprise
  const [creating, setCreating] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [creationError, setCreationError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [meRes, businessesRes] = await Promise.all([
          fetch('/api/auth/me', { credentials: 'include' }),
          fetch('/api/pro/businesses', { credentials: 'include' }),
        ]);

        // Non authentifié → on redirige vers /login
        if (meRes.status === 401) {
          if (typeof window !== 'undefined') {
            window.location.href = `/login?from=/app/pro`;
          }
          return;
        }

        if (!meRes.ok) {
          throw new Error("Impossible de charger les informations utilisateur.");
        }

        if (!businessesRes.ok) {
          throw new Error("Impossible de charger les entreprises.");
        }

        const meJson = (await meRes.json()) as AuthMeResponse;
        const businessesJson = (await businessesRes.json()) as BusinessesResponse;

        if (!isMounted) return;

        setMe(meJson);
        setBusinesses(businessesJson);
        setError(null);
      } catch (err) {
        console.error(err);
        if (!isMounted) return;
        setError(
          err instanceof Error
            ? err.message
            : "Une erreur est survenue lors du chargement de l'espace pro."
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleCreateBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreationError(null);

    const name = newBusinessName.trim();
    if (!name) {
      setCreationError("Merci d'indiquer un nom d'entreprise.");
      return;
    }

    try {
      setCreating(true);

      const res = await fetch('/api/pro/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setCreationError(
          typeof json.error === 'string'
            ? json.error
            : "Impossible de créer l'entreprise."
        );
        return;
      }

      // on rafraîchit la liste des entreprises
      const businessesRes = await fetch('/api/pro/businesses', {
        credentials: 'include',
      });

      if (businessesRes.ok) {
        const businessesJson = (await businessesRes.json()) as BusinessesResponse;
        setBusinesses(businessesJson);
      }

      setNewBusinessName('');
      setCreationError(null);
    } catch (err) {
      console.error(err);
      setCreationError('Une erreur est survenue pendant la création.');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-slate-400">
            Chargement de ton espace pro…
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl space-y-4">
          <h1 className="text-2xl font-semibold">Espace PRO</h1>
          <p className="text-sm text-rose-400">{error}</p>
          <p className="text-xs text-slate-500">
            Tu peux essayer de recharger la page ou de te reconnecter.
          </p>
        </div>
      </main>
    );
  }

  const items = businesses?.items ?? [];
  const userName = me?.user.name || me?.user.email;

  // Cas 1 : aucune entreprise -> écran "créer ou rejoindre"
  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl space-y-6">
          <header className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              App
            </p>
            <h1 className="text-2xl font-semibold">Espace PRO</h1>
            <p className="text-sm text-slate-400">
              Bienvenue {userName}. Tu n&apos;as pas encore d&apos;entreprise
              configurée.
            </p>
          </header>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="text-lg font-semibold">Créer une entreprise</h2>
              <p className="text-sm text-slate-400">
                Crée l&apos;espace PRO de ton activité. Tu pourras ensuite
                inviter des collaborateurs et configurer tes clients, projets et
                finances.
              </p>

              <form onSubmit={handleCreateBusiness} className="space-y-2">
                <input
                  type="text"
                  value={newBusinessName}
                  onChange={(e) => setNewBusinessName(e.target.value)}
                  placeholder="Nom de l’entreprise"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-blue-500"
                />
                {creationError ? (
                  <p className="text-xs text-rose-400">{creationError}</p>
                ) : null}
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {creating ? 'Création...' : 'Créer mon entreprise'}
                </button>
              </form>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <h2 className="text-lg font-semibold">Rejoindre une entreprise</h2>
              <p className="text-sm text-slate-400">
                Si quelqu&apos;un t&apos;a invité dans une entreprise, tu pourras
                accepter l&apos;invitation depuis un lien dédié (à venir).
              </p>
              <p className="text-xs text-slate-500">
                Cette section sera reliée au système d&apos;invitations (email +
                rôle).
              </p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  // Cas 2 : au moins une entreprise -> liste + formulaire compact en haut
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              App
            </p>
            <h1 className="text-2xl font-semibold">Espace PRO</h1>
            <p className="text-sm text-slate-400">
              Choisis une entreprise à piloter ou crée-en une nouvelle.
            </p>
          </div>

          <form
            onSubmit={handleCreateBusiness}
            className="flex flex-col gap-2 md:flex-row md:items-center"
          >
            <input
              type="text"
              value={newBusinessName}
              onChange={(e) => setNewBusinessName(e.target.value)}
              placeholder="Nom de la nouvelle entreprise"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-blue-500 md:w-64"
            />
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center justify-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {creating ? 'Création...' : 'Nouvelle entreprise'}
            </button>
            {creationError ? (
              <p className="text-xs text-rose-400 md:ml-2">{creationError}</p>
            ) : null}
          </form>
        </header>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map(({ business, role }) => (
            <div
              key={business.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/40 p-5 shadow-sm"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-slate-50">
                    {business.name}
                  </h2>
                  <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs uppercase tracking-wide text-slate-400">
                    {role}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Créée le{' '}
                  {new Date(business.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Link
                  href={`/app/pro/${business.id}`}
                  className="text-sm font-semibold text-blue-300 hover:text-blue-200"
                >
                  Entrer dans l&apos;espace →
                </Link>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
