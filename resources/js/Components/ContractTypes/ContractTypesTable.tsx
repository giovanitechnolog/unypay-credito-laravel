import { Pencil, Trash2, FileText } from "lucide-react";
import type { ContractType } from "../../types/contractType";

interface ContractTypesTableProps {
  contractTypes: ContractType[];
  loading: boolean;
  onEdit: (contractType: ContractType) => void;
  onDelete: (contractType: ContractType) => void;
}

export default function ContractTypesTable({
  contractTypes,
  loading,
  onEdit,
  onDelete,
}: ContractTypesTableProps) {
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 14 }}>
        Carregando tipos de contrato...
      </div>
    );
  }

  if (contractTypes.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 14 }}>
        Nenhum tipo de contrato encontrado.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            <Th style={{ width: 48 }}>#</Th>
            <Th>Nome</Th>
            <Th>Identificador</Th>
            <Th style={{ width: 130, textAlign: "center" }}>Contratos</Th>
            <Th style={{ width: 110, textAlign: "right" }}>Ações</Th>
          </tr>
        </thead>
        <tbody>
          {contractTypes.map((ct) => {
            const total = ct.contracts_count ?? 0;
            const active = ct.active_contracts_count ?? 0;
            const blockDelete = active > 0;
            return (
              <tr key={ct.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <Td style={{ color: "#9ca3af", fontFamily: "'IBM Plex Mono', monospace" }}>{ct.id}</Td>
                <Td>
                  <strong style={{ color: "#111827" }}>{ct.name}</strong>
                </Td>
                <Td>
                  {ct.slug ? (
                    <code style={{ fontSize: 11, color: "#6b7280", background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>
                      {ct.slug}
                    </code>
                  ) : (
                    <span style={{ color: "#d1d5db" }}>—</span>
                  )}
                </Td>
                <Td style={{ textAlign: "center" }}>
                  <span
                    title={`${total} contrato(s) no total · ${active} ativo(s)`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: active > 0 ? "#ecfdf5" : "#f3f4f6",
                      color: active > 0 ? "#065f46" : "#6b7280",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    <FileText size={11} />
                    {active}/{total}
                  </span>
                </Td>
                <Td style={{ textAlign: "right" }}>
                  <button onClick={() => onEdit(ct)} title="Editar" style={iconActionBtn}>
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => onDelete(ct)}
                    title={
                      blockDelete
                        ? `Não é possível excluir: ${active} contrato(s) ativo(s) usando este tipo`
                        : "Excluir"
                    }
                    disabled={blockDelete}
                    style={{
                      ...iconActionBtn,
                      color: blockDelete ? "#d1d5db" : "#b91c1c",
                      cursor: blockDelete ? "not-allowed" : "pointer",
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const iconActionBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#4b5563",
  padding: 6,
  borderRadius: 6,
  marginLeft: 4,
};

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 14px",
        fontSize: 11,
        fontWeight: 700,
        color: "#6b7280",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td
      style={{
        padding: "12px 14px",
        color: "#374151",
        ...style,
      }}
    >
      {children}
    </td>
  );
}
