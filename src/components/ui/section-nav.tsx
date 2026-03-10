'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type SectionItem = {
  id: string;
  label: string;
};

type SectionGroup = {
  label: string;
  items: SectionItem[];
};

type SectionNavProps = {
  items?: SectionItem[];
  groups?: SectionGroup[];
};

export function SectionNav({ items, groups }: SectionNavProps) {
  const flatItems = useMemo(() => {
    if (groups) return groups.flatMap((g) => g.items);
    return items ?? [];
  }, [items, groups]);

  const [activeId, setActiveId] = useState(flatItems[0]?.id ?? '');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current?.disconnect();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 },
    );

    for (const item of flatItems) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    observerRef.current = observer;
    return () => observer.disconnect();
  }, [flatItems]);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
  }

  function renderPill(item: SectionItem) {
    return (
      <a
        key={item.id}
        href={`#${item.id}`}
        onClick={(e) => { e.preventDefault(); scrollTo(item.id); }}
        className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap"
        style={
          activeId === item.id
            ? { background: 'var(--shell-accent-dark)', color: 'white' }
            : { color: 'var(--text-secondary)' }
        }
      >
        {item.label}
      </a>
    );
  }

  if (groups && groups.length > 0) {
    return (
      <nav className="sticky top-0 z-10 -mx-1 flex items-center gap-1 overflow-x-auto bg-[var(--bg)]/80 px-1 py-3 backdrop-blur-sm">
        {groups.map((group, gi) => (
          <div key={group.label} className="flex items-center gap-1 shrink-0">
            {gi > 0 && (
              <span className="mx-1.5 h-4 w-px shrink-0 bg-[var(--border)]" />
            )}
            {group.items.map(renderPill)}
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav className="sticky top-0 z-10 -mx-1 flex items-center gap-1 overflow-x-auto bg-[var(--bg)]/80 px-1 py-3 backdrop-blur-sm">
      {flatItems.map(renderPill)}
    </nav>
  );
}
