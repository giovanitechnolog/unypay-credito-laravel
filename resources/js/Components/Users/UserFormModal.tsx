import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Camera, User as UserIcon, X } from "lucide-react";
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
  role: "admin",
  photo: null,
};

const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4MB
const ACCEPTED_MIMES = ["image/jpeg", "image/png", "image/webp"];

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
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      if (user) {
        setValues({
          name: user.name ?? "",
          email: user.email ?? "",
          password: "",
          role: (user.role as UserRole) ?? "admin",
          photo: null,
        });
        setPhotoPreview(user.photoUrl ?? null);
      } else {
        setValues(EMPTY);
        setPhotoPreview(null);
      }
      setErrors({});
    }
  }, [open, user]);

  // Libera object URLs criados localmente para evitar memory leak.
  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  if (!open) return null;

  function setField<K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_MIMES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, photo: "Formatos aceitos: JPG, PNG ou WEBP." }));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setErrors((prev) => ({ ...prev, photo: "A imagem deve ter no máximo 4MB." }));
      return;
    }

    setErrors((prev) => {
      const { photo, ...rest } = prev;
      return rest;
    });
    setField("photo", file);

    if (photoPreview && photoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();

    // Validação client-side da foto obrigatória no create.
    if (!isEdit && !values.photo) {
      setErrors((prev) => ({ ...prev, photo: "Envie a foto do usuário." }));
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const formData = new FormData();
      formData.append("name", values.name);
      formData.append("email", values.email);
      formData.append("role", values.role);
      if (values.password) {
        formData.append("password", values.password);
      }
      if (values.photo) {
        formData.append("photo", values.photo);
      }

      if (isEdit && user) {
        // Method spoofing para suportar upload de arquivo via PUT.
        formData.append("_method", "PUT");
        await api.post(`/api/users/${user.id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        onSuccess("Usuário atualizado com sucesso.");
      } else {
        await api.post(`/api/users`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
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
          {/* Upload da foto */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  background: photoPreview ? `center / cover no-repeat url(${photoPreview})` : "#f3f4f6",
                  border: errors.photo ? "2px solid #b91c1c" : "2px solid #e5e7eb",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9ca3af",
                  padding: 0,
                }}
                aria-label="Selecionar foto"
                title="Selecionar foto"
              >
                {!photoPreview && <UserIcon size={36} />}
              </button>
              <span
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#1e2139",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid white",
                  pointerEvents: "none",
                }}
              >
                <Camera size={14} />
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                style={{ display: "none" }}
              />
            </div>
          </div>

          {errors.photo && (
            <p style={{ textAlign: "center", marginTop: -10, marginBottom: 12, fontSize: 12, color: "#b91c1c" }}>
              {errors.photo}
            </p>
          )}
          {!errors.photo && (
            <p style={{ textAlign: "center", marginTop: -10, marginBottom: 12, fontSize: 11, color: "#9ca3af" }}>
              {isEdit
                ? "Clique para trocar a foto (JPG, PNG ou WEBP — até 4MB)."
                : "Foto obrigatória — JPG, PNG ou WEBP, até 4MB."}
            </p>
          )}

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
              minLength={isEdit && !values.password ? undefined : 8}
              style={inputStyle}
              autoComplete="new-password"
            />
          </Field>

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
