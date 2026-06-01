import { useState, useMemo } from "react";
import { Plus, Search, FileText, CheckCircle, X, Edit2, Trash2, Upload, Eye, CreditCard, QrCode, UserCheck, Scale } from "lucide-react";
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
const ACTIONS_WIDTH = 132;
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
  guarantees: "", guarantors: "", validationUrl: "", observations: "",
  chosenBankAccount: "",
  paymentMethod: "Boleto Bancário",
  forumLocation: "Belo Horizonte / MG", 
};

const TABS = [
  { key: "basico", label: "Dados Básicos" },
  { key: "financeiro", label: "Valores e Bancos" }, 
  { key: "taxas", label: "Taxas e Encargos" },
  { key: "garantias", label: "Garantias e Fiadores" },
  { key: "regras", label: "Regras Contratuais" },
];

const headerCellStyle: React.CSSProperties = {
  background: "#f1f5f9", color: "#334155",
  padding: "5px 7px", fontSize: 9, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.04em",
  whiteSpace: "nowrap", borderBottom: "2px solid #cbd5e1",
};
const tdBase: React.CSSProperties = { padding: "3px 7px", borderBottom: "1px solid #f1f5f9", fontSize: 11, verticalAlign: "middle" };
// 🛠️ FIX 1: Recolocada a constante tdNum para formatação alinhada à direita dos valores financeiros
const tdNum: React.CSSProperties = { ...tdBase, fontFamily: "'IBM Plex Mono',monospace", textAlign: "right" };
const tdCenter: React.CSSProperties = { ...tdBase, textAlign: "center" };

