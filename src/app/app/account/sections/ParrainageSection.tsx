'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';
import { Copy, Check, Users, Trophy, Gift } from 'lucide-react';

type ReferralData = {
  referralCode: string;
  referralLink: string;
  referralCount: number;
  registeredCount: number;
  waitlistCount: number;
  referrals: { name: string; createdAt: string }[];
};

type LeaderboardData = {
  leaderboard: { name: string; referralCode: string; count: number; rank: number }[];
  userRank: number | null;
  userCount: number;
};

export function ParrainageSection() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReferralData | null>(null);
  const [lb, setLb] = useState<LeaderboardData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      const [refRes, lbRes] = await Promise.all([
        fetchJson<ReferralData>('/api/account/referral', {}, ctrl.signal),
        fetchJson<LeaderboardData>('/api/account/referral/leaderboard', {}, ctrl.signal),
      ]);
      if (ctrl.signal.aborted) return;
      if (refRes.ok && refRes.data) setData(refRes.data);
      if (lbRes.ok && lbRes.data) setLb(lbRes.data);
      setLoading(false);
    })();
    return () => ctrl.abort();
  }, []);

  async function handleCopy() {
    if (!data?.referralLink) return;
    await navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)]/70 p-5">
        <div>
          <p className="text-base font-semibold text-[var(--text-primary)]">Parrainage</p>
          <p className="text-sm text-[var(--text-secondary)]">Chargement...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-5 border-[var(--border)] bg-[var(--surface)]/70 p-5">
      <div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Parrainage</p>
        <p className="text-sm text-[var(--text-secondary)]">
          Invitez vos proches et grimpez dans le classement.
        </p>
      </div>

      {/* Referral code + copy */}
      {data && (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <p className="text-xs text-[var(--text-faint)]">Mon lien de parrainage</p>
              <p className="mt-0.5 text-sm font-mono font-medium text-[var(--text)] break-all">
                {data.referralLink}
              </p>
            </div>
            <Button type="button" onClick={handleCopy} className="shrink-0 gap-2">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copié !' : 'Copier'}
            </Button>
          </div>

          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Gift size={16} className="text-[var(--accent)]" />
            <span>
              Code : <span className="font-semibold text-[var(--text)]">{data.referralCode}</span>
            </span>
          </div>

          {/* Stats */}
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Total parrainages" value={data.referralCount} icon={<Users size={18} />} />
            <StatCard label="Inscrits" value={data.registeredCount} icon={<Check size={18} />} />
            <StatCard label="En attente" value={data.waitlistCount} icon={<Gift size={18} />} />
          </div>
        </div>
      )}

      {/* Referral list */}
      {data && data.referrals.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[var(--text)]">Mes filleuls</p>
          <div className="space-y-1">
            {data.referrals.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--surface-2)' }}
              >
                <span className="text-[var(--text-secondary)]">{r.name}</span>
                <span className="text-xs text-[var(--text-faint)]">
                  {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {lb && lb.leaderboard.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-[var(--warning, #f59e0b)]" />
            <p className="text-sm font-semibold text-[var(--text)]">Classement</p>
          </div>

          <div className="space-y-1">
            {lb.leaderboard.map((entry) => {
              const isUser = lb.userRank === entry.rank && lb.userCount === entry.count;
              return (
                <div
                  key={entry.rank}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${isUser ? 'ring-1 ring-[var(--accent)]' : ''}`}
                  style={{ background: isUser ? 'var(--accent-bg, var(--surface-2))' : 'var(--surface-2)' }}
                >
                  <span className="w-6 text-center font-semibold text-[var(--text-faint)]">
                    {entry.rank <= 3 ? ['', '\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49'][entry.rank] : `#${entry.rank}`}
                  </span>
                  <span className="flex-1 text-[var(--text-secondary)]">{entry.name}</span>
                  <span className="font-semibold text-[var(--text)]">
                    {entry.count} {entry.count > 1 ? 'filleuls' : 'filleul'}
                  </span>
                </div>
              );
            })}
          </div>

          {lb.userRank && lb.userRank > 10 && (
            <p className="text-center text-xs text-[var(--text-faint)]">
              Votre position : <span className="font-semibold">#{lb.userRank}</span> avec {lb.userCount} filleul{lb.userCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {lb && lb.leaderboard.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--border)] px-4 py-6 text-center">
          <Trophy size={24} className="mx-auto mb-2 text-[var(--text-faint)]" />
          <p className="text-sm text-[var(--text-secondary)]">
            Le classement est vide pour le moment.
          </p>
          <p className="text-xs text-[var(--text-faint)]">
            Partagez votre lien pour &ecirc;tre le premier !
          </p>
        </div>
      )}
    </Card>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
      <span className="text-[var(--accent)]">{icon}</span>
      <div>
        <p className="text-lg font-semibold text-[var(--text)]">{value}</p>
        <p className="text-xs text-[var(--text-faint)]">{label}</p>
      </div>
    </div>
  );
}
