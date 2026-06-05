import { useCallback, useEffect, useMemo, useState } from "react";
import { Head } from "@inertiajs/react";
import {
  Plus, Search, X, Edit2, Trash2, Users, Building2, User,
  IdCard, MapPin, Landmark, CreditCard, RefreshCw, Mail, Phone, Download,
} from "lucide-react";
import { toast } from "sonner";
import UnyPayLayout from "../Components/UnyPayLayout";
import ConfirmDialog from "../Components/ConfirmDialog";
import { api, extractFirstError } from "../lib/api";
import { downloadExcelWithState } from "../lib/exportHelper";

/* ────────────────────────────────────────────────────────────────────────────
 * 🚀 Interfaces TypeScript (Consignor + ConsignorBankAccount).
 *    Espelham 1:1 a estrutura persistida pelo ConsignorController.
 * ──────────────────────────────────────────────────────────────────────── */

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

/* ────────────────────────────────────────────────────────────────────────────
 *  Lista de bancos (FEBRABAN/COMPE) — usada no autocomplete da aba "Dados
 *  Bancários". Inclui bancos tradicionais, digitais, fintechs, cooperativas
 *  e instituições de pagamento mais relevantes. Mesmo padrão visual usado
 *  na aba "Dados Financeiros" do CRUD de Clientes.
 * ──────────────────────────────────────────────────────────────────────── */

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

/* ────────────────────────────────────────────────────────────────────────────
 *  Constantes visuais reaproveitadas do padrão Clients/Guarantors
 * ──────────────────────────────────────────────────────────────────────── */

const TABS = [
  { key: "dados",      label: "Dados Gerais",     icon: IdCard }   as const,
  { key: "bancarios",  label: "Dados Bancários",  icon: Landmark } as const,
];

type TabKey = typeof TABS[number]["key"];

const ACCOUNT_TYPE_OPTIONS = [
  { value: "corrente",  label: "Conta Corrente" },
  { value: "poupanca",  label: "Conta Poupança" },
] as const;

// 🚀 Unidades Federativas — mesmo padrão usado no CRUD de Fiadores.
const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

const headerCellStyle: React.CSSProperties = {
  background: "#f1f5f9", color: "#334155",
  padding: "6px 8px", fontSize: 10, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.04em",
  whiteSpace: "nowrap", borderBottom: "2px solid #cbd5e1",
};
const tdBase: React.CSSProperties = { padding: "5px 8px", borderBottom: "1px solid #f1f5f9", fontSize: 11, verticalAlign: "middle" };
const tdCenter: React.CSSProperties = { ...tdBase, textAlign: "center" };

const PAGE_SIZES = [20, 50, 100];

/* ────────────────────────────────────────────────────────────────────────────
 *  Máscaras e helpers de formatação
 * ──────────────────────────────────────────────────────────────────────── */

const onlyDigits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

const maskCPF = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const maskCNPJ = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

const maskDocument = (v: string) => {
  const d = v.replace(/\D/g, "");
  return d.length > 11 ? maskCNPJ(v) : maskCPF(v);
};

const maskPhone = (v: string) => v.replace(/\D/g, "")
  .replace(/^(\d{2})(\d)/, "($1) $2")
  .replace(/(\d{5})(\d)/, "$1-$2")
  .slice(0, 15);

const maskCEP = (v: string) => v.replace(/\D/g, "")
  .replace(/^(\d{5})(\d)/, "$1-$2")
  .slice(0, 9);

const formatDocumentForGrid = (doc: string | null | undefined): string => {
  const d = onlyDigits(doc);
  if (!d) return "—";
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  return d;
};

const personTypeFromDocument = (doc: string | null | undefined): "PF" | "PJ" =>
  onlyDigits(doc).length > 11 ? "PJ" : "PF";

/* ────────────────────────────────────────────────────────────────────────────
 *  Estado do formulário (modal)
 * ──────────────────────────────────────────────────────────────────────── */

interface BankAccountForm {
  id?: number;
  bankName: string;
  agency: string;
  accountNumber: string;
  accountType: "corrente" | "poupanca";
  pixKey: string;
}

interface FormState {
  // Dados Gerais
  name: string;
  document: string;
  phone: string;
  email: string;
  // Endereço
  street: string;
  number: string;
  neighborhood: string;
  zipCode: string;
  complement: string;
  city: string;
  state: string;
  // Contas Bancárias (1:N)
  bankAccounts: BankAccountForm[];
}

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

