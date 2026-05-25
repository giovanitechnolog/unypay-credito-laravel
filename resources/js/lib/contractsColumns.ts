/**
 * Dicionário de colunas da tabela de Contratos (UnyPay Crédito).
 */

import type { ColGroupMeta, TableColumnDef } from "./tableColumns";

export type ContractsColGroup = "identificacao" | "financeiro" | "situacao";

export type ContractsColumnId =
  // identificacao (sticky)
  | "code"
  | "client"
  | "contractName"
  | "creditor"
  // financeiro
  | "principal"
  | "financed"
  | "installments"
  | "installmentAmt"
  // situacao
  | "status"
  | "validated"
  | "firstDue"
  | "moraRate";

export type ContractsColumnDef = TableColumnDef<ContractsColumnId, ContractsColGroup>;

export const CONTRACTS_GROUP_META: Record<ContractsColGroup, ColGroupMeta> = {
  identificacao: { label: "Identificação", short: "ID",   bg: "#1e3a5f", color: "#ffffff" },
  financeiro:    { label: "Financeiro",    short: "Fin.", bg: "#2d3a8c", color: "#ffffff" },
  situacao:      { label: "Situação",      short: "Sit.", bg: "#1e2139", color: "#ffffff" },
};

export const CONTRACTS_GROUP_ORDER: readonly ContractsColGroup[] = [
  "identificacao", "financeiro", "situacao",
] as const;

export const CONTRACTS_COLUMNS: readonly ContractsColumnDef[] = [
  // —— Identificação ——
  { id: "code",         label: "Código",   group: "identificacao", width: 88,  align: "left",   defaultVisible: true, sticky: 1, sortable: true, sortKey: "code" },
  { id: "client",       label: "Cliente",  group: "identificacao", width: 180, align: "left",   defaultVisible: true, sticky: 2, sortable: true, sortKey: "client" },
  { id: "contractName", label: "Nome do Contrato", group: "identificacao", width: 200, align: "left", defaultVisible: true },
  { id: "creditor",     label: "Credor",   group: "identificacao", width: 130, align: "left",   defaultVisible: true },

  // —— Financeiro ——
  { id: "principal",      label: "Principal",   group: "financeiro", width: 120, align: "right",  defaultVisible: true, sortable: true, sortKey: "principal" },
  { id: "financed",       label: "Financiado",  group: "financeiro", width: 120, align: "right",  defaultVisible: true },
  { id: "installments",   label: "Parc.",       group: "financeiro", width: 60,  align: "center", defaultVisible: true },
  { id: "installmentAmt", label: "Vl. Parcela", group: "financeiro", width: 110, align: "right",  defaultVisible: true },

  // —— Situação ——
  { id: "status",    label: "Status",   group: "situacao", width: 100, align: "center", defaultVisible: true, sortable: true, sortKey: "status" },
  { id: "validated", label: "Valid.",   group: "situacao", width: 60,  align: "center", defaultVisible: true },
  { id: "firstDue",  label: "1ª Venc.", group: "situacao", width: 90,  align: "center", defaultVisible: true },
  { id: "moraRate",  label: "Mora",     group: "situacao", width: 70,  align: "center", defaultVisible: true },
];

export const ALL_CONTRACTS_COLUMN_IDS: ContractsColumnId[] = CONTRACTS_COLUMNS.map((c) => c.id);
