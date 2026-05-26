import { Filter } from "lucide-react";
import type { ColGroupMeta, PickerColumnInfo } from "@/lib/tableColumns";
import { columnIdsOfGroupFrom } from "@/lib/tableColumns";

interface TableGroupBadgesProps<TId extends string, TGroup extends string> {
  allColumns: readonly PickerColumnInfo<TId, TGroup>[];
  groupOrder: readonly TGroup[];
  groupMeta: Record<TGroup, ColGroupMeta>;
  visibleIds: ReadonlySet<TId>;
  setColumnsVisible: (ids: readonly TId[], visible: boolean) => void;
}

/**
 * Tira horizontal de badges coloridos. Cada badge representa um grupo de colunas;
 * o estilo "ligado/desligado" reflete se TODAS as colunas do grupo estão visíveis.
 * Clicar alterna em bloco a visibilidade das colunas do grupo.
 *
 * Componente genérico — recebe o dicionário de colunas via props.
 */
export default function TableGroupBadges<TId extends string, TGroup extends string>({
  allColumns,
  groupOrder,
  groupMeta,
  visibleIds,
  setColumnsVisible,
}: TableGroupBadgesProps<TId, TGroup>) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        color: "#6b7280",
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      <Filter size={11} style={{ color: "#9ca3af", flexShrink: 0 }} />
      <span style={{ marginRight: 2, fontWeight: 500 }}>Grupos:</span>
      {groupOrder.map((group) => {
        const ids = columnIdsOfGroupFrom(allColumns, group);
        const allOn = ids.length > 0 && ids.every((id) => visibleIds.has(id));
        const meta = groupMeta[group];

        return (
          <button
            key={String(group)}
            type="button"
            onClick={() => setColumnsVisible(ids, !allOn)}
            aria-pressed={allOn}
            title={
              allOn
                ? `Ocultar todas as colunas de ${meta.label}`
                : `Exibir todas as colunas de ${meta.label}`
            }
            style={{
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.02em",
              cursor: "pointer",
              background: allOn ? meta.bg : "#f1f5f9",
              color: allOn ? meta.color : "#64748b",
              border: `1px solid ${allOn ? meta.bg : "#e2e8f0"}`,
              transition: "all 0.1s",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {meta.short}
          </button>
        );
      })}
    </div>
  );
}
