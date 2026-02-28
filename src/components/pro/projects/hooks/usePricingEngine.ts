import { useEffect, useMemo } from 'react';
import { formatCentsToEuroInput, parseEuroToCents } from '@/lib/money';

// ── helpers ──────────────────────────────────────────────────────────

function parseCents(value?: string | null): number | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
}

function parseEuroInputCents(value: string): number | null {
  const cents = parseEuroToCents(value);
  return Number.isFinite(cents) ? cents : null;
}

// ── types ────────────────────────────────────────────────────────────

type ServiceItem = {
  id: string;
  serviceId: string;
  priceCents: string | null;
  quantity: number;
  titleOverride?: string | null;
  description?: string | null;
  notes?: string | null;
  discountType?: string | null;
  discountValue?: string | number | null;
  billingUnit?: string | null;
  unitLabel?: string | null;
  service: { id: string; name: string };
};

type CatalogService = {
  id: string;
  defaultPriceCents?: string | null;
  tjmCents?: string | null;
  durationHours?: number | null | undefined;
};

export type ServiceDraft = {
  quantity: string;
  price: string;
  title: string;
  description: string;
  discountType: string;
  discountValue: string;
  billingUnit: string;
  unitLabel: string;
};

type BillingSettings = {
  defaultDepositPercent?: number | null;
  vatEnabled?: boolean;
  vatRatePercent?: number;
};

export type PricingLine = {
  id: string;
  serviceId: string;
  quantity: number;
  unitPriceCents: number | null;
  originalUnitPriceCents: number | null;
  discountType: string;
  discountValue: number | null;
  billingUnit: string;
  unitLabel: string;
  totalCents: number;
  missingPrice: boolean;
  priceSource: 'project' | 'default' | 'tjm' | 'missing';
};

export type PricingTotals = {
  totalCents: number;
  vatCents: number;
  totalTtcCents: number;
  depositCents: number;
  balanceCents: number;
  missingCount: number;
};

// ── hook ─────────────────────────────────────────────────────────────

type Props = {
  services: ServiceItem[];
  serviceDrafts: Record<string, ServiceDraft>;
  setServiceDrafts: React.Dispatch<React.SetStateAction<Record<string, ServiceDraft>>>;
  catalogServices: CatalogService[];
  billingSettings: BillingSettings | null | undefined;
};

