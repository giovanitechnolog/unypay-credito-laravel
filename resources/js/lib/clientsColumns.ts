/**
 * Dicionário de colunas da tabela de Clientes (UnyPay Crédito).
 *
 * A coluna "Ações" NÃO é declarada aqui: é sempre visível.
 */

import type { ColGroupMeta, TableColumnDef } from "./tableColumns";

export type ClientsColGroup =
  | "identificacao"
  | "contato"
  | "classificacao"
  | "fiadores";

export type ClientsColumnId =
  // identificacao
  | "name"
  | "document"
  | "personType"
  | "profession"
  // contato
  | "email"
  | "phone"
  | "cityState"
  // classificacao
  | "rating"
  | "pixKey"
  // fiadores — coluna única "Vínculos" que abre um modal com a lista
  // detalhada (Fiadores E Codevedores) provenientes dos contratos do cliente.
  | "fiadores";

export type ClientsColumnDef = TableColumnDef<ClientsColumnId, ClientsColGroup>;

export const CLIENTS_GROUP_META: Record<ClientsColGroup, ColGroupMeta> = {
  identificacao: { label: "Identificação", short: "ID",     bg: "#1e293b", color: "#ffffff" }, // slate-900
  contato:       { label: "Contato",       short: "Cont.",  bg: "#1e3a8a", color: "#ffffff" }, // blue-900 (marinho)
  classificacao: { label: "Classificação", short: "Class.", bg: "#15803d", color: "#ffffff" }, // green-700
  fiadores:      { label: "Fiadores / Codevedores", short: "Vínc.", bg: "#7e22ce", color: "#ffffff" }, // purple-700
};

export const CLIENTS_GROUP_ORDER: readonly ClientsColGroup[] = [
  "identificacao", "contato", "classificacao", "fiadores",
] as const;

export const CLIENTS_COLUMNS: readonly ClientsColumnDef[] = [
  // —— Identificação (sticky no início) ——
  { id: "name",       label: "Nome",      group: "identificacao", width: 200, align: "left",   defaultVisible: true, sticky: 1 },
  { id: "document",   label: "Documento", group: "identificacao", width: 130, align: "left",   defaultVisible: true },
  { id: "personType", label: "Tipo",      group: "identificacao", width: 70,  align: "center", defaultVisible: true },
  { id: "profession", label: "Profissão", group: "identificacao", width: 140, align: "left",   defaultVisible: true },

  // —— Contato ——
  { id: "email",     label: "E-mail",    group: "contato", width: 200, align: "left", defaultVisible: true },
  { id: "phone",     label: "Telefone",  group: "contato", width: 130, align: "left", defaultVisible: true },
  { id: "cityState", label: "Cidade/UF", group: "contato", width: 140, align: "left", defaultVisible: true },

  // —— Classificação ——
  { id: "rating", label: "Rating", group: "classificacao", width: 80,  align: "center", defaultVisible: true },
  { id: "pixKey", label: "PIX",    group: "classificacao", width: 130, align: "left",   defaultVisible: true },

  // —— Fiadores / Codevedores (uma coluna única, abre modal com a tabela) ——
  { id: "fiadores", label: "Fiadores", group: "fiadores", width: 140, align: "center", defaultVisible: true },
];

export const ALL_CLIENTS_COLUMN_IDS: ClientsColumnId[] = CLIENTS_COLUMNS.map((c) => c.id);
