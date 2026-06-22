import { useEffect, useRef, useState } from "react";
import {
  Plus, X, Trash2, IdCard, MapPin, Landmark, CreditCard, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { api, extractFirstError } from "../lib/api";
import {
  maskDocument,
  onlyDigits,
  validateCPF,
} from "../lib/documentValidation";
import { maskPhone } from "../lib/masks";

export interface ConsignorBankAccount {
  id?: number;
  consignorId?: number;
  bankName: string;
  agency: string | null;
  accountNumber: string | null;
  accountType: "corrente" | "poupanca";
  pixKey: string | null;
}

export interface Consignor {
  id: number;
  document: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  zipCode: string | null;
  complement: string | null;
  city: string | null;
  state: string | null;
  bank_accounts_count?: number;
  bankAccounts?: ConsignorBankAccount[];
}

const LISTA_BANCOS = [
  { codigo: "001", nome: "001 - Banco do Brasil S.A." },
  { codigo: "003", nome: "003 - Banco da Amazônia S.A." },
  { codigo: "004", nome: "004 - Banco do Nordeste do Brasil S.A." },
  { codigo: "021", nome: "021 - Banestes S.A." },
  { codigo: "025", nome: "025 - Banco Alfa S.A." },
  { codigo: "029", nome: "029 - Banco Itaú Consignado S.A." },
  { codigo: "033", nome: "033 - Banco Santander (Brasil) S.A." },
  { codigo: "036", nome: "036 - Banco Bradesco BBI S.A." },
  { codigo: "037", nome: "037 - Banco do Estado do Pará S.A. (Banpará)" },
  { codigo: "041", nome: "041 - Banco do Estado do Rio Grande do Sul S.A. (Banrisul)" },
  { codigo: "047", nome: "047 - Banco do Estado de Sergipe S.A. (Banese)" },
  { codigo: "070", nome: "070 - BRB - Banco de Brasília S.A." },
  { codigo: "077", nome: "077 - Banco Inter S.A." },
  { codigo: "082", nome: "082 - Banco Topázio S.A." },
  { codigo: "084", nome: "084 - Uniprime Norte do Paraná" },
  { codigo: "085", nome: "085 - Ailos / Cooperativa Central" },
  { codigo: "097", nome: "097 - Credisis - Central de Cooperativas" },
  { codigo: "099", nome: "099 - UNIPRIME Central" },
  { codigo: "104", nome: "104 - Caixa Econômica Federal" },
  { codigo: "121", nome: "121 - Banco Agibank S.A." },
  { codigo: "133", nome: "133 - Cresol Confederação" },
  { codigo: "136", nome: "136 - Unicred Cooperativa" },
  { codigo: "151", nome: "151 - Banco Nossa Caixa S.A." },
  { codigo: "184", nome: "184 - Banco Itaú BBA S.A." },
  { codigo: "208", nome: "208 - Banco BTG Pactual S.A." },
  { codigo: "212", nome: "212 - Banco Original S.A." },
  { codigo: "218", nome: "218 - Banco BS2 S.A." },
  { codigo: "237", nome: "237 - Banco Bradesco S.A." },
  { codigo: "243", nome: "243 - Banco Master S.A." },
  { codigo: "246", nome: "246 - Banco ABC Brasil S.A." },
  { codigo: "260", nome: "260 - Nu Pagamentos S.A. (Nubank)" },
  { codigo: "265", nome: "265 - Banco Fator S.A." },
  { codigo: "290", nome: "290 - PagSeguro Internet S.A. (PagBank)" },
  { codigo: "323", nome: "323 - Mercado Pago" },
  { codigo: "335", nome: "335 - Banco Digio S.A." },
  { codigo: "336", nome: "336 - Banco C6 S.A. (C6 Bank)" },
  { codigo: "341", nome: "341 - Itaú Unibanco S.A." },
  { codigo: "356", nome: "356 - Banco Real S.A. (descontinuado)" },
  { codigo: "380", nome: "380 - PicPay Serviços S.A." },
  { codigo: "389", nome: "389 - Banco Mercantil do Brasil S.A." },
  { codigo: "394", nome: "394 - Banco Bradesco Financiamentos S.A." },
  { codigo: "399", nome: "399 - HSBC Bank Brasil S.A." },
  { codigo: "422", nome: "422 - Banco Safra S.A." },
  { codigo: "456", nome: "456 - Banco MUFG Brasil S.A." },
  { codigo: "479", nome: "479 - Banco ItauBank S.A." },
  { codigo: "604", nome: "604 - Banco Industrial do Brasil S.A." },
  { codigo: "611", nome: "611 - Banco Paulista S.A." },
  { codigo: "623", nome: "623 - Banco PAN S.A." },
  { codigo: "633", nome: "633 - Banco Rendimento S.A." },
  { codigo: "637", nome: "637 - Banco Sofisa S.A." },
  { codigo: "643", nome: "643 - Banco Pine S.A." },
  { codigo: "652", nome: "652 - Itaú Unibanco Holding S.A." },
  { codigo: "654", nome: "654 - Banco Digimais S.A." },
  { codigo: "655", nome: "655 - Banco Votorantim S.A. (BV)" },
  { codigo: "707", nome: "707 - Banco Daycoval S.A." },
  { codigo: "739", nome: "739 - Banco Cetelem S.A." },
  { codigo: "743", nome: "743 - Banco Semear S.A." },
  { codigo: "745", nome: "745 - Banco Citibank S.A." },
  { codigo: "746", nome: "746 - Banco Modal S.A." },
  { codigo: "748", nome: "748 - Banco Cooperativo Sicredi S.A." },
  { codigo: "751", nome: "751 - Scotiabank Brasil S.A." },
  { codigo: "752", nome: "752 - Banco BNP Paribas Brasil S.A." },
  { codigo: "755", nome: "755 - Bank of America Merrill Lynch Banco Múltiplo S.A." },
  { codigo: "756", nome: "756 - Banco Cooperativo do Brasil S.A. (Sicoob)" },
];

const TABS = [
  { key: "dados", label: "Dados Gerais", icon: IdCard } as const,
  { key: "bancarios", label: "Dados Bancários", icon: Landmark } as const,
];

type TabKey = typeof TABS[number]["key"];

const ACCOUNT_TYPE_OPTIONS = [
  { value: "corrente", label: "Conta Corrente" },
  { value: "poupanca", label: "Conta Poupança" },
] as const;

const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

interface BankAccountForm {
  id?: number;
  bankName: string;
  agency: string;
  accountNumber: string;
  accountType: "corrente" | "poupanca";
  pixKey: string;
}

interface FormState {
  name: string;
  document: string;
  phone: string;
  email: string;
  street: string;
  number: string;
  neighborhood: string;
  zipCode: string;
  complement: string;
  city: string;
  state: string;
  bankAccounts: BankAccountForm[];
}

const maskCEP = (v: string) => v.replace(/\D/g, "")
  .replace(/^(\d{5})(\d)/, "$1-$2")
  .slice(0, 9);

const EMPTY_BANK_ACCOUNT = (): BankAccountForm => ({
  bankName: "",
  agency: "",
  accountNumber: "",
  accountType: "corrente",
  pixKey: "",
});

const EMPTY_FORM: FormState = {
  name: "",
  document: "",
  phone: "",
  email: "",
  street: "",
  number: "",
  neighborhood: "",
  zipCode: "",
  complement: "",
  city: "",
  state: "",
  bankAccounts: [],
};

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="sigx-label" style={{ marginBottom: 4, display: "block" }}>{children}</label>
);