export function usePricingEngine({
  services,
  serviceDrafts,
  setServiceDrafts,
  catalogServices,
  billingSettings,
}: Props) {
  // Sync drafts when services list changes
  useEffect(() => {
    setServiceDrafts((prev) => {
      const next = { ...prev };
      const ids = new Set(services.map((svc) => svc.id));
      for (const svc of services) {
        if (!next[svc.id]) {
          next[svc.id] = {
            quantity: String(svc.quantity ?? 1),
            price: formatCentsToEuroInput(svc.priceCents),
            title: svc.titleOverride ?? '',
            description: svc.description ?? svc.notes ?? '',
            discountType: svc.discountType ?? 'NONE',
            discountValue:
              svc.discountType === 'AMOUNT'
                ? formatCentsToEuroInput(svc.discountValue)
                : svc.discountValue != null
                  ? String(svc.discountValue)
                  : '',
            billingUnit: svc.billingUnit ?? 'ONE_OFF',
            unitLabel: svc.unitLabel ?? '',
          };
        }
      }
      for (const id of Object.keys(next)) {
        if (!ids.has(id)) delete next[id];
      }
      return next;
    });
  }, [services, setServiceDrafts]);

  const catalogById = useMemo(() => {
    return new Map(catalogServices.map((svc) => [svc.id, svc]));
  }, [catalogServices]);

  const catalogDurationById = useMemo(
    () => new Map(catalogServices.map((svc) => [svc.id, svc.durationHours ?? null])),
    [catalogServices]
  );

  const pricingLines: PricingLine[] = useMemo(() => {
    return services.map((svc) => {
      const draft = serviceDrafts[svc.id];
      const quantityRaw = draft?.quantity ?? String(svc.quantity ?? 1);
      const quantityNum = Number(quantityRaw);
      const quantity =
        Number.isFinite(quantityNum) && quantityNum > 0 ? Math.max(1, Math.trunc(quantityNum)) : svc.quantity ?? 1;
      const draftPriceCents = draft?.price ? parseEuroInputCents(draft.price) : null;
      const projectPriceCents = draftPriceCents ?? parseCents(svc.priceCents);
      const catalog = catalogById.get(svc.serviceId);
      const defaultPriceCents = parseCents(catalog?.defaultPriceCents ?? null);
      const tjmCents = parseCents(catalog?.tjmCents ?? null);
      const resolvedUnitCents = projectPriceCents ?? defaultPriceCents ?? tjmCents;
      const missingPrice = resolvedUnitCents == null;
      const discountType = draft?.discountType ?? svc.discountType ?? 'NONE';
      const discountValueRaw = draft?.discountValue ?? (svc.discountValue != null ? String(svc.discountValue) : '');
      const discountValue =
        discountType === 'AMOUNT'
          ? (discountValueRaw ? parseEuroInputCents(discountValueRaw) : null)
          : (() => {
              const num = discountValueRaw ? Number(discountValueRaw) : null;
              return Number.isFinite(num ?? NaN) ? Math.trunc(num ?? 0) : null;
            })();
      const applyDiscount = () => {
        if (resolvedUnitCents == null) return { final: null, original: null };
        if (discountType === 'PERCENT' && discountValue != null) {
          const bounded = Math.min(100, Math.max(0, discountValue));
          const final = Math.round(resolvedUnitCents * ((100 - bounded) / 100));
          return { final, original: resolvedUnitCents };
        }
        if (discountType === 'AMOUNT' && discountValue != null) {
          const bounded = Math.max(0, discountValue);
          const final = Math.max(0, resolvedUnitCents - bounded);
          return { final, original: resolvedUnitCents };
        }
        return { final: resolvedUnitCents, original: null };
      };
      const discounted = applyDiscount();
      const unitPriceCents = discounted.final;
      const totalCents = missingPrice || unitPriceCents == null ? 0 : unitPriceCents * quantity;
      const billingUnit = draft?.billingUnit ?? svc.billingUnit ?? 'ONE_OFF';
      let unitLabel = draft?.unitLabel ?? svc.unitLabel ?? '';
      if (billingUnit === 'MONTHLY' && !unitLabel) unitLabel = '/mois';
      return {
        id: svc.id,
        serviceId: svc.serviceId,
        quantity,
        unitPriceCents: unitPriceCents,
        originalUnitPriceCents: discounted.original,
        discountType,
        discountValue: discountValue,
        billingUnit,
        unitLabel,
        totalCents,
        missingPrice,
        priceSource: projectPriceCents
          ? 'project'
          : defaultPriceCents
            ? 'default'
            : tjmCents
              ? 'tjm'
              : 'missing',
      };
    });
  }, [catalogById, serviceDrafts, services]);

  const depositPercent = billingSettings?.defaultDepositPercent;
  const effectiveDepositPercent = Number.isFinite(depositPercent) ? Number(depositPercent) : 0;
  const vatEnabled = billingSettings?.vatEnabled ?? false;
  const vatRatePercent = billingSettings?.vatRatePercent ?? 0;

  const pricingTotals: PricingTotals = useMemo(() => {
    const totalCents = pricingLines.reduce((sum, line) => sum + (line.totalCents || 0), 0);
    const vatCents = vatEnabled ? Math.round(totalCents * (vatRatePercent / 100)) : 0;
    const totalTtcCents = totalCents + vatCents;
    const depositCents = Math.round(totalCents * (effectiveDepositPercent / 100));
    const balanceCents = totalCents - depositCents;
    const missingCount = pricingLines.filter((line) => line.missingPrice).length;
    return { totalCents, vatCents, totalTtcCents, depositCents, balanceCents, missingCount };
  }, [effectiveDepositPercent, pricingLines, vatEnabled, vatRatePercent]);

  const isBillingEmpty = services.length === 0;

  const missingPriceNames = useMemo(() => {
    return pricingLines
      .filter((line) => line.missingPrice)
      .map((line) => services.find((svc) => svc.id === line.id)?.service.name ?? 'Service');
  }, [pricingLines, services]);

  return {
    catalogById,
    catalogDurationById,
    pricingLines,
    pricingTotals,
    isBillingEmpty,
    missingPriceNames,
    depositPercent,
    effectiveDepositPercent,
    vatEnabled,
    vatRatePercent,
  };
}
