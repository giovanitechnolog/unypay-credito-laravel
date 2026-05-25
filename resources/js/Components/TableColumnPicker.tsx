import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Columns3 } from "lucide-react";
import type { ColGroupMeta, PickerColumnInfo } from "@/lib/tableColumns";

interface TableColumnPickerProps<TId extends string, TGroup extends string> {
  allColumns: readonly PickerColumnInfo<TId, TGroup>[];
  groupOrder: readonly TGroup[];
  groupMeta: Record<TGroup, ColGroupMeta>;
  visibleIds: ReadonlySet<TId>;
  toggleColumn: (id: TId) => void;
  setColumnsVisible: (ids: readonly TId[], visible: boolean) => void;
  resetDefaults: () => void;
}

const POPOVER_WIDTH = 360;
const POPOVER_MAX_HEIGHT = 460;
const VIEWPORT_PADDING = 12;

interface PopoverCoords {
  top: number;
  left: number;
  maxHeight: number;
}

/**
 * Popover genérico de configuração de colunas. Renderizado via `createPortal`
 * em `document.body` com `position: fixed` para evitar clipping por
 * ancestrais com `overflow:hidden`.
 *
 * Recebe o dicionário de colunas, grupos e metadados via props.
 */
export default function TableColumnPicker<TId extends string, TGroup extends string>({
  allColumns,
  groupOrder,
  groupMeta,
  visibleIds,
  toggleColumn,
  setColumnsVisible,
  resetDefaults,
}: TableColumnPickerProps<TId, TGroup>) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<PopoverCoords | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const allCheckboxId = useId();

  const allColumnIds = useMemo<TId[]>(() => allColumns.map((c) => c.id), [allColumns]);
  const columnsByGroup = useMemo(
    () =>
      groupOrder.map((g) => ({
        group: g,
        columns: allColumns.filter((c) => c.group === g),
      })),
    [allColumns, groupOrder],
  );

  // ── Posicionamento ────────────────────────────────────────────────────
  const updateCoords = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = rect.right - POPOVER_WIDTH;
    if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING;
    if (left + POPOVER_WIDTH > vw - VIEWPORT_PADDING) {
      left = vw - VIEWPORT_PADDING - POPOVER_WIDTH;
    }

    const top = rect.bottom + 4;
    const maxHeight = Math.min(POPOVER_MAX_HEIGHT, vh - top - VIEWPORT_PADDING);

    setCoords({ top, left, maxHeight });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateCoords();
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) return;

    const onScroll = () => updateCoords();
    const onResize = () => updateCoords();
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, updateCoords]);

  const allColumnsVisible =
    allColumnIds.length > 0 && allColumnIds.every((id) => visibleIds.has(id));

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 28,
          padding: "0 10px",
          borderRadius: 6,
          border: "1px solid #d1d5db",
          background: "white",
          color: "#374151",
          fontSize: 11,
          fontWeight: 500,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <Columns3 size={12} />
        Configurar colunas
      </button>

      {open && coords &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Configurar colunas visíveis"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: POPOVER_WIDTH,
              maxHeight: coords.maxHeight,
              background: "white",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
              zIndex: 1000,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Cabeçalho */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "8px 12px",
                borderBottom: "1px solid #e5e7eb",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                  Colunas visíveis
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <NativeCheckbox
                    id={allCheckboxId}
                    checked={allColumnsVisible}
                    ariaLabel="Alternar todas as colunas"
                    onChange={(v) => setColumnsVisible(allColumnIds, v)}
                  />
                  <label
                    htmlFor={allCheckboxId}
                    style={{ cursor: "pointer", fontSize: 11, color: "#374151" }}
                  >
                    Todos
                  </label>
                </div>
              </div>
              <button
                type="button"
                onClick={resetDefaults}
                style={{
                  flexShrink: 0,
                  height: 26,
                  padding: "0 8px",
                  borderRadius: 4,
                  border: "none",
                  background: "transparent",
                  fontSize: 11,
                  fontWeight: 500,
                  color: "#4b5563",
                  cursor: "pointer",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Restaurar padrão
              </button>
            </div>

            {/* Lista (scrollável) */}
            <div style={{ overflowY: "auto", flex: 1, padding: 10 }}>
              {columnsByGroup.map(({ group, columns }, idx) => (
                <GroupSection
                  key={String(group)}
                  meta={groupMeta[group]}
                  columns={columns}
                  visibleIds={visibleIds}
                  toggleColumn={toggleColumn}
                  setColumnsVisible={setColumnsVisible}
                  showDivider={idx < columnsByGroup.length - 1}
                />
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────

interface GroupSectionProps<TId extends string, TGroup extends string> {
  meta: ColGroupMeta;
  columns: PickerColumnInfo<TId, TGroup>[];
  visibleIds: ReadonlySet<TId>;
  toggleColumn: (id: TId) => void;
  setColumnsVisible: (ids: readonly TId[], visible: boolean) => void;
  showDivider: boolean;
}

function GroupSection<TId extends string, TGroup extends string>({
  meta,
  columns,
  visibleIds,
  toggleColumn,
  setColumnsVisible,
  showDivider,
}: GroupSectionProps<TId, TGroup>) {
  const groupCheckboxId = useId();
  const groupAllVisible = columns.length > 0 && columns.every((c) => visibleIds.has(c.id));

  return (
    <div>
      {/* Cabeçalho do grupo: título à esquerda + checkbox mestre logo após.
          flex items-center gap-3 — SEM justify-between (requisito de design). */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: meta.bg,
          color: meta.color,
          padding: "5px 8px",
          borderRadius: 4,
          marginBottom: 6,
        }}
      >
        <label
          htmlFor={groupCheckboxId}
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            cursor: "pointer",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {meta.label}
        </label>
        <NativeCheckbox
          id={groupCheckboxId}
          checked={groupAllVisible}
          ariaLabel={`Alternar todas as colunas do grupo ${meta.label}`}
          onChange={(v) => setColumnsVisible(columns.map((c) => c.id), v)}
          theme="dark"
        />
      </div>

      {/* Itens individuais */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 4 }}>
        {columns.map((col) => {
          const checked = visibleIds.has(col.id);
          const cbId = `col-${String(col.id)}`;
          return (
            <div key={String(col.id)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <NativeCheckbox
                id={cbId}
                checked={checked}
                ariaLabel={`Alternar coluna ${col.label}`}
                onChange={() => toggleColumn(col.id)}
              />
              <label
                htmlFor={cbId}
                style={{
                  flex: 1,
                  cursor: "pointer",
                  fontSize: 11,
                  lineHeight: 1.3,
                  color: checked ? "#1f2937" : "#9ca3af",
                }}
              >
                {col.label}
              </label>
            </div>
          );
        })}
      </div>

      {showDivider && (
        <div style={{ height: 1, width: "100%", background: "#e5e7eb", margin: "10px 0" }} />
      )}
    </div>
  );
}

// ── Checkbox nativo estilizado ─────────────────────────────────────────────
interface NativeCheckboxProps {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
  theme?: "light" | "dark";
}

function NativeCheckbox({
  id,
  checked,
  onChange,
  ariaLabel,
  theme = "light",
}: NativeCheckboxProps) {
  const isDark = theme === "dark";
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        width: 14,
        height: 14,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
        aria-label={ariaLabel}
        style={{
          position: "absolute",
          inset: 0,
          margin: 0,
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          borderRadius: 3,
          border: `1px solid ${
            checked ? "#1e3a5f" : isDark ? "rgba(255,255,255,0.55)" : "#cbd5e1"
          }`,
          background: checked ? "#1e3a5f" : "white",
          cursor: "pointer",
          outline: "none",
        }}
      />
      {checked && (
        <Check
          size={10}
          strokeWidth={3}
          style={{ position: "relative", pointerEvents: "none", color: "white" }}
        />
      )}
    </span>
  );
}
