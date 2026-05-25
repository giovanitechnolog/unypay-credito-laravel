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
  // fiadores
  | "fiador1"
  | "fiador2";

export type ClientsColumnDef = TableColumnDef<ClientsColumnId, ClientsColGroup>;

export const CLIENTS_GROUP_META: Record<ClientsColGroup, ColGroupMeta> = {
  identificacao: { label: "Identificação", short: "ID",     bg: "#1e3a5f", color: "#ffffff" },
  contato:       { label: "Contato",       short: "Cont.",  bg: "#2d3a8c", color: "#ffffff" },
  classificacao: { label: "Classificação", short: "Class.", bg: "#1a4731", color: "#ffffff" },
  fiadores:      { label: "Fiadores",      short: "Fiad.",  bg: "#7c2d12", color: "#ffffff" },
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

  // —— Fiadores ——
  { id: "fiador1", label: "Fiador 1", group: "fiadores", width: 140, align: "left", defaultVisible: true },
  { id: "fiador2", label: "Fiador 2", group: "fiadores", width: 140, align: "left", defaultVisible: true },
];

export const ALL_CLIENTS_COLUMN_IDS: ClientsColumnId[] = CLIENTS_COLUMNS.map((c) => c.id);