/* ────────────────────────────────────────────────────────────────────────────
 *  Página /credores
 * ──────────────────────────────────────────────────────────────────────── */

export default function CredoresPage() {
  const [consignors, setConsignors] = useState<Consignor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  const [formOpen, setFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("dados");
  const [editing, setEditing] = useState<Consignor | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  // Controla qual dropdown de bancos está aberto (igual ao Clients).
  const [focusedBankIdx, setFocusedBankIdx] = useState<number | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Consignor | null>(null);

  /* ── Carregamento da listagem ─────────────────────────────────────── */
  const fetchConsignors = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/consignors", {
        params: { search: search.trim(), per_page: 200 },
      });
      // O endpoint retorna o paginator do Laravel — usamos só o array `data`.
      const rows: Consignor[] = data?.data ?? [];
      setConsignors(rows);
    } catch (err) {
      toast.error(extractFirstError(err, "Falha ao carregar credores."));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    // Debounce simples para a busca livre.
    const t = setTimeout(() => fetchConsignors(), 250);
    return () => clearTimeout(t);
  }, [fetchConsignors]);

  const handleExportExcel = useCallback(() => {
    downloadExcelWithState(
      "/credores/export",
      "credores.xlsx",
      setExporting,
      { params: { search: search.trim() || undefined } },
    );
  }, [search]);

  /* ── Abrir modal para criar / editar ──────────────────────────────── */
  const openCreateModal = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setActiveTab("dados");
    setFormOpen(true);
  };

  const openEditModal = async (consignor: Consignor) => {
    // Recarregamos o detalhe para garantir bankAccounts hidratadas, mesmo
    // que o /index já as devolva — assim suportamos lazy refresh.
    try {
      const { data } = await api.get(`/api/consignors/${consignor.id}`);
      const c: Consignor = data?.consignor ?? consignor;
      setEditing(c);
      setFormData({
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
      setActiveTab("dados");
      setFormOpen(true);
    } catch (err) {
      toast.error(extractFirstError(err, "Falha ao carregar credor."));
    }
  };

  /* ── Helpers de manipulação dinâmica das contas ───────────────────── */
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

  /* ── CEP via ViaCEP ───────────────────────────────────────────────── */
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
      /* silencioso — apenas auxiliar */
    }
  };

  /* ── Submit ───────────────────────────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
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
      // 🚀 Enviamos SEMPRE o array (mesmo vazio) para o controller sincronizar.
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
      if (editing) {
        await api.put(`/api/consignors/${editing.id}`, payload);
        toast.success("Credor atualizado com sucesso.");
      } else {
        await api.post("/api/consignors", payload);
        toast.success("Credor cadastrado com sucesso.");
      }
      setFormOpen(false);
      await fetchConsignors();
    } catch (err) {
      toast.error(extractFirstError(err, "Falha ao salvar credor."));
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Delete ───────────────────────────────────────────────────────── */
  const executeDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/consignors/${deleteTarget.id}`);
      toast.success("Credor removido com sucesso.");
      setDeleteTarget(null);
      await fetchConsignors();
    } catch (err) {
      toast.error(extractFirstError(err, "Falha ao remover credor."));
    }
  };

  /* ── Paginação local ──────────────────────────────────────────────── */
  const totalRows = consignors.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const paginated = useMemo(
    () => consignors.slice((page - 1) * pageSize, page * pageSize),
    [consignors, page, pageSize],
  );

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <UnyPayLayout>
      <Head title="Gerenciamento de Credores" />

      <div style={{ padding: "12px 20px 16px 20px", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", gap: 12 }}>
        {/* Topo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>Gerenciamento de Credores</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button className="btn-primary" onClick={openCreateModal} style={{ padding: "6px 14px", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={12} /> Novo Credor
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleExportExcel}
              disabled={exporting}
              style={{ padding: "6px 14px", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}
            >
              <Download size={12} /> {exporting ? "Exportando..." : "Exportar Excel"}
            </button>
          </div>
        </div>

        {/* Barra de busca */}
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input
                style={{ paddingLeft: 26, width: 300, fontSize: 11, height: 28, border: "1px solid #d1d5db", borderRadius: 6, outline: "none", color: "#374151" }}
                placeholder="Buscar por nome, documento, e-mail ou telefone..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, flexShrink: 0 }}>{totalRows} credor(es)</span>
          </div>
          <button
            type="button"
            onClick={() => fetchConsignors()}
            title="Atualizar"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", fontSize: 11, cursor: "pointer", color: "#374151" }}
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Atualizar
          </button>
        </div>

        {/* Grade */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden", background: "white" }}>
          <div style={{ flex: 1, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 11 }}>
              <colgroup>
                <col style={{ width: 60 }} />
                <col style={{ width: 280 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 180 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 130 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...headerCellStyle, textAlign: "center" }}>#</th>
                  <th style={{ ...headerCellStyle, textAlign: "left" }}>Nome / Razão Social</th>
                  <th style={{ ...headerCellStyle, textAlign: "center" }}>Tipo</th>
                  <th style={{ ...headerCellStyle, textAlign: "left" }}>Documento</th>
                  <th style={{ ...headerCellStyle, textAlign: "left" }}>E-mail</th>
                  <th style={{ ...headerCellStyle, textAlign: "left" }}>Telefone</th>
                  <th style={{ ...headerCellStyle, textAlign: "left" }}>Cidade / UF</th>
                  <th style={{ ...headerCellStyle, textAlign: "center" }}>Contas</th>
                  <th style={{ ...headerCellStyle, textAlign: "center" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
                    <RefreshCw size={22} className="animate-spin" style={{ margin: "0 auto 8px", display: "block", opacity: 0.6 }} />
                    Carregando credores...
                  </td></tr>
                ) : totalRows === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
                    <Users size={28} style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }} />
                    Nenhum credor cadastrado.
                  </td></tr>
                ) : (
                  paginated.map((c, idx) => {
                    const personType = personTypeFromDocument(c.document);
                    const isPJ = personType === "PJ";
                    const rowBg = idx % 2 === 1 ? "#fafafa" : "white";
                    return (
                      <tr key={c.id} style={{ background: rowBg }}
                        onMouseOver={(e) => (e.currentTarget.style.background = "#eff6ff")}
                        onMouseOut={(e) => (e.currentTarget.style.background = rowBg)}
                      >
                        <td style={tdCenter}>
                          <span className="mono" style={{ fontSize: 10, color: "#6b7280" }}>#{c.id}</span>
                        </td>
                        <td style={tdBase}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#1a2035", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600, color: "#111827" }}>{c.name}</span>
                          </div>
                        </td>
                        <td style={tdCenter}>
                          <span
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700,
                              background: isPJ ? "#eff6ff" : "#ecfdf5",
                              color:      isPJ ? "#1e40af" : "#065f46",
                            }}
                          >
                            {isPJ ? <Building2 size={10} /> : <User size={10} />} {personType}
                          </span>
                        </td>
                        <td style={{ ...tdBase, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: "#475569" }}>
                          {formatDocumentForGrid(c.document)}
                        </td>
                        <td style={{ ...tdBase, color: "#6b7280" }}>
                          {c.email ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Mail size={11} style={{ opacity: 0.6 }} /> {c.email}
                            </span>
                          ) : "—"}
                        </td>
                        <td style={{ ...tdBase, color: "#6b7280" }}>
                          {c.phone ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Phone size={11} style={{ opacity: 0.6 }} /> {c.phone}
                            </span>
                          ) : "—"}
                        </td>
                        <td style={{ ...tdBase, color: "#6b7280" }}>
                          {c.city ? `${c.city}${c.state ? `/${c.state}` : ""}` : "—"}
                        </td>
                        <td style={tdCenter}>
                          {(() => {
                            const count = c.bank_accounts_count ?? c.bankAccounts?.length ?? 0;
                            return (
                              <span
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700,
                                  background: count > 0 ? "#eff6ff" : "#f1f5f9",
                                  color:      count > 0 ? "#1d4ed8" : "#94a3b8",
                                  border:     count > 0 ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                                }}
                              >
                                <CreditCard size={11} /> {count}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={tdCenter}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            <button className="btn-icon" title="Editar" onClick={() => openEditModal(c)}>
                              <Edit2 size={11} />
                            </button>
                            <button className="btn-icon" title="Excluir" style={{ color: "#dc2626" }} onClick={() => setDeleteTarget(c)}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div style={{ padding: "6px 12px", background: "#fafbfc", borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6b7280" }}>
              <span>Exibir</span>
              <select style={{ padding: "2px 6px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 11, background: "white" }} value={pageSize} onChange={(e) => { setPageSize(+e.target.value); setPage(1); }}>
                {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <span>por página</span>
            </div>
            <span style={{ fontSize: 11, color: "#6b7280" }}>
              Mostrando {Math.min((page - 1) * pageSize + 1, totalRows)}–{Math.min(page * pageSize, totalRows)} de {totalRows}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "3px 10px", border: "1px solid #d1d5db", borderRadius: 4, background: "white", fontSize: 11, cursor: page === 1 ? "not-allowed" : "pointer", color: page === 1 ? "#9ca3af" : "#374151" }}>← Anterior</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const n = page <= 3 ? i + 1 : page - 2 + i;
                if (n < 1 || n > totalPages) return null;
                return (
                  <button type="button" key={n} onClick={() => setPage(n)} style={{ width: 28, height: 26, borderRadius: 4, border: "1px solid", fontSize: 11, background: n === page ? "#1a2035" : "white", color: n === page ? "white" : "#374151", borderColor: n === page ? "#1a2035" : "#d1d5db", fontWeight: n === page ? 700 : 400, cursor: "pointer" }}>{n}</button>
                );
              })}
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ padding: "3px 10px", border: "1px solid #d1d5db", borderRadius: 4, background: "white", fontSize: 11, cursor: page >= totalPages ? "not-allowed" : "pointer", color: page >= totalPages ? "#9ca3af" : "#374151" }}>Próxima →</button>
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────────
            MODAL — Cadastro / Edição com Tabs (idêntico ao de Clientes)
           ────────────────────────────────────────────────────────────── */}
        {formOpen && (
          <div className="sigx-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setFormOpen(false); }}>
            <div
              className="sigx-modal"
              style={{ maxWidth: 880, width: "min(880px, calc(100vw - 32px))", padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* HEADER com gradiente */}
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
                  onClick={() => setFormOpen(false)}
                  style={{ background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer", color: "white", width: 30, height: 30, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* TABS pílula */}
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
                        <span
                          style={{
                            marginLeft: 4, fontSize: 9, fontWeight: 700,
                            padding: "1px 6px", borderRadius: 10,
                            background: active ? "#2563eb" : "#e2e8f0",
                            color: active ? "white" : "#475569",
                          }}
                        >
                          {formData.bankAccounts.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                <div className="sigx-modal-body" style={{ padding: 22, height: "clamp(380px, 56vh, 64vh)", overflowY: "auto", background: "white" }}>

                  {/* ─────────────── ABA 1 — DADOS GERAIS ─────────────── */}
                  {activeTab === "dados" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {/* Banner */}
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
                          <input className="sigx-input" required value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="Nome completo ou razão social" />
                        </div>

                        <div>
                          <Label>{personTypeFromDocument(formData.document) === "PJ" ? "CNPJ" : "CPF"}</Label>
                          <input
                            className="sigx-input mono"
                            value={formData.document}
                            placeholder="000.000.000-00 ou 00.000.000/0000-00"
                            onChange={(e) => setFormData((p) => ({ ...p, document: maskDocument(e.target.value) }))}
                          />
                        </div>
                        <div>
                          <Label>TELEFONE / WHATSAPP</Label>
                          <input className="sigx-input" value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" />
                        </div>
                        <div>
                          <Label>E-MAIL</Label>
                          <input type="email" className="sigx-input" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} placeholder="email@exemplo.com" />
                        </div>
                      </div>

                      {/* Endereço */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569", fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginTop: 4 }}>
                        <MapPin size={13} /> Endereço
                      </div>

                      <div className="form-grid-3">
                        <div>
                          <Label>CEP</Label>
                          <input
                            className="sigx-input mono"
                            value={formData.zipCode}
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
                          <input className="sigx-input" value={formData.street} onChange={(e) => setFormData((p) => ({ ...p, street: e.target.value }))} />
                        </div>

                        <div>
                          <Label>NÚMERO</Label>
                          <input className="sigx-input" value={formData.number} onChange={(e) => setFormData((p) => ({ ...p, number: e.target.value }))} />
                        </div>
                        <div>
                          <Label>BAIRRO</Label>
                          <input className="sigx-input" value={formData.neighborhood} onChange={(e) => setFormData((p) => ({ ...p, neighborhood: e.target.value }))} />
                        </div>
                        <div>
                          <Label>COMPLEMENTO</Label>
                          <input className="sigx-input" value={formData.complement} onChange={(e) => setFormData((p) => ({ ...p, complement: e.target.value }))} />
                        </div>

                        <div className="col-span-2">
                          <Label>CIDADE</Label>
                          <input className="sigx-input" value={formData.city} onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))} />
                        </div>
                        <div>
                          <Label>ESTADO (UF)</Label>
                          <select
                            className="sigx-input"
                            value={formData.state}
                            onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))}
                          >
                            <option value="">Selecione...</option>
                            {UF_OPTIONS.map((uf) => (
                              <option key={uf} value={uf}>{uf}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─────────────── ABA 2 — DADOS BANCÁRIOS ─────────────── */}
                  {activeTab === "bancarios" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {/* Banner */}
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
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#2563eb" }}>
                          {formData.bankAccounts.length} CONTA(S)
                        </span>
                      </div>

                      {formData.bankAccounts.length === 0 && (
                        <div style={{ border: "1px dashed #cbd5e1", borderRadius: 8, padding: 28, background: "#f8fafc", textAlign: "center", color: "#94a3b8" }}>
                          <Landmark size={26} style={{ opacity: 0.3, margin: "0 auto 6px", display: "block" }} />
                          <span style={{ fontSize: 11.5 }}>
                            Nenhuma conta cadastrada. Use o botão abaixo para adicionar a primeira.
                          </span>
                        </div>
                      )}

                      {formData.bankAccounts.map((acc, idx) => (
                        <div key={acc.id ?? `new-${idx}`} style={{ padding: 16, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                              <CreditCard size={13} style={{ color: "#2563eb" }} /> CONTA BANCÁRIA {idx + 1}
                            </span>
                            <button
                              type="button"
                              title="Remover conta"
                              onClick={() => removeBankAccount(idx)}
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "white", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer", transition: "all 0.12s" }}
                            >
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
                                // 🚀 setTimeout dá tempo do onMouseDown da opção
                                // disparar antes do dropdown fechar.
                                onBlur={() => setTimeout(() => setFocusedBankIdx(null), 200)}
                                onChange={(e) => updateBankAccount(idx, { bankName: e.target.value })}
                              />
                              {focusedBankIdx === idx && (() => {
                                const term = acc.bankName.toLowerCase().trim();
                                const matches = term
                                  ? LISTA_BANCOS.filter((b) => b.nome.toLowerCase().includes(term))
                                  : LISTA_BANCOS;
                                return (
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: "100%",
                                      left: 0,
                                      right: 0,
                                      background: "white",
                                      border: "1px solid #cbd5e1",
                                      borderRadius: 6,
                                      zIndex: 100,
                                      maxHeight: 220,
                                      overflowY: "auto",
                                      boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
                                      marginTop: 2,
                                    }}
                                  >
                                    {matches.length === 0 ? (
                                      <div style={{ padding: "10px 12px", fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
                                        Nenhum banco encontrado
                                      </div>
                                    ) : (
                                      matches.map((b) => (
                                        <div
                                          key={b.codigo}
                                          style={{
                                            padding: "7px 12px",
                                            fontSize: 11,
                                            cursor: "pointer",
                                            color: "#1e293b",
                                            borderBottom: "1px solid #f1f5f9",
                                          }}
                                          onMouseDown={() => {
                                            updateBankAccount(idx, { bankName: b.nome });
                                            setFocusedBankIdx(null);
                                          }}
                                          onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
                                          onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                                        >
                                          {b.nome}
                                        </div>
                                      ))
                                    )}
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
                              <select
                                className="sigx-input"
                                value={acc.accountType}
                                onChange={(e) => updateBankAccount(idx, { accountType: e.target.value as BankAccountForm["accountType"] })}
                              >
                                {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <Label>CHAVE PIX</Label>
                            <input
                              className="sigx-input mono"
                              placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória"
                              value={acc.pixKey}
                              onChange={(e) => updateBankAccount(idx, { pixKey: e.target.value })}
                            />
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: 11, width: "max-content", display: "inline-flex", alignItems: "center", gap: 6 }}
                        onClick={addBankAccount}
                      >
                        <Plus size={12} /> Adicionar outra conta
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="sigx-modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)} disabled={submitting}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting
                      ? "Salvando..."
                      : editing ? "Atualizar Credor" : "Cadastrar Credor"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        tone="danger"
        title="Excluir Credor"
        description="Esta ação remove permanentemente o cadastro do credor e suas contas bancárias vinculadas."
        entityLabel={personTypeFromDocument(deleteTarget?.document) === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}
        entityName={deleteTarget?.name}
        entityDetail={formatDocumentForGrid(deleteTarget?.document) ?? undefined}
        consequences={[
          "Todas as contas bancárias vinculadas serão removidas em cascata.",
          "Contratos ou lançamentos que referenciem este credor podem ser afetados.",
        ]}
        confirmLabel="Excluir Credor"
        onConfirm={executeDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </UnyPayLayout>
  );
}