export default function Contracts({ contracts, clients, contractTypes = [], filters }: any) {
  const [search, setSearch] = useState(filters?.search || "");
  const [statusFilter, setStatusFilter] = useState(filters?.statusFilter || "Todos");
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("basico");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [contractPdfFiles, setContractPdfFiles] = useState<File[]>([]);
  const [existingPdfNames, setExistingPdfNames] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  const [pdfPreview, setPdfPreview] = useState<{ id: number; code: string; names: string[] } | null>(null);
  const [activePdfIndex, setActivePdfIndex] = useState<number>(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortCol, setSortCol] = useState<string>("code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const selectedClientMeta = useMemo(() => {
    if (!form.clientId) return null;
    const clientFound = clients?.find((c: any) => c.id === form.clientId);
    if (!clientFound || !clientFound.notes) return null;
    try { return JSON.parse(clientFound.notes); } catch { return null; }
  }, [form.clientId, clients]);

  const { visibleIds, toggleColumn, setColumnsVisible, resetDefaults } =
    useColumnVisibility<ContractsColumnId>("unypay.contracts.columns.v1", CONTRACTS_COLUMNS);

  const visibleOrdered: ContractsColumnDef[] = useMemo(
    () => CONTRACTS_COLUMNS.filter((c) => visibleIds.has(c.id)),
    [visibleIds]
  );

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
    setPage(1);
    router.get("/contracts", { search: newSearch, statusFilter: newStatus }, { preserveState: true, replace: true });
  };

  const resetModal = () => {
    setForm(emptyForm);
    setEditingId(null);
    setContractPdfFiles([]);
    setExistingPdfNames([]);
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
      validationUrl: c.validationUrl ?? "",
      observations: c.observations ?? "",
      chosenBankAccount: c.chosenBankAccount ?? "",
      paymentMethod: c.paymentMethod ?? "Boleto Bancário",
      forumLocation: c.forumLocation ?? "Belo Horizonte / MG",
    });
    setContractPdfFiles([]);
    
    try {
      const decodedNames = JSON.parse(c.sourcePdfName || "[]");
      setExistingPdfNames(Array.isArray(decodedNames) ? decodedNames : []);
    } catch {
      setExistingPdfNames(c.sourcePdfName ? [c.sourcePdfName] : []);
    }

    setActiveTab("basico");
    setOpen(true);
  };

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
    e.target.value = "";
  };

  const buildFormData = (): FormData => {
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (typeof v === "boolean") fd.append(k, v ? "1" : "0");
      else fd.append(k, String(v));
    });
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
    if (!c.hasContractPdf) {
      toast.info("Este contrato não possui minutas digitais anexadas.");
      return;
    }
    let decodedNames: string[] = [];
    try { decodedNames = JSON.parse(c.sourcePdfName || "[]"); } catch { decodedNames = [c.sourcePdfName || "documento.pdf"]; }
    setActivePdfIndex(0);
    setPdfPreview({ id: c.id, code: c.code ?? "", names: decodedNames });
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
        const cName = item.client_name ?? item.clientName ?? "";
        return (
          (!search || contractObj.contractName.toLowerCase().includes(q) || contractObj.code.toLowerCase().includes(q) || cName.toLowerCase().includes(q)) &&
          (statusFilter === "Todos" || contractObj.status === statusFilter)
        );
      })
      .sort((a: any, b: any) => {
        let va: any, vb: any;
        const cA = a.contract ?? a; const cB = b.contract ?? b;
        if (sortCol === "code") { va = cA.code; vb = cB.code; }
        else if (sortCol === "client") { va = a.client_name ?? a.clientName ?? ""; vb = b.client_name ?? b.clientName ?? ""; }
        else if (sortCol === "principal") { va = +cA.principalAmount; vb = +cB.principalAmount; }
        else if (sortCol === "status") { va = cA.status; vb = cB.status; }
        else { va = cA.code; vb = cB.code; }
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [contracts, search, statusFilter, sortCol, sortDir]);

  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const renderCellContent = (col: ContractsColumnDef, item: any): React.ReactNode => {
    const contract = item.contract ?? item;
    const sc = STATUS_BADGE[contract.status] ?? STATUS_BADGE["Ativo"];
    switch (col.id) {
      case "code": return <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "#6b7280", fontWeight: 500 }}>{contract.code}</span>;
      case "client": return <div style={{ maxWidth: col.width - 14, fontWeight: 700, fontSize: 11, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.client_name ?? item.clientName ?? "—"}</div>;
      case "contractType": return <span style={{ fontSize: 10, padding: "2px 6px", background: "#f3f4f6", borderRadius: 4, fontWeight: 500, color: "#4b5563" }}>{contract.contract_type_name ?? contract.contractType ?? "Mútuo"}</span>;
      case "contractName": return <span style={{ fontSize: 11, color: "#374151" }}>{contract.contractName}</span>;
      case "creditor": return <span style={{ fontSize: 10, color: "#6b7280" }}>{contract.creditor}</span>;
      case "principal": return <span style={{ ...tdNum, fontWeight: 700, fontSize: 11 }}>{fmt(contract.principalAmount)}</span>;
      case "financed": return <span style={{ ...tdNum, fontSize: 11, color: "#6b7280" }}>{fmt(contract.financedTotal)}</span>;
      case "installments": return <span style={{ color: "#6b7280" }}>{contract.installmentCount}×</span>;
      case "installmentAmt": return <span style={{ ...tdNum, fontSize: 11, color: "#6b7280" }}>{fmt(contract.installmentAmount)}</span>;
      case "status": return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: "uppercase", background: sc.bg, color: sc.color }}>{contract.status}</span>;
      case "validated": return contract.validated ? <CheckCircle size={12} style={{ color: "#059669" }} /> : <span style={{ color: "#9ca3af" }}>—</span>;
      case "firstDue": return <span style={{ fontSize: 10, whiteSpace: "nowrap" }}>{fmtDate(contract.firstDueDate)}</span>;
      case "moraRate": return <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10 }}>{fmtPct(contract.moraRateMonthly)}</span>;
      default: return null;
    }
  };

  return (
    <UnyPayLayout>
      <Head title="Carteira de Contratos" />

      <div style={{ padding: "12px 20px 16px 20px", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", gap: 12 }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>Contratos e Ativos</h1>
          <button onClick={handleOpenCreate} className="btn-primary" style={{ padding: "6px 14px", fontSize: 11 }}>
            <Plus size={12} /> Novo Contrato
          </button>
        </div>

        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input style={{ paddingLeft: 26, width: 260, fontSize: 11, height: 28, border: "1px solid #d1d5db", borderRadius: 6, outline: "none", color: "#374151" }} placeholder="Buscar contratos..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <select style={{ width: 150, fontSize: 11, height: 28, background: "white", border: "1px solid #d1d5db", borderRadius: 6, color: "#374151", cursor: "pointer", flexShrink: 0 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); handleFilterChange(search, e.target.value); }}>
              <option value="Todos">Todos os status</option>
              <option value="Ativo">Ativo</option>
              <option value="Inadimplente">Inadimplente</option>
              <option value="Quitado">Quitado</option>
              <option value="Renegociado">Renegociado</option>
              <option value="Cancelado">Cancelado</option>
            </select>
            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, flexShrink: 0 }}>{totalRows} contratos</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <TableGroupBadges allColumns={CONTRACTS_COLUMNS} groupOrder={CONTRACTS_GROUP_ORDER} groupMeta={CONTRACTS_GROUP_META} visibleIds={visibleIds} setColumnsVisible={setColumnsVisible} />
            <TableColumnPicker allColumns={CONTRACTS_COLUMNS} groupOrder={CONTRACTS_GROUP_ORDER} groupMeta={CONTRACTS_GROUP_META} visibleIds={visibleIds} toggleColumn={toggleColumn} setColumnsVisible={setColumnsVisible} resetDefaults={resetDefaults} />
          </div>
        </div>

        <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "white" }}>
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
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={visibleOrdered.length + 1} style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
                      <FileText size={28} style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }} /> Nenhum contrato localizado
                    </td>
                  </tr>
                ) : (
                  paginated.map((item: any, rowIdx: number) => {
                    const c = item.contract ?? item;
                    const rowBg = rowIdx % 2 === 1 ? "#fafafa" : "white";
                    return (
                      <tr key={c.id} style={{ background: rowBg }} onMouseOver={e => (e.currentTarget.style.background = "#eff6ff")} onMouseOut={e => (e.currentTarget.style.background = rowBg)}>
                        {visibleOrdered.map(col => {
                          const stickyStyle: React.CSSProperties = col.sticky ? { position: "sticky", left: stickyOffsets.get(col.id), zIndex: 1, background: "inherit" } : {};
                          const base = col.align === "right" ? { ...tdBase, textAlign: "right" as const } : col.align === "center" ? tdCenter : tdBase;
                          return <td key={col.id} style={{ ...base, ...stickyStyle }}>{renderCellContent(col, item)}</td>;
                        })}
                        <td style={tdCenter}>
                          <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                            {c.hasContractPdf && (
                              <button type="button" className="btn-icon" onClick={() => handleViewPdf(item)} title="Visualizar Minutas Anexas">
                                <Eye size={11} style={{ color: "#2563eb" }} />
                              </button>
                            )}
                            <button type="button" className="btn-icon" onClick={() => handleOpenEdit(item)}><Edit2 size={11} /></button>
                            <button type="button" className="btn-icon text-danger" onClick={() => handleDelete(item)}><Trash2 size={11} /></button>
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

        {/* Modal Principal Cadastro / Edição */}
        {open && (
          <div className="sigx-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
            <div className="sigx-modal" style={{ maxWidth: 860 }} onMouseDown={e => e.stopPropagation()}>
              <div className="sigx-modal-header">
                <span className="sigx-modal-title">{editingId ? "Editar Contrato" : "Novo Contrato"}</span>
                <button type="button" onClick={() => { setOpen(false); resetModal(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}><X size={18} /></button>
              </div>
              <div className="sigx-tabs" style={{ display: "flex", gap: 2, background: "#f3f4f6", padding: 4 }}>
                {TABS.map(tab => (
                  <div key={tab.key} className={`sigx-tab${activeTab === tab.key ? " active" : ""}`} onClick={() => setActiveTab(tab.key)} style={{ padding: "6px 12px", fontSize: 11, cursor: "pointer", borderRadius: 4, background: activeTab === tab.key ? "white" : "transparent", fontWeight: activeTab === tab.key ? 700 : 400 }}>{tab.label}</div>
                ))}
              </div>
              <form onSubmit={handleSubmit}>
                <div className="sigx-modal-body" style={{ padding: 20, maxHeight: "55vh", overflowY: "auto" }}>
                  
                  {/* TAB 1: BÁSICO */}
                  {activeTab === "basico" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div style={{ gridColumn: "span 2" }}>
                        <label className="sigx-label">CLIENTE DEVEDOR *</label>
                        <select className="sigx-input" value={String(form.clientId || "")} onChange={e => setForm(p => ({ ...p, clientId: Number(e.target.value), chosenBankAccount: "" }))}>
                          <option value="">Selecione o cliente</option>
                          {clients?.map((c: any) => <option key={c.id} value={String(c.id)}>{c.name} ({c.document})</option>)}
                        </select>
                      </div>
                      <div><label className="sigx-label">CÓDIGO INTERNO *</label><input className="sigx-input" value={form.code} onChange={n("code")} required /></div>
                      <div><label className="sigx-label">DATA DE EMISSÃO</label><input type="date" className="sigx-input" value={form.contractDate} onChange={n("contractDate")} /></div>
                      <div style={{ gridColumn: "span 2" }}><label className="sigx-label">NOME OU OBJETO DO CONTRATO *</label><input className="sigx-input" value={form.contractName} onChange={n("contractName")} required /></div>
                      <div><label className="sigx-label">CREDOR DA DÍVIDA</label><input className="sigx-input" value={form.creditor} onChange={n("creditor")} /></div>
                      <div>
                        <label className="sigx-label">TIPO ESTRUTURAL *</label>
                        <select className="sigx-input" required value={form.contract_type_id} onChange={e => setForm(p => ({ ...p, contract_type_id: e.target.value }))}>
                          <option value="">Selecione...</option>
                          {contractTypes.map((type: any) => <option key={type.id} value={type.id}>{type.name}</option>)}
                        </select>
                      </div>
                      
                      <div style={{ gridColumn: "span 2" }}>
                        <label className="sigx-label">STATUS OPERACIONAL DO CONTRATO *</label>
                        <select className="sigx-input" value={form.status} onChange={n("status")} required>
                          <option value="Ativo">Ativo / Regular</option>
                          <option value="Inadimplente">Inadimplente / Jurídico</option>
                          <option value="Quitado">Quitado / Baixado</option>
                          <option value="Renegociado">Renegociado</option>
                          <option value="Cancelado">Cancelado</option>
                        </select>
                      </div>
                      
                      <div style={{ gridColumn: "span 2" }}>
                        <label className="sigx-label" style={{ display: "flex", alignItems: "center", gap: 4 }}><Scale size={12} style={{ color: "#0d9488" }} /> FORO ELEITO DE ELEIÇÃO (COMARCA COBRANÇA)</label>
                        <input className="sigx-input" value={form.forumLocation} onChange={n("forumLocation")} placeholder="Ex: Belo Horizonte / MG" />
                        <span style={{ fontSize: 10, color: "#94a3b8" }}>Define o município jurídico responsável pela resolução de litígios e execução judicial deste ativo.</span>
                      </div>

                      <div style={{ gridColumn: "span 2" }}>
                        <label className="sigx-label">ANEXAR DOCUMENTOS E ATIVOS (PDF)</label>
                        <input type="file" accept=".pdf" onChange={handlePdfFilesChange} multiple style={{ fontSize: 12 }} />
                        
                        {(contractPdfFiles.length > 0 || existingPdfNames.length > 0) && (
                          <div style={{ marginTop: 10, padding: 10, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b" }}>DOCUMENTOS SELECIONADOS PARA ESTE INSTRUMENTO:</span>
                            {existingPdfNames.map((name, idx) => (
                              <div key={`exist-${idx}`} style={{ fontSize: 11, color: "#0f172a", display: "flex", alignItems: "center", gap: 4 }}>
                                <FileText size={12} style={{ color: "#2563eb" }} /> {name} <span style={{ fontSize: 9, color: "#059669", background: "#d1fae5", padding: "1px 4px", borderRadius: 3 }}>Salvo no Banco</span>
                              </div>
                            ))}
                            {contractPdfFiles.map((file, idx) => (
                              <div key={`new-${idx}`} style={{ fontSize: 11, color: "#0f172a", display: "flex", alignItems: "center", gap: 4 }}>
                                <FileText size={12} style={{ color: "#ea580c" }} /> {file.name} <span style={{ fontSize: 9, color: "#ea580c", background: "#ffedd5", padding: "1px 4px", borderRadius: 3 }}>Aguardando Gravação</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: FINANCEIRO */}
                  {activeTab === "financeiro" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                        <div><label className="sigx-label">VALOR PRINCIPAL (R$) *</label><input type="number" step="0.01" className="sigx-input" value={form.principalAmount || ""} onChange={num("principalAmount")} required /></div>
                        <div><label className="sigx-label">Nº DE PARCELAS *</label><input type="number" className="sigx-input" value={form.installmentCount} onChange={numI("installmentCount")} required /></div>
                        <div><label className="sigx-label">VALOR DA PARCELA (R$) *</label><input type="number" step="0.01" className="sigx-input" value={form.installmentAmount || ""} onChange={num("installmentAmount")} required /></div>
                      </div>

                      <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: 14 }}>
                        <label className="sigx-label" style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 700, color: "#1e293b" }}><CreditCard size={13} /> CONTA DE DESTINO PARA LIQUIDAÇÃO</label>
                        <span style={{ fontSize: 11, color: "#64748b", marginBottom: 10, display: "block" }}>Selecione abaixo uma das contas homologadas no cadastro do devedor e defina a esteira de cobrança:</span>
                        
                        {!form.clientId ? (
                          <div style={{ padding: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 11, color: "#94a3b8", textAlign: "center" }}>Selecione um cliente na aba "Dados Básicos" para ver as contas bancárias disponíveis.</div>
                        ) : !selectedClientMeta?.bankAccounts || selectedClientMeta.bankAccounts.length === 0 ? (
                          <div style={{ padding: 12, background: "#fff7ed", border: "1px solid #ffedd5", borderRadius: 6, fontSize: 11, color: "#c2410c" }}>Este cliente não possui nenhuma conta bancária cadastrada na sua ficha cadastral.</div>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            {selectedClientMeta.bankAccounts.map((acc: any, idx: number) => {
                              const uniqueBankKey = `${acc.banco}-${acc.agencia}-${acc.conta}`;
                              const isSelected = form.chosenBankAccount === uniqueBankKey;
                              return (
                                <div 
                                  key={idx} 
                                  onClick={() => setForm(p => ({ ...p, chosenBankAccount: uniqueBankKey }))}
                                  style={{
                                    padding: 10, borderRadius: 6, border: isSelected ? "2px solid #2563eb" : "1px solid #cbd5e1",
                                    background: isSelected ? "#eff6ff" : "white", cursor: "pointer", transition: "all 0.1s"
                                  }}
                                >
                                  <div style={{ fontWeight: 700, fontSize: 12, color: "#0f172a" }}>{acc.banco || "Banco não informado"}</div>
                                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>Ag: {acc.agencia} | Conta: {acc.conta} ({acc.tipo})</div>
                                  {acc.hasPix && acc.pixKey && (
                                    <div style={{ fontSize: 10, color: "#0d9488", display: "flex", alignItems: "center", gap: 4, marginTop: 4, background: "#f0fdf4", padding: "1px 4px", borderRadius: 3, width: "fit-content" }}>
                                      <QrCode size={10} /> PIX: {acc.pixKey}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {form.chosenBankAccount && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
                            <div>
                              <label className="sigx-label">ESTEIRA / MEIO DE PAGAMENTO</label>
                              <select className="sigx-input" value={form.paymentMethod} onChange={n("paymentMethod")}>
                                <option value="Boleto Bancário">Boleto Bancário Estruturado</option>
                                <option value="PIX QrCode">PIX Dinâmico (QrCode)</option>
                                <option value="TED / DOC">TED / Transferência Direta</option>
                                <option value="Cheque Operacional">Cartula / Cheque Operacional</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: TAXAS */}
                  {activeTab === "taxas" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                        <div>
                          <label className="sigx-label">INDEXADOR DE CORREÇÃO MONETÁRIA</label>
                          <select className="sigx-input" value={form.correctionIndex} onChange={n("correctionIndex")}>
                            <option value="PRE">Pré-fixado (Sem Correção)</option>
                            <option value="IPCA">IPCA (IBGE - Inflação Oficial)</option>
                            <option value="IGPM">IGP-M (FGV - Mercado)</option>
                          </select>
                        </div>
                        <div>
                          <label className="sigx-label">DATA DO 1º VENCIMENTO</label>
                          <input type="date" className="sigx-input" value={form.firstDueDate || ""} onChange={n("firstDueDate")} />
                        </div>
                        <div>
                          <label className="sigx-label" style={{ color: "#2563eb", fontWeight: 700 }}>TARIFA DE ESTRUTURAÇÃO (TAC R$)</label>
                          <input type="number" step="0.01" className="sigx-input" style={{ borderColor: "#2563eb" }} value={form.tacAmount || ""} onChange={num("tacAmount")} placeholder="Ex: 500.00" />
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, borderTop: "1px dashed #e2e8f0", paddingTop: 14 }}>
                        <div>
                          <label className="sigx-label">JUROS REMUNERATÓRIOS MENSAL (%)</label>
                          <input type="number" step="0.001" className="sigx-input" value={form.monthlyInterestRate ? (form.monthlyInterestRate * 100).toFixed(3) : ""} onChange={e => setForm(p => ({ ...p, monthlyInterestRate: parseFloat(e.target.value) / 100 || 0 }))} />
                        </div>
                        <div>
                          <label className="sigx-label">MORA MENSAL (ATRASO) (%)</label>
                          <input type="number" step="0.001" className="sigx-input" value={form.moraRateMonthly ? (form.moraRateMonthly * 100).toFixed(3) : ""} onChange={e => setForm(p => ({ ...p, moraRateMonthly: parseFloat(e.target.value) / 100 || 0 }))} />
                        </div>
                        <div>
                          <label className="sigx-label">MULTA PENAL POR ATRASO (%)</label>
                          <input type="number" step="0.001" className="sigx-input" value={form.penaltyRate ? (form.penaltyRate * 100).toFixed(3) : ""} onChange={e => setForm(p => ({ ...p, penaltyRate: parseFloat(e.target.value) / 100 || 0 }))} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: GARANTIAS */}
                  {activeTab === "garantias" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {/* 🛠️ FIX 2: Removido o teste 'allFiadores' que quebrava o escopo e mantida a verificação limpa de metadados do cliente devedor */}
                      {selectedClientMeta && (selectedClientMeta.fiador1Nome || selectedClientMeta.fiador2Nome) && (
                        <div style={{ padding: 10, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#1e293b", display: "block", marginBottom: 6 }}>Fiadores localizados no cadastro deste devedor:</span>
                          <div style={{ display: "flex", gap: 8 }}>
                            {selectedClientMeta.fiador1Nome && (
                              <button
                                type="button"
                                onClick={() => setForm(p => ({ ...p, guarantors: `[FIADOR 1] Nome: ${selectedClientMeta.fiador1Nome}, CPF: ${selectedClientMeta.fiador1Cpf}, Tel: ${selectedClientMeta.fiador1Telefone}, Endereço: ${selectedClientMeta.fiador1Endereco}, ${selectedClientMeta.fiador1Cidade}/${selectedClientMeta.fiador1Estado}\n${p.guarantors}` }))}
                                className="btn-secondary" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px" }}
                              >
                                <UserCheck size={12} color="#2563eb" /> Injetar {selectedClientMeta.fiador1Nome}
                              </button>
                            )}
                            {selectedClientMeta.fiador2Nome && (
                              <button
                                type="button"
                                onClick={() => setForm(p => ({ ...p, guarantors: `[FIADOR 2] Nome: ${selectedClientMeta.fiador2Nome}, CPF: ${selectedClientMeta.fiador2Cpf}, Tel: ${selectedClientMeta.fiador2Telefone}, Endereço: ${selectedClientMeta.fiador2Endereco}, ${selectedClientMeta.fiador2Cidade}/${selectedClientMeta.fiador2Estado}\n${p.guarantors}` }))}
                                className="btn-secondary" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px" }}
                              >
                                <UserCheck size={12} color="#6b21a8" /> Injetar {selectedClientMeta.fiador2Nome}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      <div><label className="sigx-label">GARANTIAS REAIS ACOPLADAS</label><textarea className="sigx-input" value={form.guarantees} onChange={n("guarantees")} rows={3} /></div>
                      <div><label className="sigx-label">MINUTA DETALHADA DOS FIADORES / COOBRIGADOS</label><textarea className="sigx-input" value={form.guarantors} onChange={n("guarantors")} rows={4} placeholder="Clique nos botões acima para puxar os fiadores cadastrados na ficha do cliente..." /></div>
                    </div>
                  )}

                  {/* TAB 5: REGRAS */}
                  {activeTab === "regras" && (
                    <div><label className="sigx-label">OBSERVAÇÕES INTERNAS E HISTÓRICOS</label><textarea className="sigx-input" value={form.observations} onChange={n("observations")} rows={4} /></div>
                  )}

                </div>
                <div className="sigx-modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => { setOpen(false); resetModal(); }}>Cancelar</button>
                  <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Gravando..." : "Salvar Contrato"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* VISUALIZADOR MULTI-PDF SPLIT SCREEN */}
        {pdfPreview && (
          <div className="sigx-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setPdfPreview(null); }}>
            <div className="sigx-modal" style={{ width: "min(1250px, 96vw)", maxWidth: "96vw", height: "92vh", display: "flex", flexDirection: "column", padding: 0 }} onMouseDown={e => e.stopPropagation()}>
              <div className="sigx-modal-header" style={{ flexShrink: 0 }}>
                <span className="sigx-modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><FileText size={14} /> Documentos Digitais — Contrato {pdfPreview.code}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <a href={`/contracts/${pdfPreview.id}/pdf?index=${activePdfIndex}`} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: 11, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}><Upload size={11} style={{ transform: "rotate(180deg)" }} /> Ver Completo / Imprimir</a>
                <button type="button" onClick={() => setPdfPreview(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", display: "flex" }}><X size={18} /></button>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0, display: "flex", background: "#1f2937" }}>
                <div style={{ width: 250, background: "#111827", borderRight: "1px solid #374151", padding: 12, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.05em", marginBottom: 6 }}>ARQUIVOS COMPONENTES:</span>
                  {pdfPreview.names.map((name, index) => (
                    <button key={index} type="button" onClick={() => setActivePdfIndex(index)} style={{ width: "100%", padding: "10px 12px", borderRadius: 4, border: "none", textAlign: "left", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, background: activePdfIndex === index ? "#2563eb" : "#1f2937", color: activePdfIndex === index ? "white" : "#d1d5db", transition: "all 0.1s" }}>
                      <FileText size={12} style={{ flexShrink: 0, color: activePdfIndex === index ? "white" : "#9ca3af" }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={name}>{name}</span>
                    </button>
                  ))}
                </div>
                <div style={{ flex: 1, height: "100%", background: "#1f2937" }}>
                  <iframe key={`${pdfPreview.id}-${activePdfIndex}`} src={`/contracts/${pdfPreview.id}/pdf?index=${activePdfIndex}#toolbar=1&navpanes=0&view=FitH`} title={`Visualizador do PDF ${activePdfIndex}`} style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </UnyPayLayout>
  );
}