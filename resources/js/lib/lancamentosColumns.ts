/**
 * Dicionário de colunas da tabela de Lançamentos (UnyPay Crédito)
 *
 * - `LANCAMENTOS_COLUMNS`: ordem e metadados de cada coluna togglável.
 * - `COL_GROUP_META`: metadados visuais dos grupos (badge horizontal e cabeçalho do dropdown).
 * - Helpers: contagem por grupo, listagem ordenada de visíveis, type-guard de IDs.
 *
 * A coluna "Ações" não é declarada aqui: por contrato ela é sempre visível,
 * renderizada como bloco especial pelo `Pages/Lancamentos.tsx`.
 */

// ── Tipos públicos ─────────────────────────────────────────────────────────
export type ColGroup =
  | "identificacao"
  | "financeiro"
  | "parcelas"
  | "juros"
  | "situacao";

export interface ColGroupMeta {
  label: string;
  short: string;
  bg: string;
  color: string;
}

export type CellAlign = "left" | "right" | "center";

/** IDs de coluna conhecidos (literal-union para auto-completar e type-safety). */
export type LancamentoColumnId =
  // identificacao
  | "code"
  | "client"
  | "type"
  | "status"
  // financeiro
  | "principal"
  | "totalWithInterest"
  | "toReceiveFin"
  | "installments"
  | "installmentAmt"
  | "date"
  | "creditor"
  // parcelas
  | "paid"
  | "overdue"
  | "daysOverdue"
  | "toReceive"
  // juros
  | "totalInterest"
  | "cetMonthly"
  | "cetAnnual"
  // situacao
  | "firstDue"
  | "validated";

export interface LancamentoColumnDef {
  id: LancamentoColumnId;
  label: string;
  group: ColGroup;
  width: number;
  align: CellAlign;
  defaultVisible: boolean;
  /** Posição na faixa congelada à esquerda (1 = mais à esquerda). Ausente = rolável. */
  sticky?: 1 | 2 | 3 | 4;
  /** Se a coluna participa do sort no header (default: true). */
  sortable?: boolean;
  /** Nome do campo usado para ordenar (default: igual a `id`). */
  sortKey?: string;
}

// ── Metadados visuais dos grupos ───────────────────────────────────────────
export const COL_GROUP_META: Record<ColGroup, ColGroupMeta> = {
  identificacao: { label: "Identificação", short: "ID",    bg: "#1e293b", color: "#ffffff" }, // slate-900
  financeiro:    { label: "Financeiro",    short: "Fin.",  bg: "#92400e", color: "#ffffff" }, // amber-800 (mostarda escura)
  parcelas:      { label: "Parcelas",      short: "Parc.", bg: "#15803d", color: "#ffffff" }, // green-700
  juros:         { label: "Juros / CET",   short: "Juros", bg: "#991b1b", color: "#ffffff" }, // red-800 (vinho)
  situacao:      { label: "Situação",      short: "Sit.",  bg: "#7e22ce", color: "#ffffff" }, // purple-700
};

export const GROUP_ORDER: readonly ColGroup[] = [
  "identificacao",
  "financeiro",
  "parcelas",
  "juros",
  "situacao",
] as const;

// ── Dicionário de colunas ──────────────────────────────────────────────────
export const LANCAMENTOS_COLUMNS: readonly LancamentoColumnDef[] = [
  // —— Identificação (sticky) ——
  { id: "code",   label: "Classif.", group: "identificacao", width: 82,  align: "left",   defaultVisible: true, sticky: 1 },
  { id: "client", label: "Cliente",  group: "identificacao", width: 220, align: "left",   defaultVisible: true, sticky: 2 },
  { id: "type",   label: "Tipo",     group: "identificacao", width: 100, align: "left",   defaultVisible: true, sticky: 3 },
  { id: "status", label: "Status",   group: "identificacao", width: 88,  align: "left",   defaultVisible: true, sticky: 4 },

  // —— Financeiro ——
  { id: "principal",         label: "Principal",       group: "financeiro", width: 120, align: "right",  defaultVisible: true },
  { id: "totalWithInterest", label: "Total c/ Juros",  group: "financeiro", width: 135, align: "right",  defaultVisible: true },
  { id: "toReceiveFin",      label: "Total a Receber", group: "financeiro", width: 130, align: "right",  defaultVisible: true },
  { id: "installments",      label: "Parc.",           group: "financeiro", width: 50,  align: "center", defaultVisible: true },
  { id: "installmentAmt",    label: "Vl. Parcela",     group: "financeiro", width: 110, align: "right",  defaultVisible: true },
  { id: "date",              label: "Data",            group: "financeiro", width: 86,  align: "center", defaultVisible: true },
  { id: "creditor",          label: "Credor",          group: "financeiro", width: 130, align: "left",   defaultVisible: true },

  // —— Parcelas ——
  { id: "paid",        label: "Pagas",       group: "parcelas", width: 58,  align: "center", defaultVisible: true },
  { id: "overdue",     label: "Em Aberto",   group: "parcelas", width: 72,  align: "center", defaultVisible: true },
  { id: "daysOverdue", label: "Dias Atr.",   group: "parcelas", width: 72,  align: "center", defaultVisible: true },
  { id: "toReceive",   label: "Vl. Receber", group: "parcelas", width: 120, align: "right",  defaultVisible: true },

  // —— Juros / CET ——
  { id: "totalInterest", label: "Juros Totais", group: "juros", width: 120, align: "right",  defaultVisible: true },
  { id: "cetMonthly",    label: "CET Mensal",   group: "juros", width: 84,  align: "center", defaultVisible: true },
  { id: "cetAnnual",     label: "CET Anual",    group: "juros", width: 78,  align: "center", defaultVisible: true },

  // —— Situação ——
  { id: "firstDue",  label: "1ª Venc.", group: "situacao", width: 86, align: "center", defaultVisible: true },
  { id: "validated", label: "Valid.",   group: "situacao", width: 54, align: "center", defaultVisible: true },
];

// ── Helpers ────────────────────────────────────────────────────────────────
const _ids = new Set(LANCAMENTOS_COLUMNS.map((c) => c.id));

export function isKnownColumnId(id: string): id is LancamentoColumnId {
  return _ids.has(id as LancamentoColumnId);
}

export function getVisibleOrdered(
  visible: ReadonlySet<LancamentoColumnId>,
): LancamentoColumnDef[] {
  return LANCAMENTOS_COLUMNS.filter((c) => visible.has(c.id));
}

export function countVisibleByGroup(
  visible: ReadonlySet<LancamentoColumnId>,
): Record<ColGroup, number> {
  const out: Record<ColGroup, number> = {
    identificacao: 0,
    financeiro: 0,
    parcelas: 0,
    juros: 0,
    situacao: 0,
  };
  for (const def of LANCAMENTOS_COLUMNS) {
    if (visible.has(def.id)) out[def.group] += 1;
  }
  return out;
}

/** IDs das colunas que compõem um grupo (na ordem natural do dicionário). */
export function columnIdsOfGroup(group: ColGroup): LancamentoColumnId[] {
  return LANCAMENTOS_COLUMNS.filter((c) => c.group === group).map((c) => c.id);
}

/** Todos os IDs conhecidos (útil para a checkbox "Todos"). */
export const ALL_LANCAMENTO_COLUMN_IDS: LancamentoColumnId[] =
  LANCAMENTOS_COLUMNS.map((c) => c.id);
