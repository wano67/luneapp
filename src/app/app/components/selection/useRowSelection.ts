import { useCallback, useMemo, useState } from 'react';

type RowSelectionOptions = {
  initialSelectedIds?: string[];
};

export function useRowSelection(options?: RowSelectionOptions) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(options?.initialSelectedIds ?? [])
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const toggleAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      }
      return new Set(ids);
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const selectedCount = selectedIds.size;
  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

  return {
    selectedIds,
    selectedArray,
    selectedCount,
    toggle,
    toggleAll,
    selectAll,
    clear,
    isSelected,
  };
}
