import { useState, useMemo } from "react";
import { Head, router } from "@inertiajs/react";
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area } from "recharts";
import { 
  DollarSign, TrendingUp, CheckCircle, AlertTriangle, Clock, 
  Users, FileText, Percent, Calendar, RefreshCw, Filter, X 
} from "lucide-react";
import UnyPayLayout from "../Components/UnyPayLayout";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtShort = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return fmt(v);
};
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtDate = (d?: string | null) => d ? d.split("-").reverse().join("/") : "—";

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
function formatMonth(m: string) {
  if (!m || m.length < 7) return m;
  const [y, mo] = m.split("-");
  return `${MONTH_NAMES[parseInt(mo) - 1]}/${y?.slice(2)}`;
}

// 🔄 Equalizado: Tooltip avançado integrado com os contadores dinâmicos reais do Manus
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 6, padding: "10px 14px", fontSize: 11, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", minWidth: 180, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div style={{ fontWeight: 700, marginBottom: 8, borderBottom: "1px solid #e5e7eb", paddingBottom: 6, color: "var(--foreground)" }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
          <span style={{ color: "#6b7280", flex: 1 }}>{p.name}:</span>
          <span style={{ fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>
            {typeof p.value === "number" && p.value > 100 ? fmtShort(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard({ kpis, monthlyEvolution, interestTable, overdueByMonth, filters }: any) {
  const [overdueMonthFilter, setOverdueMonthFilter] = useState(filters?.month || "");

  const handleMonthFilterChange = (month: string) => {
    setOverdueMonthFilter(month);
    router.get("/dashboard", { month }, { preserveState: true, replace: true });
  };

  const chartData = useMemo(() => {
    if (!monthlyEvolution) return [];
    return monthlyEvolution.map((m: any) => ({
      month: formatMonth(String(m.month ?? "")),
      "Recebido": Number(m.totalPaid ?? 0),
      "Vencido": Number(m.overdueAmount ?? 0),
      "Novos Contratos": Number(m.newPrincipal ?? 0),
    }));
  }, [monthlyEvolution]);

  const availableMonths = useMemo(() => {
    if (!monthlyEvolution) return [];
    return monthlyEvolution.map((m: any) => m.month).filter(Boolean).sort().reverse();
  }, [monthlyEvolution]);

  const totalInterestReal = useMemo(() => (interestTable ?? []).reduce((s: number, c: any) => s + c.totalInterest, 0), [interestTable]);
  const totalPayableReal = useMemo(() => (interestTable ?? []).reduce((s: number, c: any) => s + c.totalPayable, 0), [interestTable]);

  const clientVolumeRanking = useMemo(() => {
    if (!interestTable) return [];
    const clientMap: Record<string, number> = {};
    interestTable.forEach((c: any) => {
      const name = c.clientName ?? "Desconhecido";
      clientMap[name] = (clientMap[name] ?? 0) + Number(c.principal);
    });
    const sorted = Object.entries(clientMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxVal = sorted[0]?.[1] ?? 1;
    return sorted.map(([name, value], i) => ({ name, value, pctOfMax: (value / maxVal) * 100, index: i + 1 }));
  }, [interestTable]);

  // 🔄 Equalizado: Alinhamento das legendas nominais, subtextos e badges dinâmicos
  const mainCards = [
    { label: "TOTAL FINANCIADO", value: fmt(kpis?.totalFinanced ?? 0), sub: `Principal: ${fmtShort(kpis?.totalPrincipal ?? 0)}`, badge: `${kpis?.totalContracts ?? 0} contratos`, gradient: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%)", icon: DollarSign },
    { label: "TOTAL COM JUROS", value: fmt(totalPayableReal), sub: `Juros reais: ${fmtShort(totalInterestReal)}`, badge: `${fmtPct(kpis?.pctInterest ?? 0)} s/ principal`, gradient: "linear-gradient(135deg, #7c2d12 0%, #ea580c 60%, #f97316 100%)", icon: TrendingUp },
    { label: "TOTAL RECEBIDO", value: fmt(kpis?.totalPaid ?? 0), sub: `${fmtPct(kpis?.pctPaid ?? 0)} do financiado`, badge: `${kpis?.totalPaymentsCount ?? 0} pagamentos`, gradient: "linear-gradient(135deg, #065f46 0%, #059669 60%, #10b981 100%)", icon: CheckCircle },
    { label: "TOTAL VENCIDO", value: fmt(kpis?.totalOverdue ?? 0), sub: `${fmtPct(kpis?.pctOverdue ?? 0)} do financiado`, badge: `${kpis?.overdueInstallments ?? 0} faturas`, gradient: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 60%, #ef4444 100%)", icon: AlertTriangle },
  ];

  const secondaryMetrics = [
    { label: "A RECEBER", value: fmtShort(kpis?.totalPending ?? 0), sub: `${kpis?.pendingInstallments ?? 0} parcelas`, color: "#7c3aed", icon: Clock },
    { label: "CLIENTES", value: String(kpis?.totalClients ?? 0), sub: "cadastrados", color: "#2563eb", icon: Users },
    { label: "CONTRATOS ATIVOS", value: String(kpis?.activeContracts ?? 0), sub: `de ${kpis?.totalContracts ?? 0} total`, color: "#059669", icon: FileText },
    { label: "INADIMPLENTES", value: String(kpis?.inadimplentContracts ?? 0), sub: "contratos", color: "#dc2626", icon: AlertTriangle },
    { label: "QUITADOS", value: String(kpis?.quitadoContracts ?? 0), sub: "contratos", color: "#0891b2", icon: CheckCircle },
    { label: "VALIDADOS", value: String(kpis?.validatedContracts ?? 0), sub: "auditoria ok", color: "#d97706", icon: CheckCircle },
    { label: "PARCELAS PAGAS", value: String(kpis?.paidInstallments ?? 0), sub: `de ${kpis?.totalInstallments ?? 0} total`, color: "#059669", icon: CheckCircle },
    { label: "% PAGO", value: fmtPct(kpis?.pctPaid ?? 0), sub: "do financiado", color: "#2563eb", icon: Percent },
    { label: "% EM ATRASO", value: fmtPct(kpis?.pctOverdue ?? 0), sub: "do financiado", color: "#dc2626", icon: Percent },
  ];

  return (
    <UnyPayLayout>
      <Head title="Dashboard de Performance" />

      <style>{`
        /* —— Caixa alta visual da tela inteira —— */
        .dashboard-page,
        .dashboard-page input,
        .dashboard-page select,
        .dashboard-page textarea,
        .dashboard-page button,
        .dashboard-page option,
        .dashboard-page label,
        .dashboard-page h1, .dashboard-page h2, .dashboard-page h3,
        .dashboard-page p, .dashboard-page span, .dashboard-page strong,
        .dashboard-page td, .dashboard-page th { text-transform: uppercase; }

        /* Mantém legibilidade onde caixa alta atrapalha */
        .dashboard-page input.mono,
        .dashboard-page input[type="email"],
        .dashboard-page input[type="password"],
        .dashboard-page input[type="date"],
        .dashboard-page input[type="number"] { text-transform: none; }
        .dashboard-page input::placeholder,
        .dashboard-page textarea::placeholder { text-transform: none; }
        .dashboard-page .keep-case,
        .dashboard-page .keep-case * { text-transform: none !important; }

        /* SVGs do Recharts (eixos, legendas, tooltips) também em caixa alta */
        .dashboard-page svg text { text-transform: uppercase; }
      `}</style>

      <div className="dashboard-page" style={{ padding: "0px 24px 24px 24px" }}>
        
        {/* Action Bar */}
        <div style={{ padding: "8px 0px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2139", color: "white", padding: "5px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>
            <Calendar size={12} /> Carteira Completa
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-secondary" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }} onClick={() => router.get('/dashboard')}>
              <RefreshCw size={11} /> Sync IPCA/BCB
            </button>
            <button className="btn-primary" style={{ fontSize: 11 }} onClick={() => router.get('/lancamentos')}>Ver Lançamentos</button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: "linear-gradient(135deg, #2563eb, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileText size={16} color="white" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>Dashboard de Performance — Carteira de Crédito</h2>
          </div>
        </div>

        {/* Grid Principal do Dashboard */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
          
          {/* 4 Cards Principais de Gradiente */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {mainCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} style={{视觉: "none", background: card.gradient, borderRadius: 8, padding: "16px", color: "white" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={14} /></div>
                    <span style={{ background: "rgba(255,255,255,0.18)", padding: "2px 8px", borderRadius: 10, fontSize: 9, fontWeight: 700 }}>{card.badge}</span>
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.8, marginBottom: 4 }}>{card.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "monospace", marginBottom: 4 }}>{card.value}</div>
                  <div style={{ fontSize: 10, opacity: 0.7 }}>{card.sub}</div>
                </div>
              );
            })}
          </div>

          {/* 9 Mini Cards Secundários */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 8 }}>
            {secondaryMetrics.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.label} style={{ background: "white", border: "1px solid #e5e7eb", borderTop: `3px solid ${m.color}`, borderRadius: 6, padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                    <Icon size={10} style={{ color: m.color }} />
                    <span style={{ fontSize: 8, fontWeight: 700, color: "#6b7280" }}>{m.label}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "monospace" }}>{m.value}</div>
                  <div style={{ fontSize: 9, color: "#6b7280", marginTop: 2 }}>{m.sub}</div>
                </div>
              );
            })}
          </div>

          {/* Barras de Progressão */}
          <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {[
                { label: "% Recebido do Financiado", value: kpis?.pctPaid ?? 0, color: "#059669" },
                { label: "% Em Atraso do Financiado", value: kpis?.pctOverdue ?? 0, color: "#dc2626" },
                { label: "% Juros sobre Principal", value: kpis?.pctInterest ?? 0, color: "#ea580c" },
              ].map(bar => (
                <div key={bar.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 10 }}>
                    <span style={{ color: "#6b7280" }}>{bar.label}</span>
                    <span style={{ fontWeight: 700, color: bar.color, fontFamily: "monospace" }}>{fmtPct(bar.value)}</span>
                  </div>
                  <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, bar.value)}%`, background: bar.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gráfico Composed Chart de Evolução Mensal */}
          <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", background: "#fafafa", fontSize: 12, fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>
              Evolução Mensal — Recebimentos vs Vencidos vs Novos Contratos
            </div>
            <div style={{ padding: "12px 14px 4px 0px" }}>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.12}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => fmtShort(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Recebido" stroke="#2563eb" strokeWidth={2.5} fill="url(#colorRec)" />
                  <Line type="monotone" dataKey="Vencido" stroke="#dc2626" strokeWidth={2} strokeDasharray="5 3" />
                  <Line type="monotone" dataKey="Novos Contratos" stroke="#059669" strokeWidth={1.5} strokeDasharray="3 3" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bloco Casado de Juros e Inadimplência */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            
            {/* Esquerda: Tabela de Juros Reais */}
            <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", background: "#fafafa", fontSize: 12, fontWeight: 700, borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between" }}>
                <span>Juros Reais por Contrato</span>
                <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 400 }}>Tabela Price</span>
              </div>
              <div style={{ overflowY: "auto", maxHeight: 250 }}>
                <table className="sigx-table" style={{ fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: "#1a2035", color: "white" }}>
                      <th>Contrato</th>
                      <th style={{ textAlign: "right" }}>Principal</th>
                      <th style={{ textAlign: "right" }}>Juros</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                      <th style={{ textAlign: "center" }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interestTable?.map((c: any) => (
                      <tr key={c.contractId}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{c.code}</div>
                          <span className="badge" style={{ fontSize: 8 }}>{c.status}</span>
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmtShort(c.principal)}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace", color: c.totalInterest > 0 ? "#dc2626" : "inherit" }}>{fmtShort(c.totalInterest)}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{fmtShort(c.totalPayable)}</td>
                        <td style={{ textAlign: "center", fontFamily: "monospace" }}>{c.interestPct.toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Direita: Inadimplência por Mês */}
            <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", background: "#fafafa", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>Inadimplência por Mês</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Filter size={11} style={{ color: "#9ca3af" }} />
                  <select className="sigx-input" style={{ width: 120, padding: "2px 4px", height: 22, fontSize: 11 }} value={overdueMonthFilter} onChange={e => handleMonthFilterChange(e.target.value)}>
                    <option value="">Todos os meses</option>
                    {availableMonths.map((m: any) => <option key={m} value={m}>{formatMonth(m)}</option>)}
                  </select>
                </div>
              </div>
              
              <div style={{ padding: "6px 0px 0px" }}>
                <ResponsiveContainer width="100%" height={100}>
                  <ComposedChart data={chartData.slice(-12)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 8 }} />
                    <YAxis tick={{ fontSize: 8 }} />
                    <Bar dataKey="Vencido" fill="#dc2626" opacity={0.85} radius={[2, 2, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div style={{ overflowY: "auto", maxHeight: 110, borderTop: "1px solid #e5e7eb" }}>
                <table className="sigx-table" style={{ fontSize: 10 }}>
                  <thead>
                    <tr style={{ background: "#2d3748", color: "white" }}>
                      <th>Contrato</th>
                      <th>Parc.</th>
                      <th>Vencimento</th>
                      <th style={{ textAlign: "right" }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueByMonth?.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: "center", padding: 12, color: "#6b7280" }}>Selecione um mês para auditar parcelas vencidas</td></tr>
                    ) : (
                      overdueByMonth?.map((item: any) => (
                        <tr key={item.installmentId}>
                          <td style={{ fontFamily: "monospace" }}>{item.contractCode}</td>
                          <td style={{ textAlign: "center" }}>#{item.installmentNumber}</td>
                          <td style={{ color: "#dc2626" }}>{fmtDate(item.dueDate)}</td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "#dc2626", fontFamily: "monospace" }}>{fmt(Number(item.originalAmount))}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Gráfico Histórico de Inadimplência Mês a Mês */}
          <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", background: "#fafafa", fontSize: 12, fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>
              Evolução da Inadimplência Mês a Mês
            </div>
            <p style={{ margin: "4px 16px 0", fontSize: 11, color: "#6b7280" }}>Valor total de parcelas vencidas por mês — baseado nos dados reais das parcelas</p>
            <div style={{ padding: "12px 14px 4px 0px" }}>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="colorVen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => fmtShort(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Vencido" name="Valor Vencido" stroke="#dc2626" strokeWidth={2.5} fill="url(#colorVen)" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bloco Inferior: Status da Carteira e Ranking de Clientes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            
            <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", background: "#fafafa", fontSize: 12, fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>
                Distribuição por Status
              </div>
              <div style={{ padding: "14px 16px" }}>
                {[
                  { label: "Ativo", count: kpis?.activeContracts ?? 0, color: "#059669", bg: "#dcfce7" },
                  { label: "Inadimplente", count: kpis?.inadimplentContracts ?? 0, color: "#dc2626", bg: "#fee2e2" },
                  { label: "Quitado", count: kpis?.quitadoContracts ?? 0, color: "#2563eb", bg: "#dbeafe" },
                ].map(item => {
                  const total = kpis?.totalContracts ?? 1;
                  const pct = total > 0 ? (item.count / total) * 100 : 0;
                  return (
                    <div key={item.label} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}>
                        <span className="badge" style={{ background: item.bg, color: item.color, fontSize: 9, fontWeight: 700 }}>{item.label}</span>
                        <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                          {item.count} <span style={{ color: "#6b7280", fontWeight: 400 }}>({pct.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div style={{ height: 5, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: item.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", background: "#fafafa", fontSize: 12, fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>
                Top Clientes por Volume
              </div>
              <div style={{ padding: "6px 0" }}>
                {clientVolumeRanking.map((cl: any) => (
                  <div key={cl.name} style={{ padding: "7px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: cl.index === 1 ? "#1e2139" : "#f3f4f6", color: cl.index === 1 ? "white" : "#4b5563", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700 }}>
                      {cl.index}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cl.name}</div>
                      <div style={{ height: 3, background: "#f3f4f6", borderRadius: 2, marginTop: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${cl.pctOfMax}%`, background: "linear-gradient(90deg, #2563eb, #7c3aed)" }} />
                      </div>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700 }}>{fmtShort(cl.value)}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </UnyPayLayout>
  );
}