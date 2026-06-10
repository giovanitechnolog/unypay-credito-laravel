import { Plus, Search, Users, Building2, User as UserIcon, Edit2, Trash2, Eye, CheckCircle, Sparkles, UserPlus } from "lucide-react";
import { GuarantorLite } from "./GuarantorSearchModal";
import { GuarantorFormValues } from "./GuarantorFormFields";

/**
 * 🚀 Componente genérico de vínculo Pessoa↔Contrato/Cliente.
 *
 * Mesma UX para Fiadores E Codevedores — a diferença é apenas a coluna `role`
 * que vai na pivot do banco. Aqui no front recebemos `type` e ele controla:
 *   • Labels dos botões "NOVO FIADOR" / "NOVO CODEVEDOR" (e respectivos "BUSCAR")
 *   • Texto de instrução do rodapé
 *   • Cabeçalho informativo (ícone + título + contador)
 *   • Empty state
 *
 * Toda a lógica (busca, criação rápida, visualização, remoção) é orquestrada
 * pelo componente-pai (Contracts.tsx) — este componente é puramente visual,
 * recebendo callbacks. Isso mantém a fonte de verdade no pai e evita
 * duplicação entre "Fiadores" e "Codevedores".
 */

export type VinculoPessoaType = "FIADOR" | "CODEVEDOR" | "TESTEMUNHA";

/** Item da lista — espelha a estrutura usada em Contracts.tsx (ContractGuarantor). */
export type VinculoPessoaItem = {
  localId: string;
  id?: number;
  isFromDb: boolean;
  name: string;
  personType: "PF" | "PJ";
  document: string | null;
  formValues?: GuarantorFormValues;
};

interface Props {
  type: VinculoPessoaType;

  /** Lista atual de pessoas vinculadas (selecionadas) — controlado pelo pai. */
  data: VinculoPessoaItem[];
  onRemove: (idx: number) => void;

  /** Estado de cliente devedor — quando ausente, os botões ficam desabilitados. */
  clientId: number | null;

  /** Sugestões: pessoas já vinculadas a este cliente (vindas do back). */
  suggested: GuarantorLite[];
  onAddSuggested: (g: GuarantorLite) => void;

  /** Callbacks dos modais (ficam no pai). */
  onOpenCreate: () => void;
  onOpenSearch: () => void;
  onOpenEditNew: (idx: number, item: VinculoPessoaItem) => void;
  onOpenView: (id: number) => void;

  /** Texto formatado de documento (CPF/CNPJ) para a tabela. */
  formatDocument: (doc: string | null | undefined, type: "PF" | "PJ") => string;
}

/** Labels dependentes do papel — única fonte de strings condicionais do componente. */
const LABELS: Record<VinculoPessoaType, {
  singular: string;
  singularUC: string;
  plural: string;
  pluralUC: string;
  banner: string;
  bannerHint: string;
  emptyText: string;
  removeTitle: string;
  footerArticle: string;
  footerNoun: string;
}> = {
  "FIADOR": {
    singular: "Fiador",
    singularUC: "FIADOR",
    plural: "Fiadores",
    pluralUC: "FIADORES",
    banner: "Fiadores Sugeridos para este cliente",
    bannerHint: "— clique para adicionar ao contrato",
    emptyText: "Nenhum fiador vinculado. Use os botões acima para adicionar.",
    removeTitle: "Remover do contrato",
    footerArticle: "Os",
    footerNoun: "Fiadores",
  },
  "CODEVEDOR": {
    singular: "Codevedor",
    singularUC: "CODEVEDOR",
    plural: "Codevedores",
    pluralUC: "CODEVEDORES",
    banner: "Codevedores Sugeridos para este cliente",
    bannerHint: "— clique para adicionar ao contrato",
    emptyText: "Nenhum codevedor vinculado. Use os botões acima para adicionar.",
    removeTitle: "Remover do contrato",
    footerArticle: "Os",
    footerNoun: "Codevedores",
  },
  "TESTEMUNHA": {
    singular: "Testemunha",
    singularUC: "TESTEMUNHA",
    plural: "Testemunhas",
    pluralUC: "TESTEMUNHAS",
    banner: "Pessoas Sugeridas para este cliente",
    bannerHint: "— clique para adicionar como testemunha",
    emptyText: "Nenhuma testemunha vinculada. Use os botões acima para adicionar.",
    removeTitle: "Remover do contrato",
    footerArticle: "As",
    footerNoun: "Testemunhas",
  },
};

