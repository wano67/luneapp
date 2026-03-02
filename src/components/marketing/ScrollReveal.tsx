'use client';

import { useRef, useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Props = {
  children: ReactNode;
  className?: string;
  animation?: 'reveal-up' | 'reveal-left' | 'reveal-right' | 'reveal-scale';
  delay?: number;
  threshold?: number;
  as?: 'div' | 'section' | 'article';
};

export function ScrollReveal({
  children,
  className,
  animation = 'reveal-up',
  delay = 0,
  threshold = 0.15,
  as: Tag = 'div',
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      className={cn(visible ? `animate-${animation}` : 'opacity-0', className)}
      style={visible && delay > 0 ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
