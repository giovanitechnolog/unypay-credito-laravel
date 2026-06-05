import React, { useCallback, useMemo, useState } from "react";
import { Head, router } from "@inertiajs/react";
import {
  Plus, Search, Edit2, Trash2, Users, Building2,
  User, Shield, FileText, X, Eye, Upload, Loader2, CreditCard, QrCode,
  UserCheck, Scale, IdCard, MapPin, Landmark, ScrollText, Download,
} from "lucide-react";
import { toast } from "sonner";
import UnyPayLayout from "../Components/UnyPayLayout";
import ConfirmDialog from "../Components/ConfirmDialog";
import TableGroupBadges from "../Components/TableGroupBadges";
import TableColumnPicker from "../Components/TableColumnPicker";
import GuarantorQuickCreateModal from "../Components/GuarantorQuickCreateModal";
import ClientGuarantorsTable, { ClientGuarantorRow } from "../Components/ClientGuarantorsTable";
import { GuarantorFormValues } from "../Components/GuarantorFormFields";
import { api, extractFirstError } from "../lib/api";
import { downloadExcelWithState } from "../lib/exportHelper";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import {
  CLIENTS_COLUMNS,
  CLIENTS_GROUP_META,
  CLIENTS_GROUP_ORDER,
  type ClientsColumnDef,
  type ClientsColumnId,
} from "../lib/clientsColumns";

const RISK_COLORS: Record<string, { bg: string; color: string }> = {
  A: { bg: "oklch(92% .08 145)", color: "oklch(35% .15 145)" },
  B: { bg: "oklch(92% .06 240)", color: "oklch(35% .15 240)" },
  C: { bg: "oklch(92% .08 75)",  color: "oklch(40% .15 75)" },
  D: { bg: "oklch(92% .08 50)",  color: "oklch(40% .15 50)" },
  E: { bg: "oklch(92% .08 27)",  color: "oklch(40% .2 27)" },
};

const LISTA_BANCOS = [
  { codigo: "001", nome: "001 - Banco do Brasil S.A." },
  { codigo: "033", nome: "033 - Banco Santander (Brasil) S.A." },
  { codigo: "104", nome: "104 - Caixa Econômica Federal" },
  { codigo: "237", nome: "237 - Banco Bradesco S.A." },
  { codigo: "260", nome: "260 - Nu Pagamentos S.A. (Nubank)" },
  { codigo: "341", nome: "341 - Itaú Unibanco S.A." },
  { codigo: "077", nome: "077 - Banco Inter S.A." },
  { codigo: "212", nome: "212 - Banco Original S.A." },
  { codigo: "422", nome: "422 - Banco Safra S.A." },
  { codigo: "748", nome: "748 - Banco Cooperativo Sicredi S.A." },
  { codigo: "756", nome: "756 - Banco Cooperativo do Brasil S.A. (Sicoob)" },
];

interface BankAccount { 
  banco: string; 
  agencia: string; 
  conta: string; 
  tipo: string;
  hasPix: boolean;             // 🚀 Novo controle profissional
  pixType: string;             // 🚀 Tipo da Chave (CPF, CNPJ, Email, etc.)
  pixKey: string;              // 🚀 Valor da Chave PIX
}

const emptyBankAccount = (): BankAccount => ({ 
  banco: "", 
  agencia: "", 
  conta: "", 
  tipo: "corrente",
  hasPix: false,
  pixType: "aleatoria",
  pixKey: ""
});

const emptyForm = {
  name: "", document: "", email: "", phone: "",
  address: "", city: "", state: "", zipCode: "",
  personType: "PF" as "PF" | "PJ",
  riskRating: "A" as "A" | "B" | "C" | "D" | "E",
  profissao: "", rendaMensal: "",
  bankAccounts: [emptyBankAccount()] as BankAccount[],
  notes: "",
  fiador1Nome: "", fiador1Cpf: "", fiador1Cnpj: "", fiador1Telefone: "",
  fiador1Endereco: "", fiador1Cidade: "", fiador1Estado: "", fiador1Cep: "",
  fiador2Nome: "", fiador2Cpf: "", fiador2Cnpj: "", fiador2Telefone: "",
  fiador2Endereco: "", fiador2Cidade: "", fiador2Estado: "", fiador2Cep: "",
  observacoesJuridicas: "",
};

type FormType = typeof emptyForm;

function parseNotes(notes: string | null | undefined): Partial<FormType> {
  if (!notes) return {};
  try { const p = JSON.parse(notes); return typeof p === "object" ? p : {}; } catch { return {}; }
}

function buildNotes(form: FormType): string {
  const { name, document, email, phone, address, city, state, zipCode, personType, riskRating, ...extra } = form;
  return JSON.stringify(extra);
}

const maskCEP = (v: string) => v.replace(/\D/g, "").replace(/^(\d{5})(\d)/, "$1-$2").slice(0, 9);
const maskCPF = (v: string) => v.replace(/\D/g, "").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2").slice(0, 14);
const maskCNPJ = (v: string) => v.replace(/\D/g, "").replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2").slice(0, 18);
const maskPhone = (v: string) => v.replace(/\D/g, "").replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").slice(0, 15);

const onlyDigits = (v: string) => (v ?? "").replace(/\D/g, "");

// 🚀 Vínculo apresentado na aba "Fiadores / Codevedores" do modal — agora
// é uma listagem somente-leitura derivada dos CONTRATOS do cliente. Cada
// item representa uma combinação única (pessoa, papel) extraída da pivot
// contract_guarantor. Não há mais criação/edição/remoção aqui — esta tela
// apenas exibe quem atua como Fiador ou Codevedor nos contratos do cliente.
type ClientGuarantor = {
  /** Chave estável para o React. Composta por `${id}-${role}` no hidrate. */
  localId: string;
  id: number;
  name: string;
  personType: "PF" | "PJ";
  document: string | null;
  role: "FIADOR" | "CODEVEDOR";
};

