import React, { FormEvent, useEffect, useRef, useState } from "react";
import {
  UserCheck, X, KeyRound, IdCard, Users, Camera, Upload, Trash, Loader2, RefreshCw,
} from "lucide-react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import PasswordInput from "../PasswordInput";
import { api, extractFirstError } from "../../lib/api";
import { fetchSigxByCpf, getRedHighlight, notifySigxFailure } from "../../lib/sigx";

interface ProfileUser {
  id: number;
  name: string;
  email: string;
  cpf: string | null;
  rg: string | null;
  phone: string | null;
  birthDate: string | null;
  gender: string | null;
  photoUrl?: string | null;
}

interface UserProfileModalProps {
  open: boolean;
  userId: number;
  onClose: () => void;
}

const FIELD_MAX_LENGTH = {
  name: 255,
  email: 320,
  password: 255,
  cpf: 14,
  rg: 20,
  phone: 15,
  gender: 20,
} as const;

const NO_PASTE_PROPS: React.InputHTMLAttributes<HTMLInputElement> = {
  onPaste: (e) => e.preventDefault(),
  onCopy: (e) => e.preventDefault(),
  onCut: (e) => e.preventDefault(),
  onDrop: (e) => e.preventDefault(),
  onDragOver: (e) => e.preventDefault(),
  autoComplete: "off",
  spellCheck: false,
};

