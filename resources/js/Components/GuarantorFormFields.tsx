import { useRef, useState, type CSSProperties } from "react";
import { User, Building2, CheckCircle2, Mail, Phone, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { maskPhone } from "../lib/masks";
import { api, extractFirstError } from "../lib/api";
import { fetchSigxByCpf, getRedHighlight, notifySigxFailure } from "../lib/sigx";

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

  // 🚀 Auto-preenchimento via Receita Federal — espelha o comportamento da
  // tela de Pessoas (Guarantors.tsx). Ao completar 14 dígitos no CNPJ, dispara
  // a consulta em `/api/cnpj/{digits}` e popula razão social, endereço e
  // contatos. O ref evita disparar a mesma consulta duas vezes (idempotência).
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const lastFetchedCnpjRef = useRef("");

  const fetchCnpjData = async (digits: string, current: GuarantorFormValues) => {
    if (digits.length !== 14 || lastFetchedCnpjRef.current === digits) return;

    setCnpjLoading(true);
    try {
      const { data } = await api.get(`/api/cnpj/${digits}`);
      lastFetchedCnpjRef.current = digits;

      onChange({
        ...current,
        name: data.nome || current.name,
        tradeName: data.fantasia || current.tradeName,
        zipCode: data.cep ? maskCEP(String(data.cep)) : current.zipCode,
        street: data.logradouro || current.street,
        number: data.numero ? String(data.numero) : current.number,
        complement: data.complemento || current.complement,
        neighborhood: data.bairro || current.neighborhood,
        city: data.municipio || current.city,
        state: data.uf ? String(data.uf).toUpperCase() : current.state,
        email: data.email || current.email,
        phone: data.telefone ? maskPhone(String(data.telefone)) : current.phone,
      });

      toast.success("Dados da Receita Federal preenchidos automaticamente.");
    } catch (err) {
      lastFetchedCnpjRef.current = "";
      toast.error(extractFirstError(err, "Não foi possível consultar o CNPJ."));
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleCnpjChange = (raw: string) => {
    const masked = maskCNPJ(raw);
    const next: GuarantorFormValues = { ...value, cnpj: masked };
    onChange(next);

    const digits = onlyDigits(masked);
    if (digits.length !== 14) {
      lastFetchedCnpjRef.current = "";
      return;
    }
    void fetchCnpjData(digits, next);
  };

  // 🚀 Sincronização SIGx (PF) — quando o operador clica "Sincronizar com SIGx"
  // a integração ATIVA com finalidade `cpf_lookup` é acionada e os campos do
  // formulário são preenchidos automaticamente. Campos não retornados pela API
  // ficam destacados em vermelho (sem virar `required`) — apenas como
  // orientação visual ao operador, espelhando o comportamento da Ingestão IA.
  const [cpfLoading, setCpfLoading] = useState(false);
  const [cpfSynced, setCpfSynced] = useState(false);

  const handleSyncCpf = async () => {
    const digits = onlyDigits(value.cpf);
    if (digits.length !== 11) {
      toast.error("Digite um CPF completo (11 dígitos) antes de sincronizar.");
      return;
    }

    setCpfLoading(true);
    try {
      const result = await fetchSigxByCpf(digits);
      if (!result.ok || !result.data) {
        notifySigxFailure(result);
        // 404 → limpa os campos preenchíveis pelo SIGx para evitar
        // arrastar dados de um sync anterior. Outros erros (timeout,
        // integração off) preservam o que já está digitado.
        if (result.status === 404) {
          onChange({
            ...value,
            name:          "",
            rg:            "",
            email:         "",
            phone:         "",
            nationality:   "",
            maritalStatus: "",
            zipCode:       "",
            street:        "",
            number:        "",
            complement:    "",
            neighborhood:  "",
            city:          "",
            state:         "",
          });
          setCpfSynced(false);
        }
        return;
      }

      const d = result.data;
      onChange({
        ...value,
        name:          d.name          || value.name,
        rg:            d.rg            || value.rg,
        email:         d.email         || value.email,
        phone:         d.phone         ? maskPhone(String(d.phone)) : value.phone,
        nationality:   d.nationality   || value.nationality,
        maritalStatus: d.maritalStatus || value.maritalStatus,
        zipCode:       d.zipCode       ? maskCEP(String(d.zipCode)) : value.zipCode,
        street:        d.street        || value.street,
        number:        d.number        ? String(d.number) : value.number,
        complement:    d.complement    || value.complement,
        neighborhood:  d.neighborhood  || value.neighborhood,
        city:          d.city          || value.city,
        state:         d.state         ? String(d.state).toUpperCase() : value.state,
      });
      setCpfSynced(true);
      toast.success("Dados do SIGx aplicados ao formulário.");
    } catch (err) {
      toast.error(extractFirstError(err, "Falha ao consultar o SIGx."));
    } finally {
      setCpfLoading(false);
    }
  };

  /**
   * Helper para mesclar o style do `readOnly` com o destaque vermelho
   * pós-sync. Fica vermelho apenas em campos vazios E quando o operador
   * já clicou "Sincronizar com SIGx" (não polui formulários novos).
   */
  const fieldStyle = (val: any): CSSProperties | undefined => {
    const base = readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined;
    const highlight = getRedHighlight(val, cpfSynced && value.personType === "PF");
    if (!base && Object.keys(highlight).length === 0) return undefined;
    return { ...(base ?? {}), ...highlight };
  };

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

  /**
   * 🚀 Reseta TODOS os dados (nome, contato, endereço, etc.) ao alternar
   * entre PF e PJ. Regra de negócio: dados de pessoa física (ex.: nome
   * "João Silva", e-mail pessoal, telefone celular, endereço residencial)
   * NÃO devem permanecer ao mudar para pessoa jurídica — e vice-versa
   * (Razão Social, CNPJ, Inscrição Estadual etc. não fazem sentido em PF).
   *
   * Mantemos apenas o `personType` recém-escolhido. O CEP feedback,
   * a flag de CNPJ já consultado e o destaque vermelho do SIGx também
   * são limpos para o operador começar com o formulário "zerado".
   */
  const handleSwitchPersonType = (next: PersonType) => {
    if (value.personType === next) return;
    onChange({
      ...EMPTY_GUARANTOR_FORM,
      personType: next,
    });
    setCepFeedback("");
    lastFetchedCnpjRef.current = "";
    setCpfSynced(false);
  };

  const handleCpfChange = (raw: string) => {
    set("cpf", maskCPF(raw));
    if (cpfSynced) setCpfSynced(false);
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
                onClick={() => !readOnly && handleSwitchPersonType(opt.key)}
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

      {/* 🚀 DOCUMENTO PRIMEIRO — CPF (PF) ou CNPJ (PJ) é o ÚNICO campo
          que dispara auto-preenchimento (SIGx para PF, ReceitaWS para
          PJ). Colocá-lo no topo do formulário deixa o operador digitar
          o documento e ter os demais campos preenchidos automaticamente,
          em vez de digitar nome/nacionalidade/etc. para depois descobrir
          que tudo seria preenchido pela integração. */}

      {/* ── PESSOA FÍSICA — CPF/RG ────────────────────────── */}
      {value.personType === "PF" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label className="sigx-label">CPF *</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                className="sigx-input mono"
                placeholder="000.000.000-00"
                value={value.cpf}
                onChange={(e) => handleCpfChange(e.target.value)}
                required
                minLength={14}
                readOnly={readOnly || cpfLoading}
                style={fieldStyle(value.cpf)}
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={handleSyncCpf}
                  disabled={cpfLoading || onlyDigits(value.cpf).length !== 11}
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
                    cursor: cpfLoading || onlyDigits(value.cpf).length !== 11 ? "not-allowed" : "pointer",
                    opacity: cpfLoading || onlyDigits(value.cpf).length !== 11 ? 0.55 : 1,
                    whiteSpace: "nowrap",
                    transition: "all 0.12s",
                  }}
                >
                  {cpfLoading ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <RefreshCw size={13} />
                  )}
                  <span className="keep-case">
                    {cpfLoading ? "Consultando..." : "Sincronizar com SIGx"}
                  </span>
                </button>
              )}
            </div>
            {cpfSynced && (
              <span className="keep-case" style={{ fontSize: 10, color: "#dc2626", fontWeight: 600 }}>
                Campos em vermelho não foram retornados pelo SIGx — preencha manualmente.
              </span>
            )}
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
              style={fieldStyle(value.rg)}
            />
          </div>
        </div>
      )}

      {/* ── PESSOA JURÍDICA — CNPJ/Inscrição Estadual ───────── */}
      {value.personType === "PJ" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label className="sigx-label">CNPJ *</label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                className="sigx-input mono"
                placeholder="00.000.000/0000-00"
                value={value.cnpj}
                onChange={(e) => handleCnpjChange(e.target.value)}
                required
                minLength={18}
                readOnly={readOnly || cnpjLoading}
                style={{
                  ...(readOnly ? { background: "#f9fafb", color: "#4b5563" } : {}),
                  ...(cnpjLoading ? { paddingRight: 32 } : {}),
                }}
              />
              {cnpjLoading && (
                <Loader2
                  size={14}
                  className="animate-spin"
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#2563eb",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
            {cnpjLoading && (
              <span className="keep-case" style={{ fontSize: 10, color: "#2563eb", fontWeight: 600 }}>
                Consultando Receita Federal...
              </span>
            )}
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
      )}

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
          style={fieldStyle(value.name)}
        />
      </div>

      {/* ── Demais campos específicos por tipo ──────────────── */}
      {value.personType === "PF" && (
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
              style={fieldStyle(value.nationality)}
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
              style={fieldStyle(value.maritalStatus)}
            >
              <option value="">Selecione...</option>
              {MARITAL_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {value.personType === "PJ" && (
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
            style={fieldStyle(value.email)}
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
            style={fieldStyle(value.phone)}
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
            style={fieldStyle(value.zipCode)}
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
            style={fieldStyle(value.street)}
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
            style={fieldStyle(value.number)}
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
            style={fieldStyle(value.neighborhood)}
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
            style={fieldStyle(value.city)}
          />
        </div>
        <div>
          <label className="sigx-label">UF</label>
          <select
            className="sigx-input"
            value={value.state}
            onChange={(e) => set("state", e.target.value)}
            disabled={readOnly}
            style={fieldStyle(value.state)}
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
