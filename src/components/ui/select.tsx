'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string | ReactNode;
  error?: string | null;
};

// ── Option parsing ───────────────────────────────────────────────────────

type ParsedItem =
  | { kind: 'option'; value: string; label: string; disabled?: boolean }
  | { kind: 'group'; label: string };

function parseChildren(children: ReactNode): ParsedItem[] {
  const items: ParsedItem[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === 'optgroup') {
      const groupProps = child.props as Record<string, unknown>;
      items.push({ kind: 'group', label: String(groupProps.label ?? '') });
      React.Children.forEach(groupProps.children as ReactNode, (optChild: unknown) => {
        if (!React.isValidElement(optChild)) return;
        const props = optChild.props as Record<string, unknown>;
        items.push({
          kind: 'option',
          value: String(props.value ?? ''),
          label: typeof props.children === 'string' ? props.children : String(props.children ?? ''),
          disabled: !!props.disabled,
        });
      });
      return;
    }
    if (child.type === 'option') {
      const props = child.props as Record<string, unknown>;
      items.push({
        kind: 'option',
        value: String(props.value ?? ''),
        label: typeof props.children === 'string' ? props.children : String(props.children ?? ''),
        disabled: !!props.disabled,
      });
    }
  });
  return items;
}

// ── Native fallback (multiple selects) ──────────────────────────────────

function NativeSelect({ label, error, className, children, ...props }: SelectProps) {
  return (
    <label className="flex w-full flex-col gap-1">
      {label ? (
        <span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span>
      ) : null}
      <div className="relative">
        <select
          className={cn(
            'w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 pr-12 text-base text-[var(--text-primary)] transition-colors',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
            error
              ? 'border-[var(--danger)] focus-visible:outline-[var(--danger)]'
              : 'hover:border-[var(--border-strong)]',
            className
          )}
          {...props}
        >
          {children}
        </select>
        {!props.multiple ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[var(--text-secondary)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        ) : null}
      </div>
      {error ? <span className="text-xs text-[var(--danger)]">{error}</span> : null}
    </label>
  );
}

// ── Custom dropdown ─────────────────────────────────────────────────────

function CustomSelect({
  label,
  error,
  className,
  children,
  value,
  onChange,
  disabled,
  name,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const items = parseChildren(children);

  const options = items.filter((it): it is Extract<ParsedItem, { kind: 'option' }> => it.kind === 'option');
  const selectedOption = options.find((o) => String(o.value) === String(value ?? ''));

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const handleSelect = useCallback(
    (optValue: string) => {
      setOpen(false);
      if (!onChange) return;
      const syntheticEvent = {
        target: { value: optValue, name: name ?? '' },
      } as React.ChangeEvent<HTMLSelectElement>;
      onChange(syntheticEvent);
    },
    [onChange, name]
  );

  return (
    <div className="flex w-full flex-col gap-1" ref={containerRef}>
      {label ? (
        <span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span>
      ) : null}
      <div className="relative">
        <button
          type="button"
          className={cn(
            'flex w-full items-center justify-between rounded-xl border bg-[var(--surface)] px-4 py-3 text-left text-base text-[var(--text-primary)] transition-colors',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
            error
              ? 'border-[var(--danger)] focus-visible:outline-[var(--danger)]'
              : 'border-[var(--border)] hover:border-[var(--border-strong)]',
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
            className
          )}
          onClick={() => !disabled && setOpen((v) => !v)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="truncate">{selectedOption?.label ?? 'Sélectionner'}</span>
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

        {open ? (
          <ul
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg"
            role="listbox"
          >
            {items.map((item, idx) => {
              if (item.kind === 'group') {
                return (
                  <li
                    key={`g-${idx}`}
                    className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]"
                  >
                    {item.label}
                  </li>
                );
              }
              return (
                <li key={`o-${item.value}-${idx}`}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition',
                      'hover:bg-[var(--surface-hover)] focus:bg-[var(--surface-hover)] focus:outline-none',
                      String(item.value) === String(value ?? '') ? 'bg-[var(--surface-hover)] font-semibold' : '',
                      item.disabled ? 'cursor-not-allowed opacity-50' : ''
                    )}
                    onClick={() => !item.disabled && handleSelect(item.value)}
                    disabled={item.disabled}
                  >
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      {error ? <span className="text-xs text-[var(--danger)]">{error}</span> : null}
    </div>
  );
}

// ── Public API ──────────────────────────────────────────────────────────

export function Select(props: SelectProps) {
  if (props.multiple) {
    return <NativeSelect {...props} />;
  }
  return <CustomSelect {...props} />;
}

export default Select;
