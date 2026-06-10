import { useState } from "react";
import { User, Building2, CheckCircle2, Mail, Phone } from "lucide-react";
import { maskPhone } from "../lib/masks";

/**
 * Tipo de pessoa do fiador (PF ou PJ).
 */
export type PersonType = "PF" | "PJ";

/**
 * Estado do formulário de fiador. As máscaras de CPF/CNPJ/CEP são
 * aplicadas no próprio componente (na entrada) e ficam armazenadas no estado
 * já formatadas — quem persiste é responsável por extrair os dígitos.
 */
export interface GuarantorFormValues {
  personType: PersonType;
  name: string;
  // Contato — comuns a PF e PJ
  email: string;
  phone: string;
  // PF
  nationality: string;
  maritalStatus: string;
  cpf: string;
  rg: string;
  // PJ
  cnpj: string;
  tradeName: string;
  stateRegistration: string;
  // Endereço
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

export const EMPTY_GUARANTOR_FORM: GuarantorFormValues = {
  personType: "PF",
  name: "",
  email: "",
  phone: "",
  nationality: "Brasileiro",
  // 🚀 Default explícito conforme regra de negócio: novas pessoas sem estado
  // civil definido entram como "Não Informado" — bate com a opção do enum
  // do <select> (case-sensitive) e satisfaz a validação `required` do modal.
  maritalStatus: "Não Informado",
  cpf: "",
  rg: "",
  cnpj: "",
  tradeName: "",
  stateRegistration: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  zipCode: "",
};

const MARITAL_STATUS_OPTIONS = [
  "Não Informado",
  "Solteiro(a)",
  "Casado(a)",
  "União Estável",
  "Divorciado(a)",
  "Viúvo(a)",
  "Separado(a)",
];

const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export const onlyDigits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

export const maskCPF = (v: string) => {
  let d = v.replace(/\D/g, "");
  if (d.length > 11) d = d.substring(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

export const maskCNPJ = (v: string) => {
  let d = v.replace(/\D/g, "");
  if (d.length > 14) d = d.substring(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

export const maskCEP = (v: string) => {
  let d = v.replace(/\D/g, "");
  if (d.length > 8) d = d.substring(0, 8);
  return d.replace(/(\d{5})(\d)/, "$1-$2");
};

interface Props {
  value: GuarantorFormValues;
  onChange: (next: GuarantorFormValues) => void;
  /** Quando true, todos os campos viram somente-leitura (caso "Cadastrado"). */
  readOnly?: boolean;
}

/**
 * Renderiza o conjunto de campos PF/PJ + Endereço de um fiador.
 *
 * Não inclui modal/header/botões — esses ficam a cargo de quem usa
 * (Guarantors.tsx, GuarantorQuickCreateModal.tsx, etc.). Isso permite
 * reusar o mesmo formulário em múltiplos contextos sem duplicar código.
 *
 * @example
 *   const [form, setForm] = useState(EMPTY_GUARANTOR_FORM);
 *   <GuarantorFormFields value={form} onChange={setForm} />
 */
export default function GuarantorFormFields({ value, onChange, readOnly = false }: Props) {
  const set = <K extends keyof GuarantorFormValues>(key: K, v: GuarantorFormValues[K]) => {
    onChange({ ...value, [key]: v });
  };

  const [cepFeedback, setCepFeedback] = useState<string>("");

  /**
   * Busca o CEP no ViaCEP e preenche logradouro, bairro, cidade e UF.
   * Mesma estratégia usada na tela de Clientes (handleFetchCep).
   *
   * Importante: aplica o CEP digitado em `next` ANTES de fazer o fetch para
   * que, quando o `onChange` final rodar, o zipCode digitado pelo usuário
   * não seja perdido por causa de um value desatualizado.
   */
  const handleCepChange = async (raw: string) => {
    const masked = maskCEP(raw);
    const next: GuarantorFormValues = { ...value, zipCode: masked };
    onChange(next);

    const digits = masked.replace(/\D/g, "");
    if (digits.length !== 8) {
      setCepFeedback("");
      return;
    }

    setCepFeedback("Buscando...");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await response.json();
      if (data.erro) {
        setCepFeedback("CEP não encontrado.");
        return;
      }
      onChange({
        ...next, // preserva zipCode digitado
        street:       data.logradouro || next.street,
        neighborhood: data.bairro     || next.neighborhood,
        city:         data.localidade || next.city,
        state:        data.uf         || next.state,
      });
      setCepFeedback(`${data.logradouro || ""}, ${data.bairro || ""} — ${data.localidade || ""}/${data.uf || ""}`);
    } catch {
      setCepFeedback("Falha ao consultar o CEP.");
    }
  };

  const switchPersonType = (next: PersonType) => {
    if (value.personType === next) return;
    if (next === "PJ") {
      onChange({
        ...value,
        personType: "PJ",
        nationality: "",
        maritalStatus: "",
        cpf: "",
        rg: "",
      });
    } else {
      onChange({
        ...value,
        personType: "PF",
        nationality: value.nationality || "Brasileiro",
        cnpj: "",
        tradeName: "",
        stateRegistration: "",
      });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ── Toggle PF / PJ ─────────────────────────────────────── */}
      <div>
        <label className="sigx-label">TIPO DE PESSOA *</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { key: "PF" as const, label: "Pessoa Física",   icon: User,      color: "#059669", bg: "#ecfdf5" },
            { key: "PJ" as const, label: "Pessoa Jurídica", icon: Building2, color: "#2563eb", bg: "#eff6ff" },
          ].map((opt) => {
            const Icon = opt.icon;
            const active = value.personType === opt.key;
            const disabled = readOnly && !active;
            return (
              <button
                type="button"
                key={opt.key}
                onClick={() => !readOnly && switchPersonType(opt.key)}
                disabled={readOnly}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 8,
                  cursor: readOnly ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.5 : 1,
                  background: active ? opt.bg : "white",
                  border: `2px solid ${active ? opt.color : "#e5e7eb"}`,
                  color: active ? opt.color : "#64748b",
                  fontWeight: active ? 700 : 500,
                  fontSize: 12,
                  transition: "all 0.12s",
                  boxShadow: active ? `0 2px 8px ${opt.color}22` : "none",
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: active ? opt.color : "#f1f5f9",
                    color: active ? "white" : "#94a3b8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={14} />
                </span>
                <span style={{ flex: 1, textAlign: "left" }}>{opt.label}</span>
                {active && <CheckCircle2 size={14} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Nome / Razão Social ─────────────────────────────── */}
      <div>
        <label className="sigx-label">
          {value.personType === "PJ" ? "RAZÃO SOCIAL *" : "NOME COMPLETO *"}
        </label>
        <input
          type="text"
          className="sigx-input"
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
          required
          maxLength={255}
          readOnly={readOnly}
          style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
        />
      </div>

      {/* ── PESSOA FÍSICA ───────────────────────────────────── */}
      {value.personType === "PF" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label className="sigx-label">NACIONALIDADE *</label>
              <input
                type="text"
                className="sigx-input"
                value={value.nationality}
                onChange={(e) => set("nationality", e.target.value)}
                required
                maxLength={80}
                readOnly={readOnly}
                style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
              />
            </div>
            <div>
              <label className="sigx-label">ESTADO CIVIL *</label>
              <select
                className="sigx-input"
                value={value.maritalStatus}
                onChange={(e) => set("maritalStatus", e.target.value)}
                required
                disabled={readOnly}
                style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
              >
                <option value="">Selecione...</option>
                {MARITAL_STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label className="sigx-label">CPF *</label>
              <input
                type="text"
                className="sigx-input mono"
                placeholder="000.000.000-00"
                value={value.cpf}
                onChange={(e) => set("cpf", maskCPF(e.target.value))}
                required
                minLength={14}
                readOnly={readOnly}
                style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
              />
            </div>
            <div>
              <label className="sigx-label">RG</label>
              <input
                type="text"
                className="sigx-input"
                placeholder="MG-00.000.000"
                value={value.rg}
                onChange={(e) => set("rg", e.target.value)}
                maxLength={20}
                readOnly={readOnly}
                style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
              />
            </div>
          </div>
        </>
      )}

      {/* ── PESSOA JURÍDICA ─────────────────────────────────── */}
      {value.personType === "PJ" && (
        <>
          <div>
            <label className="sigx-label">NOME FANTASIA *</label>
            <input
              type="text"
              className="sigx-input"
              value={value.tradeName}
              onChange={(e) => set("tradeName", e.target.value)}
              required
              maxLength={255}
              readOnly={readOnly}
              style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label className="sigx-label">CNPJ *</label>
              <input
                type="text"
                className="sigx-input mono"
                placeholder="00.000.000/0000-00"
                value={value.cnpj}
                onChange={(e) => set("cnpj", maskCNPJ(e.target.value))}
                required
                minLength={18}
                readOnly={readOnly}
                style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
              />
            </div>
            <div>
              <label className="sigx-label">INSCRIÇÃO ESTADUAL</label>
              <input
                type="text"
                className="sigx-input"
                placeholder='Número ou "ISENTO"'
                value={value.stateRegistration}
                onChange={(e) => set("stateRegistration", e.target.value)}
                maxLength={30}
                readOnly={readOnly}
                style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
              />
            </div>
          </div>
        </>
      )}

      {/* ── Contato (comum a PF e PJ) ───────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label className="sigx-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Mail size={11} style={{ color: "#0d9488" }} /> E-MAIL
          </label>
          <input
            type="email"
            className="sigx-input"
            placeholder="email@exemplo.com"
            value={value.email}
            onChange={(e) => set("email", e.target.value)}
            maxLength={255}
            readOnly={readOnly}
            style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
          />
        </div>
        <div>
          <label className="sigx-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Phone size={11} style={{ color: "#0d9488" }} /> TELEFONE
          </label>
          <input
            type="text"
            className="sigx-input mono"
            placeholder="(00) 00000-0000"
            value={value.phone}
            onChange={(e) => set("phone", maskPhone(e.target.value))}
            maxLength={20}
            readOnly={readOnly}
            style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
          />
        </div>
      </div>

      {/* ── Endereço (comum aos dois tipos) ─────────────────── */}
      <div
        style={{
          height: 1,
          background: "#e5e7eb",
          margin: "4px 0",
        }}
      />

      {/* 🚀 CEP no topo do bloco — dispara busca automática no ViaCEP
          assim que os 8 dígitos forem completados (mesmo padrão da tela
          de Clientes). Preenche RUA, BAIRRO, CIDADE e UF abaixo. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
        <div>
          <label className="sigx-label">CEP</label>
          <input
            type="text"
            className="sigx-input mono"
            placeholder="00000-000"
            value={value.zipCode}
            onChange={(e) => handleCepChange(e.target.value)}
            readOnly={readOnly}
            style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
          />
          {cepFeedback && (
            <span className="keep-case" style={{ fontSize: 10, color: "#16a34a", fontWeight: 600 }}>
              {cepFeedback}
            </span>
          )}
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <label className="sigx-label">RUA / LOGRADOURO</label>
          <input
            type="text"
            className="sigx-input"
            value={value.street}
            onChange={(e) => set("street", e.target.value)}
            maxLength={255}
            readOnly={readOnly}
            style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
          />
        </div>
        <div>
          <label className="sigx-label">NÚMERO</label>
          <input
            type="text"
            className="sigx-input"
            value={value.number}
            onChange={(e) => set("number", e.target.value)}
            maxLength={20}
            readOnly={readOnly}
            style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
          />
        </div>
        <div>
          <label className="sigx-label">BAIRRO</label>
          <input
            type="text"
            className="sigx-input"
            value={value.neighborhood}
            onChange={(e) => set("neighborhood", e.target.value)}
            maxLength={120}
            readOnly={readOnly}
            style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
          />
        </div>
        <div>
          <label className="sigx-label">COMPLEMENTO</label>
          <input
            type="text"
            className="sigx-input"
            value={value.complement}
            onChange={(e) => set("complement", e.target.value)}
            maxLength={255}
            readOnly={readOnly}
            style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 14 }}>
        <div>
          <label className="sigx-label">CIDADE</label>
          <input
            type="text"
            className="sigx-input"
            value={value.city}
            onChange={(e) => set("city", e.target.value)}
            maxLength={120}
            readOnly={readOnly}
            style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
          />
        </div>
        <div>
          <label className="sigx-label">UF</label>
          <select
            className="sigx-input"
            value={value.state}
            onChange={(e) => set("state", e.target.value)}
            disabled={readOnly}
            style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
          >
            <option value="">—</option>
            {UF_OPTIONS.map((uf) => (
              <option key={uf} value={uf}>{uf}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
