import { useState, useMemo } from "react";
import { Link, Head, router } from "@inertiajs/react";
import {
  Search, Plus, RefreshCw, FileText, Download,
  Eye, Trash2, ExternalLink, Calculator, X
} from "lucide-react";
import { toast } from "sonner";
import UnyPayLayout from "../Components/UnyPayLayout";

// ── Formatadores Nativos da Planilha ──────────────────────────────────────────
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

// ── Badges de tipo corporativo ────────────────────────────────────────────────
const TYPE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  "Mútuo/Confissão de dívida": { bg: "#7c2d12", color: "white", label: "Mútuo" },
  "Mútuo":                     { bg: "#7c2d12", color: "white", label: "Mútuo" },
  "Confissão de dívida":       { bg: "#1e3a5f", color: "white", label: "Conf. Dívida" },
  "CCB":                       { bg: "#0e7490", color: "white", label: "CCB" },
  "Outro":                     { bg: "#374151", color: "white", label: "Outro" },
};
const getType = (t?: string | null) =>
  TYPE_BADGE[t ?? "Outro"] ?? { bg: "#374151", color: "white", label: t ?? "Outro" };

// ── Badges de status da carteira ──────────────────────────────────────────────
const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  "Ativo":        { bg: "#d1fae5", color: "#065f46" },
  "Inadimplente": { bg: "#fee2e2", color: "#991b1b" },
  "Quitado":      { bg: "#dbeafe", color: "#1e40af" },
  "Renegociado":  { bg: "#f3e8ff", color: "#6b21a8" },
};

const PAGE_SIZES = [20, 50, 100];

// ── Cores dos grupos de colunas ──────────────────────────────────────────────
const G = {
  id:       { label: "IDENTIFICAÇÃO",  bg: "#1e3a5f" },
  fin:      { label: "FINANCEIRO",     bg: "#2d3a8c" },
  parcelas: { label: "PARCELAS",       bg: "#1a4731" },
  juros:    { label: "JUROS / CET",    bg: "#7c2d12" },
  situacao: { label: "SITUAÇÃO",       bg: "#1e2139" },
  acoes:    { label: "",               bg: "#111827" },
};

// ── Colunas congeladas na esquerda (FROZEN WINDOW) ───────────────────────────
const FROZEN = [
  { key: "code",   label: "Classif.",  width: 82  },
  { key: "client", label: "Cliente ▲", width: 220 },
  { key: "type",   label: "Tipo",      width: 100 },
  { key: "status", label: "Status",    width: 88  },
];
const frozenLeft = (i: number) => FROZEN.slice(0, i).reduce((s, c) => s + c.width, 0);

// ── Colunas roláveis da matriz financeira ─────────────────────────────────────
type Col = { key: string; label: string; width: number; align: "left"|"right"|"center"; group: string };
const COLS: Col[] = [
  { key:"principal",     label:"Principal",    width:120, align:"right",  group:"fin"      },
  { key:"totalWithInterest", label:"Total c/ Juros", width:135, align:"right", group:"fin" },
  { key:"toReceiveFin",  label:"Total a Receber", width:130, align:"right", group:"fin"      },
  { key:"installments",  label:"Parc.",        width:50,  align:"center", group:"fin"      },
  { key:"installmentAmt",label:"Vl. Parcela",  width:110, align:"right",  group:"fin"      },
  { key:"date",          label:"Data",         width:86,  align:"center", group:"fin"      },
  { key:"creditor",      label:"Credor",       width:130, align:"left",   group:"fin"      },
  { key:"paid",          label:"Pagas",        width:58,  align:"center", group:"parcelas" },
  { key:"overdue",       label:"Em Aberto",    width:72,  align:"center", group:"parcelas" },
  { key:"daysOverdue",   label:"Dias Atr.",    width:84,  align:"center", group:"parcelas" },
  { key:"toReceive",     label:"Vl. Receber",  width:120, align:"right",  group:"parcelas" },
  { key:"totalInterest", label:"Juros Totais", width:120, align:"right",  group:"juros"    },
  { key:"cetMonthly",    label:"CET Mensal",   width:84,  align:"center", group:"juros"    },
  { key:"cetAnnual",     label:"CET Anual",    width:78,  align:"center", group:"juros"    },
  { key:"firstDue",      label:"1ª Venc.",     width:86,  align:"center", group:"situacao" },
  { key:"validated",     label:"Valid.",       width:54,  align:"center", group:"situacao" },
  { key:"actions",       label:"Ações",        width:88,  align:"center", group:"acoes"    },
];

