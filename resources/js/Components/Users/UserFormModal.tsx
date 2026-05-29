import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Eye, EyeOff, KeyRound, User as UserIcon, X } from "lucide-react";
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
  document: "",
  birthDate: "",
  phone: "",
  password: "",
  passwordConfirmation: "",
  role: "admin",
  photo: null,
};

const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4MB
const ACCEPTED_MIMES = ["image/jpeg", "image/png", "image/webp"];

type TabKey = "pessoal" | "seguranca";

const TABS: { key: TabKey; label: string }[] = [
  { key: "pessoal", label: "Dados Pessoais" },
  { key: "seguranca", label: "Acesso e Segurança" },
];

// ─── Máscaras (apenas dígitos → string formatada) ──────────────────────────
const onlyDigits = (v: string) => v.replace(/\D/g, "");

const maskCPF = (v: string) =>
  onlyDigits(v)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

const maskCNPJ = (v: string) =>
  onlyDigits(v)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");

/** Detecta automaticamente CPF vs CNPJ pela quantidade de dígitos. */
const maskDocument = (v: string) => {
  const digits = onlyDigits(v);
  return digits.length > 11 ? maskCNPJ(digits) : maskCPF(digits);
};

const maskPhone = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
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
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("pessoal");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      if (user) {
        setValues({
          name: user.name ?? "",
          email: user.email ?? "",
          document: user.document ? maskDocument(user.document) : "",
          birthDate: user.birthDate ?? "",
          phone: user.phone ? maskPhone(user.phone) : "",
          password: "",
          passwordConfirmation: "",
          role: (user.role as UserRole) ?? "admin",
          photo: null,
        });
        setPhotoPreview(user.photoUrl ?? null);
      } else {
        setValues(EMPTY);
        setPhotoPreview(null);
      }
      setErrors({});
      setActiveTab("pessoal");
      setShowPassword(false);
      setShowPasswordConfirm(false);
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

  // Conta erros por aba para exibir um indicador visual quando o usuário envia
  // o formulário e a validação falha em uma aba diferente da atual.
  const errorsByTab = useMemo(() => {
    const pessoalKeys = ["name", "document", "birthDate", "phone", "photo"];
    const segurancaKeys = ["email", "password", "password_confirmation"];
    return {
      pessoal: pessoalKeys.filter((k) => errors[k]).length,
      seguranca: segurancaKeys.filter((k) => errors[k]).length,
    };
  }, [errors]);

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
      setActiveTab("pessoal");
      return;
    }

    // Confirmação de senha precisa bater antes de ir ao servidor — UX mais ágil.
    if (values.password && values.password !== values.passwordConfirmation) {
      setErrors((prev) => ({ ...prev, password_confirmation: "A confirmação de senha não confere." }));
      setActiveTab("seguranca");
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const formData = new FormData();
      formData.append("name", values.name);
      formData.append("email", values.email);
      formData.append("role", values.role);

      if (values.document) formData.append("document", values.document);
      if (values.birthDate) formData.append("birthDate", values.birthDate);
      if (values.phone) formData.append("phone", values.phone);

      if (values.password) {
        formData.append("password", values.password);
        formData.append("password_confirmation", values.passwordConfirmation);
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

        // Pula automaticamente para a primeira aba que contém erro.
        const securityKeys = ["email", "password", "password_confirmation"];
        const hasSecurityError = securityKeys.some((k) => flat[k]);
        const personalKeys = ["name", "document", "birthDate", "phone", "photo"];
        const hasPersonalError = personalKeys.some((k) => flat[k]);
        if (hasPersonalError) setActiveTab("pessoal");
        else if (hasSecurityError) setActiveTab("seguranca");
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
          maxWidth: 560,
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

        {/* Abas no topo do modal */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #e5e7eb",
            background: "#fafafa",
          }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const errorCount = errorsByTab[tab.key];
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  background: isActive ? "white" : "transparent",
                  border: "none",
                  borderBottom: isActive ? "2px solid #1e2139" : "2px solid transparent",
                  color: isActive ? "#1e2139" : "#6b7280",
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "all 0.15s",
                }}
              >
                {tab.label}
                {errorCount > 0 && (
                  <span
                    style={{
                      background: "#b91c1c",
                      color: "white",
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 999,
                      padding: "1px 6px",
                      minWidth: 16,
                      textAlign: "center",
                    }}
                  >
                    {errorCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <form onSubmit={submit} style={{ padding: 20 }}>
          {/* Container com altura mínima fixa para que o modal não “pule”
              de tamanho ao alternar entre as abas (a aba mais alta —
              Dados Pessoais — define o piso visual). */}
          <div style={{ minHeight: 440 }}>
          {/* ── ABA: Dados Pessoais ─────────────────────────────────────── */}
          {activeTab === "pessoal" && (
            <>
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

              <Field label="Nome completo" error={errors.name}>
                <input
                  type="text"
                  value={values.name}
                  onChange={(e) => setField("name", e.target.value)}
                  required
                  placeholder="Ex.: João Carlos da Silva"
                  style={inputStyle}
                />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                <Field label="CPF ou CNPJ" error={errors.document}>
                  <input
                    type="text"
                    value={values.document}
                    onChange={(e) => setField("document", maskDocument(e.target.value))}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Data de nascimento" error={errors.birthDate}>
                  <input
                    type="date"
                    value={values.birthDate}
                    onChange={(e) => setField("birthDate", e.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                    style={inputStyle}
                  />
                </Field>
              </div>

              <Field label="Telefone / Celular" error={errors.phone} style={{ marginTop: 14 }}>
                <input
                  type="tel"
                  value={values.phone}
                  onChange={(e) => setField("phone", maskPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  inputMode="numeric"
                  style={inputStyle}
                />
              </Field>
            </>
          )}

          {/* ── ABA: Acesso e Segurança ─────────────────────────────────── */}
          {activeTab === "seguranca" && (
            <>
              <Field label="E-mail" error={errors.email}>
                <input
                  type="email"
                  value={values.email}
                  onChange={(e) => setField("email", e.target.value)}
                  required
                  placeholder="email@exemplo.com"
                  style={inputStyle}
                  autoComplete="email"
                />
              </Field>

              <Field
                label={isEdit ? "Nova senha (opcional)" : "Senha"}
                error={errors.password}
                style={{ marginTop: 14 }}
                hint={isEdit ? "Deixe em branco para manter a senha atual." : "Mínimo de 8 caracteres."}
              >
                <PasswordInput
                  value={values.password}
                  onChange={(v) => setField("password", v)}
                  required={!isEdit}
                  minLength={isEdit && !values.password ? undefined : 8}
                  show={showPassword}
                  onToggleShow={() => setShowPassword((s) => !s)}
                  autoComplete="new-password"
                />
              </Field>

              <Field
                label={isEdit ? "Confirme a nova senha" : "Confirme a senha"}
                error={errors.password_confirmation}
                style={{ marginTop: 14 }}
                hint="Repita a senha digitada acima para evitar erros."
              >
                <PasswordInput
                  value={values.passwordConfirmation}
                  onChange={(v) => setField("passwordConfirmation", v)}
                  required={!isEdit || !!values.password}
                  minLength={isEdit && !values.password ? undefined : 8}
                  show={showPasswordConfirm}
                  onToggleShow={() => setShowPasswordConfirm((s) => !s)}
                  autoComplete="new-password"
                />
              </Field>

              {/* Aviso suave quando as duas senhas divergem (feedback em tempo real). */}
              {values.password &&
                values.passwordConfirmation &&
                values.password !== values.passwordConfirmation && (
                  <p style={{ marginTop: 8, fontSize: 12, color: "#b91c1c", display: "flex", alignItems: "center", gap: 6 }}>
                    <KeyRound size={12} /> As senhas não coincidem.
                  </p>
                )}
            </>
          )}
          </div>

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

function PasswordInput({
  value,
  onChange,
  required,
  minLength,
  show,
  onToggleShow,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minLength?: number;
  show: boolean;
  onToggleShow: () => void;
  autoComplete?: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        style={{ ...inputStyle, paddingRight: 40 }}
      />
      <button
        type="button"
        onClick={onToggleShow}
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        title={show ? "Ocultar senha" : "Mostrar senha"}
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "#6b7280",
          display: "flex",
          padding: 4,
        }}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
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
