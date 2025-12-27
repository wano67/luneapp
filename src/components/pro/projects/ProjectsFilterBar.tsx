import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { ProjectFilters } from '@/lib/hooks/useProjects';
import { useClientsLite } from '@/lib/hooks/useClientsLite';

const statusOptions = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'PLANNED', label: 'Planifié' },
  { value: 'ACTIVE', label: 'En cours' },
  { value: 'ON_HOLD', label: 'En attente' },
  { value: 'COMPLETED', label: 'Terminé' },
  { value: 'CANCELLED', label: 'Annulé' },
];

type Props = {
  initialFilters: ProjectFilters;
  onChange: (next: ProjectFilters) => void;
  businessId: string;
};

export function ProjectsFilterBar({ initialFilters, onChange, businessId }: Props) {
  const [openAdvanced, setOpenAdvanced] = useState(false);
  const [filters, setFilters] = useState<ProjectFilters>(initialFilters);
  const [clientQuery, setClientQuery] = useState('');
  const [selectedClientName, setSelectedClientName] = useState<string>('');
  const [searchInput, setSearchInput] = useState(initialFilters.q ?? '');
  const { data: clients } = useClientsLite(businessId, clientQuery);

  const derivedClientName =
    selectedClientName ||
    (filters.clientId ? clients.find((c) => c.id === filters.clientId)?.name ?? '' : '');

  const activeChips = [
    filters.status && filters.status !== 'all'
      ? { label: statusOptions.find((s) => s.value === filters.status)?.label ?? filters.status, key: 'status' }
      : null,
    filters.clientId ? { label: derivedClientName || `Client #${filters.clientId}`, key: 'clientId' } : null,
    filters.archived ? { label: filters.archived === 'true' ? 'Archivés' : 'Actifs', key: 'archived' } : null,
    filters.q ? { label: `Recherche: ${filters.q}`, key: 'q' } : null,
  ].filter(Boolean) as Array<{ label: string; key: keyof ProjectFilters }>;

  function clearAll() {
    const reset = { status: 'all', q: '', clientId: '', archived: undefined };
    setFilters(reset);
    setSearchInput('');
    setSelectedClientName('');
    onChange({ status: 'all', q: '' });
  }

  // debounce search
  useEffect(() => {
    const handle = setTimeout(() => {
      onChange({ ...filters, q: searchInput });
    }, 350);
    return () => clearTimeout(handle);
  }, [filters, onChange, searchInput]);

  const filteredClients = useMemo(() => {
    if (!clientQuery.trim()) return clients.slice(0, 10);
    const q = clientQuery.toLowerCase();
    return clients.filter((c) => (c.name ?? '').toLowerCase().includes(q)).slice(0, 10);
  }, [clientQuery, clients]);

  function selectClient(id: string | null, name: string) {
    setFilters((prev) => ({ ...prev, clientId: id ?? undefined }));
    setSelectedClientName(id ? name : '');
    setClientQuery('');
    onChange({ ...filters, clientId: id ?? undefined });
  }

  const showList = clientQuery.trim().length > 0 && filteredClients.length > 0;

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[2fr_1.2fr_1.2fr]">
        <Input
          label="Recherche"
          placeholder="Nom du projet"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Select
          label="Statut"
          value={filters.status ?? 'all'}
          onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <div className="space-y-1">
          <label className="text-xs text-[var(--text-secondary)]">Client</label>
          <div className="relative">
            <input
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              placeholder="Rechercher un client"
              value={derivedClientName || clientQuery}
              onChange={(e) => {
                setSelectedClientName('');
                setClientQuery(e.target.value);
              }}
            />
            {showList ? (
              <div className="absolute z-10 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg">
                {filteredClients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-hover)]"
                    onClick={() => selectClient(c.id, c.name ?? 'Sans nom')}
                  >
                    {c.name ?? 'Sans nom'} <span className="text-[var(--text-secondary)]">#{c.id}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                  onClick={() => selectClient(null, '')}
                >
                  Effacer le client
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {openAdvanced ? (
        <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
          <Select
            label="Archivés"
            value={filters.archived ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              const value = raw === 'true' || raw === 'false' ? raw : undefined;
              setFilters((prev) => ({ ...prev, archived: value }));
            }}
          >
            <option value="">Tous</option>
            <option value="false">Actifs uniquement</option>
            <option value="true">Archivés uniquement</option>
          </Select>
          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={clearAll}
              className="w-full"
            >
              Réinitialiser
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpenAdvanced(true)}
            className="text-xs"
          >
            Filtres avancés
          </Button>
          <Button type="button" variant="ghost" onClick={clearAll} className="text-xs text-[var(--text-secondary)]">
            Effacer
          </Button>
        </div>
      )}

      {activeChips.length ? (
        <div className="flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <Badge
              key={chip.key}
              variant="neutral"
              className="cursor-pointer bg-[var(--surface-2)] text-[var(--text-secondary)]"
              onClick={() => {
                const next = { ...filters, [chip.key]: undefined };
                setFilters(next);
                if (chip.key === 'clientId') {
                  setSelectedClientName('');
                  setClientQuery('');
                }
                onChange(next);
              }}
            >
              {chip.label} ✕
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
