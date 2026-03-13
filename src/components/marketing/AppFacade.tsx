'use client';

import type { CSSProperties } from 'react';

/**
 * Animated mockup of the Pivot app interface.
 * Used on marketing pages to tease the product visually.
 */
export function AppFacade() {
  return (
    <div
      className="relative mx-auto w-full overflow-hidden rounded-2xl shadow-xl"
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        aspectRatio: '16 / 9',
        maxWidth: 720,
      }}
    >
      {/* ── Sidebar ── */}
      <div
        className="absolute bottom-0 left-0 top-0 flex flex-col"
        style={{
          width: '18%',
          background: 'var(--shell-sidebar-bg)',
          borderRadius: '16px 0 0 16px',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-1.5 p-3">
          <div
            className="h-5 w-5 rounded-md animate-pulse-glow"
            style={{ background: 'var(--shell-accent)' }}
          />
          <div
            className="h-2 w-10 rounded"
            style={{ background: 'rgba(238,237,227,0.4)' }}
          />
        </div>

        {/* Nav items */}
        <div className="flex flex-col gap-0.5 px-2">
          {[
            { w: 0.65, active: false, label: 'Dashboard' },
            { w: 0.75, active: true, label: 'Projets' },
            { w: 0.5, active: false, label: 'Clients' },
            { w: 0.6, active: false, label: 'Factures' },
            { w: 0.45, active: false, label: 'Tâches' },
            { w: 0.55, active: false, label: 'Compta' },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 animate-stagger-in"
              style={{
                background: item.active ? 'var(--shell-sidebar-active-bg)' : 'transparent',
                '--stagger-index': i,
                animationDelay: `${600 + i * 80}ms`,
              } as CSSProperties}
            >
              <div
                className="h-2.5 w-2.5 shrink-0 rounded"
                style={{
                  background: item.active
                    ? 'var(--shell-accent)'
                    : 'rgba(238,237,227,0.25)',
                }}
              />
              <div
                className="h-1.5 rounded"
                style={{
                  width: `${item.w * 100}%`,
                  background: item.active
                    ? 'var(--shell-sidebar-active-text)'
                    : 'rgba(238,237,227,0.3)',
                }}
              />
            </div>
          ))}
        </div>

        {/* Bottom section */}
        <div className="mt-auto px-2 pb-3">
          <div className="h-px w-full rounded" style={{ background: 'rgba(238,237,227,0.1)' }} />
          <div className="mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5">
            <div className="h-4 w-4 rounded-full" style={{ background: 'var(--shell-accent)', opacity: 0.6 }} />
            <div className="h-1.5 w-8 rounded" style={{ background: 'rgba(238,237,227,0.25)' }} />
          </div>
        </div>
      </div>

      {/* ── Top bar ── */}
      <div
        className="absolute right-0 top-0 flex items-center justify-between px-4"
        style={{
          left: '18%',
          height: '8%',
          background: 'var(--shell-topbar-bg)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 rounded" style={{ background: 'var(--text)', opacity: 0.15 }} />
          <div className="h-2 w-1 rounded" style={{ background: 'var(--border)' }} />
          <div className="h-2 w-24 rounded" style={{ background: 'var(--text)', opacity: 0.25 }} />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded" style={{ background: 'var(--border)' }} />
          <div className="h-5 w-5 rounded-full" style={{ background: 'var(--surface-2)' }} />
        </div>
      </div>

      {/* ── Main content ── */}
      <div
        className="absolute bottom-0 right-0 overflow-hidden"
        style={{ left: '18%', top: '8%', padding: '2.5%' }}
      >
        {/* Page header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-28 rounded animate-kpi-appear"
              style={{
                background: 'var(--text)',
                opacity: 0.2,
                animationDelay: '1000ms',
                animationFillMode: 'backwards',
              }}
            />
          </div>
          <div className="flex gap-1.5">
            <div
              className="h-5 w-16 rounded-md animate-kpi-appear"
              style={{
                background: 'var(--accent)',
                opacity: 0.8,
                animationDelay: '1100ms',
                animationFillMode: 'backwards',
              }}
            />
            <div
              className="h-5 w-5 rounded-md animate-kpi-appear"
              style={{
                background: 'var(--surface-2)',
                animationDelay: '1150ms',
                animationFillMode: 'backwards',
              }}
            />
          </div>
        </div>

        {/* KPI cards row */}
        <div className="mb-3 grid grid-cols-4 gap-2">
          {[
            { label: 'CA', color: 'var(--shell-accent)' },
            { label: 'Projets', color: 'var(--success)' },
            { label: 'Factures', color: 'var(--warning, #f59e0b)' },
            { label: 'Patrimoine', color: 'var(--surface-2)' },
          ].map((kpi, i) => (
            <div
              key={i}
              className="rounded-lg p-2 animate-kpi-appear"
              style={{
                background: kpi.color,
                animationDelay: `${1200 + i * 150}ms`,
                animationFillMode: 'backwards',
              }}
            >
              <div
                className="mb-1 h-1 w-10 rounded"
                style={{ background: 'rgba(255,255,255,0.35)' }}
              />
              <div
                className="h-2.5 w-14 rounded"
                style={{ background: 'rgba(255,255,255,0.6)' }}
              />
            </div>
          ))}
        </div>

        {/* Two-column layout: chart + list */}
        <div className="grid grid-cols-5 gap-2" style={{ height: '55%' }}>
          {/* Chart area */}
          <div
            className="col-span-3 rounded-lg border border-[var(--border)] p-2"
            style={{ background: 'var(--surface)' }}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="h-1.5 w-14 rounded" style={{ background: 'var(--text)', opacity: 0.15 }} />
              <div className="flex gap-1">
                {['var(--shell-accent)', 'var(--success)', 'var(--border)'].map((c, i) => (
                  <div key={i} className="flex items-center gap-0.5">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                    <div className="h-1 w-6 rounded" style={{ background: 'var(--text)', opacity: 0.1 }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Bar chart */}
            <div className="flex items-end gap-[3px]" style={{ height: '75%' }}>
              {[0.3, 0.5, 0.7, 0.45, 0.85, 0.6, 0.75, 0.4, 0.9, 0.55, 0.65, 0.8].map((h, i) => (
                <div key={i} className="flex flex-1 flex-col items-stretch gap-[1px]">
                  <div
                    className="rounded-t animate-bar-grow"
                    style={{
                      height: `${h * 100}%`,
                      background: i % 3 === 0 ? 'var(--shell-accent)' : i % 3 === 1 ? 'var(--success)' : 'var(--surface-2)',
                      animationDelay: `${1800 + i * 60}ms`,
                      animationFillMode: 'backwards',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Right panel — project list */}
          <div
            className="col-span-2 rounded-lg border border-[var(--border)] p-2"
            style={{ background: 'var(--surface)' }}
          >
            <div className="mb-2 h-1.5 w-12 rounded" style={{ background: 'var(--text)', opacity: 0.15 }} />
            <div className="space-y-1.5">
              {[
                { w: 0.85, accent: true, progress: 0.7 },
                { w: 0.7, accent: false, progress: 0.45 },
                { w: 0.6, accent: false, progress: 0.9 },
                { w: 0.75, accent: false, progress: 0.3 },
                { w: 0.5, accent: false, progress: 0.6 },
              ].map((row, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-md px-1.5 py-1 animate-stagger-in"
                  style={{
                    background: row.accent ? 'var(--accent)' : 'transparent',
                    opacity: row.accent ? 0.1 : 1,
                    '--stagger-index': i,
                    animationDelay: `${2200 + i * 80}ms`,
                  } as CSSProperties}
                >
                  <div
                    className="h-1.5 rounded"
                    style={{ width: `${row.w * 50}%`, background: 'var(--text)', opacity: 0.2 }}
                  />
                  <div className="ml-auto flex items-center gap-1">
                    <div
                      className="h-1 w-8 overflow-hidden rounded-full"
                      style={{ background: 'var(--border)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${row.progress * 100}%`,
                          background: row.progress > 0.7 ? 'var(--success)' : 'var(--shell-accent)',
                        }}
                      />
                    </div>
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{
                        background: row.progress > 0.7 ? 'var(--success)' : 'var(--shell-accent)',
                        opacity: 0.6,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
