'use client';

import { useEffect, useRef, useState } from 'react';
import { useAddressAutocomplete } from '@/lib/hooks/useAddressAutocomplete';

export type AddressFields = {
  addressLine1: string;
  postalCode: string;
  city: string;
};

type AddressInputProps = {
  value: AddressFields;
  onChange: (fields: Partial<AddressFields>) => void;
  countryCode?: string;
  disabled?: boolean;
};

export function AddressInput({ value, onChange, countryCode = 'FR', disabled }: AddressInputProps) {
  const isFrance = countryCode.toUpperCase() === 'FR';
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { suggestions } = useAddressAutocomplete(value.addressLine1, isFrance && showSuggestions);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-3" ref={wrapperRef}>
      <div className="relative">
        <label className="mb-1 block text-sm font-medium text-[var(--text)]">Adresse</label>
        <input
          type="text"
          value={value.addressLine1}
          onChange={(e) => {
            onChange({ addressLine1: e.target.value });
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          placeholder="12 rue de la Paix"
          disabled={disabled}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          autoComplete="off"
        />
        {showSuggestions && suggestions.length > 0 ? (
          <ul className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg">
            {suggestions.map((s) => (
              <li key={s.label}>
                <button
                  type="button"
                  className="w-full cursor-pointer px-3 py-2 text-left text-sm text-[var(--text)] transition hover:bg-[var(--surface-hover)]"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange({ addressLine1: s.street, postalCode: s.postcode, city: s.city });
                    setShowSuggestions(false);
                  }}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text)]">Code postal</label>
          <input
            type="text"
            value={value.postalCode}
            onChange={(e) => onChange({ postalCode: e.target.value })}
            placeholder="75002"
            disabled={disabled}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text)]">Ville</label>
          <input
            type="text"
            value={value.city}
            onChange={(e) => onChange({ city: e.target.value })}
            placeholder="Paris"
            disabled={disabled}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </div>
      </div>
    </div>
  );
}
