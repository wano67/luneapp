'use client';

import { cn } from '@/lib/cn';

type PivotCoverVariant = 'web' | 'social' | 'branding';

type VariantConfig = {
  label: string;
  background: string;
  textColor: string;
  rayAsset: string;
  badgeBorder: string;
};

const VARIANTS: Record<PivotCoverVariant, VariantConfig> = {
  web: {
    label: 'Webdesign',
    background: '#8c6c6c',
    textColor: '#d7d5bb',
    rayAsset: 'https://www.figma.com/api/mcp/asset/bf51af43-d518-48e5-aa3e-ba6126954c69',
    badgeBorder: '#d7d5bb',
  },
  social: {
    label: 'Social Média',
    background: '#eeede3',
    textColor: '#000000',
    rayAsset: 'https://www.figma.com/api/mcp/asset/1d25d1b2-5bce-4b65-b3c3-7f62cd900aa9',
    badgeBorder: '#d7d5bb',
  },
  branding: {
    label: 'Branding',
    background: '#1e1e1e',
    textColor: '#d7d5bb',
    rayAsset: 'https://www.figma.com/api/mcp/asset/f8634c83-d51d-4eab-b70a-33df2c68fb21',
    badgeBorder: '#d7d5bb',
  },
};

export function PivotCoverFromFigma({
  variant = 'web',
  className,
  nodeId,
}: {
  variant?: PivotCoverVariant;
  className?: string;
  nodeId?: string;
}) {
  const v = VARIANTS[variant];

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-2xl px-6 py-8 sm:px-10 sm:py-12 md:px-[72px] md:py-[80px]',
        className,
      )}
      style={{
        backgroundColor: v.background,
        aspectRatio: '16 / 9',
      }}
      data-node-id={nodeId ?? '2010:151'}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={v.rayAsset}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />

      <div className="relative z-10 flex h-full flex-col justify-start gap-5 md:gap-8">
        <div
          className="leading-[0.8] tracking-tight"
          style={{
            color: v.textColor,
            fontFamily: 'Georgia, serif',
            fontWeight: 700,
            fontSize: 'clamp(72px, 11vw, 220px)',
          }}
          data-node-id={variant === 'web' ? '2010:155' : variant === 'social' ? '2010:162' : '2010:169'}
        >
          aaa
        </div>

        <div className="space-y-4 md:space-y-6">
          <p
            className="leading-[1.05]"
            style={{
              color: v.textColor,
              fontFamily: 'var(--font-sans), sans-serif',
              fontWeight: 500,
              fontSize: 'clamp(28px, 5vw, 78px)',
            }}
            data-node-id={variant === 'web' ? '2006:160' : variant === 'social' ? '2010:164' : '2010:171'}
          >
            {v.label}
          </p>

          <div
            className="inline-flex items-center rounded-full border bg-black px-5 py-2.5 sm:px-8 sm:py-3"
            style={{ borderColor: v.badgeBorder, borderWidth: 2 }}
            data-node-id={variant === 'branding' ? '2010:172' : '2010:147'}
          >
            <span
              className="uppercase"
              style={{
                color: '#d7d5bb',
                fontFamily: 'var(--font-sans), sans-serif',
                fontWeight: 700,
                fontSize: 'clamp(18px, 2.4vw, 34px)',
                lineHeight: 1,
              }}
            >
              Archivé
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
