'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { fetchJson } from '@/lib/apiClient';

type ReferenceType = 'CATEGORY' | 'TAG';

type ReferenceItem = {
  id: string;
  name: string;
};

type ReferenceListResponse = {
  items: Array<{ id: string; name: string }>;
};

type ReferencePickerProps = {
  businessId: string;
  categoryId: string | null;
  tagIds: string[];
  onCategoryChange: (id: string | null) => void;
  onTagsChange: (ids: string[]) => void;
  disabled?: boolean;
  title?: string;
};

async function loadReferences(businessId: string, type: ReferenceType) {
  const res = await fetchJson<ReferenceListResponse>(
    `/api/pro/businesses/${businessId}/references?type=${type}`
  );
  return res;
}

export function ReferencePicker(props: ReferencePickerProps) {
  const { businessId, categoryId, tagIds, onCategoryChange, onTagsChange, disabled = false, title } = props;
  const [categories, setCategories] = useState<ReferenceItem[]>([]);
  const [tags, setTags] = useState<ReferenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      setLoading(true);
      setError(null);
      setRequestId(null);
      const [catRes, tagRes] = await Promise.all([loadReferences(businessId, 'CATEGORY'), loadReferences(businessId, 'TAG')]);
      if (cancelled) return;
      if (!catRes.ok || !tagRes.ok || !catRes.data || !tagRes.data) {
        const msg = catRes.error || tagRes.error || 'Impossible de charger les références.';
        setError(
          catRes.requestId || tagRes.requestId ? `${msg} (Ref: ${catRes.requestId || tagRes.requestId})` : msg
        );
      } else {
        setCategories(catRes.data.items);
        setTags(tagRes.data.items);
      }
      setRequestId(catRes.requestId || tagRes.requestId || null);
      setLoading(false);
    }
    void fetchAll();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  function toggleTag(id: string) {
    if (disabled) return;
    if (tagIds.includes(id)) {
      onTagsChange(tagIds.filter((t) => t !== id));
    } else {
      onTagsChange([...tagIds, id]);
    }
  }

  return (
    <Card className="space-y-3 p-3">
      {title ? <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">{title}</p> : null}
      {loading ? <p className="text-sm text-[var(--text-secondary)]">Chargement des références…</p> : null}
      {error ? <p className="text-xs text-rose-500">{error}</p> : null}
      {requestId ? (
        <p className="text-[10px] text-[var(--text-secondary)]">Request ID: {requestId}</p>
      ) : null}

      <div className="space-y-2">
        <label className="space-y-1">
          <span className="text-sm font-medium text-[var(--text-secondary)]">Catégorie</span>
          <Select
            value={categoryId ?? ''}
            onChange={(e) => onCategoryChange(e.target.value || null)}
            disabled={disabled || loading}
          >
            <option value="">Aucune</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </Select>
        </label>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Tags</span>
            {!disabled && tagIds.length ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onTagsChange([])}
                disabled={disabled || loading}
              >
                Effacer
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const active = tagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  disabled={disabled || loading}
                  className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                >
                  <Badge
                    variant="neutral"
                    className={
                      active
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
                    }
                  >
                    {tag.name}
                  </Badge>
                </button>
              );
            })}
            {!tags.length && !loading ? (
              <p className="text-sm text-[var(--text-secondary)]">Aucun tag disponible.</p>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
