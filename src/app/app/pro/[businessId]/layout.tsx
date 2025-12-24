// src/app/app/pro/[businessId]/layout.tsx
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { fetchJson } from '@/lib/apiClient';
import {
  ActiveBusinessProvider,
  type ActiveBusiness,
  useActiveBusiness,
} from '../ActiveBusinessProvider';
import SwitchBusinessModal from '../SwitchBusinessModal';
import { ActiveBusinessTopBar } from '../../components/ActiveBusinessTopBar';

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

  const initialActive: ActiveBusiness | null = business
    ? { id: business.id, name: business.name, role, websiteUrl: business.websiteUrl }
    : null;

  return (
    <ActiveBusinessProvider initialBusiness={initialActive}>
      <LayoutContent error={error} initialActive={initialActive}>
        {children}
      </LayoutContent>
    </ActiveBusinessProvider>
  );
}

function LayoutContent({
  children,
  error,
  initialActive,
}: {
  children: ReactNode;
  error: string | null;
  initialActive: ActiveBusiness | null;
}) {
  const ctx = useActiveBusiness({ optional: true });
  const activeForDisplay = ctx?.activeBusiness ?? initialActive;

  return (
    <div className="space-y-3">
      {activeForDisplay ? (
        <div className="sticky top-14 z-40 border-b border-[var(--border)] bg-[var(--background)]/85 backdrop-blur-md">
          <div className="mx-auto max-w-6xl px-4 py-2 md:px-6">
            <ActiveBusinessTopBar
              businessName={activeForDisplay.name}
              websiteUrl={activeForDisplay.websiteUrl}
              roleLabel={activeForDisplay.role}
              onChange={() => ctx?.openSwitchModal?.()}
              hubHref="/app/pro"
            />
          </div>
        </div>
      ) : null}
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
      <div>{children}</div>
      <SwitchBusinessModal />
    </div>
  );
}
