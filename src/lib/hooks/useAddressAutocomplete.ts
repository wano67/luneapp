'use client';

import { useEffect, useRef, useState } from 'react';

export type AddressSuggestion = {
  label: string;
  street: string;
  postcode: string;
  city: string;
};

type BanFeature = {
  properties: {
    label: string;
    name: string;
    postcode: string;
    city: string;
  };
};

type BanResponse = {
  features: BanFeature[];
};

export function useAddressAutocomplete(query: string, enabled = true) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || query.trim().length < 4) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const url = `https://api-adresse.data.gouv.fr/search?q=${encodeURIComponent(query.trim())}&limit=5`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error('BAN API error');
        const data: BanResponse = await res.json();
        setSuggestions(
          data.features.map((f) => ({
            label: f.properties.label,
            street: f.properties.name,
            postcode: f.properties.postcode,
            city: f.properties.city,
          }))
        );
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [query, enabled]);

  return { suggestions, loading };
}
