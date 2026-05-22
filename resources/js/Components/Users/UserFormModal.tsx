import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import { api, extractFirstError } from "../../lib/api";
import type { User, UserFormValues, UserRole } from "../../types/user";

interface UserFormModalProps {
  open: boolean;
  user?: User | null;
  onClose: () => void;
  onSaved: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

const EMPTY: UserFormValues = {
  name: "",
  email: "",
  password: "",
  password_confirmation: "",
  role: "admin",
};

export default function UserFormModal({
  open,
  user,
  onClose,
  onSaved,
  onSuccess,
  onError,
}: UserFormModalProps) {
  const isEdit = !!user;
  const [values, setValues] = useState<UserFormValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (user) {
        setValues({
          name: user.name ?? "",
          email: user.email ?? "",
          password: "",
          password_confirmation: "",
          role: (user.role as UserRole) ?? "admin",
        });
      } else {
        setValues(EMPTY);
      }
      setErrors({});
    }
  }, [open, user]);

  if (!open) return null;

  function setField<K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    try {
      const payload: Partial<UserFormValues> = {
        name: values.name,
        email: values.email,
        role: values.role,
      };
      // Senha: obrigatória no create; opcional no update.
      if (values.password) {
        payload.password = values.password;
        payload.password_confirmation = values.password_confirmation;
      }

      if (isEdit && user) {
        await api.put(`/api/users/${user.id}`, payload);
        onSuccess("Usuário atualizado com sucesso.");
      } else {
        await api.post(`/api/users`, {
          ...payload,
          password: values.password,
          password_confirmation: values.password_confirmation,
        });
        onSuccess("Usuário criado com sucesso.");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      const fieldErrors = err?.response?.data?.errors as Record<string, string[]> | undefined;
      if (fieldErrors) {
        const flat: Record<string, string> = {};
        for (const k of Object.keys(fieldErrors)) flat[k] = fieldErrors[k][0];
        setErrors(flat);
      }
      onError(extractFirstError(err, "Não foi possível salvar o usuário."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Backdrop onClose={onClose}>
      <div
        style={{
          background: "white",
          borderRadius: 12,
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 10px 40px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>
            {isEdit ? "Editar usuário" : "Novo usuário"}
          </h2>
          <button onClick={onClose} style={closeBtn} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={submit} style={{ padding: 20 }}>
          <Field label="Nome" error={errors.name}>
            <input
              type="text"
              value={values.name}
              onChange={(e) => setField("name", e.target.value)}
              required
              style={inputStyle}
            />
          </Field>

          <Field label="E-mail" error={errors.email} style={{ marginTop: 14 }}>
            <input
              type="email"
              value={values.email}
              onChange={(e) => setField("email", e.target.value)}
              required
              style={inputStyle}
            />
          </Field>

          <Field label="Perfil" error={errors.role} style={{ marginTop: 14 }}>
            <select
              value={values.role}
              onChange={(e) => setField("role", e.target.value as UserRole)}
              style={inputStyle}
            >
              <option value="admin">Administrador</option>
              <option value="user">Usuário</option>
            </select>
          </Field>

          <Field
            label={isEdit ? "Nova senha (opcional)" : "Senha"}
            error={errors.password}
            style={{ marginTop: 14 }}
            hint={isEdit ? "Deixe em branco para manter a senha atual." : "Mínimo de 8 caracteres."}
          >
            <input
              type="password"
              value={values.password}
              onChange={(e) => setField("password", e.target.value)}
              required={!isEdit}
              style={inputStyle}
              autoComplete="new-password"
            />
          </Field>

          {(values.password || !isEdit) && (
            <Field
              label="Confirmar senha"
              error={errors.password_confirmation}
              style={{ marginTop: 14 }}
            >
              <input
                type="password"
                value={values.password_confirmation}
                onChange={(e) => setField("password_confirmation", e.target.value)}
                required={!isEdit || !!values.password}
                style={inputStyle}
                autoComplete="new-password"
              />
            </Field>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 24 }}>
            <button type="button" onClick={onClose} style={secondaryBtn}>
              Cancelar
            </button>
            <button type="submit" disabled={submitting} style={primaryBtn(submitting)}>
              {submitting ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar usuário"}
            </button>
          </div>
        </form>
      </div>
    </Backdrop>
  );
}

/* ---------- helpers visuais ---------- */
export function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 14,
  background: "white",
  outline: "none",
};

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

const primaryBtn = (loading: boolean): React.CSSProperties => ({
  padding: "9px 14px",
  background: loading ? "#4b4f78" : "#1e2139",
  border: "none",
  borderRadius: 8,
  color: "white",
  fontSize: 13,
  fontWeight: 600,
  cursor: loading ? "not-allowed" : "pointer",
});

function Field({
  label,
  children,
  error,
  style,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  style?: React.CSSProperties;
  hint?: string;
}) {
  return (
    <div style={style}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <p style={{ marginTop: 4, fontSize: 11, color: "#9ca3af" }}>{hint}</p>
      )}
      {error && <p style={{ marginTop: 4, fontSize: 12, color: "#b91c1c" }}>{error}</p>}
    </div>
  );
}
