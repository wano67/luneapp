// src/app/app/pro/[businessId]/layout.tsx
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { fetchJson } from '@/lib/apiClient';
import { useActiveBusiness } from '../ActiveBusinessProvider';
import SwitchBusinessModal from '../SwitchBusinessModal';

type Business = {
  id: string;
  name: string;
  websiteUrl?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  role?: string;
};

type BusinessLayoutProps = {
  children: ReactNode;
};

export default function BusinessLayout({ children }: BusinessLayoutProps) {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const [business, setBusiness] = useState<Business | null>(null);
  const [role, setRole] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;

    async function load() {
      try {
        const res = await fetchJson<Business>(
          `/api/pro/businesses/${businessId}`,
          {},
          controller.signal
        );

        if (controller.signal.aborted) return;
        if (res.ok && res.data) {
          setBusiness(res.data);
          setRole(res.data.role ?? null);
          setError(null);
          return;
        }
        if (res.status === 401) {
          const from = window.location.pathname + window.location.search;
          window.location.href = `/login?from=${encodeURIComponent(from)}`;
          return;
        }
        const msg = res.error ?? 'Impossible de charger l’entreprise.';
        setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        setError('Impossible de charger l’entreprise.');
      }
    }

    void load();
    return () => controller.abort();
  }, [businessId]);

  const activeCtx = useActiveBusiness({ optional: true });

  useEffect(() => {
    if (business) {
      activeCtx?.setActiveBusiness({
        id: business.id,
        name: business.name,
        role,
        websiteUrl: business.websiteUrl,
      });
    }
  }, [activeCtx, business, role]);

  return (
    <div className="space-y-3">
      {error ? (
        <p className="text-xs text-rose-400">{error}</p>
      ) : null}
      <div>{children}</div>
      <SwitchBusinessModal />
    </div>
  );
}
