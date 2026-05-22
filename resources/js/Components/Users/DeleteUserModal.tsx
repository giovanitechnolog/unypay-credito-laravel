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
          borderRadius: 12,
          width: "100%",
          maxWidth: 420,
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
            Excluir usuário
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