/** Formata CPF/CNPJ a partir dos dígitos persistidos para a tabela da aba. */
const formatGuarantorDocument = (doc: string | null | undefined, type: "PF" | "PJ"): string => {
  const digits = (doc ?? "").replace(/\D/g, "");
  if (!digits) return "—";
  if (type === "PJ" && digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (type === "PF" && digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return digits;
};

// Mascaramento Inteligente para as chaves PIX de acordo com a seleção
const maskPixKey = (v: string, type: string) => {
  if (type === "cpf") return maskCPF(v);
  if (type === "cnpj") return maskCNPJ(v);
  if (type === "telefone") return maskPhone(v);
  return v; // Email ou chave aleatória não aplicam máscaras fixas numéricas
};

const TABS = [
  { key: "dados",      label: "Dados Pessoais",         icon: IdCard },
  { key: "endereco",   label: "Endereço",               icon: MapPin },
  { key: "financeiro", label: "Dados Financeiros",      icon: Landmark },
  { key: "fiadores",   label: "Fiadores / Codevedores", icon: UserCheck },
  { key: "obs",        label: "Obs. Jurídicas",         icon: ScrollText },
];

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="sigx-label" style={{ marginBottom: 4, display: "block" }}>{children}</label>
);

const ACTIONS_WIDTH = 130;
const PAGE_SIZES = [20, 50, 100];

const headerCellStyle: React.CSSProperties = {
  background: "#f1f5f9", color: "#334155",
  padding: "5px 7px", fontSize: 9, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.04em",
  whiteSpace: "nowrap", borderBottom: "2px solid #cbd5e1",
};
const tdBase: React.CSSProperties = { padding: "3px 7px", borderBottom: "1px solid #f1f5f9", fontSize: 11, verticalAlign: "middle" };
const tdCenter: React.CSSProperties = { ...tdBase, textAlign: "center" };

export default function Clients({ clients, filters }: any) {
  const [search, setSearch] = useState(filters?.search || "");
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState("dados");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [focusedBankIdx, setFocusedBankIdx] = useState<number | null>(null);
  const [cepMeta, setCepMeta] = useState({ main: "", fiador1: "", fiador2: "" });

  // 🚀 Lista de pessoas (Fiador/Codevedor) que aparecem em CONTRATOS do
  // cliente — somente leitura. A fonte é a pivot contract_guarantor (com role)
  // e os dados chegam hidratados pelo ClientController@index. Não há mais UI
  // para adicionar/buscar/editar — gerenciar vínculos é feito na aba
  // "Fiador / Codevedor" do contrato.
  const [selectedGuarantors, setSelectedGuarantors] = useState<ClientGuarantor[]>([]);
  // Modal usado APENAS para visualizar (modo "view") os dados completos da
  // pessoa quando o usuário clica no olhinho. Não há mais "create"/"edit-new"
  // nesta tela.
  const [viewModalState, setViewModalState] = useState<{
    open: boolean;
    initialValue?: Partial<GuarantorFormValues>;
  }>({ open: false });

  // Modal popup acionado pelo ícone da nova coluna "Fiadores" da grade
  // principal — mostra a tabela completa de Fiadores+Codevedores do cliente.
  const [guarantorsModal, setGuarantorsModal] = useState<{
    client: any;
    list: ClientGuarantorRow[];
  } | null>(null);

  const { visibleIds, toggleColumn, setColumnsVisible, resetDefaults } =
    useColumnVisibility<ClientsColumnId>("unypay.clients.columns.v1", CLIENTS_COLUMNS);

  const visibleOrdered: ClientsColumnDef[] = useMemo(
    () => CLIENTS_COLUMNS.filter((c) => visibleIds.has(c.id)),
    [visibleIds],
  );

  const stickyOffsets = useMemo(() => {
    const offsets = new Map<ClientsColumnId, number>();
    let acc = 0;
    for (const col of visibleOrdered) {
      if (col.sticky) {
        offsets.set(col.id, acc);
        acc += col.width;
      }
    }
    return offsets;
  }, [visibleOrdered]);

  const visibleGroupRuns = useMemo(() => {
    const runs: { group: typeof CLIENTS_GROUP_ORDER[number]; count: number }[] = [];
    for (const col of visibleOrdered) {
      const last = runs[runs.length - 1];
      if (last && last.group === col.group) last.count += 1;
      else runs.push({ group: col.group, count: 1 });
    }
    return runs;
  }, [visibleOrdered]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    router.get("/clients", { search: value }, { preserveState: true, replace: true });
  };

  const handleExportExcel = useCallback(() => {
    downloadExcelWithState(
      "/clients/export",
      "clientes.xlsx",
      setExporting,
      { params: { search: search || undefined } },
    );
  }, [search]);

  const handleOpen = (client?: any) => {
    if (client) {
      setEditing(client.id);
      const extra = parseNotes(client.notes);
      setForm({
        name: client.name ?? "", document: client.document ?? "",
        email: client.email ?? "", phone: client.phone ?? "",
        address: client.address ?? "", city: client.city ?? "",
        state: client.state ?? "", zipCode: client.zipCode ?? "",
        personType: client.personType ?? "PF", riskRating: client.riskRating ?? "A",
        profissao: extra.profissao ?? "", rendaMensal: extra.rendaMensal ?? "",
        bankAccounts: extra.bankAccounts ?? [emptyBankAccount()],
        notes: extra.notes ?? "",
        fiador1Nome: extra.fiador1Nome ?? "", fiador1Cpf: extra.fiador1Cpf ?? "",
        fiador1Cnpj: extra.fiador1Cnpj ?? "", fiador1Telefone: extra.fiador1Telefone ?? "",
        fiador1Endereco: extra.fiador1Endereco ?? "", fiador1Cidade: extra.fiador1Cidade ?? "",
        fiador1Estado: extra.fiador1Estado ?? "", fiador1Cep: extra.fiador1Cep ?? "",
        fiador2Nome: extra.fiador2Nome ?? "", fiador2Cpf: extra.fiador2Cpf ?? "",
        fiador2Cnpj: extra.fiador2Cnpj ?? "", fiador2Telefone: extra.fiador2Telefone ?? "",
        fiador2Endereco: extra.fiador2Endereco ?? "", fiador2Cidade: extra.fiador2Cidade ?? "",
        fiador2Estado: extra.fiador2Estado ?? "", fiador2Cep: extra.fiador2Cep ?? "",
        observacoesJuridicas: extra.observacoesJuridicas ?? "",
      });

      // 🚀 Hidrata a aba "Fiadores" com os fiadores institucionais já vinculados
      // (vindos do back via index() — relação NxN client_guarantor).
      const linked: any[] = client.guarantors ?? [];
      setSelectedGuarantors(linked.map((g: any) => ({
        // localId composto evita colisão quando a mesma pessoa aparece em
        // dois papéis distintos para o mesmo cliente (Fiador e Codevedor).
        localId: `${g.id}-${g.role ?? "FIADOR"}`,
        id: Number(g.id),
        name: g.name,
        personType: (g.personType as "PF" | "PJ") ?? "PF",
        document: g.document ?? null,
        role: (g.role as "FIADOR" | "CODEVEDOR") ?? "FIADOR",
      })));
    } else {
      setEditing(null);
      setForm(emptyForm);
      setSelectedGuarantors([]);
    }
    setActiveTab("dados");
    setOpen(true);
  };

  const handleFetchCep = async (cep: string, targetPrefix: "main" | "fiador1" | "fiador2") => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (data.erro) return;
      const summary = `${data.logradouro}, ${data.bairro} — ${data.localidade}/${data.uf}`;
      setCepMeta(prev => ({ ...prev, [targetPrefix]: summary }));
      setForm(prev => {
        if (targetPrefix === "main") return { ...prev, address: `${data.logradouro}, ${data.bairro}`, city: data.localidade, state: data.uf };
        if (targetPrefix === "fiador1") return { ...prev, fiador1Endereco: `${data.logradouro}, ${data.bairro}`, fiador1Cidade: data.localidade, fiador1Estado: data.uf };
        return { ...prev, fiador2Endereco: `${data.logradouro}, ${data.bairro}`, fiador2Cidade: data.localidade, fiador2Estado: data.uf };
      });
    } catch (err) { console.error(err); }
  };

  /**
   * 🚀 Abre o sub-modal em modo "view" (somente leitura) com TODOS os dados
   * da pessoa (Fiador ou Codevedor). Como a tabela mantém apenas o resumo
   * (nome, tipo, documento, papel), buscamos o detalhe completo no backend
   * antes de exibir endereço, RG, nacionalidade, etc.
   */
  const openGuarantorViewModal = async (guarantorId: number) => {
    try {
      const { data } = await api.get(`/api/guarantors/${guarantorId}`);
      const g = data?.guarantor;
      if (!g) {
        toast.error("Fiador não encontrado.");
        return;
      }
      const initialValue: Partial<GuarantorFormValues> = {
        personType: g.personType,
        name: g.name ?? "",
        nationality: g.nationality ?? "",
        maritalStatus: g.maritalStatus ?? "",
        cpf: g.cpf ? maskCPF(g.cpf) : "",
        rg: g.rg ?? "",
        cnpj: g.cnpj ? maskCNPJ(g.cnpj) : "",
        tradeName: g.tradeName ?? "",
        stateRegistration: g.stateRegistration ?? "",
        street: g.street ?? "",
        number: g.number ?? "",
        complement: g.complement ?? "",
        neighborhood: g.neighborhood ?? "",
        city: g.city ?? "",
        state: g.state ?? "",
        zipCode: g.zipCode ? maskCEP(g.zipCode) : "",
      };
      setViewModalState({ open: true, initialValue });
    } catch (err) {
      toast.error(extractFirstError(err, "Falha ao carregar dados da pessoa."));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 🚀 A aba "Fiadores / Codevedores" virou somente leitura — o vínculo
    // pessoa↔cliente passou a ser derivado dos contratos do cliente, então
    // não precisamos mais persistir/sincronizar guarantor_ids aqui.
    const data: Record<string, any> = {
      name: form.name, document: form.document || null,
      email: form.email || null, phone: form.phone || null,
      address: form.address || null, city: form.city || null,
      state: form.state || null, zipCode: form.zipCode || null,
      personType: form.personType, riskRating: form.riskRating,
      notes: buildNotes(form),
    };
    if (editing) {
      router.put(`/clients/${editing}`, data, { onSuccess: () => setOpen(false) });
    } else {
      router.post("/clients", data, { onSuccess: () => setOpen(false) });
    }
  };

  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string; document?: string | null; personType?: string } | null>(null);

  const handleDelete = (client: any) => {
    setConfirmDelete({
      id: client.id,
      name: client.name,
      document: client.document,
      personType: client.personType,
    });
  };

  const executeClientDelete = () => {
    if (!confirmDelete) return;
    router.delete(`/clients/${confirmDelete.id}`, {
      onSuccess: () => setConfirmDelete(null),
    });
  };

  const handleOcrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    router.post("/clients/ocr", formData, {
      onSuccess: (page: any) => {
        const data = page.props.flash?.ocrData;
        if (data) {
          setForm(prev => ({
            ...prev,
            name: data.debtorName || prev.name, document: data.debtorDocument || prev.document,
            address: data.debtorAddress || prev.address, city: data.city || prev.city, state: data.state || prev.state,
            fiador1Nome: data.guarantors || prev.fiador1Nome
          }));
          setActiveTab("dados");
        }
      },
      onFinish: () => setOcrLoading(false)
    });
  };

  const f = (k: keyof FormType) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const totalRows = clients?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const paginated = useMemo(() => (clients ?? []).slice((page - 1) * pageSize, page * pageSize), [clients, page, pageSize]);

  const renderCellContent = (col: ClientsColumnDef, client: any): React.ReactNode => {
    const extra = parseNotes(client.notes);
    const risk = RISK_COLORS[client.riskRating ?? "A"] ?? RISK_COLORS.A;
    switch (col.id) {
      case "name":
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 6, maxWidth: col.width - 14, overflow: "hidden" }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#1a2035", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
              {client.name.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontWeight: 600, fontSize: 11, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client.name}</span>
          </div>
        );
      case "document": return <span className="mono" style={{ fontSize: 10, color: "#6b7280" }}>{client.document || "—"}</span>;
      case "personType":
        return (
          <span className={`badge ${client.personType === "PJ" ? "badge-pj" : "badge-pf"}`} style={{ fontSize: 9 }}>
            {client.personType === "PJ" ? <Building2 size={9} /> : <User size={9} />}{client.personType}
          </span>
        );
      case "profession": return <span style={{ fontSize: 10, color: "#6b7280" }}>{extra.profissao || "—"}</span>;
      case "email": return <span style={{ fontSize: 10, color: "#6b7280" }}>{client.email || "—"}</span>;
      case "phone": return <span style={{ fontSize: 10, color: "#6b7280" }}>{client.phone || "—"}</span>;
      case "cityState": return <span style={{ fontSize: 10, color: "#6b7280" }}>{client.city ? `${client.city}${client.state ? `/${client.state}` : ""}` : "—"}</span>;
      case "rating":
        return (
          <span className="badge" style={{ background: risk.bg, color: risk.color, fontSize: 9 }}>
            <Shield size={9} /> {client.riskRating ?? "A"}
          </span>
        );
      case "pixKey": 
        // 🚀 Exibe de forma inteligente a primeira chave PIX que encontrar nas contas bancárias
        const primeiraContaComPix = extra.bankAccounts?.find((b: any) => b.hasPix && b.pixKey);
        return <span style={{ fontSize: 10, color: "#475569", fontWeight: 500 }}>{primeiraContaComPix ? primeiraContaComPix.pixKey : "—"}</span>;
      case "fiadores": {
        // 🚀 Coluna única que substitui as antigas "fiador1"/"fiador2".
        // Mostra um chip com a contagem total de Fiadores + Codevedores
        // (provenientes dos contratos do cliente) e abre um modal com a
        // tabela detalhada quando o usuário clica.
        const linked = (client.guarantors ?? []) as ClientGuarantorRow[];
        const total = linked.length;
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setGuarantorsModal({ client, list: linked });
            }}
            title={total === 0
              ? "Nenhum fiador / codevedor"
              : `Ver ${total} vínculo(s) — fiadores e codevedores`
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 9px",
              borderRadius: 12,
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
              background: total > 0 ? "#fbf7ff" : "#f1f5f9",
              color: total > 0 ? "#6b21a8" : "#94a3b8",
              border: total > 0 ? "1px solid #e9d5ff" : "1px solid #e2e8f0",
              transition: "all 0.12s",
            }}
          >
            <Users size={11} /> {total}
            <Eye size={10} style={{ marginLeft: 2 }} />
          </button>
        );
      }
      default: return null;
    }
  };

  return (
    <UnyPayLayout>
      <Head title="Gerenciamento de Clientes" />

      <style>{`
        /* —— Caixa alta visual da tela inteira (incluindo modal) —— */
        .clients-page,
        .clients-page input,
        .clients-page select,
        .clients-page textarea,
        .clients-page button,
        .clients-page option,
        .clients-page label,
        .clients-page h1, .clients-page h2, .clients-page h3,
        .clients-page p, .clients-page span, .clients-page strong,
        .clients-page td, .clients-page th { text-transform: uppercase; }

        .clients-page input.mono,
        .clients-page input[type="email"],
        .clients-page input[type="password"],
        .clients-page input[type="date"],
        .clients-page input[type="number"] { text-transform: none; }
        .clients-page input::placeholder,
        .clients-page textarea::placeholder { text-transform: none; }
        .clients-page .keep-case,
        .clients-page .keep-case * { text-transform: none !important; }
      `}</style>

      <div className="clients-page" style={{ padding: "12px 20px 16px 20px", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>Gerenciamento de Clientes</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button className="btn-primary" onClick={() => handleOpen()} style={{ padding: "6px 14px", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={12} /> Novo Cliente
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

        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input
                style={{ paddingLeft: 26, width: 280, fontSize: 11, height: 28, border: "1px solid #d1d5db", borderRadius: 6, outline: "none", color: "#374151" }}
                placeholder="Buscar clientes..." value={search} onChange={e => handleSearchChange(e.target.value)}
              />
            </div>
            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, flexShrink: 0 }}>{clients?.length ?? 0} clientes</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <TableGroupBadges allColumns={CLIENTS_COLUMNS} groupOrder={CLIENTS_GROUP_ORDER} groupMeta={CLIENTS_GROUP_META} visibleIds={visibleIds} setColumnsVisible={setColumnsVisible} />
            <TableColumnPicker allColumns={CLIENTS_COLUMNS} groupOrder={CLIENTS_GROUP_ORDER} groupMeta={CLIENTS_GROUP_META} visibleIds={visibleIds} toggleColumn={toggleColumn} setColumnsVisible={setColumnsVisible} resetDefaults={resetDefaults} />
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden", background: "white" }}>
          <div style={{ flex: 1, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 11 }}>
              <colgroup>
                {visibleOrdered.map(col => <col key={col.id} style={{ width: col.width }} />)}
                <col style={{ width: ACTIONS_WIDTH }} />
              </colgroup>
              <thead>
                <tr>
                  {visibleGroupRuns.map((run, i) => {
                    const meta = CLIENTS_GROUP_META[run.group];
                    return (
                      <th key={`${run.group}-${i}`} colSpan={run.count} style={{ background: meta.bg, color: meta.color, textAlign: "center", padding: "4px 8px", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        {meta.label}
                      </th>
                    );
                  })}
                  <th style={{ background: "#1e2139", color: "white", textAlign: "center", padding: "4px 8px", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Ações</th>
                </tr>
                <tr>
                  {visibleOrdered.map(col => {
                    const stickyStyle: React.CSSProperties = col.sticky ? { position: "sticky", left: stickyOffsets.get(col.id), zIndex: 2, background: "#f1f5f9" } : {};
                    return <th key={col.id} style={{ ...headerCellStyle, textAlign: col.align, ...stickyStyle }}>{col.label.toUpperCase()}</th>;
                  })}
                  <th style={{ ...headerCellStyle, textAlign: "center" }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {!clients || clients.length === 0 ? (
                  <tr>
                    <td colSpan={visibleOrdered.length + 1} style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
                      <Users size={28} style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }} /> Nenhum cliente cadastrado
                    </td>
                  </tr>
                ) : (
                  paginated.map((client: any, rowIdx: number) => {
                    const rowBg = rowIdx % 2 === 1 ? "#fafafa" : "white";
                    return (
                      <tr key={client.id} style={{ background: rowBg }} onMouseOver={e => (e.currentTarget.style.background = "#eff6ff")} onMouseOut={e => (e.currentTarget.style.background = rowBg)}>
                        {visibleOrdered.map(col => {
                          const stickyStyle: React.CSSProperties = col.sticky ? { position: "sticky", left: stickyOffsets.get(col.id), zIndex: 1, background: "inherit" } : {};
                          const base = col.align === "right" ? { ...tdBase, fontFamily: "'IBM Plex Mono', monospace", textAlign: "right" as const } : col.align === "center" ? tdCenter : tdBase;
                          return <td key={col.id} style={{ ...base, ...stickyStyle }}>{renderCellContent(col, client)}</td>;
                        })}
                        <td style={tdCenter}>
                          <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                            <button className="btn-icon" title="Ver detalhes" onClick={() => router.get(`/clients/${client.id}`)}><Eye size={11} /></button>
                            <button className="btn-icon" title="Ver contratos" onClick={() => router.get(`/contracts?clientId=${client.id}`)}><FileText size={11} /></button>
                            <button className="btn-icon" title="Editar" onClick={() => handleOpen(client)}><Edit2 size={11} /></button>
                            <button className="btn-icon" title="Excluir" style={{ color: "#dc2626" }} onClick={() => handleDelete(client)}><Trash2 size={11} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ padding: "6px 12px", background: "#fafbfc", borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6b7280" }}>
              <span>Exibir</span>
              <select style={{ padding: "2px 6px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 11, background: "white" }} value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(1); }}>
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <span>por página</span>
            </div>
            <span style={{ fontSize: 11, color: "#6b7280" }}>Mostrando {Math.min((page - 1) * pageSize + 1, totalRows)}–{Math.min(page * pageSize, totalRows)} de {totalRows}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "3px 10px", border: "1px solid #d1d5db", borderRadius: 4, background: "white", fontSize: 11, cursor: page === 1 ? "not-allowed" : "pointer", color: page === 1 ? "#9ca3af" : "#374151" }}>← Anterior</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const n = page <= 3 ? i + 1 : page - 2 + i;
                if (n < 1 || n > totalPages) return null;
                return (
                  <button type="button" key={n} onClick={() => setPage(n)} style={{ width: 28, height: 26, borderRadius: 4, border: "1px solid", fontSize: 11, background: n === page ? "#1a2035" : "white", color: n === page ? "white" : "#374151", borderColor: n === page ? "#1a2035" : "#d1d5db", fontWeight: n === page ? 700 : 400, cursor: "pointer" }}>{n}</button>
                );
              })}
              <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ padding: "3px 10px", border: "1px solid #d1d5db", borderRadius: 4, background: "white", fontSize: 11, cursor: page >= totalPages ? "not-allowed" : "pointer", color: page >= totalPages ? "#9ca3af" : "#374151" }}>Próxima →</button>
            </div>
          </div>
        </div>

        {/* Modal de Formulário Completo — header com gradiente + tabs estilo
            pílula, alinhando o visual ao modal de Fiadores e Contratos. */}
        {open && (
          <div className="sigx-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
            <div
              className="sigx-modal"
              style={{
                maxWidth: 880,
                width: "min(880px, calc(100vw - 32px))",
                padding: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
              onMouseDown={e => e.stopPropagation()}
            >
              {/* HEADER com gradiente — mesmo padrão dos modais de Fiadores e Contratos */}
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
                    <Users size={16} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>
                      {editing ? "Editar Cliente" : "Novo Cliente"}
                    </span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                      {editing ? `Atualizando registro #${editing}` : "Preencha as guias abaixo para registrar um novo cliente"}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ cursor: "pointer" }}>
                    <button
                      type="button"
                      onClick={() => document.getElementById("ocr-upload")?.click()}
                      disabled={ocrLoading}
                      style={{
                        background: "rgba(255,255,255,0.12)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        cursor: ocrLoading ? "not-allowed" : "pointer",
                        color: "white",
                        height: 30,
                        padding: "0 12px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        opacity: ocrLoading ? 0.6 : 1,
                      }}
                    >
                      {ocrLoading ? <><Loader2 size={11} className="animate-spin" /> Lendo PDF...</> : <><Upload size={11} /> Preencher via PDF (OCR)</>}
                    </button>
                    <input id="ocr-upload" type="file" style={{ display: "none" }} onChange={handleOcrUpload} accept=".pdf" />
                  </label>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "none",
                      cursor: "pointer",
                      color: "white",
                      width: 30,
                      height: 30,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* TABS estilo pílula — fundo claro, botões arredondados com indicador */}
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
                {TABS.map(tab => {
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
                  className="sigx-modal-body"
                  style={{
                    padding: 22,
                    height: "clamp(380px, 56vh, 64vh)",
                    overflowY: "auto",
                    background: "white",
                  }}
                >
                  
                  {activeTab === "dados" && (
                    <div className="form-grid-3">
                      <div className="col-span-3"><Label>NOME COMPLETO / RAZÃO SOCIAL *</Label><input className="sigx-input" value={form.name} onChange={f("name")} required placeholder="Nome completo ou razão social" /></div>
                      <div>
                        <Label>TIPO DE PESSOA</Label>
                        <select className="sigx-input" value={form.personType} onChange={f("personType")}>
                          <option value="PF">Pessoa Física</option><option value="PJ">Pessoa Jurídica</option>
                        </select>
                      </div>
                      <div>
                        <Label>{form.personType === "PJ" ? "CNPJ" : "CPF"}</Label>
                        <input
                          className="sigx-input"
                          value={form.document}
                          onChange={(e) => {
                            // 🚀 Máscara dinâmica: CPF até 11 dígitos, CNPJ a partir de 12.
                            // Atualiza o personType automaticamente conforme o usuário digita,
                            // mantendo o Label e o select de Tipo de Pessoa em sincronia.
                            const digits = e.target.value.replace(/\D/g, "");
                            const nextPersonType = digits.length > 11 ? "PJ" : "PF";
                            const masked = nextPersonType === "PJ" ? maskCNPJ(e.target.value) : maskCPF(e.target.value);
                            setForm(p => ({ ...p, document: masked, personType: nextPersonType }));
                          }}
                          placeholder="000.000.000-00 ou 00.000.000/0000-00"
                        />
                      </div>
                      <div>
                        <Label>RATING DE RISCO</Label>
                        <select className="sigx-input" value={form.riskRating} onChange={f("riskRating")}>
                          <option value="A">Rating A (Excelente)</option><option value="B">Rating B (Bom)</option><option value="C">Rating C (Regular)</option><option value="D">Rating D (Ruim)</option><option value="E">Rating E (Péssimo)</option>
                        </select>
                      </div>
                      <div><Label>TELEFONE / WHATSAPP</Label><input className="sigx-input" value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" /></div>
                      <div className="col-span-2"><Label>E-MAIL</Label><input type="email" className="sigx-input" value={form.email} onChange={f("email")} placeholder="email@exemplo.com" /></div>
                      <div><Label>PROFISSÃO / ATIVIDADE</Label><input className="sigx-input" value={form.profissao} onChange={f("profissao")} placeholder="Ex: Empresário, Transportador..." /></div>
                      <div><Label>RENDA MENSAL (R$)</Label><input className="sigx-input mono" value={form.rendaMensal} onChange={f("rendaMensal")} placeholder="0,00" /></div>
                    </div>
                  )}

                  {activeTab === "endereco" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <Label>CEP</Label>
                        <input className="sigx-input" style={{ width: "38%" }} value={form.zipCode} onChange={(e) => { const masked = maskCEP(e.target.value); setForm(p => ({ ...p, zipCode: masked })); if (masked.replace(/\D/g, "").length === 8) handleFetchCep(masked, "main"); }} placeholder="00000-000" />
                        {cepMeta.main && <div style={{ color: "var(--color-green)", fontSize: 11, fontWeight: 600, marginTop: 4 }}>{cepMeta.main}</div>}
                      </div>
                      <div><Label>ENDEREÇO COMPLETO</Label><input className="sigx-input" value={form.address} onChange={f("address")} /></div>
                      <div className="form-grid-3">
                        <div className="col-span-2"><Label>CIDADE</Label><input className="sigx-input" value={form.city} onChange={f("city")} /></div>
                        <div><Label>ESTADO (UF)</Label><input className="sigx-input" value={form.state} onChange={f("state")} maxLength={2} /></div>
                      </div>
                    </div>
                  )}

                  {activeTab === "financeiro" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {/* Banner informativo no estilo dos modais de Fiadores/Contratos */}
                      <div
                        className="keep-case"
                        style={{
                          padding: "10px 12px",
                          background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)",
                          border: "1px solid #e0e7ff",
                          borderRadius: 8,
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#2563eb", color: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Landmark size={15} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ fontSize: 12, color: "#1e2139", display: "block" }}>Contas Bancárias e Chaves PIX</strong>
                          <span style={{ fontSize: 10.5, color: "#64748b" }}>
                            Cadastre uma ou mais contas bancárias do cliente. As chaves PIX podem ser vinculadas individualmente a cada conta.
                          </span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#2563eb" }}>
                          {form.bankAccounts.length} CONTA(S)
                        </span>
                      </div>

                      {form.bankAccounts.length === 0 && (
                        <div
                          style={{
                            border: "1px dashed #cbd5e1",
                            borderRadius: 8,
                            padding: 28,
                            background: "#f8fafc",
                            textAlign: "center",
                            color: "#94a3b8",
                          }}
                        >
                          <Landmark size={26} style={{ opacity: 0.3, margin: "0 auto 6px", display: "block" }} />
                          <span style={{ fontSize: 11.5 }}>
                            Nenhuma conta cadastrada. Use o botão abaixo para adicionar a primeira.
                          </span>
                        </div>
                      )}

                      {form.bankAccounts.map((acc, idx) => (
                        <div key={idx} style={{ padding: 16, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                              <CreditCard size={13} style={{ color: "#2563eb" }} /> CONTA BANCÁRIA {idx + 1}
                            </span>
                            <button
                              type="button"
                              title="Remover conta"
                              onClick={() => setForm(p => ({ ...p, bankAccounts: p.bankAccounts.filter((_, i) => i !== idx) }))}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "4px 10px",
                                background: "white",
                                border: "1px solid #fecaca",
                                color: "#dc2626",
                                borderRadius: 6,
                                fontSize: 10,
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "all 0.12s",
                              }}
                            >
                              <Trash2 size={11} /> Remover
                            </button>
                          </div>
                          
                          {/* Grade da Conta Tradicional */}
                          {/* 🚀 Coluna do TIPO ampliada (1.6fr) para acomodar os 5 rótulos completos */}
                          <div style={{ display: "grid", gridTemplateColumns: "2.4fr 0.9fr 1.8fr 1.6fr", gap: 10, marginBottom: 12 }}>
                            <div style={{ position: "relative" }}>
                              <input className="sigx-input" value={acc.banco} placeholder="Buscar banco..." onFocus={() => setFocusedBankIdx(idx)} onBlur={() => setTimeout(() => setFocusedBankIdx(null), 200)}
                                onChange={e => setForm(p => ({ ...p, bankAccounts: form.bankAccounts.map((a, i) => i === idx ? { ...a, banco: e.target.value } : a) }))} />
                              {focusedBankIdx === idx && (
                                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid var(--border)", borderRadius: 6, zIndex: 100, maxHeight: 140, overflowY: "auto" }}>
                                  {LISTA_BANCOS.filter(b => b.nome.toLowerCase().includes(acc.banco.toLowerCase())).map(b => (
                                    <div key={b.codigo} style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer" }} onMouseDown={() => setForm(p => ({ ...p, bankAccounts: form.bankAccounts.map((a, i) => i === idx ? { ...a, banco: b.nome } : a) }))}>{b.nome}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <input className="sigx-input" value={acc.agencia} placeholder="Agência" onChange={e => setForm(p => ({ ...p, bankAccounts: form.bankAccounts.map((a, i) => i === idx ? { ...a, agencia: e.target.value } : a) }))} />
                            <input className="sigx-input" value={acc.conta} placeholder="Número Conta" onChange={e => setForm(p => ({ ...p, bankAccounts: form.bankAccounts.map((a, i) => i === idx ? { ...a, conta: e.target.value } : a) }))} />
                            <select className="sigx-input" value={acc.tipo} onChange={e => setForm(p => ({ ...p, bankAccounts: form.bankAccounts.map((a, i) => i === idx ? { ...a, tipo: e.target.value } : a) }))}>
                              <option value="corrente">Corrente</option>
                              <option value="poupanca">Poupança</option>
                              <option value="pagamentos">Pagamentos</option>
                              <option value="salario">Conta Salário</option>
                              <option value="conjunta">Conta Conjunta</option>
                            </select>
                          </div>

                          {/* 🚀 Bloco Profissional do PIX Acoplado à Conta */}
                          <div style={{ background: "#ffffff", border: "1px dashed #cbd5e1", borderRadius: 6, padding: "10px 12px" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: "#475569", cursor: "pointer" }}>
                              <input 
                                type="checkbox" 
                                checked={acc.hasPix || false} 
                                onChange={e => setForm(p => ({ ...p, bankAccounts: form.bankAccounts.map((a, i) => i === idx ? { ...a, hasPix: e.target.checked } : a) }))}
                              />
                              <QrCode size={13} style={{ color: "#0d9488" }} /> Vincular Chave PIX a esta conta bancária
                            </label>

                            {acc.hasPix && (
                              <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
                                <select 
                                  className="sigx-input" 
                                  style={{ width: "30%", height: 30 }} 
                                  value={acc.pixType || "aleatoria"} 
                                  onChange={e => setForm(p => ({ ...p, bankAccounts: form.bankAccounts.map((a, i) => i === idx ? { ...a, pixType: e.target.value, pixKey: "" } : a) }))}
                                >
                                  <option value="cpf">CPF</option>
                                  <option value="cnpj">CNPJ</option>
                                  <option value="email">E-mail</option>
                                  <option value="telefone">Celular</option>
                                  <option value="aleatoria">Chave Aleatória</option>
                                  <option value="dados_conta">Dados da Conta</option>
                                </select>
                                <input 
                                  className="sigx-input mono" 
                                  style={{ flex: 1, height: 30 }}
                                  disabled={acc.pixType === "dados_conta"}
                                  placeholder={acc.pixType === "dados_conta" ? "Usa os dados informados acima" : "Informe a chave PIX aqui..."}
                                  value={acc.pixType === "dados_conta" ? `${acc.agencia} / ${acc.conta}` : acc.pixKey || ""} 
                                  onChange={e => setForm(p => ({ ...p, bankAccounts: form.bankAccounts.map((a, i) => i === idx ? { ...a, pixKey: maskPixKey(e.target.value, acc.pixType) } : a) }))}
                                />
                              </div>
                            )}
                          </div>

                        </div>
                      ))}
                      
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: 11, width: "max-content", display: "inline-flex", alignItems: "center", gap: 6 }}
                        onClick={() => setForm(p => ({ ...p, bankAccounts: [...p.bankAccounts, emptyBankAccount()] }))}
                      >
                        <Plus size={12} /> Adicionar outra conta
                      </button>
                      <div style={{ marginTop: 6 }}><Label>Observações Financeiras Gerais</Label><textarea className="sigx-input" value={form.notes} onChange={f("notes")} rows={3} style={{ resize: "vertical" }} /></div>
                    </div>
                  )}

                  {activeTab === "fiadores" && (() => {
                    const fiadoresCount = selectedGuarantors.filter(g => g.role === "FIADOR").length;
                    const codevedoresCount = selectedGuarantors.filter(g => g.role === "CODEVEDOR").length;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <div
                          className="keep-case"
                          style={{
                            padding: "10px 12px",
                            background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)",
                            border: "1px solid #e0e7ff",
                            borderRadius: 8,
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#2563eb", color: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Shield size={15} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ fontSize: 12, color: "#1e2139", display: "block" }}>Fiadores e Codevedores em Contratos do Cliente</strong>
                            <span style={{ fontSize: 10.5, color: "#64748b" }}>
                              Lista somente leitura derivada dos contratos. Para vincular ou desvincular pessoas, edite o contrato correspondente.
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#6b21a8", background: "#fbf7ff", padding: "3px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <UserCheck size={11} /> {fiadoresCount} FIADOR(ES)
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#c2410c", background: "#fff7ed", padding: "3px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Scale size={11} /> {codevedoresCount} CODEVEDOR(ES)
                            </span>
                          </div>
                        </div>

                        <div
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 8,
                            overflow: "hidden",
                            background: "white",
                          }}
                        >
                          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 11 }}>
                            <thead>
                              <tr style={{ background: "#f1f5f9" }}>
                                <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 70 }}>Tipo</th>
                                <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Nome / Razão Social</th>
                                <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 160 }}>Documento</th>
                                <th style={{ padding: "7px 10px", textAlign: "center", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 130 }}>Vínculo</th>
                                <th style={{ padding: "7px 10px", textAlign: "center", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 80 }}>Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedGuarantors.length === 0 ? (
                                <tr>
                                  <td colSpan={5} style={{ padding: 28, textAlign: "center", color: "#94a3b8" }}>
                                    <Users size={24} style={{ opacity: 0.3, margin: "0 auto 6px", display: "block" }} />
                                    <span style={{ fontSize: 11.5 }}>
                                      Nenhum fiador ou codevedor está vinculado a contratos deste cliente.
                                    </span>
                                  </td>
                                </tr>
                              ) : (
                                selectedGuarantors.map((g, idx) => {
                                  const isPJ = g.personType === "PJ";
                                  const isCodevedor = g.role === "CODEVEDOR";
                                  return (
                                    <tr key={g.localId} style={{ background: idx % 2 === 1 ? "#fafafa" : "white" }}>
                                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9" }}>
                                        <span
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 4,
                                            padding: "2px 8px",
                                            borderRadius: 4,
                                            fontSize: 9,
                                            fontWeight: 700,
                                            background: isPJ ? "#eff6ff" : "#ecfdf5",
                                            color: isPJ ? "#1e40af" : "#065f46",
                                          }}
                                        >
                                          {isPJ ? <Building2 size={10} /> : <User size={10} />}
                                          {g.personType}
                                        </span>
                                      </td>
                                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", fontWeight: 600, color: "#0f172a" }}>
                                        {g.name}
                                      </td>
                                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: "#475569" }}>
                                        {formatGuarantorDocument(g.document, g.personType)}
                                      </td>
                                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", textAlign: "center" }}>
                                        <span
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 4,
                                            padding: "2px 8px",
                                            borderRadius: 4,
                                            fontSize: 9,
                                            fontWeight: 700,
                                            background: isCodevedor ? "#fff7ed" : "#fbf7ff",
                                            color:      isCodevedor ? "#c2410c" : "#6b21a8",
                                          }}
                                        >
                                          {isCodevedor ? <Scale size={10} /> : <UserCheck size={10} />}
                                          {isCodevedor ? "Codevedor" : "Fiador"}
                                        </span>
                                      </td>
                                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", textAlign: "center" }}>
                                        <button
                                          type="button"
                                          className="btn-icon"
                                          title="Visualizar dados"
                                          onClick={() => openGuarantorViewModal(g.id)}
                                        >
                                          <Eye size={11} style={{ color: "#2563eb" }} />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div className="keep-case" style={{ fontSize: 10.5, color: "#64748b", lineHeight: 1.5 }}>
                          Esta listagem é gerada automaticamente a partir da pivot de contratos. Para gerenciar vínculos
                          (adicionar, remover ou alterar papel) acesse o contrato correspondente na tela de Contratos.
                        </div>
                      </div>
                    );
                  })()}

                  {activeTab === "obs" && (
                    <div><Label>Observações Jurídicas e Contratuais</Label><textarea className="sigx-input" value={form.observacoesJuridicas} onChange={f("observacoesJuridicas")} rows={8} style={{ resize: "vertical" }} /></div>
                  )}

                </div>
                <div className="sigx-modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary">{editing ? "Atualizar Cliente" : "Cadastrar Cliente"}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title="Excluir Cliente"
        description="Esta ação remove permanentemente o cadastro do cliente. Contratos e históricos vinculados podem ser afetados."
        entityLabel={confirmDelete?.personType === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}
        entityName={confirmDelete?.name}
        entityDetail={confirmDelete?.document ?? undefined}
        consequences={[
          "Todos os documentos digitais do cliente serão apagados.",
          "Vínculos com fiadores serão automaticamente desfeitos.",
        ]}
        confirmLabel="Excluir Cliente"
        onConfirm={executeClientDelete}
        onClose={() => setConfirmDelete(null)}
      />

      {/* ── MODAL POPUP "FIADORES / CODEVEDORES" ──────────────────────────
          Acionado pelo ícone da nova coluna "Fiadores" da grade principal
          de Clientes. Reusa ClientGuarantorsTable, que também é usado na
          aba homônima da tela de Detalhes do Cliente. */}
      {guarantorsModal && (
        <div
          className="sigx-modal-backdrop"
          onClick={() => setGuarantorsModal(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.55)",
            zIndex: 1000,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "8vh 16px 16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(820px, 100%)",
              maxHeight: "84vh",
              background: "white",
              borderRadius: 10,
              boxShadow: "0 20px 50px rgba(2,6,23,0.25)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                background: "linear-gradient(135deg, #1e3a8a 0%, #6b21a8 100%)",
                color: "white",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Users size={18} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: 13, display: "block" }}>Fiadores / Codevedores</strong>
                <span style={{ fontSize: 11, opacity: 0.85 }}>
                  Cliente: <strong>{guarantorsModal.client.name}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setGuarantorsModal(null)}
                title="Fechar"
                style={{
                  background: "rgba(255,255,255,0.18)",
                  border: "none",
                  color: "white",
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: 18, overflowY: "auto" }}>
              <ClientGuarantorsTable data={guarantorsModal.list} compact />
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE VISUALIZAÇÃO (somente leitura) ──────────────────────
          Acionado pelo botão de olhinho na aba "Fiadores / Codevedores".
          Reusa o GuarantorQuickCreateModal em modo "view" — sem onConfirm
          ativo, pois esta tela não permite editar/criar pessoas. */}
      <GuarantorQuickCreateModal
        open={viewModalState.open}
        mode="view"
        initialValue={viewModalState.initialValue}
        onClose={() => setViewModalState({ open: false })}
        onConfirm={() => setViewModalState({ open: false })}
      />
    </UnyPayLayout>
  );
}