export default function VinculoPessoaList({
  type,
  data,
  onRemove,
  clientId,
  suggested,
  onAddSuggested,
  onOpenCreate,
  onOpenSearch,
  onOpenEditNew,
  onOpenView,
  formatDocument,
}: Props) {
  const labels = LABELS[type];

  // Sugestões que ainda não foram adicionadas — evita oferecer um item já presente.
  const stillToAdd = suggested.filter(
    (g) => !data.some((s) => s.isFromDb && s.id === g.id)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {!clientId && (
        <div
          style={{
            padding: 12,
            background: "#fef3c7",
            border: "1px solid #fde68a",
            borderRadius: 6,
            fontSize: 11,
            color: "#92400e",
          }}
        >
          Selecione um cliente na guia <strong>Dados Básicos</strong> antes de adicionar {labels.plural.toLowerCase()}.
        </div>
      )}

      {/* 🚀 Sugeridos: pessoas já vinculadas a este cliente (NxN client_guarantor) */}
      {!!clientId && stillToAdd.length > 0 && (
        <div
          style={{
            padding: 12,
            background: "#f0f9ff",
            border: "1px solid #bae6fd",
            borderRadius: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Sparkles size={13} color="#0369a1" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#0c4a6e" }}>
              {labels.banner}
            </span>
            <span style={{ fontSize: 10, color: "#475569" }}>
              {labels.bannerHint}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {stillToAdd.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onAddSuggested(g)}
                className="keep-case"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 10px",
                  background: "white",
                  border: "1px dashed #38bdf8",
                  borderRadius: 16,
                  fontSize: 11,
                  color: "#0c4a6e",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Plus size={11} /> {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Botões de ação principais — labels dependem do `type` */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={onOpenCreate}
          className="btn-primary"
          disabled={!clientId}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            fontSize: 11,
            opacity: clientId ? 1 : 0.5,
            cursor: clientId ? "pointer" : "not-allowed",
          }}
        >
          <UserPlus size={12} /> Novo {labels.singular}
        </button>
        <button
          type="button"
          onClick={onOpenSearch}
          className="btn-secondary"
          disabled={!clientId}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            fontSize: 11,
            opacity: clientId ? 1 : 0.5,
            cursor: clientId ? "pointer" : "not-allowed",
          }}
        >
          <Search size={12} /> Buscar {labels.plural}
        </button>
      </div>

      {/* Tabela de pessoas associadas */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          overflow: "hidden",
          background: "white",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#f1f5f9" }}>
              <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 70 }}>Tipo</th>
              <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Nome / Razão Social</th>
              <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 160 }}>Documento</th>
              <th style={{ padding: "7px 10px", textAlign: "center", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 110 }}>Origem</th>
              <th style={{ padding: "7px 10px", textAlign: "center", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 110 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 28, textAlign: "center", color: "#94a3b8" }}>
                  <Users size={24} style={{ opacity: 0.3, margin: "0 auto 6px", display: "block" }} />
                  <span style={{ fontSize: 11.5 }}>{labels.emptyText}</span>
                </td>
              </tr>
            ) : (
              data.map((g, idx) => {
                const isPJ = g.personType === "PJ";
                return (
                  <tr key={g.localId} style={{ background: idx % 2 === 1 ? "#fafafa" : "white" }}>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 9,
                          fontWeight: 700,
                          background: isPJ ? "#eff6ff" : "#ecfdf5",
                          color: isPJ ? "#1e40af" : "#065f46",
                        }}
                      >
                        {isPJ ? <Building2 size={10} /> : <UserIcon size={10} />}
                        {g.personType}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", fontWeight: 600, color: "#0f172a" }}>
                      {g.name}
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: "#475569" }}>
                      {formatDocument(g.document, g.personType)}
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 9,
                          fontWeight: 700,
                          background: g.isFromDb ? "#dcfce7" : "#fef3c7",
                          color: g.isFromDb ? "#166534" : "#92400e",
                        }}
                      >
                        {g.isFromDb ? <CheckCircle size={10} /> : <Sparkles size={10} />}
                        {g.isFromDb ? "Cadastrado" : "Novo"}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        {g.isFromDb ? (
                          <button
                            type="button"
                            className="btn-icon"
                            title="Visualizar dados"
                            onClick={() => g.id && onOpenView(g.id)}
                          >
                            <Eye size={11} style={{ color: "#2563eb" }} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-icon"
                            title={`Editar ${labels.singular.toLowerCase()}`}
                            onClick={() => onOpenEditNew(idx, g)}
                          >
                            <Edit2 size={11} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-icon"
                          title={labels.removeTitle}
                          style={{ color: "#dc2626" }}
                          onClick={() => onRemove(idx)}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="keep-case" style={{ fontSize: 10.5, color: "#64748b", lineHeight: 1.5 }}>
        {labels.footerArticle} {labels.footerNoun.toLowerCase()} marcados como{" "}
        <strong style={{ color: "#92400e" }}>Novo</strong> serão cadastrados e
        vinculados ao cliente automaticamente quando você salvar o contrato. Os marcados como{" "}
        <strong style={{ color: "#166534" }}>Cadastrado</strong> não podem ser editados aqui (edite-os na tela de Pessoas).
      </div>
    </div>
  );
}
