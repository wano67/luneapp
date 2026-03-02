'use client';

import type { CSSProperties } from 'react';

export function DashboardIllustration() {
  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl"
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        aspectRatio: '16 / 10',
        maxWidth: 480,
      }}
    >
      {/* Fake sidebar */}
      <div
        className="absolute bottom-0 left-0 top-0"
        style={{
          width: '20%',
          background: 'var(--shell-sidebar-bg)',
          borderRadius: '16px 0 0 16px',
        }}
      >
        {/* Fake logo */}
        <div className="p-3">
          <div
            className="h-6 w-6 rounded-md animate-pulse-glow"
            style={{ background: 'var(--shell-accent)' }}
          />
        </div>
        {/* Fake nav items */}
        {[0.7, 1, 0.5, 0.8, 0.6].map((w, i) => (
          <div
            key={i}
            className="mx-3 mb-2 rounded-md animate-stagger-in"
            style={{
              height: 8,
              width: `${w * 60}%`,
              background: i === 1 ? 'var(--shell-sidebar-active-bg)' : 'rgba(238,237,227,0.15)',
              '--stagger-index': i,
              animationDelay: `${800 + i * 120}ms`,
            } as CSSProperties}
          />
        ))}
      </div>

      {/* Fake topbar */}
      <div
        className="absolute right-0 top-0"
        style={{
          left: '20%',
          height: '10%',
          background: 'var(--shell-topbar-bg)',
        }}
      >
        <div className="flex h-full items-center gap-2 px-4">
          <div className="h-2 w-12 rounded" style={{ background: 'var(--text-faint)', opacity: 0.3 }} />
          <div className="h-2 w-1 rounded" style={{ background: 'var(--border)' }} />
          <div className="h-2 w-16 rounded" style={{ background: 'var(--text)', opacity: 0.2 }} />
        </div>
      </div>

      {/* Fake main content */}
      <div
        className="absolute bottom-0 right-0"
        style={{ left: '20%', top: '10%', padding: '4%' }}
      >
        {/* KPI cards row */}
        <div className="mb-3 flex gap-2">
          {[
            { bg: 'var(--shell-accent)' },
            { bg: 'var(--success)' },
            { bg: 'var(--surface-2)' },
          ].map((kpi, i) => (
            <div
              key={i}
              className="flex-1 rounded-lg p-2 animate-kpi-appear"
              style={{
                background: kpi.bg,
                animationDelay: `${1200 + i * 200}ms`,
                animationFillMode: 'backwards',
              }}
            >
              <div
                className="mb-1.5 h-1.5 w-8 rounded"
                style={{ background: 'rgba(255,255,255,0.3)' }}
              />
              <div
                className="h-3 w-12 rounded"
                style={{ background: 'rgba(255,255,255,0.6)' }}
              />
            </div>
          ))}
        </div>

        {/* Fake bar chart */}
        <div className="flex items-end gap-1" style={{ height: '40%' }}>
          {[0.3, 0.5, 0.7, 0.4, 0.9, 0.6, 0.8].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t animate-bar-grow"
              style={{
                height: `${h * 100}%`,
                background: i === 4 ? 'var(--shell-accent)' : 'var(--surface-2)',
                animationDelay: `${1800 + i * 100}ms`,
                animationFillMode: 'backwards',
              }}
            />
          ))}
        </div>

        {/* Fake list rows */}
        <div className="mt-3 space-y-1.5">
          {[0.9, 0.7, 0.5].map((w, i) => (
            <div
              key={i}
              className="flex items-center gap-2 animate-stagger-in"
              style={{
                '--stagger-index': i,
                animationDelay: `${2400 + i * 100}ms`,
              } as CSSProperties}
            >
              <div
                className="h-2 rounded"
                style={{ width: `${w * 60}%`, background: 'var(--border)' }}
              />
              <div
                className="h-2 w-8 rounded"
                style={{ background: 'var(--shell-accent)', opacity: 0.5 }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
