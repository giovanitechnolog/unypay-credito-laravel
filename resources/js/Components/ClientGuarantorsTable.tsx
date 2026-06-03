import { UserCheck, Scale, User as UserIcon, Building2, Users } from "lucide-react";

/**
 * 🚀 Tabela somente-leitura de Fiadores e Codevedores vinculados a um cliente.
 *
 * Reusada em dois pontos da experiência:
 *   1. Modal popup acionado pelo ícone da nova coluna "Fiadores" da grade
 *      principal de Clientes.
 *   2. Aba "Fiadores / Codevedores" da tela de Detalhes do Cliente.
 *
 * A fonte de dados é a pivot contract_guarantor (com `role`), distinct por
 * `(clientId, guarantorId, role)` — exatamente o array que o
 * ClientController@index e @show passam em `client.guarantors`.
 */

export type ClientGuarantorRow = {
  id: number;
  name: string;
  personType: "PF" | "PJ";
  document: string | null;
  role: "FIADOR" | "CODEVEDOR";
};

interface Props {
  data: ClientGuarantorRow[];
  /** Permite usar o mesmo componente em layouts compactos (modal) e largos (detalhe). */
  compact?: boolean;
}

const formatDocument = (doc: string | null | undefined, type: "PF" | "PJ"): string => {
  const digits = (doc ?? "").replace(/\D/g, "");
  if (!digits) return "—";
  if (type === "PJ" && digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (type === "PF" && digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return digits;
};

export default function ClientGuarantorsTable({ data, compact = false }: Props) {
  const fiadores    = data.filter(d => d.role === "FIADOR").length;
  const codevedores = data.filter(d => d.role === "CODEVEDOR").length;

  const cellPad = compact ? "8px 10px" : "10px 14px";
  const fontBase = compact ? 11 : 12;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Resumo com contadores por papel */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            background: "#fbf7ff",
            color: "#6b21a8",
            border: "1px solid #e9d5ff",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <UserCheck size={12} /> {fiadores} FIADOR(ES)
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            background: "#fff7ed",
            color: "#c2410c",
            border: "1px solid #fed7aa",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <Scale size={12} /> {codevedores} CODEVEDOR(ES)
        </span>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          overflow: "hidden",
          background: "white",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: fontBase }}>
          <thead>
            <tr style={{ background: "#f1f5f9" }}>
              <th style={{ padding: cellPad, textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 70 }}>Tipo</th>
              <th style={{ padding: cellPad, textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Nome / Razão Social</th>
              <th style={{ padding: cellPad, textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 170 }}>Documento</th>
              <th style={{ padding: cellPad, textAlign: "center", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 130 }}>Vínculo</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 28, textAlign: "center", color: "#94a3b8" }}>
                  <Users size={24} style={{ opacity: 0.3, margin: "0 auto 6px", display: "block" }} />
                  <span style={{ fontSize: 11.5 }}>
                    Nenhum fiador ou codevedor está vinculado a contratos deste cliente.
                  </span>
                </td>
              </tr>
            ) : (
              data.map((g, idx) => {
                const isPJ = g.personType === "PJ";
                const isCodevedor = g.role === "CODEVEDOR";
                return (
                  <tr key={`${g.id}-${g.role}`} style={{ background: idx % 2 === 1 ? "#fafafa" : "white" }}>
                    <td style={{ padding: cellPad, borderBottom: "1px solid #f1f5f9" }}>
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
                    <td style={{ padding: cellPad, borderBottom: "1px solid #f1f5f9", fontWeight: 600, color: "#0f172a" }}>
                      {g.name}
                    </td>
                    <td style={{ padding: cellPad, borderBottom: "1px solid #f1f5f9", fontFamily: "'IBM Plex Mono',monospace", fontSize: fontBase - 0.5, color: "#475569" }}>
                      {formatDocument(g.document, g.personType)}
                    </td>
                    <td style={{ padding: cellPad, borderBottom: "1px solid #f1f5f9", textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 9,
                          fontWeight: 700,
                          background: isCodevedor ? "#fff7ed" : "#fbf7ff",
                          color:      isCodevedor ? "#c2410c" : "#6b21a8",
                        }}
                      >
                        {isCodevedor ? <Scale size={10} /> : <UserCheck size={10} />}
                        {isCodevedor ? "Codevedor" : "Fiador"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="keep-case" style={{ fontSize: 10.5, color: "#64748b", lineHeight: 1.5 }}>
        Esta listagem é gerada automaticamente a partir dos contratos do cliente.
        Para gerenciar vínculos (adicionar, remover ou alterar papel) acesse o contrato correspondente.
      </div>
    </div>
  );
}
