import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

type Item = { code: string; label: string; meta?: string };

export type SearchSelectProps = {
  label: string;
  placeholder?: string;
  items: Item[];
  value: string;
  onChange: (code: string) => void;
  error?: string | null;
  helper?: string;
  disabled?: boolean;
};

const DROPDOWN_MAX_H = 280; // search input + max-h-56 list

function applyPosition(buttonEl: HTMLElement | null, dropdownEl: HTMLElement | null) {
  const rect = buttonEl?.getBoundingClientRect();
  if (!rect || !dropdownEl) return;
  const spaceBelow = window.innerHeight - rect.bottom;
  const openUp = spaceBelow < DROPDOWN_MAX_H && rect.top > spaceBelow;
  dropdownEl.style.left = `${rect.left}px`;
  dropdownEl.style.width = `${rect.width}px`;
  if (openUp) {
    dropdownEl.style.top = '';
    dropdownEl.style.bottom = `${window.innerHeight - rect.top + 4}px`;
  } else {
    dropdownEl.style.top = `${rect.bottom + 4}px`;
    dropdownEl.style.bottom = '';
  }
}

export function SearchSelect({ label, placeholder, items, value, onChange, error, helper, disabled }: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const normalized = (str: string) =>
    str
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();

  const selected = items.find((it) => it.code === value) ?? null;

  const filtered = useMemo(() => {
    const q = normalized(query);
    if (!q) return items;
    return items.filter((it) => normalized(it.label).includes(q));
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => applyPosition(buttonRef.current, dropdownRef.current);
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey as unknown as EventListener);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey as unknown as EventListener);
    };
  }, [open]);

  const selectItem = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      listRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }
    if (e.key === 'Enter') {
      if (!query) return;
      const exact = items.find((it) => normalized(it.label) === normalized(query));
      if (exact) selectItem(exact.code);
    }
  };

  const handleBlur = () => {
    if (!query) return;
    const exact = items.find((it) => normalized(it.label) === normalized(query));
    if (exact) {
      selectItem(exact.code);
    }
  };

  // Position the dropdown via ref callback (runs on mount)
  const dropdownRefCallback = useCallback(
    (el: HTMLDivElement | null) => {
      dropdownRef.current = el;
      if (el) applyPosition(buttonRef.current, el);
    },
    []
  );

  const dropdown = open
    ? createPortal(
        <div
          ref={dropdownRefCallback}
          className="fixed z-[80] rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg"
        >
          <div className="border-b border-[var(--border)] px-3 py-2">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={handleBlur}
              placeholder={placeholder ?? 'Rechercher\u2026'}
              className="w-full rounded-lg bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
            />
          </div>
          <ul
            ref={listRef}
            className="max-h-56 overflow-y-auto p-1 text-sm text-[var(--text-primary)]"
            role="listbox"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-[var(--text-secondary)]">Aucun résultat</li>
            ) : (
              filtered.map((it) => (
                <li key={it.code}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition',
                      'hover:bg-[var(--surface-hover)] focus:bg-[var(--surface-hover)] focus:outline-none',
                      it.code === value ? 'bg-[var(--surface-hover)] font-semibold' : ''
                    )}
                    onClick={() => selectItem(it.code)}
                  >
                    <span>{it.label}</span>
                    {it.meta ? <span className="text-[var(--text-secondary)]">{it.meta}</span> : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-[var(--text-secondary)]">{label}</label>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          className={cn(
            'flex w-full items-center justify-between rounded-xl border bg-[var(--surface)] px-4 py-3 text-left text-base text-[var(--text-primary)] transition-colors',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
            error
              ? 'border-[var(--danger)] focus-visible:outline-[var(--danger)]'
              : 'border-[var(--border)] hover:border-[var(--border-strong)]',
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
          )}
          onClick={() => !disabled && setOpen((v) => !v)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="truncate">{selected ? selected.label : placeholder ?? 'Sélectionner'}</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="shrink-0 text-[var(--text-secondary)]"
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {dropdown}
      </div>
      {helper ? <p className="text-xs text-[var(--text-secondary)]">{helper}</p> : null}
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
