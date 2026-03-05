'use client';

import { useEffect, useRef, useState } from 'react';

type SectionItem = {
  id: string;
  label: string;
};

type SectionNavProps = {
  items: SectionItem[];
};

export function SectionNav({ items }: SectionNavProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '');
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

    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    observerRef.current = observer;
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className="sticky top-0 z-10 -mx-1 flex items-center gap-1 overflow-x-auto bg-[var(--bg)]/80 px-1 py-2 backdrop-blur-sm">
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setActiveId(item.id);
          }}
          className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
          style={
            activeId === item.id
              ? { background: 'var(--shell-accent-dark)', color: 'white' }
              : { color: 'var(--text-secondary)' }
          }
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
