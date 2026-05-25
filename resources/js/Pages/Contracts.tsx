import { useState, useMemo } from "react";
import { Plus, Search, FileText, CheckCircle, X } from "lucide-react";
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
};

const PAGE_SIZES = [20, 50, 100];

const emptyForm = {
  clientId: 0, code: "", contractName: "", creditor: "UnyPay® S.A.",
  contractType: "Mútuo/Confissão de dívida", contractDate: new Date().toISOString().slice(0, 10), status: "Ativo" as const,
  validated: false, principalAmount: 0, financedTotal: 0, tacAmount: 0, iofAmount: 0,
  installmentCount: 12, installmentAmount: 0, firstDueDate: "",
  monthlyInterestRate: 0, moraRateMonthly: 0.02, penaltyRate: 0.1,
  penaltyBaseType: "installment" as const, penaltyScope: "per_installment" as const,
  correctionIndex: "IPCA", honoraryRate: 0, accelerates: false,
  accelerationRule: "", accelerationConsecutiveThreshold: undefined as number | undefined,
  accelerationAlternateThreshold: undefined as number | undefined,
  guarantees: "", guarantors: "", validationUrl: "", sourcePdfName: "", observations: "",
};

const TABS = [
  { key: "basico", label: "Dados Básicos" },
  { key: "financeiro", label: "Valores Financeiros" },
  { key: "taxas", label: "Taxas e Encargos" },
  { key: "garantias", label: "Garantias e Fiadores" },
  { key: "regras", label: "Regras Contratuais" },
];

// estilos compactos compartilhados
const headerCellStyle: React.CSSProperties = {
  background: "#f1f5f9", color: "#334155",
  padding: "5px 7px", fontSize: 9, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.04em",
  whiteSpace: "nowrap", borderBottom: "2px solid #cbd5e1",
};
const tdBase: React.CSSProperties = { padding: "3px 7px", borderBottom: "1px solid #f1f5f9", fontSize: 11, verticalAlign: "middle" };
const tdNum: React.CSSProperties = { ...tdBase, fontFamily: "'IBM Plex Mono', monospace", textAlign: "right" };
const tdCenter: React.CSSProperties = { ...tdBase, textAlign: "center" };

