import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Hook genérico de visibilidade de colunas com persistência em `localStorage`.
 *
 * Contrato:
 *  - Se há preferência salva: ela é respeitada absolutamente (filtrando IDs desconhecidos).
 *    Não "re-injetamos" defaults para evitar reverter escolhas explícitas do usuário.
 *  - Se não há preferência: usa o conjunto `defaultVisible`.
 *  - Para lançar uma coluna nova visível a todos os usuários (mesmo aos que já têm
 *    preferências salvas), basta versionar o `storageKey` (ex.: `_v1` → `_v2`).
 *  - Persiste o set a cada mudança.
 */

export interface ColumnDefBase<T extends string> {
  id: T;
  defaultVisible: boolean;
}

export interface UseColumnVisibilityResult<T extends string> {
  visibleIds: ReadonlySet<T>;
  isVisible: (id: T) => boolean;
  toggleColumn: (id: T) => void;
  setColumn: (id: T, visible: boolean) => void;
  setColumnsVisible: (ids: readonly T[], visible: boolean) => void;
  resetDefaults: () => void;
}

function buildInitialSet<T extends string>(
  storageKey: string,
  allDefs: readonly ColumnDefBase<T>[],
): Set<T> {
  const validIds = new Set(allDefs.map((d) => d.id));
  const defaults = new Set(allDefs.filter((d) => d.defaultVisible).map((d) => d.id));

  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaults;

    const saved = parsed.filter((x): x is T => typeof x === "string" && validIds.has(x as T));
    return new Set<T>(saved);
  } catch {
    return defaults;
  }
}

export function useColumnVisibility<T extends string>(
  storageKey: string,
  allDefs: readonly ColumnDefBase<T>[],
): UseColumnVisibilityResult<T> {
  const [visibleIds, setVisibleIds] = useState<Set<T>>(() =>
    buildInitialSet(storageKey, allDefs),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(Array.from(visibleIds)));
    } catch {
      // localStorage indisponível (modo privado, quota cheia, etc.) — não fatal.
    }
  }, [storageKey, visibleIds]);

  const toggleColumn = useCallback((id: T) => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setColumn = useCallback((id: T, visible: boolean) => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      if (visible) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const setColumnsVisible = useCallback((ids: readonly T[], visible: boolean) => {
    if (ids.length === 0) return;
    setVisibleIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (visible) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const resetDefaults = useCallback(() => {
    setVisibleIds(new Set(allDefs.filter((d) => d.defaultVisible).map((d) => d.id)));
  }, [allDefs]);

  const isVisible = useCallback((id: T) => visibleIds.has(id), [visibleIds]);

  const readonlyVisible = useMemo(() => visibleIds as ReadonlySet<T>, [visibleIds]);

  return {
    visibleIds: readonlyVisible,
    isVisible,
    toggleColumn,
    setColumn,
    setColumnsVisible,
    resetDefaults,
  };
}
