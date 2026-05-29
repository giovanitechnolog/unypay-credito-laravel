import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { api, extractFirstError } from "../../lib/api";
import type { ContractType } from "../../types/contractType";
import { Backdrop } from "./ContractTypeFormModal";

interface DeleteContractTypeModalProps {
  open: boolean;
  contractType: ContractType | null;
  onClose: () => void;
  onDeleted: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export default function DeleteContractTypeModal({
  open,
  contractType,
  onClose,
  onDeleted,
  onSuccess,
  onError,
}: DeleteContractTypeModalProps) {
  const [submitting, setSubmitting] = useState(false);

  if (!open || !contractType) return null;

  const total = contractType.contracts_count ?? 0;
  const active = contractType.active_contracts_count ?? 0;
  const blocked = active > 0;

  async function confirm() {
    if (!contractType) return;
    setSubmitting(true);
    try {
      await api.delete(`/api/contract-types/${contractType.id}`);
      onSuccess("Tipo de contrato excluído com sucesso.");
      onDeleted();
      onClose();
    } catch (err) {
      onError(extractFirstError(err, "Não foi possível excluir o tipo de contrato."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Backdrop onClose={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 12,
          width: "100%",
          maxWidth: 460,
          boxShadow: "0 10px 40px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>
            Excluir tipo de contrato
          </h2>
          <button onClick={onClose} style={closeBtn} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <div style={{ padding: 20 }}>
          <div
            style={{
              display: "flex",
              gap: 12,
              padding: 14,
              background: blocked ? "#fffbeb" : "#fef2f2",
              border: `1px solid ${blocked ? "#fde68a" : "#fecaca"}`,
              borderRadius: 10,
              alignItems: "flex-start",
            }}
          >
            <AlertTriangle
              size={20}
              color={blocked ? "#b45309" : "#b91c1c"}
              style={{ flexShrink: 0, marginTop: 2 }}
            />
            <div style={{ fontSize: 13, color: blocked ? "#78350f" : "#7f1d1d", lineHeight: 1.5 }}>
              {blocked ? (
                <>
                  Não é possível excluir <strong>{contractType.name}</strong>: existem{" "}
                  <strong>{active} contrato(s) ativo(s)</strong> associado(s) a este tipo.
                  <br />
                  <br />
                  Considere <strong>desativar</strong> o tipo (ele continuará vinculado ao histórico,
                  mas deixará de aparecer no cadastro de novos contratos).
                </>
              ) : (
                <>
                  Esta ação é <strong>permanente</strong>. Tem certeza que deseja excluir o tipo{" "}
                  <strong>{contractType.name}</strong>?
                  {total > 0 && (
                    <>
                      <br />
                      <br />
                      Existem <strong>{total} contrato(s)</strong> históricos associados (nenhum
                      ativo). Após a exclusão, eles perderão a referência do tipo.
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
            <button type="button" onClick={onClose} style={secondaryBtn}>
              Cancelar
            </button>
            {!blocked && (
              <button
                type="button"
                onClick={confirm}
                disabled={submitting}
                style={dangerBtn(submitting)}
              >
                {submitting ? "Excluindo..." : "Confirmar exclusão"}
              </button>
            )}
          </div>
        </div>
      </div>
    </Backdrop>
  );
}

const closeBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#6b7280",
  padding: 4,
  borderRadius: 6,
  display: "flex",
};

const secondaryBtn: React.CSSProperties = {
  padding: "9px 14px",
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  color: "#374151",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};

const dangerBtn = (loading: boolean): React.CSSProperties => ({
  padding: "9px 14px",
  background: loading ? "#7f1d1d" : "#b91c1c",
  border: "none",
  borderRadius: 8,
  color: "white",
  fontSize: 13,
  fontWeight: 600,
  cursor: loading ? "not-allowed" : "pointer",
});