const consignorToForm = (c: Consignor): FormState => ({
  name: c.name ?? "",
  document: c.document ? maskDocument(c.document) : "",
  phone: c.phone ?? "",
  email: c.email ?? "",
  street: c.street ?? "",
  number: c.number ?? "",
  neighborhood: c.neighborhood ?? "",
  zipCode: c.zipCode ? maskCEP(c.zipCode) : "",
  complement: c.complement ?? "",
  city: c.city ?? "",
  state: c.state ?? "",
  bankAccounts: (c.bankAccounts ?? []).map((b) => ({
    id: b.id,
    bankName: b.bankName ?? "",
    agency: b.agency ?? "",
    accountNumber: b.accountNumber ?? "",
    accountType: (b.accountType as BankAccountForm["accountType"]) ?? "corrente",
    pixKey: b.pixKey ?? "",
  })),
});

export interface ConsignorFormModalProps {
  open: boolean;
  onClose: () => void;
  editing?: Consignor | null;
  onSaved?: (consignor: Consignor) => void;
}

export default function ConsignorFormModal({ open, onClose, editing = null, onSaved }: ConsignorFormModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("dados");
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const lastFetchedCnpjRef = useRef("");
  const [focusedBankIdx, setFocusedBankIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setActiveTab("dados");
    setDocumentError("");
    setCnpjLoading(false);
    lastFetchedCnpjRef.current = editing?.document ? onlyDigits(editing.document) : "";
    setFormData(editing ? consignorToForm(editing) : EMPTY_FORM);
  }, [open, editing]);

  const addBankAccount = () =>
    setFormData((p) => ({ ...p, bankAccounts: [...p.bankAccounts, EMPTY_BANK_ACCOUNT()] }));

  const removeBankAccount = (idx: number) =>
    setFormData((p) => ({
      ...p,
      bankAccounts: p.bankAccounts.filter((_, i) => i !== idx),
    }));

  const updateBankAccount = (idx: number, patch: Partial<BankAccountForm>) =>
    setFormData((p) => ({
      ...p,
      bankAccounts: p.bankAccounts.map((acc, i) => (i === idx ? { ...acc, ...patch } : acc)),
    }));

  const validateDocumentField = (documentValue: string): string => {
    const digits = onlyDigits(documentValue);
    if (!digits) return "";
    if (digits.length <= 11) {
      if (digits.length === 11 && !validateCPF(digits)) {
        return "CPF inválido. Verifique os dígitos informados.";
      }
      return "";
    }
    if (digits.length < 14) return "CNPJ incompleto. Informe os 14 dígitos.";
    return "";
  };

  const fetchCnpjData = async (digits: string) => {
    if (digits.length !== 14 || lastFetchedCnpjRef.current === digits) return;
    setCnpjLoading(true);
    try {
      const { data } = await api.get(`/api/cnpj/${digits}`);
      lastFetchedCnpjRef.current = digits;
      setFormData(prev => ({
        ...prev,
        name: data.nome || prev.name,
        zipCode: data.cep ? maskCEP(String(data.cep)) : prev.zipCode,
        street: data.logradouro || prev.street,
        number: data.numero ? String(data.numero) : prev.number,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.municipio || prev.city,
        state: data.uf ? String(data.uf).toUpperCase() : prev.state,
        email: data.email || prev.email,
        phone: data.telefone ? maskPhone(String(data.telefone)) : prev.phone,
      }));
      toast.success("Dados da Receita Federal preenchidos automaticamente.");
    } catch (err) {
      lastFetchedCnpjRef.current = "";
      toast.error(extractFirstError(err, "Não foi possível consultar o CNPJ."));
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleDocumentChange = (value: string) => {
    const masked = maskDocument(value);
    const digits = onlyDigits(masked);
    setFormData(prev => ({ ...prev, document: masked }));
    setDocumentError("");
    if (digits.length !== 14) lastFetchedCnpjRef.current = "";
    if (digits.length === 14) void fetchCnpjData(digits);
  };

  const handleDocumentBlur = () => {
    const digits = onlyDigits(formData.document);
    const error = validateDocumentField(formData.document);
    setDocumentError(error);
    if (!error && digits.length === 14) void fetchCnpjData(digits);
  };

  const handleFetchCep = async (cep: string) => {
    const clean = onlyDigits(cep);
    if (clean.length !== 8) return;
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await resp.json();
      if (data.erro) return;
      setFormData((p) => ({
        ...p,
        street: data.logradouro || p.street,
        neighborhood: data.bairro || p.neighborhood,
        city: data.localidade || p.city,
        state: (data.uf || p.state)?.toUpperCase(),
      }));
    } catch {
      /* silencioso */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const docError = validateDocumentField(formData.document);
    if (docError) {
      setDocumentError(docError);
      setActiveTab("dados");
      return;
    }
    if (cnpjLoading) return;

    setSubmitting(true);
    const payload = {
      name: formData.name.trim(),
      document: formData.document ? onlyDigits(formData.document) : null,
      phone: formData.phone || null,
      email: formData.email || null,
      street: formData.street || null,
      number: formData.number || null,
      neighborhood: formData.neighborhood || null,
      zipCode: formData.zipCode ? onlyDigits(formData.zipCode) : null,
      complement: formData.complement || null,
      city: formData.city || null,
      state: formData.state || null,
      bankAccounts: formData.bankAccounts.map((acc) => ({
        id: acc.id,
        bankName: acc.bankName.trim(),
        agency: acc.agency || null,
        accountNumber: acc.accountNumber || null,
        accountType: acc.accountType,
        pixKey: acc.pixKey || null,
      })),
    };

    try {
      let saved: Consignor;
      if (editing) {
        const { data } = await api.put(`/api/consignors/${editing.id}`, payload);
        saved = data?.consignor ?? editing;
        toast.success("Credor atualizado com sucesso.");
      } else {
        const { data } = await api.post("/api/consignors", payload);
        saved = data?.consignor;
        toast.success("Credor cadastrado com sucesso.");
      }
      onSaved?.(saved);
      onClose();
    } catch (err) {
      toast.error(extractFirstError(err, "Falha ao salvar credor."));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="sigx-modal-overlay credores-page" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="sigx-modal"
        style={{ maxWidth: 880, width: "min(880px, calc(100vw - 32px))", padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 22px", background: "linear-gradient(135deg, #1e2139 0%, #2d3154 100%)", color: "white", borderBottom: "1px solid #2d3154" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Landmark size={16} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>
                {editing ? "Editar Credor" : "Novo Credor"}
              </span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                {editing ? `Atualizando registro #${editing.id}` : "Preencha as abas abaixo para cadastrar um novo credor"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer", color: "white", width: 30, height: 30, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 4, background: "#f8fafc", padding: "8px 12px", borderBottom: "1px solid #e5e7eb", overflowX: "auto", flexWrap: "nowrap" }}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                type="button" key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", fontSize: 11, fontWeight: active ? 700 : 500,
                  cursor: "pointer", borderRadius: 6,
                  background: active ? "white" : "transparent",
                  color: active ? "#1e2139" : "#475569",
                  border: active ? "1px solid #e2e8f0" : "1px solid transparent",
                  boxShadow: active ? "0 1px 2px rgba(15,23,42,0.06)" : "none",
                  whiteSpace: "nowrap", transition: "all 0.1s",
                }}
              >
                <Icon size={12} style={{ color: active ? "#2563eb" : "#94a3b8" }} />
                {tab.label}
                {tab.key === "bancarios" && (
                  <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: active ? "#2563eb" : "#e2e8f0", color: active ? "white" : "#475569" }}>
                    {formData.bankAccounts.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div className="sigx-modal-body" style={{ padding: 22, height: "clamp(380px, 56vh, 64vh)", overflowY: "auto", background: "white" }}>
            {activeTab === "dados" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="keep-case" style={{ padding: "10px 12px", background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)", border: "1px solid #e0e7ff", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "#2563eb", color: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <IdCard size={15} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 12, color: "#1e2139", display: "block" }}>Dados Gerais do Credor</strong>
                    <span style={{ fontSize: 10.5, color: "#64748b" }}>
                      Preencha as informações cadastrais. O documento (CPF/CNPJ) é detectado automaticamente.
                    </span>
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="col-span-3">
                    <Label>NOME COMPLETO / RAZÃO SOCIAL *</Label>
                    <input className="sigx-input" required value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} disabled={cnpjLoading} placeholder="Nome completo ou razão social" />
                  </div>
                  <div>
                    <Label>CPF ou CNPJ</Label>
                    <div style={{ position: "relative" }}>
                      <input
                        className="sigx-input mono"
                        value={formData.document}
                        placeholder="000.000.000-00 ou 00.000.000/0000-00"
                        onChange={(e) => handleDocumentChange(e.target.value)}
                        onBlur={handleDocumentBlur}
                        disabled={cnpjLoading}
                        style={documentError ? { borderColor: "#dc2626" } : undefined}
                      />
                      {cnpjLoading && (
                        <Loader2 size={14} className="animate-spin" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#2563eb" }} />
                      )}
                    </div>
                    {documentError && <div style={{ color: "#dc2626", fontSize: 11, marginTop: 4, fontWeight: 500 }}>{documentError}</div>}
                    {cnpjLoading && !documentError && <div style={{ color: "#2563eb", fontSize: 11, marginTop: 4, fontWeight: 500 }}>Consultando dados na Receita Federal...</div>}
                  </div>
                  <div>
                    <Label>TELEFONE / WHATSAPP</Label>
                    <input className="sigx-input" value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: maskPhone(e.target.value) }))} disabled={cnpjLoading} placeholder="(00) 00000-0000" />
                  </div>
                  <div>
                    <Label>E-MAIL</Label>
                    <input type="email" className="sigx-input" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} disabled={cnpjLoading} placeholder="email@exemplo.com" />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569", fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginTop: 4 }}>
                  <MapPin size={13} /> Endereço
                </div>

                <div className="form-grid-3">
                  <div>
                    <Label>CEP</Label>
                    <input
                      className="sigx-input mono"
                      value={formData.zipCode}
                      disabled={cnpjLoading}
                      onChange={(e) => {
                        const masked = maskCEP(e.target.value);
                        setFormData((p) => ({ ...p, zipCode: masked }));
                        if (onlyDigits(masked).length === 8) handleFetchCep(masked);
                      }}
                      placeholder="00000-000"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>RUA / LOGRADOURO</Label>
                    <input className="sigx-input" value={formData.street} onChange={(e) => setFormData((p) => ({ ...p, street: e.target.value }))} disabled={cnpjLoading} />
                  </div>
                  <div>
                    <Label>NÚMERO</Label>
                    <input className="sigx-input" value={formData.number} onChange={(e) => setFormData((p) => ({ ...p, number: e.target.value }))} disabled={cnpjLoading} />
                  </div>
                  <div>
                    <Label>BAIRRO</Label>
                    <input className="sigx-input" value={formData.neighborhood} onChange={(e) => setFormData((p) => ({ ...p, neighborhood: e.target.value }))} disabled={cnpjLoading} />
                  </div>
                  <div>
                    <Label>COMPLEMENTO</Label>
                    <input className="sigx-input" value={formData.complement} onChange={(e) => setFormData((p) => ({ ...p, complement: e.target.value }))} disabled={cnpjLoading} />
                  </div>
                  <div className="col-span-2">
                    <Label>CIDADE</Label>
                    <input className="sigx-input" value={formData.city} onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))} disabled={cnpjLoading} />
                  </div>
                  <div>
                    <Label>ESTADO (UF)</Label>
                    <select className="sigx-input" value={formData.state} onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))} disabled={cnpjLoading}>
                      <option value="">Selecione...</option>
                      {UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "bancarios" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="keep-case" style={{ padding: "10px 12px", background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)", border: "1px solid #e0e7ff", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "#2563eb", color: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Landmark size={15} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 12, color: "#1e2139", display: "block" }}>Contas Bancárias e Chaves PIX</strong>
                    <span style={{ fontSize: 10.5, color: "#64748b" }}>
                      Adicione uma ou mais contas bancárias do credor. Todas serão salvas em uma única transação ao confirmar o cadastro.
                    </span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#2563eb" }}>{formData.bankAccounts.length} CONTA(S)</span>
                </div>

                {formData.bankAccounts.length === 0 && (
                  <div style={{ border: "1px dashed #cbd5e1", borderRadius: 8, padding: 28, background: "#f8fafc", textAlign: "center", color: "#94a3b8" }}>
                    <Landmark size={26} style={{ opacity: 0.3, margin: "0 auto 6px", display: "block" }} />
                    <span style={{ fontSize: 11.5 }}>Nenhuma conta cadastrada. Use o botão abaixo para adicionar a primeira.</span>
                  </div>
                )}

                {formData.bankAccounts.map((acc, idx) => (
                  <div key={acc.id ?? `new-${idx}`} style={{ padding: 16, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                        <CreditCard size={13} style={{ color: "#2563eb" }} /> CONTA BANCÁRIA {idx + 1}
                      </span>
                      <button type="button" title="Remover conta" onClick={() => removeBankAccount(idx)} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "white", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                        <Trash2 size={11} /> Remover
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "2.4fr 0.9fr 1.4fr 1.4fr", gap: 10, marginBottom: 10 }}>
                      <div style={{ position: "relative" }}>
                        <Label>BANCO *</Label>
                        <input
                          className="sigx-input"
                          required
                          placeholder="Buscar banco..."
                          value={acc.bankName}
                          onFocus={() => setFocusedBankIdx(idx)}
                          onBlur={() => setTimeout(() => setFocusedBankIdx(null), 200)}
                          onChange={(e) => updateBankAccount(idx, { bankName: e.target.value })}
                        />
                        {focusedBankIdx === idx && (() => {
                          const term = acc.bankName.toLowerCase().trim();
                          const matches = term ? LISTA_BANCOS.filter((b) => b.nome.toLowerCase().includes(term)) : LISTA_BANCOS;
                          return (
                            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid #cbd5e1", borderRadius: 6, zIndex: 100, maxHeight: 220, overflowY: "auto", boxShadow: "0 4px 12px rgba(15,23,42,0.08)", marginTop: 2 }}>
                              {matches.length === 0 ? (
                                <div style={{ padding: "10px 12px", fontSize: 11, color: "#94a3b8", textAlign: "center" }}>Nenhum banco encontrado</div>
                              ) : matches.map((b) => (
                                <div
                                  key={b.codigo}
                                  style={{ padding: "7px 12px", fontSize: 11, cursor: "pointer", color: "#1e293b", borderBottom: "1px solid #f1f5f9" }}
                                  onMouseDown={() => { updateBankAccount(idx, { bankName: b.nome }); setFocusedBankIdx(null); }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                                >
                                  {b.nome}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                      <div>
                        <Label>AGÊNCIA</Label>
                        <input className="sigx-input mono" placeholder="0000" value={acc.agency} onChange={(e) => updateBankAccount(idx, { agency: e.target.value })} />
                      </div>
                      <div>
                        <Label>NÚMERO DA CONTA</Label>
                        <input className="sigx-input mono" placeholder="00000-0" value={acc.accountNumber} onChange={(e) => updateBankAccount(idx, { accountNumber: e.target.value })} />
                      </div>
                      <div>
                        <Label>TIPO *</Label>
                        <select className="sigx-input" value={acc.accountType} onChange={(e) => updateBankAccount(idx, { accountType: e.target.value as BankAccountForm["accountType"] })}>
                          {ACCOUNT_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <Label>CHAVE PIX</Label>
                      <input className="sigx-input mono" placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória" value={acc.pixKey} onChange={(e) => updateBankAccount(idx, { pixKey: e.target.value })} />
                    </div>
                  </div>
                ))}

                <button type="button" className="btn-secondary" style={{ fontSize: 11, width: "max-content", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={addBankAccount}>
                  <Plus size={12} /> Adicionar outra conta
                </button>
              </div>
            )}
          </div>

          <div className="sigx-modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={submitting || cnpjLoading || !!documentError}>
              {submitting ? "Salvando..." : editing ? "Atualizar Credor" : "Cadastrar Credor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