const maskCPF = (v: string) => {
  v = v.replace(/\D/g, "");
  if (v.length > 11) v = v.substring(0, 11);
  return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const maskPhone = (v: string) => {
  v = v.replace(/\D/g, "");
  if (v.length > 11) v = v.substring(0, 11);
  if (v.length === 11) return v.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  return v.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
};

const uppercaseText = (value: string) => value.toUpperCase();

const isValidCpf = (raw: string): boolean => {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  for (let t = 9; t < 11; t++) {
    let sum = 0;
    for (let i = 0; i < t; i++) sum += parseInt(digits[i], 10) * (t + 1 - i);
    let rest = (sum * 10) % 11;
    if (rest === 10) rest = 0;
    if (rest !== parseInt(digits[t], 10)) return false;
  }
  return true;
};

const MODAL_STYLES = `
  .users-profile-modal,
  .users-profile-modal input,
  .users-profile-modal select,
  .users-profile-modal textarea,
  .users-profile-modal button,
  .users-profile-modal option,
  .users-profile-modal label,
  .users-profile-modal span,
  .users-profile-modal strong { text-transform: uppercase; }

  .users-profile-modal input.mono,
  .users-profile-modal input[type="email"],
  .users-profile-modal input[type="password"],
  .users-profile-modal input[type="date"],
  .users-profile-modal input.password-input { text-transform: none !important; }
  .users-profile-modal input::placeholder { text-transform: none; }
  .users-profile-modal .keep-case,
  .users-profile-modal .keep-case * { text-transform: none !important; }

  .users-profile-modal .users-modal-body { scroll-behavior: smooth; }
  .users-profile-modal .users-modal-body::-webkit-scrollbar { width: 8px; }
  .users-profile-modal .users-modal-body::-webkit-scrollbar-track { background: #f1f5f9; }
  .users-profile-modal .users-modal-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
  .users-profile-modal .users-modal-body::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  .users-profile-modal .sigx-input { transition: border-color 0.15s, box-shadow 0.15s; }
  .users-profile-modal .sigx-input:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }
`;

export default function UserProfileModal({ open, userId, onClose }: UserProfileModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"perfil" | "pessoal">("perfil");
  const [originalEmail, setOriginalEmail] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [cpfLoading, setCpfLoading] = useState(false);
  const [cpfSynced, setCpfSynced] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    emailConfirmation: "",
    currentPassword: "",
    password: "",
    passwordConfirmation: "",
    cpf: "",
    rg: "",
    phone: "",
    birthDate: "",
    gender: "",
  });

  const emailChanged = formData.email.trim().toLowerCase() !== originalEmail.toLowerCase();
  const requireEmailConfirm = emailChanged;
  const isChangingPassword =
    !!formData.password || !!formData.passwordConfirmation || !!formData.currentPassword;

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setActiveTab("perfil");
    setCpfError(null);
    setCpfSynced(false);

    api.get<{ user: ProfileUser }>("/api/users/profile")
      .then(({ data }) => {
        const u = data.user;
        setOriginalEmail(u.email ?? "");
        setFormData({
          name: uppercaseText(u.name ?? ""),
          email: u.email ?? "",
          emailConfirmation: u.email ?? "",
          currentPassword: "",
          password: "",
          passwordConfirmation: "",
          cpf: u.cpf ? maskCPF(u.cpf) : "",
          rg: u.rg ? uppercaseText(u.rg) : "",
          phone: u.phone ? maskPhone(u.phone) : "",
          birthDate: u.birthDate ?? "",
          gender: u.gender ?? "",
        });
        setPhotoFile(null);
        setPhotoPreview(u.photoUrl ?? null);
      })
      .catch((err) => {
        toast.error(extractFirstError(err, "Não foi possível carregar seu perfil."));
        onClose();
      })
      .finally(() => setLoading(false));
  }, [open, userId, onClose]);

  useEffect(() => {
    if (emailChanged && formData.emailConfirmation === originalEmail) {
      setFormData((p) => ({ ...p, emailConfirmation: "" }));
    }
  }, [emailChanged, originalEmail, formData.emailConfirmation]);

  if (!open) return null;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem (JPG, PNG ou WEBP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem ultrapassa o limite de 2 MB.");
      return;
    }
    if (photoPreview && photoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const handlePhotoRemove = () => {
    if (photoPreview && photoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSyncCpf = async () => {
    const digits = (formData.cpf ?? "").replace(/\D/g, "");
    if (digits.length !== 11) {
      toast.error("Digite um CPF completo (11 dígitos) antes de sincronizar.");
      return;
    }
    if (!isValidCpf(digits)) {
      toast.error("CPF inválido — corrija antes de consultar o SIGx.");
      return;
    }

    setCpfLoading(true);
    try {
      const result = await fetchSigxByCpf(digits);
      if (!result.ok || !result.data) {
        notifySigxFailure(result);
        if (result.status === 404) {
          setFormData((p) => ({
            ...p,
            name: "",
            email: "",
            rg: "",
            phone: "",
            birthDate: "",
            gender: "",
          }));
          setCpfSynced(false);
        }
        return;
      }

      const d = result.data;
      setFormData((p) => ({
        ...p,
        name: d.name ? uppercaseText(d.name) : p.name,
        email: d.email || p.email,
        rg: d.rg ? uppercaseText(String(d.rg)) : p.rg,
        phone: d.phone ? maskPhone(String(d.phone)) : p.phone,
        birthDate: d.birthDate || p.birthDate,
        gender: d.gender || p.gender,
      }));
      setCpfSynced(true);
      toast.success("Dados do SIGx aplicados ao formulário.");
    } catch (err) {
      toast.error(extractFirstError(err, "Falha ao consultar o SIGx."));
    } finally {
      setCpfLoading(false);
    }
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (requireEmailConfirm && formData.email.trim().toLowerCase() !== formData.emailConfirmation.trim().toLowerCase()) {
      toast.error("O e-mail e a confirmação de e-mail não conferem.");
      return;
    }
    if (isChangingPassword) {
      if (formData.password !== formData.passwordConfirmation) {
        toast.error("A nova senha e a confirmação não conferem.");
        return;
      }
      if (!formData.currentPassword) {
        toast.error("Informe a senha atual para alterar a senha.");
        return;
      }
    }
    if (formData.cpf && !isValidCpf(formData.cpf)) {
      setCpfError("O CPF informado é inválido.");
      setActiveTab("pessoal");
      toast.error("O CPF informado é inválido.");
      return;
    }

    const data = new FormData();
    data.append("name", uppercaseText(formData.name.trim()));
    data.append("email", formData.email);
    if (requireEmailConfirm) data.append("email_confirmation", formData.emailConfirmation);
    data.append("cpf", formData.cpf);
    data.append("rg", formData.rg ? uppercaseText(formData.rg.trim()) : formData.rg);
    data.append("phone", formData.phone);
    data.append("birthDate", formData.birthDate);
    data.append("gender", formData.gender);

    if (isChangingPassword) {
      data.append("current_password", formData.currentPassword);
      data.append("password", formData.password);
      data.append("password_confirmation", formData.passwordConfirmation);
    }

    if (photoFile) data.append("photo", photoFile);
    data.append("_method", "PUT");

    setSubmitting(true);
    try {
      await api.post(`/api/users/${userId}`, data);
      toast.success("Perfil atualizado com sucesso!");
      onClose();
      router.reload({ only: ["auth"] });
    } catch (err) {
      toast.error(extractFirstError(err, "Falha ao atualizar o perfil."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="users-profile-modal">
      <style>{MODAL_STYLES}</style>
      <div className="sigx-modal-overlay" onMouseDown={onClose} style={{ zIndex: 200 }}>
        <div
          className="sigx-modal users-modal"
          style={{
            width: "min(720px, 96vw)",
            maxWidth: "96vw",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 24px 60px rgba(15, 23, 42, 0.25)",
            borderRadius: 10,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
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
                <UserCheck size={16} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>Meus Dados</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                  Atualize suas informações de acesso e cadastro
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
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
          </div>

          <div
            style={{
              display: "flex",
              gap: 4,
              background: "#f8fafc",
              padding: "8px 12px",
              borderBottom: "1px solid #e5e7eb",
              overflowX: "auto",
              flexWrap: "nowrap",
            }}
          >
            {([
              { key: "perfil" as const, label: "Dados de Acesso", icon: KeyRound },
              { key: "pessoal" as const, label: "Informações Pessoais", icon: IdCard },
            ]).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  type="button"
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    fontSize: 11,
                    fontWeight: active ? 700 : 500,
                    cursor: "pointer",
                    borderRadius: 6,
                    background: active ? "white" : "transparent",
                    color: active ? "#1e2139" : "#475569",
                    border: active ? "1px solid #e2e8f0" : "1px solid transparent",
                    boxShadow: active ? "0 1px 2px rgba(15,23,42,0.06)" : "none",
                    whiteSpace: "nowrap",
                    transition: "all 0.1s",
                  }}
                >
                  <Icon size={12} style={{ color: active ? "#2563eb" : "#94a3b8" }} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <div
              className="sigx-modal-body users-modal-body"
              style={{
                padding: 22,
                height: "clamp(380px, 52vh, 60vh)",
                overflowY: "auto",
                background: "white",
              }}
            >
              {loading ? (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", flexDirection: "column", gap: 12 }}>
                  <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
                  Carregando perfil...
                </div>
              ) : activeTab === "perfil" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      padding: 14,
                      background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)",
                      border: "1px solid #e0e7ff",
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div
                        style={{
                          width: 72, height: 72,
                          borderRadius: "50%",
                          background: "white",
                          border: "3px solid #2563eb",
                          overflow: "hidden",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: "0 4px 14px rgba(37, 99, 235, 0.25)",
                        }}
                      >
                        {photoPreview ? (
                          <img src={photoPreview} alt="Foto do operador" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <Users size={26} style={{ color: "#cbd5e1" }} />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        title={photoPreview ? "Trocar foto" : "Adicionar foto"}
                        style={{
                          position: "absolute",
                          bottom: -2, right: -2,
                          width: 26, height: 26,
                          borderRadius: "50%",
                          background: "#2563eb",
                          border: "2px solid white",
                          color: "white",
                          cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
                        }}
                      >
                        <Camera size={12} />
                      </button>
                      <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#1e2139", letterSpacing: "0.02em" }}>
                          Foto do Operador
                        </span>
                        <span className="keep-case" style={{ fontSize: 10.5, color: "#64748b" }}>
                          JPG, PNG ou WEBP — recomendamos imagem quadrada de até 2 MB.
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 14px",
                            fontSize: 11,
                            fontWeight: 600,
                            background: "#2563eb",
                            color: "white",
                            border: "1px solid #1d4ed8",
                            borderRadius: 6,
                            cursor: "pointer",
                            boxShadow: "0 1px 2px rgba(37, 99, 235, 0.25)",
                          }}
                        >
                          <Upload size={12} /> {photoPreview ? "Trocar Foto" : "Adicionar Foto"}
                        </button>
                        {photoPreview && (
                          <button
                            type="button"
                            onClick={handlePhotoRemove}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "6px 14px",
                              fontSize: 11,
                              fontWeight: 600,
                              background: "white",
                              color: "#dc2626",
                              border: "1px solid #fecaca",
                              borderRadius: 6,
                              cursor: "pointer",
                            }}
                          >
                            <Trash size={12} /> Remover
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="sigx-label">NOME COMPLETO *</label>
                    <input
                      type="text"
                      className="sigx-input"
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: uppercaseText(e.target.value) }))}
                      maxLength={FIELD_MAX_LENGTH.name}
                      required
                      style={getRedHighlight(formData.name, cpfSynced)}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label className="sigx-label">E-MAIL *</label>
                      <input
                        type="email"
                        className="sigx-input"
                        value={formData.email}
                        onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                        maxLength={FIELD_MAX_LENGTH.email}
                        required
                        style={getRedHighlight(formData.email, cpfSynced)}
                      />
                    </div>
                    <div>
                      <label className="sigx-label">
                        CONFIRMAÇÃO DE E-MAIL {requireEmailConfirm && <span>*</span>}
                      </label>
                      <input
                        type="email"
                        className="sigx-input"
                        value={formData.emailConfirmation}
                        onChange={(e) => setFormData((p) => ({ ...p, emailConfirmation: e.target.value }))}
                        maxLength={FIELD_MAX_LENGTH.email}
                        disabled={!requireEmailConfirm}
                        required={requireEmailConfirm}
                        placeholder={requireEmailConfirm ? "Digite o e-mail novamente" : ""}
                        {...NO_PASTE_PROPS}
                      />
                      {requireEmailConfirm
                        && formData.emailConfirmation
                        && formData.emailConfirmation.trim().toLowerCase() !== formData.email.trim().toLowerCase() && (
                        <span className="keep-case" style={{ display: "block", marginTop: 4, fontSize: 10.5, color: "#dc2626", fontWeight: 600 }}>
                          Os e-mails não conferem.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="keep-case">
                    <label className="sigx-label">
                      SENHA ATUAL {isChangingPassword && <span>*</span>}
                      <span className="keep-case" style={{ color: "#94a3b8", fontWeight: 500, fontSize: 10, marginLeft: 6 }}>
                        (necessária apenas para alterar a senha)
                      </span>
                    </label>
                    <PasswordInput
                      className="sigx-input"
                      value={formData.currentPassword}
                      onChange={(e) => setFormData((p) => ({ ...p, currentPassword: e.target.value }))}
                      maxLength={FIELD_MAX_LENGTH.password}
                      required={isChangingPassword}
                      autoComplete="current-password"
                      spellCheck={false}
                    />
                  </div>

                  <div className="keep-case" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label className="sigx-label">
                        NOVA SENHA
                        <span className="keep-case" style={{ color: "#94a3b8", fontWeight: 500, fontSize: 10, marginLeft: 6 }}>
                          (deixe vazio para manter)
                        </span>
                      </label>
                      <PasswordInput
                        className="sigx-input"
                        value={formData.password}
                        onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                        maxLength={FIELD_MAX_LENGTH.password}
                        minLength={6}
                        required={isChangingPassword}
                        autoComplete="new-password"
                        spellCheck={false}
                      />
                    </div>
                    <div>
                      <label className="sigx-label">
                        CONFIRMAÇÃO DA NOVA SENHA {isChangingPassword && <span>*</span>}
                      </label>
                      <PasswordInput
                        className="sigx-input"
                        value={formData.passwordConfirmation}
                        onChange={(e) => setFormData((p) => ({ ...p, passwordConfirmation: e.target.value }))}
                        maxLength={FIELD_MAX_LENGTH.password}
                        minLength={6}
                        required={isChangingPassword}
                        placeholder="Digite a senha novamente"
                        {...NO_PASTE_PROPS}
                      />
                      {(formData.passwordConfirmation || formData.password)
                        && formData.password !== formData.passwordConfirmation && (
                        <span className="keep-case" style={{ display: "block", marginTop: 4, fontSize: 10.5, color: "#dc2626", fontWeight: 600 }}>
                          As senhas não conferem.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label className="sigx-label">CPF</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          type="text"
                          className="sigx-input mono"
                          placeholder="000.000.000-00"
                          value={formData.cpf}
                          maxLength={FIELD_MAX_LENGTH.cpf}
                          onChange={(e) => {
                            const next = maskCPF(e.target.value);
                            setFormData((p) => ({ ...p, cpf: next }));
                            setCpfError(null);
                            if (cpfSynced) setCpfSynced(false);
                          }}
                          onBlur={(e) => {
                            const v = e.target.value;
                            if (v && !isValidCpf(v)) setCpfError("O CPF informado é inválido.");
                            else setCpfError(null);
                          }}
                          readOnly={cpfLoading}
                          style={cpfError ? { borderColor: "#dc2626", boxShadow: "0 0 0 3px rgba(220,38,38,0.12)" } : undefined}
                        />
                        <button
                          type="button"
                          onClick={handleSyncCpf}
                          disabled={cpfLoading || formData.cpf.replace(/\D/g, "").length !== 11}
                          title="Consulta o CPF na integração SIGx ativa e preenche os campos automaticamente"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "0 12px",
                            borderRadius: 8,
                            border: "1px solid #2563eb",
                            background: cpfLoading ? "#dbeafe" : "#eff6ff",
                            color: "#1d4ed8",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: cpfLoading || formData.cpf.replace(/\D/g, "").length !== 11 ? "not-allowed" : "pointer",
                            opacity: cpfLoading || formData.cpf.replace(/\D/g, "").length !== 11 ? 0.55 : 1,
                            whiteSpace: "nowrap",
                            transition: "all 0.12s",
                          }}
                        >
                          {cpfLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                          <span className="keep-case">
                            {cpfLoading ? "Consultando..." : "Sincronizar com SIGx"}
                          </span>
                        </button>
                      </div>
                      {cpfError && (
                        <span className="keep-case" style={{ display: "block", marginTop: 4, fontSize: 10.5, color: "#dc2626", fontWeight: 600 }}>
                          {cpfError}
                        </span>
                      )}
                      {cpfSynced && !cpfError && (
                        <span className="keep-case" style={{ display: "block", marginTop: 4, fontSize: 10.5, color: "#dc2626", fontWeight: 600 }}>
                          Campos em vermelho não foram retornados pelo SIGx — preencha manualmente.
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="sigx-label">IDENTIDADE (RG)</label>
                      <input
                        type="text"
                        className="sigx-input"
                        value={formData.rg}
                        maxLength={FIELD_MAX_LENGTH.rg}
                        onChange={(e) => setFormData((p) => ({ ...p, rg: uppercaseText(e.target.value) }))}
                        style={getRedHighlight(formData.rg, cpfSynced)}
                      />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label className="sigx-label">TELEFONE / WHATSAPP</label>
                      <input
                        type="text"
                        className="sigx-input mono"
                        placeholder="(00) 00000-0000"
                        value={formData.phone}
                        maxLength={FIELD_MAX_LENGTH.phone}
                        onChange={(e) => setFormData((p) => ({ ...p, phone: maskPhone(e.target.value) }))}
                        style={getRedHighlight(formData.phone, cpfSynced)}
                      />
                    </div>
                    <div>
                      <label className="sigx-label">DATA DE NASCIMENTO</label>
                      <input
                        type="date"
                        className="sigx-input"
                        value={formData.birthDate}
                        onChange={(e) => setFormData((p) => ({ ...p, birthDate: e.target.value }))}
                        style={getRedHighlight(formData.birthDate, cpfSynced)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="sigx-label">GÊNERO</label>
                    <select
                      className="sigx-input"
                      value={formData.gender}
                      onChange={(e) => setFormData((p) => ({ ...p, gender: e.target.value }))}
                      style={getRedHighlight(formData.gender, cpfSynced)}
                    >
                      <option value="">Não Informar</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                padding: "12px 22px",
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                background: "#f8fafc",
              }}
            >
              <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>
                Edição registrada com auditoria automática
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={onClose} disabled={loading || submitting}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading || submitting}
                  style={{ minWidth: 150, justifyContent: "center" }}
                >
                  {submitting ? "Salvando..." : "Atualizar Operador"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