export default function Contracts({ contracts, clients, filters }: any) {
  const [search, setSearch] = useState(filters?.search || "");
  const [statusFilter, setStatusFilter] = useState(filters?.statusFilter || "Todos");
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("basico");
  const [form, setForm] = useState(emptyForm);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortCol, setSortCol] = useState<string>("code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ── Visibilidade de colunas ────────────────────────────────────────────
  const { visibleIds, toggleColumn, setColumnsVisible, resetDefaults } =
    useColumnVisibility<ContractsColumnId>(
      "unypay.contracts.columns.v1",
      CONTRACTS_COLUMNS,
    );

  const visibleOrdered: ContractsColumnDef[] = useMemo(
    () => CONTRACTS_COLUMNS.filter((c) => visibleIds.has(c.id)),
    [visibleIds],
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
    router.get("/contracts", { search: newSearch, statusFilter: newStatus }, { preserveState: true, replace: true });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId) { toast.error("Selecione o cliente vinculado."); return; }

    router.post("/contracts", form, {
      preserveState: false,
      onSuccess: () => {
        toast.success("Contrato gravado com sucesso!");
        setOpen(false);
        setForm(emptyForm);
      },
      onError: (err: any) => {
        toast.error("Erro ao registrar: " + Object.values(err).join(", "));
      }
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

  // ── células ────────────────────────────────────────────────────────────
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

        {/* Cabeçalho */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>Contratos e Ativos</h1>
          <button onClick={() => { setForm(emptyForm); setActiveTab("basico"); setOpen(true); }}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 6, border: "none", background: "#1a2035", color: "white", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            <Plus size={12} /> Novo Contrato
          </button>
        </div>

        {/* Barra de filtros */}
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

        {/* Container unificado tabela + paginação */}
        <div style={{
          flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
          border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden", background: "white",
        }}>
          <div style={{ flex: 1, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 11, minWidth: 900 }}>
              <colgroup>
                {visibleOrdered.map(col => <col key={col.id} style={{ width: col.width }} />)}
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
                </tr>
              </thead>

              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={visibleOrdered.length} style={{ textAlign: "center", padding: 48, color: "#9ca3af" }}>
                      <FileText size={28} style={{ margin: "0 auto 8px", display: "block", opacity: 0.2 }} /> Nenhum contrato encontrado
                    </td>
                  </tr>
                ) : (
                  paginated.map((item: any, rowIdx: number) => {
                    const rowBg = rowIdx % 2 === 1 ? "#fafafa" : "white";
                    return (
                      <tr key={(item.contract ?? item).id} style={{ background: rowBg }}
                        onMouseOver={e => (e.currentTarget.style.background = "#eff6ff")}
                        onMouseOut={e => (e.currentTarget.style.background = rowBg)}
                      >
                        {visibleOrdered.map(col => {
                          const stickyStyle: React.CSSProperties = col.sticky
                            ? { position: "sticky", left: stickyOffsets.get(col.id), zIndex: 1, background: "inherit" }
                            : {};
                          const base =
                            col.align === "right" ? tdNum :
                              col.align === "center" ? tdCenter : tdBase;
                          return (
                            <td key={col.id} style={{ ...base, ...stickyStyle }}>
                              {renderCellContent(col, item)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
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

        {/* Modal Cadastro */}
        {open && (
          <div className="sigx-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
            <div className="sigx-modal" style={{ maxWidth: 860 }} onMouseDown={e => e.stopPropagation()}>
              <div className="sigx-modal-header">
                <span className="sigx-modal-title">Novo Contrato</span>
                <button type="button" onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", display: "flex" }}><X size={18} /></button>
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
                      <div><label className="sigx-label">CÓDIGO *</label><input className="sigx-input" value={form.code} onChange={n("code")} required placeholder="Ex: BeloSanta1" /></div>
                      <div><label className="sigx-label">DATA DO CONTRATO</label><input type="date" className="sigx-input" value={form.contractDate} onChange={n("contractDate")} /></div>
                      <div style={{ gridColumn: "span 2" }}><label className="sigx-label">NOME DO CONTRATO *</label><input className="sigx-input" value={form.contractName} onChange={n("contractName")} required /></div>
                      <div><label className="sigx-label">CREDOR *</label><input className="sigx-input" value={form.creditor} onChange={n("creditor")} required /></div>
                      <div><label className="sigx-label">TIPO DE CONTRATO</label><input className="sigx-input" value={form.contractType} onChange={n("contractType")} /></div>
                      <div>
                        <label className="sigx-label">STATUS</label>
                        <select className="sigx-input" value={form.status} onChange={n("status") as any}>
                          {["Ativo", "Quitado", "Inadimplente", "Renegociado"].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}>
                        <input type="checkbox" id="validated" checked={form.validated} onChange={e => setForm(p => ({ ...p, validated: e.target.checked }))} style={{ width: 14, height: 14 }} />
                        <label htmlFor="validated" className="sigx-label" style={{ marginBottom: 0, cursor: "pointer" }}>Contrato validado digitalmente</label>
                      </div>
                      <div style={{ gridColumn: "span 2" }}><label className="sigx-label">URL DE VALIDAÇÃO</label><input className="sigx-input" value={form.validationUrl} onChange={n("validationUrl")} placeholder="https://valida.ae/..." /></div>
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
                    </div>
                  )}
                  {activeTab === "garantias" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div style={{ gridColumn: "span 2" }}><label className="sigx-label">GARANTIAS REAIS</label><textarea className="sigx-input" value={form.guarantees} onChange={n("guarantees")} rows={3} /></div>
                      <div style={{ gridColumn: "span 2" }}><label className="sigx-label">FIADORES</label><textarea className="sigx-input" value={form.guarantors} onChange={n("guarantors")} rows={3} /></div>
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
                    </div>
                  )}
                </div>
                <div className="sigx-modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary">Salvar Contrato</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </UnyPayLayout>
  );
}
