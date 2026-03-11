'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';

type OnboardingStep = {
  icon: ReactNode;
  title: string;
  description: string;
};

type OnboardingModalProps = {
  steps: OnboardingStep[];
  storageKey: string;
  apiField: 'onboardingPersonalDone' | 'onboardingProDone';
  onComplete: () => void;
};

export function OnboardingModal({ steps, storageKey, apiField, onComplete }: OnboardingModalProps) {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);
  const [direction, setDirection] = useState<'in' | 'out'>('in');

  useEffect(() => {
    // Double protection: check localStorage
    if (typeof window !== 'undefined' && localStorage.getItem(storageKey)) {
      onComplete();
      return;
    }
    setVisible(true);
  }, [storageKey, onComplete]);

  const goNext = useCallback(() => {
    if (current < steps.length - 1) {
      setDirection('out');
      setTimeout(() => {
        setCurrent((c) => c + 1);
        setDirection('in');
      }, 250);
    }
  }, [current, steps.length]);

  const goPrev = useCallback(() => {
    if (current > 0) {
      setDirection('out');
      setTimeout(() => {
        setCurrent((c) => c - 1);
        setDirection('in');
      }, 250);
    }
  }, [current]);

  const finish = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, '1');
    }
    // Mark done in DB (fire-and-forget)
    void fetchJson('/api/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: typeof window !== 'undefined' ? window.location.origin : '' },
      body: JSON.stringify({ [apiField]: true }),
    });
    setVisible(false);
    onComplete();
  }, [storageKey, apiField, onComplete]);

  if (!visible) return null;

  const step = steps[current];
  const isLast = current === steps.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-fade-in-up"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={finish}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-md rounded-3xl p-8 animate-celebrate-enter"
        style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-float)' }}
      >
        {/* Skip */}
        <button
          type="button"
          onClick={finish}
          className="absolute top-4 right-4 text-xs transition-opacity hover:opacity-100"
          style={{ color: 'var(--text-faint)', opacity: 0.6 }}
        >
          Passer
        </button>

        {/* Content */}
        <div
          key={current}
          className={direction === 'in' ? 'animate-onboarding-in' : 'animate-onboarding-out'}
        >
          <div className="flex flex-col items-center text-center gap-4">
            {/* Icon */}
            <div
              className="flex items-center justify-center rounded-2xl animate-confetti-pop"
              style={{ width: 64, height: 64, background: 'var(--shell-accent)' }}
            >
              {step.icon}
            </div>

            {/* Title */}
            <h2
              className="text-xl font-bold"
              style={{ color: 'var(--text)', fontFamily: 'var(--font-barlow), sans-serif' }}
            >
              {step.title}
            </h2>

            {/* Description */}
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-faint)' }}>
              {step.description}
            </p>
          </div>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mt-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === current ? 20 : 6,
                height: 6,
                background: i === current ? 'var(--shell-accent)' : 'var(--border)',
              }}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={goPrev}
            className="flex items-center gap-1 text-sm transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-faint)', visibility: current > 0 ? 'visible' : 'hidden' }}
          >
            <ChevronLeft size={16} />
            Précédent
          </button>

          {isLast ? (
            <Button onClick={finish} className="gap-2">
              <Sparkles size={16} />
              C&apos;est parti !
            </Button>
          ) : (
            <Button onClick={goNext} className="gap-2">
              Suivant
              <ChevronRight size={16} />
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
