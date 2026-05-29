import { useState, useMemo } from "react";
import { Plus, Search, FileText, CheckCircle, X, Edit2, Trash2, Upload, Eye, Ban } from "lucide-react";
import { Head, router } from "@inertiajs/react";
import { toast } from "sonner";
import UnyPayLayout from "../Components/UnyPayLayout";
import TableGroupBadges from "../Components/TableGroupBadges";
import TableColumnPicker from "../Components/TableColumnPicker";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import {
  CONTRACTS_COLUMNS,
  CONTRACTS_GROUP_META,
  CONTRACTS_GROUP_ORDER,
  type ContractsColumnDef,
  type ContractsColumnId,
} from "../lib/contractsColumns";

const fmt = (v: number | string) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
const fmtDate = (d?: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
const fmtPct = (v: number | string) => `${(Number(v) * 100).toFixed(2)}%`;

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  "Ativo":        { bg: "#d1fae5", color: "#065f46" },
  "Inadimplente": { bg: "#fee2e2", color: "#991b1b" },
  "Quitado":      { bg: "#dbeafe", color: "#1e40af" },
  "Renegociado":  { bg: "#f3e8ff", color: "#6b21a8" },
  "Cancelado":    { bg: "#e5e7eb", color: "#4b5563" },
};

const PAGE_SIZES = [20, 50, 100];
const ACTIONS_WIDTH = 160;
const MAX_PDF_MB = 20;
const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024;

type ContractStatus = "Ativo" | "Quitado" | "Inadimplente" | "Renegociado" | "Cancelado";
type PenaltyBaseType = "installment" | "debt" | "contract";
type PenaltyScope = "per_installment" | "contract_once";

const emptyForm = {
  clientId: 0, code: "", contractName: "", creditor: "UnyPay® S.A.",
  contract_type_id: "", 
  contractType: "Mútuo/Confissão de dívida", contractDate: new Date().toISOString().slice(0, 10),
  status: "Ativo" as ContractStatus,
  validated: false, principalAmount: 0, financedTotal: 0, tacAmount: 0, iofAmount: 0,
  installmentCount: 12, installmentAmount: 0, firstDueDate: "",
  monthlyInterestRate: 0, moraRateMonthly: 0.02, penaltyRate: 0.1,
  penaltyBaseType: "installment" as PenaltyBaseType, penaltyScope: "per_installment" as PenaltyScope,
  correctionIndex: "IPCA", honoraryRate: 0, accelerates: false,
  accelerationRule: "", accelerationConsecutiveThreshold: undefined as number | undefined,
  accelerationAlternateThreshold: undefined as number | undefined,
  guarantees: "", guarantors: "",
  confessionOfDebt: false,
  forum: "",
  validationUrl: "", observations: "",
};

const TABS = [
  { key: "basico", label: "Dados Básicos" },
  { key: "financeiro", label: "Valores Financeiros" },
  { key: "taxas", label: "Taxas e Encargos" },
  { key: "garantias", label: "Garantias e Fiadores" },
  { key: "regras", label: "Regras Contratuais" },
  { key: "bancarios", label: "Dados Bancários" },
];

// Tradução amigável dos tipos de conta para exibição na aba "Dados Bancários"
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  corrente: "Corrente",
  poupanca: "Poupança",
  pagamentos: "Pagamentos",
  salario: "Conta Salário",
  conjunta: "Conta Conjunta",
};

