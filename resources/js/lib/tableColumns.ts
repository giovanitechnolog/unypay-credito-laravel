/**
 * Tipos genéricos para o sistema de visibilidade de colunas
 * (badges de grupo + popover de configuração).
 *
 * Estes tipos são compartilhados por TODAS as tabelas do sistema
 * (Lançamentos, Pagamentos, Contratos, Clientes, Hist. Simulações, etc.).
 */

export type CellAlign = "left" | "right" | "center";

/** Metadados visuais de um grupo de colunas. */
export interface ColGroupMeta {
  label: string;
  short: string;
  bg: string;
  color: string;
}

/**
 * Definição genérica de uma coluna togglável.
 * `TId`    = literal-union dos IDs de coluna da tabela.
 * `TGroup` = literal-union dos IDs de grupo da tabela.
 */
export interface TableColumnDef<TId extends string, TGroup extends string> {
  id: TId;
  label: string;
  group: TGroup;
  width: number;
  align: CellAlign;
  defaultVisible: boolean;
  /** Posição na faixa congelada à esquerda (1 = mais à esquerda); ausente = rolável. */
  sticky?: 1 | 2 | 3 | 4;
  sortable?: boolean;
  /** Nome do campo usado para ordenar (default: igual a `id`). */
  sortKey?: string;
}

/** Subconjunto mínimo necessário pelo picker/badges. */
export interface PickerColumnInfo<TId extends string, TGroup extends string> {
  id: TId;
  label: string;
  group: TGroup;
  defaultVisible: boolean;
}

// ── Helpers genéricos ──────────────────────────────────────────────────────

export function getVisibleOrderedFrom<
  TId extends string,
  TGroup extends string,
  D extends TableColumnDef<TId, TGroup>,
>(allDefs: readonly D[], visible: ReadonlySet<TId>): D[] {
  return allDefs.filter((c) => visible.has(c.id));
}

export function countVisibleByGroupFrom<TId extends string, TGroup extends string>(
  allDefs: readonly PickerColumnInfo<TId, TGroup>[],
  groupOrder: readonly TGroup[],
  visible: ReadonlySet<TId>,
): Record<TGroup, number> {
  const out = {} as Record<TGroup, number>;
  for (const g of groupOrder) out[g] = 0;
  for (const def of allDefs) {
    if (visible.has(def.id)) out[def.group] += 1;
  }
  return out;
}

export function columnIdsOfGroupFrom<TId extends string, TGroup extends string>(
  allDefs: readonly PickerColumnInfo<TId, TGroup>[],
  group: TGroup,
): TId[] {
  return allDefs.filter((c) => c.group === group).map((c) => c.id);
}
