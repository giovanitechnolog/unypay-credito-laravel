import { useMemo, useState } from "react";
import { Link, Head, router } from "@inertiajs/react";
import {
  Search, Plus, RefreshCw, FileText, Download,
  Eye, Trash2, ExternalLink, Calculator, X
} from "lucide-react";
import { toast } from "sonner";
import UnyPayLayout from "../Components/UnyPayLayout";
import TableGroupBadges from "../Components/TableGroupBadges";
import TableColumnPicker from "../Components/TableColumnPicker";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import {
  COL_GROUP_META,
  GROUP_ORDER,
  LANCAMENTOS_COLUMNS,
  getVisibleOrdered,
  type ColGroup,
  type LancamentoColumnDef,
  type LancamentoColumnId,
} from "../lib/lancamentosColumns";

// ── Formatadores ─────────────────────────────────────────────────────────────
const fmt = (v: number | string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
const fmtShort = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return fmt(v);
};
const fmtDate = (d?: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;

// ── Badges de tipo ───────────────────────────────────────────────────────────
const TYPE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  "Mútuo/Confissão de dívida": { bg: "#7c2d12", color: "white", label: "Mútuo" },
  "Mútuo":                     { bg: "#7c2d12", color: "white", label: "Mútuo" },
  "Confissão de dívida":       { bg: "#1e3a5f", color: "white", label: "Conf. Dívida" },
  "CCB":                       { bg: "#0e7490", color: "white", label: "CCB" },
  "Outro":                     { bg: "#374151", color: "white", label: "Outro" },
};
const getType = (t?: string | null) =>
  TYPE_BADGE[t ?? "Outro"] ?? { bg: "#374151", color: "white", label: t ?? "Outro" };

// ── Badges de status ─────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  "Ativo":        { bg: "#d1fae5", color: "#065f46" },
  "Inadimplente": { bg: "#fee2e2", color: "#991b1b" },
  "Quitado":      { bg: "#dbeafe", color: "#1e40af" },
  "Renegociado":  { bg: "#f3e8ff", color: "#6b21a8" },
};

const PAGE_SIZES = [20, 50, 100];

const COLUMNS_STORAGE_KEY = "unypay_credito_colunas_lancamentos_v1";

const ACTIONS_GROUP_BG = "#111827";
const ACTIONS_COL_WIDTH = 100;

// ══ ESTILOS DE CÉLULA — fiel ao padrão SIGX (compacto) ═══════════════════════
const FONT_MONO = "'IBM Plex Mono', monospace";

const tdBase: React.CSSProperties = {
  fontSize: 11,
  padding: "3px 7px",
  whiteSpace: "nowrap",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "middle",
};
const tdNum: React.CSSProperties = {
  ...tdBase,
  textAlign: "right",
  fontFamily: FONT_MONO,
};
const tdCenter: React.CSSProperties = { ...tdBase, textAlign: "center" };

// Header (2ª linha) — cabeçalho de cada coluna
const thBase: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  padding: "5px 7px",
  whiteSpace: "nowrap",
  cursor: "pointer",
  userSelect: "none",
  background: "#f1f5f9",
  color: "#334155",
  borderBottom: "2px solid #cbd5e1",
  position: "sticky",
  top: 28,
  zIndex: 10,
  textAlign: "left",
};

// Header (1ª linha) — grupo colorido
const thGroup: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  padding: "5px 12px",
  whiteSpace: "nowrap",
  textAlign: "center",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  position: "sticky",
  top: 0,
  zIndex: 11,
};

