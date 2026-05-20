import React, { useState, useMemo } from "react";
import { Head, router, usePage } from "@inertiajs/react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from "recharts";
import { Calculator, User, Info, ChevronDown, ChevronUp } from "lucide-react";
import UnyPayLayout from "../Components/UnyPayLayout";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtPct = (v: number) => `${v.toFixed(4)}%`;
const fmtDate = (d: string) => {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

function calcIOFGov(principal: number, installmentCount: number, personType: "PF" | "PJ") {
  const diasTotais = Math.min(365, installmentCount * 30);
  const aliqDiaria = personType === "PJ" ? 0.000041 : 0.000082;
  const aliqAdicional = 0.0038;
  const iofDiario = principal * aliqDiaria * diasTotais;
  const iofAdicional = principal * aliqAdicional;
  return {
    iofDiario: Math.round(iofDiario * 100) / 100,
    iofAdicional: Math.round(iofAdicional * 100) / 100,
    iofTotal: Math.round((iofDiario + iofAdicional) * 100) / 100,
    aliqDiaria: aliqDiaria * 100,
    diasTotais,
  };
}

function calcTACValue(principal: number, mode: "valor" | "pct", v: number) {
  return mode === "pct" ? Math.round(principal * v / 100 * 100) / 100 : v;
}

function addMonths(dateStr: string, months: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

interface Row { n: number; dueDate: string; payment: number; interest: number; amortization: number; balance: number; }

function buildPriceRows(principal: number, rate: number, n: number, firstDue: string): Row[] {
  if (rate <= 0) {
    const amort = principal / n;
    return Array.from({ length: n }, (_, i) => ({
      n: i + 1, dueDate: addMonths(firstDue, i), payment: amort,
      interest: 0, amortization: amort, balance: Math.max(0, principal - amort * (i + 1)),
    }));
  }
  const r = rate / 100;
  const pmt = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  let balance = principal;
  return Array.from({ length: n }, (_, i) => {
    const interest = balance * r;
    const amortization = pmt - interest;
    balance = Math.max(0, balance - amortization);
    return { n: i + 1, dueDate: addMonths(firstDue, i), payment: Math.round(pmt * 100) / 100, interest: Math.round(interest * 100) / 100, amortization: Math.round(amortization * 100) / 100, balance: Math.round(balance * 100) / 100 };
  });
}

function buildSimpleRows(principal: number, rate: number, n: number, firstDue: string): Row[] {
  const r = rate / 100;
  const totalInterest = principal * r * n;
  const payment = (principal + totalInterest) / n;
  return Array.from({ length: n }, (_, i) => ({
    n: i + 1, dueDate: addMonths(firstDue, i), payment: Math.round(payment * 100) / 100,
    interest: Math.round((principal * r) * 100) / 100,
    amortization: Math.round((principal / n) * 100) / 100,
    balance: Math.max(0, Math.round((principal - (principal / n) * (i + 1)) * 100) / 100),
  }));
}

function calcCETRate(principal: number, pmt: number, n: number, tac: number, iof: number) {
  const net = principal - tac - iof;
  if (net <= 0 || pmt <= 0) return { cetMonthly: 0, cetAnnual: 0 };
  let r = 0.02;
  for (let i = 0; i < 200; i++) {
    const pv = pmt * (1 - Math.pow(1 + r, -n)) / r;
    const dpv = pmt * ((Math.pow(1 + r, -n) * n / r) - (1 - Math.pow(1 + r, -n)) / (r * r));
    const rNew = r - (pv - net) / dpv;
    if (Math.abs(rNew - r) < 1e-10) { r = rNew; break; }
    r = Math.max(0.0001, rNew);
  }
  return { cetMonthly: r * 100, cetAnnual: (Math.pow(1 + r, 12) - 1) * 100 };
}

export default function Simulator() {
  const { flash }: any = usePage().props;
  const [mode, setMode] = useState<"price" | "simple" | "manual">("price");
  const [personType, setPersonType] = useState<"PF" | "PJ">("PF");
  const [clientName, setClientName] = useState("");
  const [clientDoc, setClientDoc] = useState("");
  const [principal, setPrincipal] = useState("100000");
  const [monthlyRate, setMonthlyRate] = useState("2");
  const [installmentCount, setInstallmentCount] = useState("24");
  const [manualPmt, setManualPmt] = useState("5000");
  const [firstDue, setFirstDue] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10);
  });
  const [tacMode, setTacMode] = useState<"valor" | "pct">("valor");
  const [tacValue, setTacValue] = useState("0");
  const [iofMode, setIofMode] = useState<"auto" | "manual">("auto");
  const [iofManual, setIofManual] = useState("0");
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [showFull, setShowFull] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    if (!summary) return;
    setIsSaving(true);
    
    router.post("/api/simulator/save", {
      clientName: clientName || null,
      clientDocument: clientDoc || null,
      personType,
      mode: summary.mode,
      principal: summary.principal,
      monthlyRate: summary.r,
      installmentCount: summary.n,
      installmentAmount: summary.pmt,
      firstDueDate: firstDue,
      tac: summary.tac,
      iof: summary.iof,
      financedTotal: summary.financedTotal,
      totalPayable: summary.totalPayable,
      totalInterest: Math.max(0, summary.totalInterest),
      cetMonthly: summary.cetMonthly / 100,
      cetAnnual: summary.cetAnnual / 100,
    }, {
      onFinish: () => setIsSaving(false)
    });
  };

  const p = parseFloat(principal) || 0;
  const n = parseInt(installmentCount) || 0;

  const iofPreview = useMemo(() => {
    if (!p || !n || iofMode !== "auto") return null;
    return calcIOFGov(p, n, personType);
  }, [p, n, personType, iofMode]);

  const tacPreview = useMemo(() => calcTACValue(p, tacMode, parseFloat(tacValue) || 0), [p, tacMode, tacValue]);

  const handleCalculate = () => {
    const r = parseFloat(monthlyRate) || 0;
    const tac = calcTACValue(p, tacMode, parseFloat(tacValue) || 0);
    const iof = iofMode === "auto" ? calcIOFGov(p, n, personType).iofTotal : (parseFloat(iofManual) || 0);
    const financedTotal = p + tac + iof;

    let calcRows: Row[];
    let pmt: number;

    if (mode === "price") {
      calcRows = buildPriceRows(financedTotal, r, n, firstDue);
      pmt = calcRows[0]?.payment ?? 0;
    } else if (mode === "simple") {
      calcRows = buildSimpleRows(financedTotal, r, n, firstDue);
      pmt = calcRows[0]?.payment ?? 0;
    } else {
      pmt = parseFloat(manualPmt) || 0;
      calcRows = Array.from({ length: n }, (_, i) => ({
        n: i + 1, dueDate: addMonths(firstDue, i), payment: pmt,
        interest: 0, amortization: pmt, balance: Math.max(0, financedTotal - pmt * (i + 1)),
      }));
    }

    const totalPayable = pmt * n;
    const totalInterest = totalPayable - financedTotal;
    const { cetMonthly, cetAnnual } = calcCETRate(financedTotal, pmt, n, tac, iof);

    setRows(calcRows);
    setSummary({ principal: p, financedTotal, tac, iof, pmt, totalPayable, totalInterest, cetMonthly, cetAnnual, mode, r, n });
    setShowFull(false);
  };

  const chartData = useMemo(() =>
    rows.slice(0, 36).map(r => ({ n: r.n, juros: r.interest, amort: r.amortization })),
  [rows]);

  const displayRows = showFull ? rows : rows.slice(0, 12);

  return (
    <UnyPayLayout>
      <Head title="Simulador de Empréstimo" />
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", padding: "0 24px 24px 24px" }}>

        {/* Header */}
        <div style={{ flexShrink: 0, background: "white", borderBottom: "1px solid #e5e7eb", padding: "12px 0", display: "flex", alignItems: "center", gap: 10, margin: "0 -24px", paddingLeft: 24 }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: "linear-gradient(135deg, #1a2035, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Calculator size={18} color="white" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>Simulador de Empréstimo</h2>
            <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>
              Tabela Price, Juros Simples ou Manual — IOF calculado pela regra do Governo Federal (Decreto 6.306/2007)
            </p>
          </div>
        </div>

        {/* Avisos Flash */}
        {flash?.success && (
          <div style={{ padding: "10px 16px", background: "#dcfce7", color: "#15803d", borderRadius: 6, fontSize: 12, fontWeight: 600, marginTop: 10 }}>
            ✓ {flash.success}
          </div>
        )}

        {/* Bloco Rolável */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16, alignItems: "start" }}>

            {/* Painel de Parâmetros */}
            <div style={{ background: "white", border: "1px solid #d1d5db", borderRadius: 10, overflow: "hidden" }} onMouseDown={e => e.stopPropagation()}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #d1d5db", background: "#1a2035" }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "white" }}>Parâmetros da Simulação</h3>
              </div>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>

                <div>
                  <label className="sigx-label">MODO DE CÁLCULO</label>
                  <div style={{ display: "flex", border: "1px solid #d1d5db", borderRadius: 6, overflow: "hidden" }}>
                    {([["price","Tabela Price"],["simple","Juros Simples"],["manual","Manual"]] as const).map(([k, l]) => (
                      <button key={k} onClick={() => setMode(k)} style={{
                        flex: 1, padding: "7px 4px", fontSize: 11, border: "none", cursor: "pointer",
                        background: mode === k ? "#1a2035" : "white",
                        color: mode === k ? "white" : "#6b7280",
                        fontWeight: mode === k ? 700 : 400, transition: "all 0.1s",
                      }}>{l}</button>
                    ))}
                  </div>
                </div>

                <div style={{ padding: 10, background: "#f8f9fa", borderRadius: 8, border: "1px solid #d1d5db" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
                    <User size={12} style={{ color: "#6b7280" }} />
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6b7280" }}>Dados do Cliente</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div>
                      <label className="sigx-label">TIPO</label>
                      <div style={{ display: "flex", border: "1px solid #d1d5db", borderRadius: 4, overflow: "hidden" }}>
                        {(["PF","PJ"] as const).map(t => (
                          <button key={t} onClick={() => setPersonType(t)} style={{
                            flex: 1, padding: "5px", fontSize: 11, border: "none", cursor: "pointer",
                            background: personType === t ? "#2563eb" : "white",
                            color: personType === t ? "white" : "#6b7280",
                            fontWeight: personType === t ? 700 : 400, transition: "all 0.1s",
                          }}>{t === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="sigx-label">NOME</label>
                      <input className="sigx-input" style={{ fontSize: 12 }} value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nome completo ou razão social" />
                    </div>
                    <div>
                      <label className="sigx-label">{personType === "PJ" ? "CNPJ" : "CPF"}</label>
                      <input className="sigx-input mono" value={clientDoc} onChange={e => setClientDoc(e.target.value)} placeholder={personType === "PJ" ? "00.000.000/0001-00" : "000.000.000-00"} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="sigx-label">VALOR DO EMPRÉSTIMO (R$) *</label>
                  <input type="number" className="sigx-input mono" value={principal} onChange={e => setPrincipal(e.target.value)} placeholder="100.000,00" />
                </div>

                {mode !== "manual" && (
                  <div>
                    <label className="sigx-label">TAXA DE JUROS MENSAL (%)</label>
                    <input type="number" step="0.001" className="sigx-input mono" value={monthlyRate} onChange={e => setMonthlyRate(e.target.value)} placeholder="2,000" />
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label className="sigx-label">Nº PARCELAS *</label>
                    <input type="number" min="1" className="sigx-input mono" value={installmentCount} onChange={e => setInstallmentCount(e.target.value)} />
                  </div>
                  <div>
                    <label className="sigx-label">1º VENCIMENTO</label>
                    <input type="date" className="sigx-input" value={firstDue} onChange={e => setFirstDue(e.target.value)} />
                  </div>
                </div>

                {mode === "manual" && (
                  <div>
                    <label className="sigx-label">VALOR DA PARCELA (R$) *</label>
                    <input type="number" step="0.01" className="sigx-input mono" value={manualPmt} onChange={e => setManualPmt(e.target.value)} />
                  </div>
                )}

                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <label className="sigx-label" style={{ marginBottom: 0 }}>TAC — ABERTURA DE CRÉDITO</label>
                    <div style={{ display: "flex", border: "1px solid #d1d5db", borderRadius: 4, overflow: "hidden" }}>
                      {(["valor","pct"] as const).map(t => (
                        <button key={t} onClick={() => setTacMode(t)} style={{
                          padding: "2px 8px", fontSize: 10, border: "none", cursor: "pointer",
                          background: tacMode === t ? "#7c3aed" : "white",
                          color: tacMode === t ? "white" : "#6b7280",
                          fontWeight: tacMode === t ? 700 : 400,
                        }}>{t === "valor" ? "R$" : "%"}</button>
                      ))}
                    </div>
                  </div>
                  <input type="number" step="0.01" className="sigx-input mono" value={tacValue} onChange={e => setTacValue(e.target.value)} placeholder="0,00" />
                  {tacPreview > 0 && tacMode === "pct" && (
                    <div style={{ fontSize: 10, color: "#7c3aed", marginTop: 2 }}>= {fmt(tacPreview)} sobre o principal</div>
                  )}
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <label className="sigx-label" style={{ marginBottom: 0 }}>IOF — OPERAÇÕES FINANCEIRAS</label>
                    <div style={{ display: "flex", border: "1px solid #d1d5db", borderRadius: 4, overflow: "hidden" }}>
                      {(["auto","manual"] as const).map(t => (
                        <button key={t} onClick={() => setIofMode(t)} style={{
                          padding: "2px 8px", fontSize: 10, border: "none", cursor: "pointer",
                          background: iofMode === t ? "#ea580c" : "white",
                          color: iofMode === t ? "white" : "#6b7280",
                          fontWeight: iofMode === t ? 700 : 400,
                        }}>{t === "auto" ? "Auto (Gov.)" : "Manual"}</button>
                      ))}
                    </div>
                  </div>
                  {iofMode === "auto" ? (
                    <div style={{ padding: "8px 10px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 6, fontSize: 11 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4, color: "#ea580c", fontWeight: 600 }}>
                        <Info size={11} /> Decreto 6.306/2007 — Cálculo automático
                      </div>
                      {iofPreview && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, color: "#6b7280" }}>
                          <div>Alíquota diária ({personType}): <span className="mono">{iofPreview.aliqDiaria.toFixed(4)}%/dia</span></div>
                          <div>Dias: <span className="mono">{iofPreview.diasTotais}d</span> | IOF diário: <span className="mono" style={{ color: "#ea580c" }}>{fmt(iofPreview.iofDiario)}</span></div>
                          <div>IOF adicional (0,38%): <span className="mono" style={{ color: "#ea580c" }}>{fmt(iofPreview.iofAdicional)}</span></div>
                          <div style={{ fontWeight: 700, color: "#ea580c" }}>IOF Total: <span className="mono">{fmt(iofPreview.iofTotal)}</span></div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <input type="number" step="0.01" className="sigx-input mono" value={iofManual} onChange={e => setIofManual(e.target.value)} placeholder="0,00" />
                  )}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-primary" onClick={handleCalculate} style={{ flex: 1, padding: "10px", fontSize: 13, fontWeight: 700, justifyContent: "center", display: "flex", alignItems: "center", gap: 4 }}>
                    <Calculator size={15} /> Calcular
                  </button>
                  <button className="btn-secondary" onClick={handleSave} disabled={!summary || isSaving} style={{ padding: "10px 12px", fontSize: 12 }} title="Salvar no histórico">
                    {isSaving ? "..." : "💾"}
                  </button>
                </div>
              </div>
            </div>

            {/* Painel de Resultados */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {!summary ? (
                <div style={{ background: "white", border: "1px solid #d1d5db", borderRadius: 10, padding: 60, textAlign: "center", color: "#6b7280" }}>
                  <Calculator size={48} style={{ margin: "0 auto 16px", display: "block", opacity: 0.15 }} />
                  <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Configure os parâmetros e clique em Calcular</p>
                  <p style={{ fontSize: 12, margin: "6px 0 0", opacity: 0.7 }}>Suporta Tabela Price, Juros Simples e modo Manual</p>
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                    {[
                      { label: "VALOR DA PARCELA", value: fmt(summary.pmt), color: "#1a2035", border: "#1a2035" },
                      { label: "TOTAL FINANCIADO", value: fmt(summary.financedTotal), color: "#2563eb", border: "#2563eb" },
                      { label: "TOTAL A PAGAR", value: fmt(summary.totalPayable), color: "#ea580c", border: "#ea580c" },
                      { label: "TOTAL DE JUROS", value: fmt(Math.max(0, summary.totalInterest)), color: "#dc2626", border: "#dc2626" },
                      { label: "CET MENSAL", value: fmtPct(summary.cetMonthly), color: "#7c3aed", border: "#7c3aed" },
                      { label: "CET ANUAL", value: fmtPct(summary.cetAnnual), color: "#0891b2", border: "#0891b2" },
                    ].map(c => (
                      <div key={c.label} style={{ background: "white", border: "1px solid #d1d5db", borderTop: `3px solid ${c.border}`, borderRadius: 8, padding: "12px 14px" }}>
                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af", marginBottom: 4 }}>{c.label}</div>
                        <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: c.color, fontFamily: "monospace" }}>{c.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: "white", border: "1px solid #d1d5db", borderRadius: 8, padding: "12px 16px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Composição do Financiamento</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                      {[
                        { label: "Principal", value: fmt(summary.principal), color: "#111827" },
                        { label: "TAC", value: fmt(summary.tac), color: "#7c3aed" },
                        { label: "IOF", value: fmt(summary.iof), color: "#ea580c" },
                        { label: "Total Financiado", value: fmt(summary.financedTotal), color: "#2563eb" },
                      ].map(item => (
                        <div key={item.label}>
                          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af", marginBottom: 3 }}>{item.label}</div>
                          <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: item.color, fontFamily: "monospace" }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {(clientName || clientDoc) && (
                    <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                      <User size={14} style={{ color: "#2563eb", flexShrink: 0 }} />
                      <div style={{ fontSize: 12, color: "#1e40af" }}>
                        <strong>Simulação para:</strong> {clientName || "—"}{clientDoc ? ` — ${clientDoc}` : ""}
                      </div>
                    </div>
                  )}

                  {chartData.length > 0 && summary.mode !== "manual" && (
                    <div style={{ background: "white", border: "1px solid #d1d5db", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ padding: "12px 16px", borderBottom: "1px solid #d1d5db", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#111827" }}>Composição das Parcelas — Juros vs Amortização</h3>
                        <div style={{ display: "flex", gap: 10, fontSize: 10 }}>
                          {[["#dc2626","Juros"],["#059669","Amortização"]].map(([c,l]) => (
                            <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                              <span style={{ color: "#6b7280" }}>{l}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ padding: "8px 4px 12px" }}>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="n" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}K`} />
                            {/* ── 💡 SOLUÇÃO DO BUG: Removida a tipagem explícita conflitante para aceitar qualquer payload do Recharts ── */}
                            <Tooltip formatter={(v: any, name: any) => [fmt(Number(v)), name === "juros" ? "Juros" : "Amortização"]} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                            <Bar dataKey="juros" stackId="a" fill="#dc2626" />
                            <Bar dataKey="amort" stackId="a" fill="#059669" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  <div style={{ background: "white", border: "1px solid #d1d5db", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid #d1d5db", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#111827" }}>
                        Tabela de Amortização — {summary.n} parcelas
                      </h3>
                      <span style={{ fontSize: 10, color: "#6b7280", fontStyle: "italic" }}>
                        {summary.mode === "price" ? "Sistema Francês (Price)" : summary.mode === "simple" ? "Juros Simples" : "Manual"}
                      </span>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: "#1a2035", color: "white" }}>
                            {["#","VENCIMENTO","PRESTAÇÃO","JUROS","AMORTIZAÇÃO","SALDO DEVEDOR"].map((col, i) => (
                              <th key={col} style={{ background: "#1a2035", color: "white", padding: "6px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: i === 0 ? "center" : i === 1 ? "left" : "right", whiteSpace: "nowrap", borderRight: i < 5 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {displayRows.map((row, idx) => (
                            <tr key={row.n}
                              style={{ background: idx % 2 === 1 ? "#fafafa" : "white", transition: "background 0.1s" }}
                              onMouseOver={e => (e.currentTarget.style.background = "#eff6ff")}
                              onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 1 ? "#fafafa" : "white")}
                            >
                              <td style={{ textAlign: "center", padding: "5px 10px", fontFamily: "monospace", fontSize: 10, color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>
                                {String(row.n).padStart(2, "0")}
                              </td>
                              <td style={{ padding: "5px 10px", fontSize: 11, borderBottom: "1px solid #e5e7eb" }}>{fmtDate(row.dueDate)}</td>
                              <td style={{ textAlign: "right", padding: "5px 10px", fontWeight: 700, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace" }}>{fmt(row.payment)}</td>
                              <td style={{ textAlign: "right", padding: "5px 10px", color: row.interest > 0 ? "#dc2626" : "#6b7280", borderBottom: "1px solid #e5e7eb", fontFamily: "monospace" }}>{fmt(row.interest)}</td>
                              <td style={{ textAlign: "right", padding: "5px 10px", color: "#059669", borderBottom: "1px solid #e5e7eb", fontFamily: "monospace" }}>{fmt(row.amortization)}</td>
                              <td style={{ textAlign: "right", padding: "5px 10px", fontWeight: 600, borderBottom: "1px solid #e5e7eb", fontFamily: "monospace" }}>{fmt(row.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: "#f3f4f6", fontWeight: 700 }}>
                            <td colSpan={2} style={{ padding: "6px 10px", fontSize: 10, textTransform: "uppercase", borderTop: "2px solid #d1d5db" }}>TOTAIS</td>
                            <td style={{ textAlign: "right", padding: "6px 10px", borderTop: "2px solid #d1d5db", fontFamily: "monospace" }}>{fmt(summary.totalPayable)}</td>
                            <td style={{ textAlign: "right", padding: "6px 10px", color: "#dc2626", borderTop: "2px solid #d1d5db", fontFamily: "monospace" }}>{fmt(Math.max(0, summary.totalInterest))}</td>
                            <td style={{ textAlign: "right", padding: "6px 10px", color: "#059669", borderTop: "2px solid #d1d5db", fontFamily: "monospace" }}>{fmt(summary.financedTotal)}</td>
                            <td style={{ borderTop: "2px solid #d1d5db" }} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    {rows.length > 12 && (
                      <div style={{ padding: "10px 16px", borderTop: "1px solid #d1d5db", textAlign: "center" }}>
                        <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setShowFull(!showFull)}>
                          {showFull ? <> Mostrar menos</> : <> Ver todas as {rows.length} parcelas</>}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </UnyPayLayout>
  );
}