// Lê os dados financeiros que estão guardados (JSON) na coluna `notes` do cliente
function parseClientNotes(notes: string | null | undefined): {
  bankAccounts?: Array<{ banco?: string; agencia?: string; conta?: string; tipo?: string }>;
  pixKey?: string;
} {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

// Tenta separar o código do banco do nome (formato salvo no cliente: "001 - Banco do Brasil S.A.")
function splitBank(label?: string): { code: string; name: string } {
  if (!label) return { code: "", name: "" };
  const match = label.match(/^\s*(\d{3,4})\s*[-–]\s*(.+)$/);
  if (match) return { code: match[1], name: match[2].trim() };
  return { code: "", name: label.trim() };
}

const headerCellStyle: React.CSSProperties = {
  background: "#f1f5f9", color: "#334155",
  padding: "5px 7px", fontSize: 9, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.04em",
  whiteSpace: "nowrap", borderBottom: "2px solid #cbd5e1",
};
const tdBase: React.CSSProperties = { padding: "3px 7px", borderBottom: "1px solid #f1f5f9", fontSize: 11, verticalAlign: "middle" };
const tdNum: React.CSSProperties = { ...tdBase, fontFamily: "'IBM Plex Mono',monospace", textAlign: "right" };
const tdCenter: React.CSSProperties = { ...tdBase, textAlign: "center" };

export default function Contracts({ contracts, clients, contractTypes = [], filters }: any) {
  const [search, setSearch] = useState(filters?.search || "");
  const [statusFilter, setStatusFilter] = useState(filters?.statusFilter || "Todos");
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("basico");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // 🚀 ESTADO PARA MÚLTIPLOS PDFs
  const [contractPdfFiles, setContractPdfFiles] = useState<File[]>([]);
  // Arquivos já gravados que EXISTEM fisicamente no servidor (vindos de `availablePdfs`)
  const [existingPdfs, setExistingPdfs] = useState<Array<{ index: number; name: string }>>([]);

  const [submitting, setSubmitting] = useState(false);

  // Controle de preview de múltiplos PDFs.
  // `files` carrega o índice real do PDF no servidor (após filtragem dos inexistentes)
  // junto com o nome de exibição.
  const [pdfPreview, setPdfPreview] = useState<{ id: number; code: string; files: Array<{ index: number; name: string }> } | null>(null);
  const [activePdfPos, setActivePdfPos] = useState<number>(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortCol, setSortCol] = useState<string>("code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const { visibleIds, toggleColumn, setColumnsVisible, resetDefaults } =
    useColumnVisibility<ContractsColumnId>("unypay.contracts.columns.v1", CONTRACTS_COLUMNS);

  const visibleOrdered: ContractsColumnDef[] = useMemo(
    () => CONTRACTS_COLUMNS.filter((c) => visibleIds.has(c.id)),
    [visibleIds]
  );

  // 🚀 Cliente vinculado no formulário (usado nas guias "Dados Básicos" e "Dados Bancários")
  const selectedClient = useMemo(() => {
    if (!form.clientId) return null;
    return (clients ?? []).find((c: any) => Number(c.id) === Number(form.clientId)) ?? null;
  }, [clients, form.clientId]);

  // Dados financeiros (contas/PIX) do cliente vinculado, decodificados do JSON salvo em `notes`
  const selectedClientNotes = useMemo(
    () => parseClientNotes(selectedClient?.notes),
    [selectedClient]
  );

  // 🚀 Juros Total = ((p × n) / q) - 1
  // p = Valor da Prestação (installmentAmount)
  // n = Número de Meses (installmentCount)
  // q = Valor Financiado — usamos `financedTotal` quando preenchido; caso contrário
  // caímos para `principalAmount` (campo obrigatório do formulário). Isso evita
  // que o cálculo fique zerado quando o operador só informa o Valor Principal.
  const jurosTotalInfo = useMemo(() => {
    const p = Number(form.installmentAmount) || 0;
    const n = Number(form.installmentCount) || 0;
    const financed = Number(form.financedTotal) || 0;
    const principal = Number(form.principalAmount) || 0;
    const q = financed > 0 ? financed : principal;
    const qSource: "financedTotal" | "principalAmount" | null =
      financed > 0 ? "financedTotal" : principal > 0 ? "principalAmount" : null;

    if (q <= 0 || n <= 0 || p <= 0 || !qSource) {
      return { value: null as number | null, q: 0, qSource: null as typeof qSource };
    }
    return { value: (p * n) / q - 1, q, qSource };
  }, [form.installmentAmount, form.installmentCount, form.financedTotal, form.principalAmount]);
  const jurosTotal = jurosTotalInfo.value;

  const stickyOffsets = useMemo(() => {
    const offsets = new Map<ContractsColumnId, number>();
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
    const runs: { group: typeof CONTRACTS_GROUP_ORDER[number]; count: number }[] = [];
    for (const col of visibleOrdered) {
      const last = runs[runs.length - 1];
      if (last && last.group === col.group) last.count += 1;
      else runs.push({ group: col.group, count: 1 });
    }
    return runs;
  }, [visibleOrdered]);

  const handleFilterChange = (newSearch: string, newStatus: string) => {
    router.get("/contracts", { search: newSearch, statusFilter: newStatus }, { preserveState: true, replace: true });
  };

  const resetModal = () => {
    setForm(emptyForm);
    setEditingId(null);
    setContractPdfFiles([]);
    setExistingPdfs([]);
    setActiveTab("basico");
  };

  const handleOpenCreate = () => {
    resetModal();
    setOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    const c = item.contract ?? item;
    setEditingId(c.id);
    setForm({
      clientId: Number(c.clientId ?? 0),
      code: c.code ?? "",
      contractName: c.contractName ?? "",
      creditor: c.creditor ?? "UnyPay® S.A.",
      contract_type_id: c.contract_type_id ? String(c.contract_type_id) : "",
      contractType: c.contractType ?? "Mútuo/Confissão de dívida",
      contractDate: c.contractDate ?? new Date().toISOString().slice(0, 10),
      status: (c.status ?? "Ativo") as ContractStatus,
      validated: !!c.validated,
      principalAmount: Number(c.principalAmount ?? 0),
      financedTotal: Number(c.financedTotal ?? 0),
      tacAmount: Number(c.tacAmount ?? 0),
      iofAmount: Number(c.iofAmount ?? 0),
      installmentCount: Number(c.installmentCount ?? 12),
      installmentAmount: Number(c.installmentAmount ?? 0),
      firstDueDate: c.firstDueDate ?? "",
      monthlyInterestRate: Number(c.monthlyInterestRate ?? 0),
      moraRateMonthly: Number(c.moraRateMonthly ?? 0.02),
      penaltyRate: Number(c.penaltyRate ?? 0.1),
      penaltyBaseType: (c.penaltyBaseType ?? "installment") as PenaltyBaseType,
      penaltyScope: (c.penaltyScope ?? "per_installment") as PenaltyScope,
      correctionIndex: c.correctionIndex ?? "IPCA",
      honoraryRate: Number(c.honoraryRate ?? 0),
      accelerates: !!c.accelerates,
      accelerationRule: c.accelerationRule ?? "",
      accelerationConsecutiveThreshold: c.accelerationConsecutiveThreshold ?? undefined,
      accelerationAlternateThreshold: c.accelerationAlternateThreshold ?? undefined,
      guarantees: c.guarantees ?? "",
      guarantors: c.guarantors ?? "",
      confessionOfDebt: !!c.confessionOfDebt,
      forum: c.forum ?? "",
      validationUrl: c.validationUrl ?? "",
      observations: c.observations ?? "",
    });
    setContractPdfFiles([]);

    // 🚀 `availablePdfs` vem do servidor já filtrado: contém apenas arquivos que
    // realmente existem no disco. Cada item tem { index, name } onde `index`
    // é a posição original no array salvo (necessária para a rota /pdf?index=N).
    const available: Array<{ index: number; name: string }> = Array.isArray(c.availablePdfs) ? c.availablePdfs : [];
    setExistingPdfs(available);

    setActiveTab("basico");
    setOpen(true);
  };

  // 🚀 SELEÇÃO MULTIPLA DE PDFs COM FILTRAGEM DE SEGURANÇA
  const handlePdfFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        toast.error(`O arquivo "${file.name}" não é um PDF válido.`);
        continue;
      }
      if (file.size > MAX_PDF_BYTES) {
        toast.error(`O arquivo "${file.name}" ultrapassa o limite de ${MAX_PDF_MB} MB.`);
        continue;
      }
      validFiles.push(file);
    }
    setContractPdfFiles(prev => [...prev, ...validFiles]);
    e.target.value = ""; // Reseta o input para permitir selecionar o mesmo arquivo se quiser
  };

  const buildFormData = (): FormData => {
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (typeof v === "boolean") fd.append(k, v ? "1" : "0");
      else fd.append(k, String(v));
    });
    
    // Alimenta o array de arquivos esperado pelo PHP
    contractPdfFiles.forEach((file) => {
      fd.append("contractPdfs[]", file);
    });
    return fd;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId) { toast.error("Selecione o cliente vinculado."); return; }
    setSubmitting(true);

    const url = editingId ? `/contracts/${editingId}` : "/contracts";
    const fd = buildFormData();
    if (editingId) fd.append("_method", "PUT");

    router.post(url, fd, {
      preserveState: false,
      forceFormData: true,
      onSuccess: () => {
        toast.success(editingId ? "Contrato atualizado com sucesso!" : "Contrato gravado com sucesso!");
        setOpen(false);
        resetModal();
      },
      onError: (err: any) => {
        const message = Object.values(err || {}).join(", ") || "Verifique as regras do formulário.";
        toast.error("Erro ao salvar: " + message);
      },
      onFinish: () => setSubmitting(false),
    });
  };

  const handleViewPdf = (item: any) => {
    const c = item.contract ?? item;
    // `availablePdfs` é montado no servidor após verificação física dos arquivos.
    // Se a lista estiver vazia, nem chegamos a abrir o modal de visualização.
    const available: Array<{ index: number; name: string }> = Array.isArray(c.availablePdfs) ? c.availablePdfs : [];
    if (!c.hasContractPdf || available.length === 0) {
      toast.info("Este contrato não possui minutas digitais disponíveis no servidor.");
      return;
    }

    setActivePdfPos(0);
    setPdfPreview({
      id: c.id,
      code: c.code ?? "",
      files: available,
    });
  };

  const handleDelete = (item: any) => {
    const c = item.contract ?? item;
    if (!confirm(`Excluir o contrato ${c.code}? Isso removerá permanentemente TODOS os arquivos anexos.`)) return;
    router.delete(`/contracts/${c.id}`, {
      preserveScroll: true,
      onSuccess: () => toast.success("Contrato removido."),
      onError: () => toast.error("Falha ao deletar o registro."),
    });
  };

  // 🚀 CANCELAR CONTRATO — apenas muda o status para "Cancelado" (sem apagar nada)
  const handleCancel = (item: any) => {
    const c = item.contract ?? item;
    if (c.status === "Cancelado") {
      toast.info("Este contrato já está cancelado.");
      return;
    }
    if (!confirm(`Deseja realmente cancelar o contrato ${c.code}? O status será alterado para "Cancelado".`)) return;
    router.post(`/contracts/${c.id}/cancel`, {}, {
      preserveScroll: true,
      onSuccess: () => toast.success("Contrato cancelado com sucesso."),
      onError: () => toast.error("Não foi possível cancelar o contrato."),
    });
  };

  const n = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm(p => ({ ...p, [k]: val }));
  };

  const num = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: parseFloat(e.target.value) || 0 }));
  const numI = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: parseInt(e.target.value) || 0 }));

  const filtered = useMemo(() => {
    const list = Array.isArray(contracts) ? contracts : (contracts?.data ?? []);
    return [...list]
      .filter((item: any) => {
        const q = search.toLowerCase();
        const contractObj = item.contract ?? item;
        const cName = item.clientName ?? item.client_name ?? "";
        return (
          (!search || contractObj.contractName.toLowerCase().includes(q) || contractObj.code.toLowerCase().includes(q) || cName.toLowerCase().includes(q)) &&
          (statusFilter === "Todos" || contractObj.status === statusFilter)
        );
      })
      .sort((a: any, b: any) => {
        let va: any, vb: any;
        const cA = a.contract ?? a; const cB = b.contract ?? b;
        if (sortCol === "code") { va = cA.code; vb = cB.code; }
        else if (sortCol === "client") { va = a.clientName ?? ""; vb = b.clientName ?? ""; }
        else if (sortCol === "principal") { va = +cA.principalAmount; vb = +cB.principalAmount; }
        else if (sortCol === "status") { va = cA.status; vb = cB.status; }
        else { va = cA.code; vb = cB.code; }
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [contracts, search, statusFilter, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const doSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const renderCellContent = (col: ContractsColumnDef, item: any): React.ReactNode => {
    const contract = item.contract ?? item;
    const sc = STATUS_BADGE[contract.status] ?? STATUS_BADGE["Ativo"];
    switch (col.id) {
      case "code":
        return <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "#6b7280", fontWeight: 500 }}>{contract.code}</span>;
      case "client":
        return (
          <div style={{ maxWidth: col.width - 14, fontWeight: 700, fontSize: 11, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.clientName ?? item.client_name ?? "—"}
          </div>
        );
      case "contractType":
        return (
          <span style={{ fontSize: 10, padding: "2px 6px", background: "#f3f4f6", borderRadius: 4, fontWeight: 500, color: "#4b5563" }}>
            {contract.contract_type_name ?? contract.contractType ?? "Mútuo"}
          </span>
        );
      case "contractName":
        return <span style={{ fontSize: 11, color: "#374151" }}>{contract.contractName}</span>;
      case "creditor":
        return <span style={{ fontSize: 10, color: "#6b7280" }}>{contract.creditor}</span>;
      case "principal":
        return <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, fontSize: 11 }}>{fmt(contract.principalAmount)}</span>;
      case "financed":
        return <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#6b7280" }}>{fmt(contract.financedTotal)}</span>;
      case "installments":
        return <span style={{ color: "#6b7280" }}>{contract.installmentCount}×</span>;
      case "installmentAmt":
        return <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#6b7280" }}>{fmt(contract.installmentAmount)}</span>;
      case "status":
        return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: "uppercase", background: sc.bg, color: sc.color }}>{contract.status}</span>;
      case "validated":
        return contract.validated
          ? <CheckCircle size={12} style={{ color: "#059669" }} />
          : <span style={{ color: "#9ca3af" }}>—</span>;
      case "firstDue":
        return <span style={{ fontSize: 10, whiteSpace: "nowrap" }}>{fmtDate(contract.firstDueDate)}</span>;
      case "moraRate":
        return <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10 }}>{fmtPct(contract.moraRateMonthly)}</span>;
      default:
        return null;
    }
  };

  const SortIco = ({ col }: { col: string }) => (
    <span style={{ marginLeft: 2, opacity: sortCol === col ? 1 : 0.4, fontSize: 8 }}>
      {sortCol === col ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  return (
    <UnyPayLayout>
      <Head title="Carteira de Contratos" />

      <div style={{ padding: "12px 20px 16px 20px", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", gap: 12 }}>

        {/* Topo da página */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>Contratos e Ativos</h1>
          <button onClick={handleOpenCreate}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 6, border: "none", background: "#1a2035", color: "white", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            <Plus size={12} /> Novo Contrato
          </button>
        </div>

        {/* Filtros e Picker de colunas */}
        <div style={{
          background: "white", border: "1px solid #e5e7eb", borderRadius: 6,
          padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input
                style={{ paddingLeft: 26, width: 260, fontSize: 11, height: 28, border: "1px solid #d1d5db", borderRadius: 6, outline: "none", color: "#374151" }}
                placeholder="Buscar contratos..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <select
              style={{ width: 150, fontSize: 11, height: 28, background: "white", border: "1px solid #d1d5db", borderRadius: 6, color: "#374151", cursor: "pointer", flexShrink: 0 }}
              value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); handleFilterChange(search, e.target.value); }}
            >
              <option value="Todos">Todos os status</option>
              <option value="Ativo">Ativo</option>
              <option value="Inadimplente">Inadimplente</option>
              <option value="Quitado">Quitado</option>
              <option value="Renegociado">Renegociado</option>
              <option value="Cancelado">Cancelado</option>
            </select>
            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, flexShrink: 0 }}>{filtered.length} contratos</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <TableGroupBadges
              allColumns={CONTRACTS_COLUMNS}
              groupOrder={CONTRACTS_GROUP_ORDER}
              groupMeta={CONTRACTS_GROUP_META}
              visibleIds={visibleIds}
              setColumnsVisible={setColumnsVisible}
            />
            <TableColumnPicker
              allColumns={CONTRACTS_COLUMNS}
              groupOrder={CONTRACTS_GROUP_ORDER}
              groupMeta={CONTRACTS_GROUP_META}
              visibleIds={visibleIds}
              toggleColumn={toggleColumn}
              setColumnsVisible={setColumnsVisible}
              resetDefaults={resetDefaults}
            />
          </div>
        </div>

        {/* Tabela de listagem */}
        <div style={{
          flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
          border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden", background: "white",
        }}>
          <div style={{ flex: 1, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 11, minWidth: 900 }}>
              <colgroup>
                {visibleOrdered.map(col => <col key={col.id} style={{ width: col.width }} />)}
                <col style={{ width: ACTIONS_WIDTH }} />
              </colgroup>

              <thead>
                <tr>
                  {visibleGroupRuns.map((run, i) => {
                    const meta = CONTRACTS_GROUP_META[run.group];
                    return (
                      <th
                        key={`${run.group}-${i}`}
                        colSpan={run.count}
                        style={{
                          background: meta.bg, color: meta.color,
                          textAlign: "center", padding: "4px 8px",
                          fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                          textTransform: "uppercase",
                        }}
                      >
                        {meta.label}
                      </th>
                    );
                  })}
                  <th style={{ background: "#1e2139", color: "white", textAlign: "center", padding: "4px 8px", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Ações
                  </th>
                </tr>
                <tr>
                  {visibleOrdered.map(col => {
                    const stickyStyle: React.CSSProperties = col.sticky
                      ? { position: "sticky", left: stickyOffsets.get(col.id), zIndex: 2, background: "#f1f5f9" }
                      : {};
                    const clickable = !!col.sortable;
                    return (
                      <th
                        key={col.id}
                        onClick={clickable ? () => doSort(col.sortKey || col.id) : undefined}
                        style={{
                          ...headerCellStyle,
                          textAlign: col.align,
                          cursor: clickable ? "pointer" : "default",
                          ...stickyStyle,
                        }}
                      >
                        {col.label.toUpperCase()}
                        {clickable && <SortIco col={col.sortKey || col.id} />}
                      </th>
                    );
                  })}
                  <th style={{ ...headerCellStyle, textAlign: "center" }}>AÇÕES</th>
                </tr>
              </thead>

              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={visibleOrdered.length + 1} style={{ textAlign: "center", padding: 48, color: "#9ca3af" }}>
                      <FileText size={28} style={{ margin: "0 auto 8px", display: "block", opacity: 0.2 }} /> Nenhum contrato encontrado
                    </td>
                  </tr>
                ) : (
                  paginated.map((item: any, rowIdx: number) => {
                    const rowBg = rowIdx % 2 === 1 ? "#fafafa" : "white";
                    const c = item.contract ?? item;
                    const hasPdf = !!c.hasContractPdf;
                    return (
                      <tr key={c.id} style={{ background: rowBg }}
                        onMouseOver={e => (e.currentTarget.style.background = "#eff6ff")}
                        onMouseOut={e => (e.currentTarget.style.background = rowBg)}
                      >
                        {visibleOrdered.map(col => {
                          const stickyStyle: React.CSSProperties = col.sticky
                            ? { position: "sticky", left: stickyOffsets.get(col.id), zIndex: 1, background: "inherit" }
                            : {};
                          const base = col.align === "right" ? tdNum : col.align === "center" ? tdCenter : tdBase;
                          return (
                            <td key={col.id} style={{ ...base, ...stickyStyle }}>
                              {renderCellContent(col, item)}
                            </td>
                          );
                        })}
                        <td style={tdCenter}>
                          <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                            {/* 🚀 ICONE DE DOCUMENTO (ABRE VIEWER MULTI-PDF) */}
                            <button
                              className="btn-icon"
                              title={hasPdf ? "Visualizar PDFs anexados" : "Nenhum PDF disponível no servidor"}
                              onClick={() => handleViewPdf(item)}
                              disabled={!hasPdf}
                              style={{ opacity: hasPdf ? 1 : 0.4, cursor: hasPdf ? "pointer" : "not-allowed" }}
                            >
                              <FileText size={11} />
                            </button>

                            <button className="btn-icon" title="Editar contrato" onClick={() => handleOpenEdit(item)}>
                              <Edit2 size={11} />
                            </button>

                            {/* 🚀 CANCELAR CONTRATO — altera somente o status */}
                            <button
                              className="btn-icon"
                              title={c.status === "Cancelado" ? "Contrato já cancelado" : "Cancelar contrato"}
                              onClick={() => handleCancel(item)}
                              disabled={c.status === "Cancelado"}
                              style={{
                                color: "#b45309",
                                opacity: c.status === "Cancelado" ? 0.4 : 1,
                                cursor: c.status === "Cancelado" ? "not-allowed" : "pointer",
                              }}
                            >
                              <Ban size={11} />
                            </button>

                            <button className="btn-icon" title="Excluir contrato" onClick={() => handleDelete(item)} style={{ color: "#dc2626" }}>
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

          {/* Paginação da tabela */}
          <div style={{
            padding: "6px 12px", background: "#fafbfc", borderTop: "1px solid #e5e7eb",
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6b7280" }}>
              <span>Exibir</span>
              <select style={{ padding: "2px 6px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 11, background: "white" }} value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(1); }}>
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <span>por página</span>
            </div>
            <span style={{ fontSize: 11, color: "#6b7280" }}>
              Mostrando {Math.min((page - 1) * pageSize + 1, filtered.length)}–{Math.min(page * pageSize, filtered.length)} de {filtered.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: "3px 10px", border: "1px solid #d1d5db", borderRadius: 4, background: "white", fontSize: 11, cursor: page === 1 ? "not-allowed" : "pointer" }}>
                ← Anterior
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button type="button" key={i} onClick={() => setPage(i + 1)}
                  style={{
                    width: 28, height: 26, borderRadius: 4, border: "1px solid",
                    fontSize: 11, background: i + 1 === page ? "#1a2035" : "white",
                    color: i + 1 === page ? "white" : "#374151",
                    borderColor: i + 1 === page ? "#1a2035" : "#d1d5db",
                    fontWeight: i + 1 === page ? 700 : 400, cursor: "pointer"
                  }}>
                  {i + 1}
                </button>
              ))}
              <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                style={{ padding: "3px 10px", border: "1px solid #d1d5db", borderRadius: 4, background: "white", fontSize: 11, cursor: page >= totalPages ? "not-allowed" : "pointer" }}>
                Próxima →
              </button>
            </div>
          </div>
        </div>

        {/* Modal Cadastro / Edição */}
        {open && (
          <div className="sigx-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
            <div className="sigx-modal" style={{ maxWidth: 860 }} onMouseDown={e => e.stopPropagation()}>
              <div className="sigx-modal-header">
                <span className="sigx-modal-title">{editingId ? "Editar Contrato" : "Novo Contrato"}</span>
                <button type="button" onClick={() => { setOpen(false); resetModal(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", display: "flex" }}><X size={18} /></button>
              </div>
              <div className="sigx-tabs" style={{ display: "flex", gap: 2, background: "#f3f4f6", padding: 4 }}>
                {TABS.map(tab => (
                  <div key={tab.key} className={`sigx-tab${activeTab === tab.key ? " active" : ""}`} onClick={() => setActiveTab(tab.key)}
                    style={{ padding: "6px 12px", fontSize: 11, cursor: "pointer", borderRadius: 4, background: activeTab === tab.key ? "white" : "transparent", fontWeight: activeTab === tab.key ? 700 : 400 }}>
                    {tab.label}
                  </div>
                ))}
              </div>
              <form onSubmit={handleSubmit}>
                <div className="sigx-modal-body" style={{ padding: 20, maxHeight: "55vh", overflowY: "auto" }}>
                  {activeTab === "basico" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div style={{ gridColumn: "span 2" }}>
                        <label className="sigx-label">CLIENTE *</label>
                        <select className="sigx-input" value={String(form.clientId || "")} onChange={e => setForm(p => ({ ...p, clientId: Number(e.target.value) }))}>
                          <option value="">Selecione o cliente</option>
                          {clients?.map((c: any) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                        </select>
                      </div>

                      {/* 🚀 Campos do cliente vinculado (somente exibição, vindos do CRUD de Clientes) */}
                      <div>
                        <label className="sigx-label">CNPJ/CPF</label>
                        <input
                          className="sigx-input"
                          value={selectedClient?.document ?? ""}
                          readOnly
                          placeholder={selectedClient ? "—" : "Selecione um cliente"}
                          style={{ background: "#f9fafb", color: "#4b5563" }}
                        />
                      </div>
                      <div>
                        <label className="sigx-label">CEP</label>
                        <input
                          className="sigx-input"
                          value={selectedClient?.zipCode ?? ""}
                          readOnly
                          placeholder={selectedClient ? "—" : "Selecione um cliente"}
                          style={{ background: "#f9fafb", color: "#4b5563" }}
                        />
                      </div>
                      <div style={{ gridColumn: "span 2" }}>
                        <label className="sigx-label">ENDEREÇO</label>
                        <input
                          className="sigx-input"
                          value={
                            selectedClient
                              ? [selectedClient.address, selectedClient.city, selectedClient.state]
                                  .filter(Boolean)
                                  .join(" — ")
                              : ""
                          }
                          readOnly
                          placeholder={selectedClient ? "—" : "Selecione um cliente"}
                          style={{ background: "#f9fafb", color: "#4b5563" }}
                        />
                      </div>

                      <div><label className="sigx-label">CÓDIGO *</label><input className="sigx-input" value={form.code} onChange={n("code")} required placeholder="Ex: BeloSanta1" /></div>
                      <div><label className="sigx-label">DATA DO CONTRATO</label><input type="date" className="sigx-input" value={form.contractDate} onChange={n("contractDate")} /></div>
                      <div style={{ gridColumn: "span 2" }}><label className="sigx-label">NOME DO CONTRATO *</label><input className="sigx-input" value={form.contractName} onChange={n("contractName")} required /></div>
                      <div><label className="sigx-label">CREDOR *</label><input className="sigx-input" value={form.creditor} onChange={n("creditor")} required /></div>
                      <div>
                        <label className="sigx-label">TIPO DE CONTRATO *</label>
                        <select className="sigx-input" required value={form.contract_type_id} onChange={e => setForm(p => ({ ...p, contract_type_id: e.target.value }))}>
                          <option value="">Selecione o Tipo...</option>
                          {contractTypes.map((type: any) => (
                            <option key={type.id} value={type.id}>{type.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="sigx-label">STATUS</label>
                        <select className="sigx-input" value={form.status} onChange={n("status") as any}>
                          {["Ativo", "Quitado", "Inadimplente", "Renegociado", "Cancelado"].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}>
                        <input type="checkbox" id="validated" checked={form.validated} onChange={e => setForm(p => ({ ...p, validated: e.target.checked }))} style={{ width: 14, height: 14 }} />
                        <label htmlFor="validated" className="sigx-label" style={{ marginBottom: 0, cursor: "pointer" }}>Contrato validado digitalmente</label>
                      </div>
                      <div style={{ gridColumn: "span 2" }}><label className="sigx-label">URL DE VALIDAÇÃO</label><input className="sigx-input" value={form.validationUrl} onChange={n("validationUrl")} placeholder="https://valida.ae/..." /></div>

                      {/* 🚀 GERENCIADOR DE MÚLTIPLOS COMPONENTES DE PDF */}
                      <div style={{ gridColumn: "span 2" }}>
                        <label className="sigx-label">ANEXAR DOCUMENTOS E ADITIVOS DO CONTRATO (PDF)</label>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <label
                            htmlFor="contract-pdf-input"
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "6px 12px", borderRadius: 6, cursor: "pointer",
                              background: "#f3f4f6", border: "1px solid #d1d5db",
                              fontSize: 11, fontWeight: 600, color: "#374151",
                            }}
                          >
                            <Upload size={12} /> Adicionar PDFs
                          </label>
                          <input
                            id="contract-pdf-input"
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={handlePdfFilesChange}
                            multiple // 👈 PERMITE SELECIONAR VÁRIOS ARQUIVOS JUNTOS
                            style={{ display: "none" }}
                          />
                        </div>

                        {/* Listagem temporária dos arquivos recém-selecionados */}
                        {contractPdfFiles.length > 0 && (
                          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#065f46" }}>NOVOS DOCUMENTOS SELECIONADOS:</span>
                            {contractPdfFiles.map((file, idx) => (
                              <span key={idx} style={{ fontSize: 11, color: "#065f46", display: "inline-flex", alignItems: "center", gap: 4, background: "#ecfdf5", padding: "2px 6px", borderRadius: 4, width: "fit-content" }}>
                                <FileText size={12} /> {file.name}
                                <button type="button" onClick={() => setContractPdfFiles(prev => prev.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex" }}>
                                  <X size={11} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Listagem dos arquivos que já estão salvos e existem no disco do servidor */}
                        {existingPdfs.length > 0 && (
                          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#4b5563" }}>DOCUMENTOS JÁ ARQUIVADOS:</span>
                            {existingPdfs.map((file, pos) => (
                              <span key={`${file.index}-${pos}`} style={{ fontSize: 11, color: "#4b5563", display: "inline-flex", alignItems: "center", gap: 4, background: "#f3f4f6", padding: "2px 6px", borderRadius: 4, width: "fit-content" }}>
                                <FileText size={12} /> {file.name}
                                {editingId && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActivePdfPos(pos);
                                      setPdfPreview({ id: editingId, code: form.code, files: existingPdfs });
                                    }}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "#2563eb", display: "flex" }}
                                    title="Visualizar este PDF específico"
                                  >
                                    <Eye size={11} />
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                        <span style={{ fontSize: 10, color: "#9ca3af", marginTop: 6, display: "block" }}>
                          Tamanho máximo: {MAX_PDF_MB} MB por arquivo. Você pode carregar quantos aditivos ou PDFs forem necessários.
                        </span>
                      </div>
                    </div>
                  )}
                  {activeTab === "financeiro" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                      <div><label className="sigx-label">VALOR PRINCIPAL (R$) *</label><input type="number" step="0.01" className="sigx-input" value={form.principalAmount || ""} onChange={num("principalAmount")} required /></div>
                      <div><label className="sigx-label">TOTAL FINANCIADO (R$)</label><input type="number" step="0.01" className="sigx-input" value={form.financedTotal || ""} onChange={num("financedTotal")} /></div>
                      <div><label className="sigx-label">TAC (R$)</label><input type="number" step="0.01" className="sigx-input" value={form.tacAmount || ""} onChange={num("tacAmount")} /></div>
                      <div><label className="sigx-label">IOF (R$)</label><input type="number" step="0.01" className="sigx-input" value={form.iofAmount || ""} onChange={num("iofAmount")} /></div>
                      <div><label className="sigx-label">Nº DE PARCELAS *</label><input type="number" min="1" className="sigx-input" value={form.installmentCount} onChange={numI("installmentCount")} required /></div>
                      <div><label className="sigx-label">VALOR DA PARCELA (R$) *</label><input type="number" step="0.01" className="sigx-input" value={form.installmentAmount || ""} onChange={num("installmentAmount")} required /></div>
                      <div><label className="sigx-label">PRIMEIRO VENCIMENTO</label><input type="date" className="sigx-input" value={form.firstDueDate} onChange={n("firstDueDate")} /></div>
                      <div><label className="sigx-label">JUROS MENSAL (%)</label><input type="number" step="0.001" className="sigx-input" value={(form.monthlyInterestRate * 100).toFixed(3)} onChange={e => setForm(p => ({ ...p, monthlyInterestRate: parseFloat(e.target.value) / 100 || 0 }))} /></div>
                    </div>
                  )}
                  {activeTab === "taxas" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                      <div><label className="sigx-label">MORA MENSAL (%)</label><input type="number" step="0.001" className="sigx-input" value={(form.moraRateMonthly * 100).toFixed(3)} onChange={e => setForm(p => ({ ...p, moraRateMonthly: parseFloat(e.target.value) / 100 || 0 }))} /></div>
                      <div><label className="sigx-label">MULTA (%)</label><input type="number" step="0.001" className="sigx-input" value={(form.penaltyRate * 100).toFixed(3)} onChange={e => setForm(p => ({ ...p, penaltyRate: parseFloat(e.target.value) / 100 || 0 }))} /></div>
                      <div><label className="sigx-label">HONORÁRIOS (%)</label><input type="number" step="0.001" className="sigx-input" value={(form.honoraryRate * 100).toFixed(3)} onChange={e => setForm(p => ({ ...p, honoraryRate: parseFloat(e.target.value) / 100 || 0 }))} /></div>
                      <div>
                        <label className="sigx-label">BASE DA MULTA</label>
                        <select className="sigx-input" value={form.penaltyBaseType} onChange={n("penaltyBaseType") as any}>
                          <option value="installment">Parcela</option><option value="debt">Débito atualizado</option><option value="contract">Contrato</option>
                        </select>
                      </div>
                      <div>
                        <label className="sigx-label">ESCOPO DA MULTA</label>
                        <select className="sigx-input" value={form.penaltyScope} onChange={n("penaltyScope") as any}>
                          <option value="per_installment">Por parcela</option><option value="contract_once">Uma vez no contrato</option>
                        </select>
                      </div>
                      <div>
                        <label className="sigx-label">CORREÇÃO MONETÁRIA</label>
                        <select className="sigx-input" value={form.correctionIndex} onChange={n("correctionIndex")}>
                          <option value="IPCA">IPCA</option><option value="IGPM">IGPM</option><option value="Nenhuma">Nenhuma</option>
                        </select>
                      </div>

                      {/* 🚀 JUROS TOTAL — calculado automaticamente: ((p × n) / q) - 1 */}
                      <div style={{ gridColumn: "span 3", marginTop: 6, padding: 12, borderRadius: 6, background: "#f8fafc", border: "1px dashed #cbd5e1" }}>
                        <label className="sigx-label" style={{ color: "#1e293b" }}>JUROS TOTAL (CALCULADO)</label>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <input
                            className="sigx-input mono"
                            readOnly
                            value={jurosTotal === null ? "" : fmtPct(jurosTotal)}
                            placeholder="Preencha o Valor Principal (ou Total Financiado), Nº de Parcelas e Valor da Parcela"
                            style={{ background: "white", color: "#0f172a", fontWeight: 700, maxWidth: 220 }}
                          />
                          <span style={{ fontSize: 10, color: "#475569", lineHeight: 1.45 }}>
                            Fórmula: <strong>((p × n) ÷ q) − 1</strong><br />
                            p = valor da parcela = <strong>{fmt(form.installmentAmount || 0)}</strong>&nbsp;|&nbsp;
                            n = nº de meses = <strong>{form.installmentCount || 0}</strong>&nbsp;|&nbsp;
                            q = valor financiado = <strong>{fmt(jurosTotalInfo.q)}</strong>
                            {jurosTotalInfo.qSource === "principalAmount" && (
                              <em style={{ color: "#92400e" }}> (usando Valor Principal — preencha Total Financiado para sobrescrever)</em>
                            )}
                            {jurosTotalInfo.qSource === "financedTotal" && (
                              <em style={{ color: "#065f46" }}> (usando Total Financiado)</em>
                            )}
                            <br />
                            Total pago no contrato = p × n = <strong>{fmt((form.installmentAmount || 0) * (form.installmentCount || 0))}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {activeTab === "garantias" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div style={{ gridColumn: "span 2" }}><label className="sigx-label">GARANTIAS REAIS</label><textarea className="sigx-input" value={form.guarantees} onChange={n("guarantees")} rows={3} /></div>
                      <div style={{ gridColumn: "span 2" }}><label className="sigx-label">FIADORES</label><textarea className="sigx-input" value={form.guarantors} onChange={n("guarantors")} rows={3} /></div>

                      {/* 🚀 CONFISSÃO DE DÍVIDA */}
                      <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                        <input
                          type="checkbox"
                          id="confessionOfDebt"
                          checked={form.confessionOfDebt}
                          onChange={e => setForm(p => ({ ...p, confessionOfDebt: e.target.checked }))}
                          style={{ width: 14, height: 14 }}
                        />
                        <label htmlFor="confessionOfDebt" className="sigx-label" style={{ marginBottom: 0, cursor: "pointer" }}>
                          Contrato contém cláusula de Confissão de Dívida
                        </label>
                      </div>

                      <div style={{ gridColumn: "span 2" }}><label className="sigx-label">OBSERVAÇÕES</label><textarea className="sigx-input" value={form.observations} onChange={n("observations")} rows={3} /></div>
                    </div>
                  )}
                  {activeTab === "regras" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="checkbox" id="accelerates" checked={form.accelerates} onChange={e => setForm(p => ({ ...p, accelerates: e.target.checked }))} style={{ width: 14, height: 14 }} />
                        <label htmlFor="accelerates" className="sigx-label" style={{ marginBottom: 0, cursor: "pointer" }}>Vencimento antecipado habilitado</label>
                      </div>
                      {form.accelerates && (
                        <>
                          <div><label className="sigx-label">PARCELAS CONSECUTIVAS</label><input type="number" min="1" className="sigx-input" value={form.accelerationConsecutiveThreshold ?? ""} onChange={e => setForm(p => ({ ...p, accelerationConsecutiveThreshold: parseInt(e.target.value) || undefined }))} /></div>
                          <div><label className="sigx-label">PARCELAS ALTERNADAS</label><input type="number" min="1" className="sigx-input" value={form.accelerationAlternateThreshold ?? ""} onChange={e => setForm(p => ({ ...p, accelerationAlternateThreshold: parseInt(e.target.value) || undefined }))} /></div>
                          <div style={{ gridColumn: "span 2" }}><label className="sigx-label">REGRA DE ATRASO (TEXTO)</label><textarea className="sigx-input" value={form.accelerationRule} onChange={n("accelerationRule")} rows={3} /></div>
                        </>
                      )}

                      {/* 🚀 FORO */}
                      <div style={{ gridColumn: "span 2" }}>
                        <label className="sigx-label">FORO</label>
                        <input
                          className="sigx-input"
                          value={form.forum}
                          onChange={n("forum")}
                          placeholder="Ex: Comarca de São Paulo / SP"
                        />
                      </div>
                    </div>
                  )}

                  {/* 🚀 NOVA GUIA - DADOS BANCÁRIOS (somente exibição, vindos do cliente) */}
                  {activeTab === "bancarios" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {!selectedClient && (
                        <div style={{ padding: 12, background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 6, fontSize: 11, color: "#92400e" }}>
                          Selecione um cliente na guia <strong>Dados Básicos</strong> para visualizar os dados bancários.
                        </div>
                      )}

                      {selectedClient && (
                        <>
                          <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic" }}>
                            Estes dados são <strong>somente leitura</strong> e refletem o que está cadastrado na guia
                            <em> Dados Financeiros</em> do cliente <strong>{selectedClient.name}</strong>.
                          </div>

                          {(!selectedClientNotes.bankAccounts || selectedClientNotes.bankAccounts.length === 0) && (
                            <div style={{ padding: 12, background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 11, color: "#6b7280" }}>
                              Este cliente ainda não possui contas bancárias cadastradas.
                            </div>
                          )}

                          {selectedClientNotes.bankAccounts?.map((acc, idx) => {
                            const { code, name } = splitBank(acc.banco);
                            const tipoLabel = ACCOUNT_TYPE_LABELS[(acc.tipo || "").toLowerCase()] ?? acc.tipo ?? "—";
                            return (
                              <div key={idx} style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 6, background: "#fafafa" }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                                  Conta Bancária {idx + 1}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                                  <div>
                                    <label className="sigx-label">CÓDIGO BANCO</label>
                                    <input className="sigx-input mono" value={code} readOnly style={{ background: "white", color: "#4b5563" }} />
                                  </div>
                                  <div style={{ gridColumn: "span 2" }}>
                                    <label className="sigx-label">NOME BANCO</label>
                                    <input className="sigx-input" value={name} readOnly style={{ background: "white", color: "#4b5563" }} />
                                  </div>
                                  <div>
                                    <label className="sigx-label">AGÊNCIA</label>
                                    <input className="sigx-input mono" value={acc.agencia ?? ""} readOnly style={{ background: "white", color: "#4b5563" }} />
                                  </div>
                                  <div>
                                    <label className="sigx-label">Nº CONTA</label>
                                    <input className="sigx-input mono" value={acc.conta ?? ""} readOnly style={{ background: "white", color: "#4b5563" }} />
                                  </div>
                                  <div>
                                    <label className="sigx-label">TIPO CONTA</label>
                                    <input className="sigx-input" value={tipoLabel} readOnly style={{ background: "white", color: "#4b5563" }} />
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          <div style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 6, background: "#fafafa" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                              PIX
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                              <div>
                                <label className="sigx-label">CHAVE PIX</label>
                                <input
                                  className="sigx-input mono"
                                  value={selectedClientNotes.pixKey ?? ""}
                                  readOnly
                                  placeholder="—"
                                  style={{ background: "white", color: "#4b5563" }}
                                />
                              </div>
                              <div>
                                <label className="sigx-label">PIX</label>
                                <input
                                  className="sigx-input"
                                  value={selectedClientNotes.pixKey ? "Cadastrado" : "Não cadastrado"}
                                  readOnly
                                  style={{ background: "white", color: selectedClientNotes.pixKey ? "#065f46" : "#9ca3af", fontWeight: 600 }}
                                />
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="sigx-modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => { setOpen(false); resetModal(); }} disabled={submitting}>Cancelar</button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? "Salvando..." : (editingId ? "Atualizar Contrato" : "Salvar Contrato")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 🚀 VISUALIZADOR AVANÇADO SPLIT-SCREEN PARA MÚLTIPLOS PDFs */}
        {pdfPreview && (
          <div className="sigx-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setPdfPreview(null); }}>
            <div
              className="sigx-modal"
              style={{
                width: "min(1250px, 96vw)",
                maxWidth: "96vw",
                height: "92vh",
                display: "flex",
                flexDirection: "column",
                padding: 0,
              }}
              onMouseDown={e => e.stopPropagation()}
            >
              {/* Topo do Visualizador */}
              <div className="sigx-modal-header" style={{ flexShrink: 0 }}>
                <span className="sigx-modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FileText size={14} />
                  Documentos Digitais — Contrato {pdfPreview.code}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* 🚀 BOTÃO "VER COMPLETO" EM NOVA ABA */}
                  <a
                    href={`/contracts/${pdfPreview.id}/pdf?index=${pdfPreview.files[activePdfPos]?.index ?? 0}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                    style={{ fontSize: 11, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                    title="Abrir o PDF selecionado em tamanho completo"
                  >
                    <Upload size={11} style={{ transform: "rotate(180deg)" }} /> Ver Completo / Imprimir
                  </a>
                  <button type="button" onClick={() => setPdfPreview(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", display: "flex" }} title="Fechar">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Corpo Split (Abas na Esquerda, Visualização na Direita) */}
              <div style={{ flex: 1, minHeight: 0, display: "flex", background: "#1f2937" }}>
                
                {/* Menu lateral esquerdo de abas de arquivos (somente os existentes no servidor) */}
                <div style={{ width: 250, background: "#111827", borderRight: "1px solid #374151", padding: 12, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.05em", marginBottom: 6 }}>ARQUIVOS COMPONENTES:</span>
                  {pdfPreview.files.map((file, pos) => (
                    <button
                      key={`${file.index}-${pos}`}
                      type="button"
                      onClick={() => setActivePdfPos(pos)}
                      style={{
                        width: "100%", padding: "10px 12px", borderRadius: 4, border: "none",
                        textAlign: "left", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                        background: activePdfPos === pos ? "#2563eb" : "#1f2937",
                        color: activePdfPos === pos ? "white" : "#d1d5db",
                        transition: "all 0.1s"
                      }}
                    >
                      <FileText size={12} style={{ flexShrink: 0, color: activePdfPos === pos ? "white" : "#9ca3af" }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={file.name}>
                        {file.name}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Área Dinâmica do Iframe carregando o index real do servidor */}
                <div style={{ flex: 1, height: "100%", background: "#1f2937" }}>
                  <iframe
                    key={`${pdfPreview.id}-${activePdfPos}`}
                    src={`/contracts/${pdfPreview.id}/pdf?index=${pdfPreview.files[activePdfPos]?.index ?? 0}#toolbar=1&navpanes=0&view=FitH`}
                    title={`Visualizador do PDF ${pdfPreview.files[activePdfPos]?.name ?? ""}`}
                    style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                  />
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </UnyPayLayout>
  );
}