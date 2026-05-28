import { useState, useCallback } from 'react';
import { usePage } from '@inertiajs/react';

export function useColumnVisibility<TId extends string>(
  storageKey: string,
  allColumns: readonly { id: TId; defaultVisible?: boolean }[]
) {
  // 1. Captura as preferências vindas direto do banco através do Inertia
  const { auth } = usePage<any>().props;
  const dbPreferences = auth?.columnPreferences?.[storageKey];

  // 2. Define o Estado Inicial seguindo a ordem de prioridade: Banco > Navegador > Padrão do código
  const [visibleIds, setVisibleIds] = useState<ReadonlySet<TId>>(() => {
    // Se existir configuração no Banco de Dados para esta tela, usa ela
    if (dbPreferences && Array.isArray(dbPreferences)) {
      return new Set<TId>(dbPreferences as TId[]);
    }

    // Se não, tenta ler o LocalStorage antigo (Fallback)
    try {
      const localData = localStorage.getItem(storageKey);
      if (localData) {
        return new Set<TId>(JSON.parse(localData));
      }
    } catch (e) {
      console.error("Erro ao ler localStorage", e);
    }

    // Se o usuário nunca mexeu em nada, aplica o padrão definido no código
    const defaults = allColumns
      .filter((c) => c.defaultVisible !== false)
      .map((c) => c.id);
    return new Set<TId>(defaults);
  });

  // 🚀 FUNÇÃO DE SINCRONIZAÇÃO ASSÍNCRONA COM O LARAVEL
  const syncWithServer = useCallback((ids: TId[]) => {
    fetch('/api/user-preferences/columns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Captura o token de segurança do Laravel injetado na página principal
        'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '',
      },
      body: JSON.stringify({
        table_key: storageKey,
        visible_columns: ids,
      }),
    }).catch(err => console.error("Falha ao salvar colunas no banco de dados:", err));
  }, [storageKey]);

  // 3. Ações de clique do usuário
  const toggleColumn = useCallback((id: TId) => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      const arrayIds = Array.from(next);
      localStorage.setItem(storageKey, JSON.stringify(arrayIds)); // Mantém no LocalStorage por segurança
      syncWithServer(arrayIds as TId[]); // Grava no Banco de Dados
      return next;
    });
  }, [storageKey, syncWithServer]);

  const setColumnsVisible = useCallback((ids: readonly TId[], visible: boolean) => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (visible) next.add(id);
        else next.delete(id);
      });
      const arrayIds = Array.from(next);
      localStorage.setItem(storageKey, JSON.stringify(arrayIds));
      syncWithServer(arrayIds as TId[]);
      return next;
    });
  }, [storageKey, syncWithServer]);

  const resetDefaults = useCallback(() => {
    const defaults = allColumns
      .filter((c) => c.defaultVisible !== false)
      .map((c) => c.id);
    setVisibleIds(new Set(defaults));
    localStorage.setItem(storageKey, JSON.stringify(defaults));
    syncWithServer(defaults);
  }, [allColumns, storageKey, syncWithServer]);

  return {
    visibleIds,
    toggleColumn,
    setColumnsVisible,
    resetDefaults,
  };
}