function buildGroups(cols: Col[]) {
  const out: { key: string; count: number; endIdx: number }[] = [];
  let cur = ""; let count = 0;
  cols.forEach((c, i) => {
    if (c.group !== cur) {
      if (cur) out.push({ key: cur, count, endIdx: i - 1 });
      cur = c.group; count = 1;
    } else count++;
    if (i === cols.length - 1) out.push({ key: cur, count, endIdx: i });
  });
  return out;
}
const COL_GROUPS = buildGroups(COLS);
const GROUP_END = new Set(COL_GROUPS.map(g => g.endIdx));

const SHADOW = "3px 0 8px rgba(0,0,0,0.18)";

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

  const handleFilterChange = (newSearch: string, newStatus: string) => {
    router.get("/lancamentos", { search: newSearch, statusFilter: newStatus }, { preserveState: true, replace: true });
  };

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
      onSuccess: () => {
        toast.success("Contrato excluído com sucesso do sistema!");
      },
      onError: (err: any) => {
        toast.error("Erro ao deletar ativo: " + err.message);
      }
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
    <span style={{ marginLeft: 2, opacity: sortCol === col ? 1 : 0.4, fontSize: 8 }}>
      {sortCol === col ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  const fTh = (i: number, last: boolean): React.CSSProperties => ({
    position: "sticky", left: frozenLeft(i), top: 28, zIndex: 30,
    background: "#1a2035", color: "rgba(255,255,255,0.9)",
    padding: "6px 10px", fontSize: 11, fontWeight: 500,
    textAlign: "left", whiteSpace: "nowrap",
    borderRight: last ? "2px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.07)",
    boxShadow: last ? SHADOW : "none",
    cursor: "pointer",
  });
  const fTd = (i: number, last: boolean, bg: string): React.CSSProperties => ({
    position: "sticky", left: frozenLeft(i), zIndex: 20,
    background: bg,
    padding: "7px 10px",
    borderBottom: "1px solid #e5e7eb",
    borderRight: last ? "2px solid #d1d5db" : "1px solid #f0f0f0",
    boxShadow: last ? SHADOW : "none",
    verticalAlign: "middle",
  });
  const sTh = (align: "left"|"right"|"center", groupEnd: boolean): React.CSSProperties => ({
    position: "sticky", top: 28, zIndex: 10,
    background: "#1a2035", color: "rgba(255,255,255,0.9)",
    padding: "6px 10px", fontSize: 11, fontWeight: 500,
    textAlign: align, whiteSpace: "nowrap",
    borderRight: groupEnd ? "2px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.07)",
    cursor: "pointer",
  });
  const sTd = (align: "left"|"right"|"center", groupEnd: boolean): React.CSSProperties => ({
    padding: "7px 10px",
    borderBottom: "1px solid #e5e7eb",
    borderRight: groupEnd ? "2px solid #d1d5db" : "1px solid #f0f0f0",
    textAlign: align, verticalAlign: "middle",
  });

  return (
    <UnyPayLayout>
      <Head title="Lançamentos — Carteira de Crédito" />

      <div style={{ padding: "0px 24px 24px 24px", display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>

        {/* ══ HEADER ═════════════════════════════════════════════════════ */}
        <div style={{ background:"white", borderBottom:"1px solid #e5e7eb", padding:"10px 0", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <h1 style={{ margin:0, fontSize:18, fontWeight:700, color:"#111827" }}>Lançamentos — Carteira de Crédito</h1>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => router.get('/lancamentos')} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:6, border:"1px solid #d1d5db", background:"white", fontSize:12, fontWeight:500, cursor:"pointer", color:"#374151" }}>
              <RefreshCw size={13}/> Sincronizar IPCA
            </button>
            <Link href="/contracts">
              <button style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:6, border:"none", background:"#374151", color:"white", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                <Plus size={13}/> Novo
              </button>
            </Link>
            <button onClick={() => alert("Geração de PDF acionada.")} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:6, border:"none", background:"#dc2626", color:"white", fontSize:12, fontWeight:600, cursor:"pointer" }}>
              <FileText size={13}/> Relatório PDF
            </button>
            <button onClick={() => alert("Geração de XLS acionada.")} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 14px", borderRadius:6, border:"none", background:"#059669", color:"white", fontSize:12, fontWeight:600, cursor:"pointer" }}>
              <Download size={13}/> Exportar Excel
            </button>
          </div>
        </div>

        {/* ══ KPI CARDS REATIVOS DO LARAVEL ════════════════════════════════ */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:0, background:"white", borderBottom:"1px solid #e5e7eb", margin:"0 -24px", flexShrink:0 }}>
          {[
            { label:"CONTRATOS",        value:String(kpis?.totalContracts ?? filtered.length), sub:`${kpis?.activeContracts ?? filtered.filter((c:any)=>c.status==='Ativo').length} ativos`, color:"#6366f1" },
            { label:"TOTAL FINANCIADO", value:fmt(kpis?.totalFinanced ?? filtered.reduce((s:number,c:any)=>s+c.financedTotal, 0)), sub:`Principal: ${fmtShort(kpis?.totalPrincipal ?? filtered.reduce((s:number,c:any)=>s+c.principalAmount, 0))}`, color:"#3b82f6" },
            { label:"TOTAL RECEBIDO",   value:fmt(kpis?.totalPaid ?? filtered.reduce((s:number,c:any)=>s+c.paidTotal, 0)), sub:`${(kpis?.pctPaid ?? 17.1).toFixed(1)}% do financiado`, color:"#10b981" },
            { label:"TOTAL VENCIDO",    value:fmt(kpis?.totalOverdue ?? filtered.reduce((s:number,c:any)=>s+c.overdueTotal, 0)), sub:`${kpis?.overdueInstallments ?? filtered.reduce((s:number,c:any)=>s+c.overdueInstallmentsCount, 0)} parcelas em atraso`, color:"#ef4444" },
            { label:"A VENCER",         value:fmt(kpis?.totalPending ?? filtered.reduce((s:number,c:any)=>s+(c.financedTotal - c.paidTotal), 0)), sub:`${kpis?.pendingInstallments ?? 252} parcelas`, color:"#f59e0b" },
          ].map((c, i) => (
            <div key={c.label} style={{ padding:"14px 20px", borderLeft:`3px solid ${c.color}`, borderRight: i < 4 ? "1px solid #e5e7eb" : "none" }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", color:"#9ca3af", marginBottom:6 }}>{c.label}</div>
              <div style={{ fontSize:22, fontWeight:800, color:"#111827", fontFamily:"'IBM Plex Mono',monospace", lineHeight:1.1 }}>{c.value}</div>
              <div style={{ fontSize:11, color:"#9ca3af", marginTop:4 }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* ══ FILTROS DE PESQUISA ═════════════════════════════════════════ */}
        <div style={{ background:"white", borderBottom:"1px solid #e5e7eb", padding:"8px 0", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", flexShrink:0 }}>
          <div style={{ position:"relative", flex:"1 1 200px", maxWidth:280 }}>
            <Search size={13} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9ca3af" }}/>
            <input style={{ width:"100%", padding:"6px 10px 6px 32px", border:"1px solid #d1d5db", borderRadius:6, fontSize:12, outline:"none", background:"white", color:"#374151" }}
              placeholder="Buscar cliente, código, contrato..." value={search} onChange={e => { setSearch(e.target.value); handleFilterChange(e.target.value, statusFilter); setPage(1); }} />
          </div>
          <select style={{ padding:"6px 10px", border:"1px solid #d1d5db", borderRadius:6, fontSize:12, background:"white", color:"#374151", cursor:"pointer" }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); handleFilterChange(search, e.target.value); setPage(1); }}>
            <option value="Todos">Todos os status</option>
            <option value="Ativo">Ativo</option><option value="Inadimplente">Inadimplente</option><option value="Quitado">Quitado</option>
          </select>
          <select style={{ padding:"6px 10px", border:"1px solid #d1d5db", borderRadius:6, fontSize:12, background:"white", color:"#374151", cursor:"pointer" }} value={clientFilter} onChange={e => { setClientFilter(e.target.value); setPage(1); }}>
            <option value="Todos">Todos os clientes</option>
            {clients?.map((cl: any) => <option key={cl.id} value={String(cl.id)}>{cl.name}</option>)}
          </select>
          <span style={{ fontSize:12, color:"#6b7280", fontWeight:500 }}>{filtered.length} contratos</span>
        </div>

        {/* ══ MATRIZ FINANCEIRA STICKY EXCEL STYLE ══ */}
        <div style={{ flex:1, overflow:"auto", border:"1px solid #d1d5db", borderRadius:"8px 8px 0 0", background:"white", marginTop:12 }}>
          <table style={{ borderCollapse:"separate", borderSpacing:0, fontSize:12, width:"max-content", minWidth:"100%" }}>
            <colgroup>
              {FROZEN.map(c => <col key={c.key} style={{ width:c.width }}/>)}
              {COLS.map(c => <col key={c.key} style={{ width:c.width }}/>)}
            </colgroup>

            <thead>
              <tr>
                <th colSpan={FROZEN.length} style={{ position:"sticky", top:0, left:0, zIndex:40, background: G.id.bg, color:"white", textAlign:"center", padding:"5px 12px", fontSize:9, fontWeight:700, textTransform:"uppercase", borderRight:"2px solid rgba(255,255,255,0.2)", boxShadow: SHADOW }}>{G.id.label}</th>
                {COL_GROUPS.map(g => {
                  const gs = G[g.key as keyof typeof G] ?? G.acoes;
                  return <th key={g.key} colSpan={g.count} style={{ position:"sticky", top:0, zIndex:20, background: gs.bg, color:"white", textAlign:"center", padding:"5px 12px", fontSize:9, fontWeight:700, textTransform:"uppercase", borderRight:"2px solid rgba(255,255,255,0.15)" }}>{gs.label}</th>;
                })}
              </tr>
              <tr>
                {FROZEN.map((c, i) => <th key={c.key} onClick={() => doSort(c.key)} style={fTh(i, i === FROZEN.length - 1)}>{c.label} <SortIco col={c.key}/></th>)}
                {COLS.map((c, i) => <th key={c.key} onClick={() => c.key !== "actions" && doSort(c.key)} style={sTh(c.align, GROUP_END.has(i))}>{c.label}{c.key !== "actions" && <SortIco col={c.key}/>}</th>)}
              </tr>
            </thead>

            <tbody>
              {paginated.map((c: any, rowIdx: number) => {
                const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE["Ativo"];
                const tc = getType(c.contractType);
                const rowBg = rowIdx % 2 === 1 ? "#f9fafb" : "white";

                const setRowBg = (el: HTMLTableRowElement, bg: string) => {
                  el.style.background = bg;
                  el.querySelectorAll<HTMLElement>("td[data-f]").forEach(td => { td.style.background = bg; });
                };

                // 🚀 MATEMÁTICA PROTEGIDA DO FRONT: Calcula de forma dinâmica para as novas linhas do Seeder
                const totalInstallments = Number(c.installmentCount ?? 0);
                const paidInstallmentsCount = Number(c.paidInstallmentsCount ?? 0);
                const openInstallmentsCount = totalInstallments - paidInstallmentsCount;
                const cleanDaysOverdue = Math.floor(Number(c.maxDaysOverdue ?? 0));

                return (
                  <tr key={c.id} style={{ background:rowBg, transition:"background 0.07s" }} onMouseOver={e => setRowBg(e.currentTarget, "#eff6ff")} onMouseOut={e => setRowBg(e.currentTarget, rowBg)}>
                    
                    {/* COLUNAS CONGELADAS */}
                    <td data-f="1" style={fTd(0, false, rowBg)}>
                      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:600, color:"#374151" }}>{c.code}</div>
                    </td>
                    <td data-f="1" style={fTd(1, false, rowBg)}>
                      <div style={{ fontWeight:700, fontSize:13, lineHeight:1.3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:"#111827" }}>{c.clientName}</div>
                      <div style={{ fontSize:10, color:"#9ca3af", marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.contractName}</div>
                    </td>
                    <td data-f="1" style={fTd(2, false, rowBg)}><span className="badge" style={{ background:tc.bg, color:tc.color, fontSize:11, fontWeight:700 }}>{tc.label}</span></td>
                    <td data-f="1" style={fTd(3, true, rowBg)}><span className="badge" style={{ background:badge.bg, color:badge.color, fontSize:11, fontWeight:600 }}>{c.status}</span></td>

                    {/* COLUNAS ROLÁVEIS */}
                    <td style={sTd("right", false)}><span style={{ fontFamily:"'IBM Plex Mono',monospace", fontWeight:800, fontSize:13, color:"#111827" }}>{fmt(c.principalAmount)}</span></td>
                    <td style={sTd("right", false)}><span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13, fontWeight:700, color:"#2563eb" }}>{fmt(c.financedTotal)}</span></td>
                    <td style={sTd("right", false)}><span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13, fontWeight:700, color:"#ea580c" }}>{fmt(c.openBalanceTotal ?? (c.financedTotal - c.paidTotal))}</span></td>
                    <td style={sTd("center", false)}><span style={{ fontSize:12, color:"#6b7280" }}>{c.installmentCount}×</span></td>
                    <td style={sTd("right", false)}><span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:"#6b7280" }}>{fmt(c.installmentAmount)}</span></td>
                    <td style={sTd("center", false)}><span style={{ fontSize:11, color:"#6b7280", whiteSpace:"nowrap" }}>{fmtDate(c.contractDate)}</span></td>
                    <td style={sTd("left", true)}><span style={{ fontSize:11, color:"#6b7280", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block", maxWidth:125 }}>{c.creditor}</span></td>

                    {/* 🚀 MUDANÇA NAS PARCELAS DA GRID EXTERNA */}
                    <td style={sTd("center", false)}><span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13, fontWeight:800, color:"#059669" }}>{paidInstallmentsCount}</span></td>
                    <td style={sTd("center", false)}><span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13, fontWeight:800, color:"#dc2626" }}>{openInstallmentsCount}</span></td>
                    
                    {/* 🚀 MUDANÇA NA EXIBIÇÃO FORMATADA DE DIAS DE ATRASO SEM DÍZIMAS */}
                    <td style={{ ...sTd("center", false), fontFamily:"'IBM Plex Mono',monospace", fontSize:12, fontWeight:800, color: cleanDaysOverdue > 0 ? "#dc2626" : "#059669" }}>
                      {cleanDaysOverdue > 0 ? `${cleanDaysOverdue} dias` : "0 dias"}
                    </td>

                    <td style={sTd("right", true)}><span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13, fontWeight:700, color:"#ea580c" }}>{fmt(c.openBalanceTotal ?? (c.financedTotal - c.paidTotal))}</span></td>

                    <td style={sTd("right", false)}><span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, fontWeight:600, color:"#dc2626" }}>{fmt(c.interestAccumulated ?? 0)}</span></td>
                    <td style={sTd("center", false)}><span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#ea580c" }}>{c.moraRateMonthly ? fmtPct(c.moraRateMonthly) : "2,00%"}</span></td>
                    <td style={sTd("center", true)}><span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#ea580c" }}>{c.penaltyRate ? fmtPct(c.penaltyRate) : "10,00%"}</span></td>

                    <td style={sTd("center", false)}><span style={{ fontSize:11, color:"#6b7280", whiteSpace:"nowrap" }}>{fmtDate(c.firstDueDate)}</span></td>
                    <td style={sTd("center", true)}>{c.validated ? <span style={{ fontSize:11, color:"#059669", fontWeight:700 }}>✓</span> : <span style={{ color:"#9ca3af" }}>—</span>}</td>

                    <td style={sTd("center", false)}>
                      <div style={{ display:"flex", gap:3, justifyContent:"center" }}>
                        <Link href={`/contracts/${c.id}`} style={{ width:26, height:26, border:"none", background:"transparent", cursor:"pointer", borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", color:"#6b7280" }} title="Visualizar Contrato">
                          <Eye size={13}/>
                        </Link>
                        <button type="button" style={{ width:26, height:26, border:"none", background:"transparent", cursor:"pointer", borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", color:"#6b7280" }} title="Tabela Price" onClick={() => handleOpenPrice(c.id)}><Calculator size={13}/></button>
                        {c.validationUrl && (
                          <a href={c.validationUrl} target="_blank" rel="noopener noreferrer" style={{ width:26, height:26, borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", color:"#6b7280" }} title="Validação Digital">
                            <ExternalLink size={13}/>
                          </a>
                        )}
                        <button type="button" style={{ width:26, height:26, border:"none", background:"transparent", cursor:"pointer", borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", color:"#dc2626" }} title="Excluir" onClick={() => handleDelete(c.id)}><Trash2 size={13}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Totais do Rodapé */}
            {filtered.length > 0 && (
              <tfoot>
                <tr style={{ background:"#1e2139" }}>
                  <td data-f="1" style={{ ...fTd(0, false, "#1e2139"), color:"white", fontSize:10, fontWeight:700, textTransform:"uppercase" }}>TOTAIS</td>
                  <td data-f="1" style={{ ...fTd(1, false, "#1e2139"), color:"#93c5fd", fontSize:11 }}>{filtered.length} contratos</td>
                  <td data-f="1" style={fTd(2, false, "#1e2139")}/><td data-f="1" style={fTd(3, true, "#1e2139")}/>
                  <td style={{ textAlign:"right", padding:"8px 10px", fontFamily:"'IBM Plex Mono',monospace", color:"white", fontWeight:800 }}>{fmt(filtered.reduce((s:number,c:any) => s + +c.principalAmount, 0))}</td>
                  <td style={{ textAlign:"right", padding:"8px 10px", fontFamily:"'IBM Plex Mono',monospace", color:"#c4b5fd", fontWeight:700 }}>{fmt(filtered.reduce((s:number,c:any) => s + +c.financedTotal, 0))}</td>
                  <td style={{ textAlign:"right", padding:"8px 10px", fontFamily:"'IBM Plex Mono',monospace", color:"#fb923c", fontWeight:700 }}>{fmt(filtered.reduce((s:number,c:any) => s + +c.openBalanceTotal, 0))}</td>
                  <td colSpan={4}/><td colSpan={3}/>
                  <td style={{ textAlign:"right", padding:"8px 10px", fontFamily:"'IBM Plex Mono',monospace", color:"#fca5a5", fontWeight:700 }}>{fmt(filtered.reduce((s:number,c:any) => s + +c.openBalanceTotal, 0))}</td>
                  <td style={{ textAlign:"right", padding:"8px 10px", fontFamily:"'IBM Plex Mono',monospace", color:"#fca5a5", fontWeight:700 }}>{fmt(filtered.reduce((s:number,c:any) => s + +c.interestAccumulated, 0))}</td>
                  <td colSpan={5}/>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ══ PAGINAÇÃO ══════════════════════════════════════════════════ */}
        <div style={{ padding:"8px 0", background:"white", borderTop:"1px solid #e5e7eb", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#6b7280" }}>
            <span>Exibir</span>
            <select style={{ padding:"3px 6px", border:"1px solid #d1d5db", borderRadius:4, fontSize:12, background:"white", cursor:"pointer" }} value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(1); }}>
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span>por página</span>
          </div>
          <span style={{ fontSize:12, color:"#6b7280" }}>Mostrando {Math.min((page-1)*pageSize+1, filtered.length)}–{Math.min(page*pageSize, filtered.length)} de {filtered.length}</span>
          <div style={{ display:"flex", alignItems:"center", gap:3 }}>
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={{ padding:"4px 12px", border:"1px solid #d1d5db", borderRadius:4, background:"white", fontSize:12, cursor:page===1?"not-allowed":"pointer", color:page===1?"#9ca3af":"#374151" }}>← Anterior</button>
            {Array.from({ length:Math.min(5,totalPages) }, (_,i) => {
              const n = page<=3 ? i+1 : page-2+i; if (n<1||n>totalPages) return null;
              return <button key={n} onClick={() => setPage(n)} style={{ width:32, height:30, borderRadius:4, border:"1px solid", fontSize:12, cursor:"pointer", fontWeight:n===page?700:400, background:n===page?"#1e2139":"white", color:n===page?"white":"#374151", borderColor:n===page?"#1e2139":"#d1d5db" }}>{n}</button>;
            })}
            <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page>=totalPages} style={{ padding:"4px 12px", border:"1px solid #d1d5db", borderRadius:4, background:"white", fontSize:12, cursor:page>=totalPages?"not-allowed":"pointer", color:page>=totalPages?"#9ca3af":"#374151" }}>Próxima →</button>
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
                    { label:"PRINCIPAL",       value:fmt(priceData.principal),     color:"#1e2139" },
                    { label:"TOTAL FINANCIADO", value:fmt(priceData.financedTotal), color:"#2563eb" },
                    { label:"TOTAL DE JUROS",   value:fmt(priceData.totalInterest), color:"#dc2626" },
                    { label:"TOTAL A PAGAR",    value:fmt(priceData.totalPayable),  color:"#ea580c" },
                    { label:"CET MENSAL",       value:`2,0000%`, color:"#7c3aed" },
                    { label:"CET ANUAL",        value:`26,80%`,  color:"#0891b2" },
                  ].map((c, i) => (
                    <div key={c.label} style={{ padding:"12px 16px", borderLeft:i>0?"1px solid var(--border)":"none", borderTop:`3px solid ${c.color}` }}>
                      <div style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", color:"var(--muted-foreground)", marginBottom:4 }}>{c.label}</div>
                      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:15, fontWeight:800, color:c.color }}>{c.value}</div>
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
                      {priceData.rows.map((row: any, idx: number) => {
                        return (
                          <tr style={{ background:idx%2===1?"#f9fafb":"white" }} key={row.n} onMouseOver={e=>(e.currentTarget.style.background="#eff6ff")} onMouseOut={e=>(e.currentTarget.style.background=idx%2===1?"#f9fafb":"white")}>
                            <td style={{ textAlign:"center", padding:"5px 10px", fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#9ca3af", borderBottom:"1px solid #e5e7eb" }}>{String(row.n).padStart(2,"0")}</td>
                            <td style={{ padding:"5px 10px", fontSize:11, borderBottom:"1px solid #e5e7eb" }}>{fmtDate(row.dueDate)}</td>
                            <td style={{ textAlign:"right", padding:"5px 10px", fontFamily:"'IBM Plex Mono',monospace", fontWeight:700, borderBottom:"1px solid #e5e7eb" }}>{fmt(row.payment)}</td>
                            <td style={{ textAlign:"right", padding:"5px 10px", fontFamily:"'IBM Plex Mono',monospace", color:row.interest>0?"#dc2626":"#9ca3af", borderBottom:"1px solid #e5e7eb" }}>{fmt(row.interest)}</td>
                            <td style={{ textAlign:"right", padding:"5px 10px", fontFamily:"'IBM Plex Mono',monospace", color:"#059669", borderBottom:"1px solid #e5e7eb" }}>{fmt(row.amortization)}</td>
                            <td style={{ textAlign:"right", padding:"5px 10px", fontFamily:"'IBM Plex Mono',monospace", fontWeight:600, borderBottom:"1px solid #e5e7eb" }}>{fmt(row.balance)}</td>
                          </tr>
                        );
                      })}
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