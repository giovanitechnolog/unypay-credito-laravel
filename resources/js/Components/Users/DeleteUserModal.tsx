import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { api, extractFirstError } from "../../lib/api";
import type { User } from "../../types/user";
import { Backdrop } from "./UserFormModal";

interface DeleteUserModalProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onDeleted: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export default function DeleteUserModal({
  open,
  user,
  onClose,
  onDeleted,
  onSuccess,
  onError,
}: DeleteUserModalProps) {
  const [submitting, setSubmitting] = useState(false);

  if (!open || !user) return null;

  async function confirm() {
    if (!user) return;
    setSubmitting(true);
    try {
      await api.delete(`/api/users/${user.id}`);
      onSuccess("Usuário excluído com sucesso.");
      onDeleted();
      onClose();
    } catch (err) {
      onError(extractFirstError(err, "Não foi possível excluir o usuário."));
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
          borderRadius: 10,
          width: "min(440px, 96vw)",
          maxWidth: "96vw",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.25)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 22px",
            background: "linear-gradient(135deg, #1e2139 0%, #2d3154 100%)",
            color: "white",
            borderBottom: "1px solid #2d3154",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertTriangle size={16} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>Excluir usuário</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>Confirme a remoção definitiva da conta</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              cursor: "pointer",
              color: "white",
              width: 30, height: 30,
              borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={16} />
          </button>
        </header>

        <div style={{ padding: 22, background: "white" }}>
          <div
            style={{
              display: "flex",
              gap: 12,
              padding: 14,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 10,
              alignItems: "flex-start",
            }}
          >
            <AlertTriangle size={20} color="#b91c1c" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.5 }}>
              Esta ação é <strong>permanente</strong>. Tem certeza que deseja excluir{" "}
              <strong>{user.name}</strong> ({user.email})?
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
            <button type="button" onClick={onClose} style={secondaryBtn}>
              Cancelar
            </button>
            <button type="button" onClick={confirm} disabled={submitting} style={dangerBtn(submitting)}>
              {submitting ? "Excluindo..." : "Confirmar exclusão"}
            </button>
          </div>
        </div>
      </div>
    </Backdrop>
  );
}

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