export default function Lancamentos({ contracts, clients, kpis, filters }: any) {
  const [search, setSearch]             = useState(filters?.search || "");
  const [statusFilter, setStatusFilter] = useState(filters?.statusFilter || "Todos");
  const [clientFilter, setClientFilter] = useState("Todos");
  const [page, setPage]                 = useState(1);
  const [pageSize, setPageSize]         = useState(50);
  const [sortCol, setSortCol]           = useState("code");
  const [sortDir, setSortDir]           = useState<"asc"|"desc">("asc");
  const [priceId, setPriceId]           = useState<number|null>(null);
  const [priceData, setPriceData]       = useState<any>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  // ── Visibilidade de colunas (persistida) ─────────────────────────────────
  const { visibleIds, toggleColumn, setColumnsVisible, resetDefaults } =
    useColumnVisibility<LancamentoColumnId>(COLUMNS_STORAGE_KEY, LANCAMENTOS_COLUMNS);

  const visibleOrdered = useMemo(
    () => getVisibleOrdered(visibleIds),
    [visibleIds],
  );

  // Sticky cols visíveis (ordenadas por rank) + offset cumulativo recalculado.
  const stickyVisible = useMemo(
    () =>
      visibleOrdered
        .filter((c) => c.sticky != null)
        .sort((a, b) => (a.sticky ?? 0) - (b.sticky ?? 0)),
    [visibleOrdered],
  );

  const stickyLeftById = useMemo(() => {
    const map = new Map<LancamentoColumnId, number>();
    let acc = 0;
    for (const col of stickyVisible) {
      map.set(col.id, acc);
      acc += col.width;
    }
    return map;
  }, [stickyVisible]);

  const lastIdColumnId = useMemo(() => {
    const idCols = visibleOrdered.filter((c) => c.group === "identificacao");
    return idCols.length > 0 ? idCols[idCols.length - 1].id : null;
  }, [visibleOrdered]);

  const visibleGroupsWithCount = useMemo(() => {
    const counts: Record<ColGroup, number> = {
      identificacao: 0, financeiro: 0, parcelas: 0, juros: 0, situacao: 0,
    };
    for (const def of LANCAMENTOS_COLUMNS) {
      if (visibleIds.has(def.id)) counts[def.group] += 1;
    }
    return GROUP_ORDER
      .filter((g) => counts[g] > 0)
      .map((g) => ({ group: g, count: counts[g] }));
  }, [visibleIds]);

  // ── Handlers existentes ──────────────────────────────────────────────────
  const handleOpenPrice = (contractId: number) => {
    setPriceId(contractId);
    setPriceLoading(true);
    fetch(`/api/payments/schedule/${contractId}`)
      .then(res => res.json())
      .then(data => {
        setPriceData({
          contractName: data.schedule?.[0]?.contractName || "Detalhamento",
          principal: data.schedule?.[0]?.principalAmount || 0,
          financedTotal: data.schedule?.[0]?.financedTotal || 0,
          totalInterest: data.schedule?.reduce((s: number, r: any) => s + (r.moraAmount + r.penaltyAmount), 0),
          totalPayable: data.schedule?.reduce((s: number, r: any) => s + r.updatedAmount, 0),
          cetMonthly: 0.02,
          cetAnnual: 0.268,
          rows: data.schedule?.map((r: any) => ({
            n: r.installmentNumber,
            dueDate: r.dueDate,
            payment: r.originalAmount,
            interest: r.moraAmount + r.penaltyAmount,
            amortization: r.originalAmount,
            balance: r.updatedAmount
          })) || []
        });
        setPriceLoading(false);
      })
      .catch(() => setPriceLoading(false));
  };

  const handleDelete = (id: number) => {
    if (!confirm("Deseja expurgar este contrato e seus lançamentos da auditoria?")) return;
    router.delete(`/api/contracts/destroy/${id}`, {
      onSuccess: () => toast.success("Contrato excluído com sucesso do sistema!"),
      onError:   (err: any) => toast.error("Erro ao deletar ativo: " + err.message),
    });
  };

  const filtered = useMemo(() => {
    const list = contracts?.data ?? contracts ?? [];
    return [...list]
      .filter((c: any) => {
        const q = search.toLowerCase();
        return (
          (!search ||
            c.code.toLowerCase().includes(q) ||
            c.contractName.toLowerCase().includes(q) ||
            (c.clientName ?? "").toLowerCase().includes(q) ||
            c.creditor.toLowerCase().includes(q)) &&
          (statusFilter === "Todos" || c.status === statusFilter) &&
          (clientFilter === "Todos" || String(c.clientId) === clientFilter)
        );
      })
      .sort((a: any, b: any) => {
        let va: any, vb: any;
        if (sortCol === "code") { va = a.code; vb = b.code; }
        else if (sortCol === "client") { va = a.clientName ?? ""; vb = b.clientName ?? ""; }
        else if (sortCol === "principal") { va = +a.principalAmount; vb = +b.principalAmount; }
        else if (sortCol === "status") { va = a.status; vb = b.status; }
        else if (sortCol === "date") { va = a.contractDate ?? ""; vb = b.contractDate ?? ""; }
        else { va = a.code; vb = b.code; }
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [contracts, search, statusFilter, clientFilter, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize);

  const doSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };
  const SortIco = ({ col }: { col: string }) => (
    <span style={{ marginLeft: 2, opacity: sortCol === col ? 1 : 0.35, fontSize: 8 }}>
      {sortCol === col ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  // ── Render de uma célula do corpo (data-driven por id de coluna) ─────────
  const renderCellContent = (col: LancamentoColumnDef, c: any) => {
    switch (col.id) {
      case "code":
        return <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 600, color: "#374151" }}>{c.code}</span>;
      case "client":
        return (
          <div style={{ maxWidth: col.width - 16, minWidth: 0 }}>
            <div
              title={c.clientName}
              style={{
                fontSize: 11, fontWeight: 600, lineHeight: 1.25, color: "#111827",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {c.clientName}
            </div>
            <div
              title={c.contractName}
              style={{
                fontSize: 9, color: "#9ca3af", lineHeight: 1.2, marginTop: 1,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {c.contractName}
            </div>
          </div>
        );
      case "type": {
        const tc = getType(c.contractType);
        return (
          <span
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              minWidth: 70, height: 18,
              padding: "0 6px", borderRadius: 3,
              background: tc.bg, color: tc.color,
              fontSize: 9, fontWeight: 700, letterSpacing: "0.02em",
              whiteSpace: "nowrap",
            }}
          >
            {tc.label}
          </span>
        );
      }
      case "status": {
        const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE["Ativo"];
        return (
          <span
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              minWidth: 64, height: 18,
              padding: "0 6px", borderRadius: 3,
              background: badge.bg, color: badge.color,
              fontSize: 9, fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {c.status}
          </span>
        );
      }
      case "principal":
        return <span style={{ fontFamily: FONT_MONO, fontWeight: 700, color: "#111827" }}>{fmt(c.principalAmount)}</span>;
      case "totalWithInterest":
        return <span style={{ fontFamily: FONT_MONO, fontWeight: 600, color: "#2563eb" }}>{fmt(c.financedTotal)}</span>;
      case "toReceiveFin":
        return <span style={{ fontFamily: FONT_MONO, fontWeight: 600, color: "#ea580c" }}>{fmt(c.openBalanceTotal ?? (c.financedTotal - c.paidTotal))}</span>;
      case "installments":
        return <span style={{ color: "#6b7280" }}>{c.installmentCount}×</span>;
      case "installmentAmt":
        return <span style={{ fontFamily: FONT_MONO, color: "#6b7280" }}>{fmt(c.installmentAmount)}</span>;
      case "date":
        return <span style={{ color: "#6b7280" }}>{fmtDate(c.contractDate)}</span>;
      case "creditor":
        return (
          <span
            title={c.creditor}
            style={{
              fontSize: 10, color: "#6b7280",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              display: "block", maxWidth: 122,
            }}
          >
            {c.creditor}
          </span>
        );
      case "paid":
        return <span style={{ fontFamily: FONT_MONO, fontWeight: 700, color: "#059669" }}>{c.paidInstallmentsCount ?? 0}</span>;
      case "overdue":
        return <span style={{ fontFamily: FONT_MONO, fontWeight: 700, color: "#dc2626" }}>{c.overdueInstallmentsCount ?? 0}</span>;
      case "daysOverdue":
        return (
          <span style={{
            fontFamily: FONT_MONO, fontWeight: 700,
            color: (c.maxDaysOverdue ?? 0) > 0 ? "#dc2626" : "#9ca3af",
          }}>
            {c.maxDaysOverdue ? Math.trunc(c.maxDaysOverdue) : "—"}
          </span>
        );
      case "toReceive":
        return <span style={{ fontFamily: FONT_MONO, fontWeight: 600, color: "#ea580c" }}>{fmt(c.openBalanceTotal ?? (c.financedTotal - c.paidTotal))}</span>;
      case "totalInterest":
        return <span style={{ fontFamily: FONT_MONO, color: "#dc2626" }}>{fmt(c.interestAccumulated ?? 0)}</span>;
      case "cetMonthly":
        return <span style={{ fontFamily: FONT_MONO, color: "#ea580c" }}>{c.moraRateMonthly ? fmtPct(c.moraRateMonthly) : "2,00%"}</span>;
      case "cetAnnual":
        return <span style={{ fontFamily: FONT_MONO, color: "#ea580c" }}>{c.penaltyRate ? fmtPct(c.penaltyRate) : "10,00%"}</span>;
      case "firstDue":
        return <span style={{ color: "#6b7280" }}>{fmtDate(c.firstDueDate)}</span>;
      case "validated":
        return c.validated
          ? <span style={{ color: "#059669", fontWeight: 700 }}>✓</span>
          : <span style={{ color: "#9ca3af" }}>—</span>;
      default:
        return <span style={{ color: "#9ca3af" }}>—</span>;
    }
  };

  // ── Render de uma célula do tfoot ────────────────────────────────────────
  const renderFooterCell = (col: LancamentoColumnDef): React.ReactNode => {
    const idCols = visibleOrdered.filter((c) => c.group === "identificacao");
    const firstId = idCols[0]?.id;
    const secondId = idCols[1]?.id;

    if (col.id === firstId) {
      return (
        <span style={{ color: "white", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
          TOTAIS
        </span>
      );
    }
    if (col.id === secondId) {
      return (
        <span style={{ color: "#93c5fd", fontSize: 10 }}>
          {filtered.length} contratos
        </span>
      );
    }

    switch (col.id) {
      case "principal":
        return <span style={{ fontFamily: FONT_MONO, color: "white", fontWeight: 700 }}>{fmt(filtered.reduce((s:number,c:any) => s + +c.principalAmount, 0))}</span>;
      case "totalWithInterest":
        return <span style={{ fontFamily: FONT_MONO, color: "#c4b5fd", fontWeight: 600 }}>{fmt(filtered.reduce((s:number,c:any) => s + +c.financedTotal, 0))}</span>;
      case "toReceiveFin":
        return <span style={{ fontFamily: FONT_MONO, color: "#fb923c", fontWeight: 600 }}>{fmt(filtered.reduce((s:number,c:any) => s + +c.openBalanceTotal, 0))}</span>;
      case "toReceive":
        return <span style={{ fontFamily: FONT_MONO, color: "#fca5a5", fontWeight: 600 }}>{fmt(filtered.reduce((s:number,c:any) => s + +c.openBalanceTotal, 0))}</span>;
      case "totalInterest":
        return <span style={{ fontFamily: FONT_MONO, color: "#fca5a5", fontWeight: 600 }}>{fmt(filtered.reduce((s:number,c:any) => s + +c.interestAccumulated, 0))}</span>;
      default:
        return null;
    }
  };

  const footerBg = "#1e2139";

  // ── Estilos sticky derivados (header e cell) ─────────────────────────────
  const headerStickyStyle = (left: number, isLastIdCol: boolean): React.CSSProperties => ({
    ...thBase,
    position: "sticky",
    top: 28,
    left,
    zIndex: 12,
    boxShadow: isLastIdCol ? "2px 0 4px rgba(0,0,0,0.06)" : undefined,
  });

  const cellStickyStyle = (left: number, bg: string, isLastIdCol: boolean): React.CSSProperties => ({
    ...tdBase,
    position: "sticky",
    left,
    zIndex: 4,
    background: bg,
    boxShadow: isLastIdCol ? "2px 0 4px rgba(0,0,0,0.05)" : undefined,
  });

  return (
    <UnyPayLayout>
      <Head title="Lançamentos — Carteira de Crédito" />

      <div style={{ padding: "12px 20px 16px 20px", display:"flex", flexDirection:"column", height:"100%", overflow:"hidden", gap: 12 }}>

        {/* ══ HEADER ═════════════════════════════════════════════════════ */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <h1 style={{ margin:0, fontSize:16, fontWeight:700, color:"#111827" }}>Lançamentos — Carteira de Crédito</h1>
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={() => router.get('/lancamentos')} style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 12px", borderRadius:5, border:"1px solid #d1d5db", background:"white", fontSize:11, fontWeight:500, cursor:"pointer", color:"#374151" }}>
              <RefreshCw size={12}/> Sincronizar IPCA
            </button>
            <Link href="/contracts">
              <button style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 12px", borderRadius:5, border:"none", background:"#374151", color:"white", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                <Plus size={12}/> Novo
              </button>
            </Link>
            <button onClick={() => alert("Geração de PDF acionada.")} style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 12px", borderRadius:5, border:"none", background:"#dc2626", color:"white", fontSize:11, fontWeight:600, cursor:"pointer" }}>
              <FileText size={12}/> Relatório PDF
            </button>
            <button onClick={() => alert("Geração de XLS acionada.")} style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 12px", borderRadius:5, border:"none", background:"#059669", color:"white", fontSize:11, fontWeight:600, cursor:"pointer" }}>
              <Download size={12}/> Exportar Excel
            </button>
          </div>
        </div>

        {/* ══ KPI CARDS — 5 cards separados ════════════════════════════════ */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5, minmax(0, 1fr))", gap: 10, flexShrink: 0 }}>
          {[
            { label:"CONTRATOS",        value:String(kpis?.totalContracts ?? filtered.length), sub:`${kpis?.activeContracts ?? filtered.filter((c:any)=>c.status==='Ativo').length} ativos`, color:"#6366f1" },
            { label:"TOTAL FINANCIADO", value:fmt(kpis?.totalFinanced ?? filtered.reduce((s:number,c:any)=>s+c.financedTotal, 0)), sub:`Principal: ${fmtShort(kpis?.totalPrincipal ?? filtered.reduce((s:number,c:any)=>s+c.principalAmount, 0))}`, color:"#3b82f6" },
            { label:"TOTAL RECEBIDO",   value:fmt(kpis?.totalPaid ?? filtered.reduce((s:number,c:any)=>s+c.paidTotal, 0)), sub:`${(kpis?.pctPaid ?? 17.1).toFixed(1)}% do financiado`, color:"#10b981" },
            { label:"TOTAL VENCIDO",    value:fmt(kpis?.totalOverdue ?? filtered.reduce((s:number,c:any)=>s+c.overdueTotal, 0)), sub:`${kpis?.overdueInstallments ?? filtered.reduce((s:number,c:any)=>s+c.overdueInstallmentsCount, 0)} parcelas em atraso`, color:"#ef4444" },
            { label:"A VENCER",         value:fmt(kpis?.totalPending ?? filtered.reduce((s:number,c:any)=>s+(c.financedTotal - c.paidTotal), 0)), sub:`${kpis?.pendingInstallments ?? 252} parcelas`, color:"#f59e0b" },
          ].map((c) => (
            <div
              key={c.label}
              style={{
                background: "white",
                border: "1px solid #e5e7eb",
                borderLeft: `3px solid ${c.color}`,
                borderRadius: 6,
                padding: "10px 14px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                minWidth: 0,
              }}
            >
              <div style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", color:"#9ca3af", marginBottom:4 }}>{c.label}</div>
              <div
                title={c.value}
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#111827",
                  fontFamily: FONT_MONO,
                  lineHeight: 1.15,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {c.value}
              </div>
              <div
                title={c.sub}
                style={{
                  fontSize: 10,
                  color: "#9ca3af",
                  marginTop: 3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {c.sub}
              </div>
            </div>
          ))}
        </div>

        {/* ══ FILTROS + GRUPOS + COLUNAS (2 seções flexíveis) ═════════════ */}
        <div style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          flexShrink: 0,
        }}>
          {/* SEÇÃO ESQUERDA — filtros */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            flex: "1 1 auto", minWidth: 0, flexWrap: "wrap",
          }}>
            <div style={{ position:"relative", flex:"1 1 180px", maxWidth: 260, minWidth: 160 }}>
              <Search size={12} style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", color:"#9ca3af" }}/>
              <input
                style={{ width:"100%", padding:"5px 8px 5px 28px", border:"1px solid #d1d5db", borderRadius:5, fontSize:11, outline:"none", background:"white", color:"#374151", height: 28 }}
                placeholder="Buscar cliente, código, contrato..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <select
              style={{ height: 28, padding:"0 8px", border:"1px solid #d1d5db", borderRadius:5, fontSize:11, background:"white", color:"#374151", cursor:"pointer" }}
              value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="Todos">Todos os status</option>
              <option value="Ativo">Ativo</option><option value="Inadimplente">Inadimplente</option><option value="Quitado">Quitado</option>
            </select>
            <select
              style={{ height: 28, padding:"0 8px", border:"1px solid #d1d5db", borderRadius:5, fontSize:11, background:"white", color:"#374151", cursor:"pointer", maxWidth: 180 }}
              value={clientFilter} onChange={e => { setClientFilter(e.target.value); setPage(1); }}
            >
              <option value="Todos">Todos os clientes</option>
              {clients?.map((cl: any) => <option key={cl.id} value={String(cl.id)}>{cl.name}</option>)}
            </select>
            <span style={{ fontSize:11, color:"#6b7280", fontWeight:500, whiteSpace: "nowrap" }}>{filtered.length} contratos</span>
          </div>

          {/* SEÇÃO DIREITA — badges + picker (sempre juntos, não compactam) */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginLeft: "auto", flexShrink: 0,
          }}>
            <TableGroupBadges
              allColumns={LANCAMENTOS_COLUMNS}
              groupOrder={GROUP_ORDER}
              groupMeta={COL_GROUP_META}
              visibleIds={visibleIds}
              setColumnsVisible={setColumnsVisible}
            />
            <TableColumnPicker
              allColumns={LANCAMENTOS_COLUMNS}
              groupOrder={GROUP_ORDER}
              groupMeta={COL_GROUP_META}
              visibleIds={visibleIds}
              toggleColumn={toggleColumn}
              setColumnsVisible={setColumnsVisible}
              resetDefaults={resetDefaults}
            />
          </div>
        </div>

        {/* ══ TABELA + PAGINAÇÃO (um único container) ═════════════════════ */}
        <div style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          background: "white",
          overflow: "hidden",
        }}>
        <div style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
        }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "max-content", minWidth: "100%" }}>
            <colgroup>
              {visibleOrdered.map((c) => <col key={c.id} style={{ width: c.width }} />)}
              <col style={{ width: ACTIONS_COL_WIDTH }} />
            </colgroup>

            <thead>
              {/* Linha 1 — cabeçalhos de grupo */}
              <tr>
                {visibleGroupsWithCount.map(({ group, count }, gIdx) => {
                  const meta = COL_GROUP_META[group];
                  const isFirstGroup = gIdx === 0;
                  const isIdentificacao = group === "identificacao";
                  const stickyLeft = isFirstGroup && isIdentificacao;
                  return (
                    <th
                      key={group}
                      colSpan={count}
                      style={{
                        ...thGroup,
                        background: meta.bg,
                        color: meta.color,
                        ...(stickyLeft ? { left: 0, zIndex: 32, boxShadow: "2px 0 4px rgba(0,0,0,0.06)" } : {}),
                      }}
                    >
                      {meta.label}
                    </th>
                  );
                })}
                <th
                  style={{
                    ...thGroup,
                    background: ACTIONS_GROUP_BG,
                    color: "white",
                  }}
                >
                  Ações
                </th>
              </tr>

              {/* Linha 2 — cabeçalhos de coluna */}
              <tr>
                {visibleOrdered.map((col) => {
                  const isLastIdCol = col.id === lastIdColumnId;
                  const isSticky = col.sticky != null;
                  const leftOffset = stickyLeftById.get(col.id) ?? 0;
                  const align = col.align;

                  const baseStyle: React.CSSProperties = isSticky
                    ? headerStickyStyle(leftOffset, isLastIdCol)
                    : { ...thBase, textAlign: align };

                  return (
                    <th
                      key={col.id}
                      onClick={() => doSort(col.id)}
                      style={baseStyle}
                      title={col.label}
                    >
                      {col.label} <SortIco col={col.id}/>
                    </th>
                  );
                })}
                <th
                  style={{
                    ...thBase,
                    textAlign: "center",
                    position: "sticky",
                    top: 28,
                    zIndex: 10,
                    cursor: "default",
                  }}
                >
                  Ações
                </th>
              </tr>
            </thead>

            <tbody>
              {paginated.map((c: any, rowIdx: number) => {
                const rowBg = rowIdx % 2 === 1 ? "#f8fafc" : "#ffffff";

                const setRowBg = (el: HTMLTableRowElement, bg: string) => {
                  el.style.background = bg;
                  el.querySelectorAll<HTMLElement>("td[data-sticky]").forEach(td => { td.style.background = bg; });
                };

                return (
                  <tr key={c.id} style={{ background: rowBg, transition: "background 0.07s" }}
                      onMouseOver={e => setRowBg(e.currentTarget, "#eff6ff")}
                      onMouseOut={e => setRowBg(e.currentTarget, rowBg)}>

                    {visibleOrdered.map((col) => {
                      const isLastIdCol = col.id === lastIdColumnId;
                      const isSticky = col.sticky != null;
                      const align = col.align;

                      if (isSticky) {
                        const leftOffset = stickyLeftById.get(col.id) ?? 0;
                        return (
                          <td
                            key={col.id}
                            data-sticky="1"
                            style={cellStickyStyle(leftOffset, rowBg, isLastIdCol)}
                          >
                            {renderCellContent(col, c)}
                          </td>
                        );
                      }

                      const tdStyle: React.CSSProperties =
                        align === "right" ? tdNum :
                        align === "center" ? tdCenter :
                        tdBase;

                      return (
                        <td key={col.id} style={tdStyle}>
                          {renderCellContent(col, c)}
                        </td>
                      );
                    })}

                    {/* Ações — sempre visível */}
                    <td style={tdCenter}>
                      <div style={{ display:"flex", gap:2, justifyContent:"center" }}>
                        <Link href={`/contracts/${c.id}`} style={{ width:22, height:22, border:"none", background:"transparent", cursor:"pointer", borderRadius:3, display:"flex", alignItems:"center", justifyContent:"center", color:"#6b7280" }} title="Visualizar Contrato">
                          <Eye size={12}/>
                        </Link>
                        <button type="button" style={{ width:22, height:22, border:"none", background:"transparent", cursor:"pointer", borderRadius:3, display:"flex", alignItems:"center", justifyContent:"center", color:"#6b7280" }} title="Tabela Price" onClick={() => handleOpenPrice(c.id)}>
                          <Calculator size={12}/>
                        </button>
                        {c.validationUrl && (
                          <a href={c.validationUrl} target="_blank" rel="noopener noreferrer" style={{ width:22, height:22, borderRadius:3, display:"flex", alignItems:"center", justifyContent:"center", color:"#6b7280" }} title="Validação Digital">
                            <ExternalLink size={12}/>
                          </a>
                        )}
                        <button type="button" style={{ width:22, height:22, border:"none", background:"transparent", cursor:"pointer", borderRadius:3, display:"flex", alignItems:"center", justifyContent:"center", color:"#dc2626" }} title="Excluir" onClick={() => handleDelete(c.id)}>
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {filtered.length > 0 && (
              <tfoot>
                <tr style={{ background: footerBg }}>
                  {visibleOrdered.map((col) => {
                    const isLastIdCol = col.id === lastIdColumnId;
                    const isSticky = col.sticky != null;
                    const align = col.align;

                    const baseFooterTd: React.CSSProperties = {
                      ...tdBase,
                      padding: "6px 7px",
                      background: footerBg,
                      borderBottom: "none",
                      textAlign: isSticky ? "left" : align,
                    };

                    if (isSticky) {
                      const leftOffset = stickyLeftById.get(col.id) ?? 0;
                      return (
                        <td
                          key={col.id}
                          data-sticky="1"
                          style={{
                            ...baseFooterTd,
                            position: "sticky",
                            left: leftOffset,
                            zIndex: 6,
                            boxShadow: isLastIdCol ? "2px 0 4px rgba(0,0,0,0.15)" : undefined,
                          }}
                        >
                          {renderFooterCell(col)}
                        </td>
                      );
                    }

                    return (
                      <td
                        key={col.id}
                        style={{
                          ...baseFooterTd,
                          fontFamily: align === "right" ? FONT_MONO : undefined,
                        }}
                      >
                        {renderFooterCell(col)}
                      </td>
                    );
                  })}
                  <td style={{ ...tdBase, background: footerBg, borderBottom: "none" }} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ══ PAGINAÇÃO (dentro do mesmo container da tabela) ══════════════ */}
        <div style={{ padding:"6px 12px", borderTop:"1px solid #e5e7eb", background:"#fafbfc", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#6b7280" }}>
            <span>Exibir</span>
            <select style={{ padding:"3px 6px", border:"1px solid #d1d5db", borderRadius:4, fontSize:11, background:"white", cursor:"pointer" }} value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(1); }}>
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span>por página</span>
          </div>
          <span style={{ fontSize:11, color:"#6b7280" }}>Mostrando {Math.min((page-1)*pageSize+1, filtered.length)}–{Math.min(page*pageSize, filtered.length)} de {filtered.length}</span>
          <div style={{ display:"flex", alignItems:"center", gap:3 }}>
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={{ padding:"4px 10px", border:"1px solid #d1d5db", borderRadius:4, background:"white", fontSize:11, cursor:page===1?"not-allowed":"pointer", color:page===1?"#9ca3af":"#374151" }}>← Anterior</button>
            {Array.from({ length:Math.min(5,totalPages) }, (_,i) => {
              const n = page<=3 ? i+1 : page-2+i; if (n<1||n>totalPages) return null;
              return <button key={n} onClick={() => setPage(n)} style={{ width:28, height:26, borderRadius:4, border:"1px solid", fontSize:11, cursor:"pointer", fontWeight:n===page?700:400, background:n===page?"#1e2139":"white", color:n===page?"white":"#374151", borderColor:n===page?"#1e2139":"#d1d5db" }}>{n}</button>;
            })}
            <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page>=totalPages} style={{ padding:"4px 10px", border:"1px solid #d1d5db", borderRadius:4, background:"white", fontSize:11, cursor:page>=totalPages?"not-allowed":"pointer", color:page>=totalPages?"#9ca3af":"#374151" }}>Próxima →</button>
          </div>
        </div>
        </div>

      </div>

      {/* ══ MODAL PRICE ═════════════════════════════════════════════════ */}
      {priceId && (
        <div className="sigx-modal-overlay" onClick={e => { if (e.target===e.currentTarget) setPriceId(null); }}>
          <div className="sigx-modal" style={{ maxWidth:900 }}>
            <div className="sigx-modal-header">
              <span className="sigx-modal-title"><Calculator size={15} style={{ marginRight:6, verticalAlign:"middle" }}/>Tabela Price — {priceData?.contractName ?? "..."}</span>
              <button onClick={() => setPriceId(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--muted-foreground)", display:"flex" }}><X size={18}/></button>
            </div>
            {priceLoading ? (
              <div style={{ padding:40, textAlign:"center" }}>
                <div style={{ width:28, height:28, border:"2px solid #2563eb", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto" }}/>
              </div>
            ) : priceData ? (
              <>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", borderBottom:"1px solid var(--border)" }}>
                  {[
                    { label:"PRINCIPAL",        value:fmt(priceData.principal),     color:"#1e2139" },
                    { label:"TOTAL FINANCIADO", value:fmt(priceData.financedTotal), color:"#2563eb" },
                    { label:"TOTAL DE JUROS",   value:fmt(priceData.totalInterest), color:"#dc2626" },
                    { label:"TOTAL A PAGAR",    value:fmt(priceData.totalPayable),  color:"#ea580c" },
                    { label:"CET MENSAL",       value:`2,0000%`, color:"#7c3aed" },
                    { label:"CET ANUAL",        value:`26,80%`,  color:"#0891b2" },
                  ].map((c, i) => (
                    <div key={c.label} style={{ padding:"12px 16px", borderLeft:i>0?"1px solid var(--border)":"none", borderTop:`3px solid ${c.color}` }}>
                      <div style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", color:"var(--muted-foreground)", marginBottom:4 }}>{c.label}</div>
                      <div style={{ fontFamily: FONT_MONO, fontSize:15, fontWeight:800, color:c.color }}>{c.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ maxHeight:320, overflowY:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"separate", borderSpacing:0, fontSize:11 }}>
                    <thead>
                      <tr>
                        {["#","VENCIMENTO","PRESTAÇÃO","JUROS","AMORTIZAÇÃO","SALDO DEVEDOR"].map((col, i) => (
                          <th key={col} style={{ position:"sticky", top:0, zIndex:10, background:"#1e2139", color:"white", padding:"6px 10px", fontSize:9, fontWeight:700, textTransform:"uppercase", textAlign:i===0?"center":i===1?"left":"right", whiteSpace:"nowrap" }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {priceData.rows.map((row: any, idx: number) => (
                        <tr key={row.n} style={{ background:idx%2===1?"#f9fafb":"white" }} onMouseOver={e=>(e.currentTarget.style.background="#eff6ff")} onMouseOut={e=>(e.currentTarget.style.background=idx%2===1?"#f9fafb":"white")}>
                          <td style={{ textAlign:"center", padding:"5px 10px", fontFamily: FONT_MONO, fontSize:10, color:"#9ca3af", borderBottom:"1px solid #e5e7eb" }}>{String(row.n).padStart(2,"0")}</td>
                          <td style={{ padding:"5px 10px", fontSize:11, borderBottom:"1px solid #e5e7eb" }}>{fmtDate(row.dueDate)}</td>
                          <td style={{ textAlign:"right", padding:"5px 10px", fontFamily: FONT_MONO, fontWeight:700, borderBottom:"1px solid #e5e7eb" }}>{fmt(row.payment)}</td>
                          <td style={{ textAlign:"right", padding:"5px 10px", fontFamily: FONT_MONO, color:row.interest>0?"#dc2626":"#9ca3af", borderBottom:"1px solid #e5e7eb" }}>{fmt(row.interest)}</td>
                          <td style={{ textAlign:"right", padding:"5px 10px", fontFamily: FONT_MONO, color:"#059669", borderBottom:"1px solid #e5e7eb" }}>{fmt(row.amortization)}</td>
                          <td style={{ textAlign:"right", padding:"5px 10px", fontFamily: FONT_MONO, fontWeight:600, borderBottom:"1px solid #e5e7eb" }}>{fmt(row.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
            <div className="sigx-modal-footer">
              <button className="btn-primary" onClick={() => setPriceId(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </UnyPayLayout>
  );
}
