'use client';

import {
  useRef,
  useEffect,
  useState,
  Children,
  cloneElement,
  isValidElement,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { cn } from '@/lib/cn';

type Props = {
  children: ReactNode;
  className?: string;
  staggerMs?: number;
  threshold?: number;
};

export function StaggerChildren({ children, className, staggerMs = 80, threshold = 0.1 }: Props) {
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
    <div ref={ref} className={className}>
      {Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child;
        const childProps = child.props as { className?: string; style?: CSSProperties };
        return cloneElement(child as React.ReactElement<Record<string, unknown>>, {
          className: cn(childProps.className, visible ? 'animate-stagger-in' : 'opacity-0'),
          style: {
            ...(childProps.style ?? {}),
            '--stagger-index': i,
            animationDelay: visible ? `${i * staggerMs}ms` : undefined,
          } as CSSProperties,
        });
      })}
    </div>
  );
}
