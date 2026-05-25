/**
 * Dicionário de colunas da tabela de Controle de Pagamentos (UnyPay Crédito).
 *
 * - `PAYMENTS_COLUMNS`: ordem e metadados de cada coluna togglável.
 * - `PAYMENTS_GROUP_META`: metadados visuais dos grupos.
 *
 * A coluna do "chevron" de expansão NÃO é declarada aqui: ela é sempre visível,
 * renderizada como bloco especial pelo `Pages/Payments.tsx`.
 */

import type { ColGroupMeta, TableColumnDef } from "./tableColumns";

export type PaymentsColGroup =
  | "identificacao"
  | "financeiro"
  | "parcelas"
  | "juros"
  | "situacao";

export type PaymentsColumnId =
  // identificacao (sticky)
  | "code"
  | "client"
  | "date"
  | "creditor"
  // financeiro
  | "principal"
  | "financed"
  | "installments"
  | "installmentAmt"
  // parcelas
  | "paid"
  | "overdue"
  | "daysOverdue"
  | "toReceive"
  // juros
  | "totalInterest"
  | "cetMonthly"
  // situacao
  | "status"
  | "firstDue";

export type PaymentsColumnDef = TableColumnDef<PaymentsColumnId, PaymentsColGroup>;

export const PAYMENTS_GROUP_META: Record<PaymentsColGroup, ColGroupMeta> = {
  identificacao: { label: "Identificação", short: "ID",    bg: "#1e293b", color: "#ffffff" }, // slate-900
  financeiro:    { label: "Financeiro",    short: "Fin.",  bg: "#92400e", color: "#ffffff" }, // amber-800 (mostarda escura)
  parcelas:      { label: "Parcelas",      short: "Parc.", bg: "#15803d", color: "#ffffff" }, // green-700
  juros:         { label: "Juros / CET",   short: "Juros", bg: "#991b1b", color: "#ffffff" }, // red-800 (vinho)
  situacao:      { label: "Situação",      short: "Sit.",  bg: "#7e22ce", color: "#ffffff" }, // purple-700
};

export const PAYMENTS_GROUP_ORDER: readonly PaymentsColGroup[] = [
  "identificacao",
  "financeiro",
  "parcelas",
  "juros",
  "situacao",
] as const;

export const PAYMENTS_COLUMNS: readonly PaymentsColumnDef[] = [
  // —— Identificação (sticky) ——
  { id: "code",     label: "Código",   group: "identificacao", width: 90,  align: "left",   defaultVisible: true, sticky: 1 },
  { id: "client",   label: "Cliente",  group: "identificacao", width: 180, align: "left",   defaultVisible: true, sticky: 2 },
  { id: "date",     label: "Data",     group: "identificacao", width: 88,  align: "left",   defaultVisible: true },
  { id: "creditor", label: "Credor",   group: "identificacao", width: 120, align: "left",   defaultVisible: true },

  // —— Financeiro ——
  { id: "principal",      label: "Principal",   group: "financeiro", width: 110, align: "right",  defaultVisible: true },
  { id: "financed",       label: "Financiado",  group: "financeiro", width: 115, align: "right",  defaultVisible: true },
  { id: "installments",   label: "Parcelas",    group: "financeiro", width: 60,  align: "center", defaultVisible: true },
  { id: "installmentAmt", label: "Vl. Parcela", group: "financeiro", width: 105, align: "right",  defaultVisible: true },

  // —— Parcelas ——
  { id: "paid",        label: "Pagas",       group: "parcelas", width: 60,  align: "center", defaultVisible: true },
  { id: "overdue",     label: "Em Aberto",   group: "parcelas", width: 72,  align: "center", defaultVisible: true },
  { id: "daysOverdue", label: "Dias Atr.",   group: "parcelas", width: 72,  align: "center", defaultVisible: true },
  { id: "toReceive",   label: "Vl. Receber", group: "parcelas", width: 115, align: "right",  defaultVisible: true },

  // —— Juros / CET ——
  { id: "totalInterest", label: "Juros Totais", group: "juros", width: 115, align: "right",  defaultVisible: true },
  { id: "cetMonthly",    label: "CET Mensal",   group: "juros", width: 80,  align: "center", defaultVisible: true },

  // —— Situação ——
  { id: "status",   label: "Status",   group: "situacao", width: 90, align: "left",   defaultVisible: true },
  { id: "firstDue", label: "1º Venc.", group: "situacao", width: 86, align: "left",   defaultVisible: true },
];

export const ALL_PAYMENTS_COLUMN_IDS: PaymentsColumnId[] = PAYMENTS_COLUMNS.map((c) => c.id);
