/**
 * Dicionário de colunas da tabela de Histórico de Simulações (UnyPay Crédito).
 *
 * A coluna "Ações" NÃO é declarada aqui: é sempre visível.
 */

import type { ColGroupMeta, TableColumnDef } from "./tableColumns";

export type SimHistoryColGroup = "identificacao" | "valores" | "juros";

export type SimHistoryColumnId =
  // identificacao
  | "date"
  | "client"
  | "mode"
  | "savedBy"
  // valores
  | "principal"
  | "financed"
  | "installments"
  | "installmentAmt"
  // juros
  | "totalInterest"
  | "cetMonthly";

export type SimHistoryColumnDef = TableColumnDef<SimHistoryColumnId, SimHistoryColGroup>;

export const SIM_HISTORY_GROUP_META: Record<SimHistoryColGroup, ColGroupMeta> = {
  identificacao: { label: "Identificação", short: "ID",    bg: "#1a243a", color: "#ffffff" },
  valores:       { label: "Valores",       short: "Val.",  bg: "#0b4687", color: "#ffffff" },
  juros:         { label: "Juros / CET",   short: "Juros", bg: "#4a1204", color: "#ffffff" },
};

export const SIM_HISTORY_GROUP_ORDER: readonly SimHistoryColGroup[] = [
  "identificacao", "valores", "juros",
] as const;

export const SIM_HISTORY_COLUMNS: readonly SimHistoryColumnDef[] = [
  // —— Identificação ——
  { id: "date",    label: "Data",      group: "identificacao", width: 130, align: "left",   defaultVisible: true, sticky: 1 },
  { id: "client",  label: "Cliente",   group: "identificacao", width: 180, align: "left",   defaultVisible: true },
  { id: "mode",    label: "Modo",      group: "identificacao", width: 100, align: "center", defaultVisible: true },
  { id: "savedBy", label: "Salvo Por", group: "identificacao", width: 110, align: "left",   defaultVisible: true },

  // —— Valores ——
  { id: "principal",      label: "Principal",   group: "valores", width: 120, align: "right",  defaultVisible: true },
  { id: "financed",       label: "Financiado",  group: "valores", width: 120, align: "right",  defaultVisible: true },
  { id: "installments",   label: "Parcelas",    group: "valores", width: 70,  align: "center", defaultVisible: true },
  { id: "installmentAmt", label: "Vl. Parcela", group: "valores", width: 120, align: "right",  defaultVisible: true },

  // —— Juros / CET ——
  { id: "totalInterest", label: "Juros Totais", group: "juros", width: 120, align: "right",  defaultVisible: true },
  { id: "cetMonthly",    label: "CET Mensal",   group: "juros", width: 90,  align: "center", defaultVisible: true },
];

export const ALL_SIM_HISTORY_COLUMN_IDS: SimHistoryColumnId[] = SIM_HISTORY_COLUMNS.map((c) => c.id);
