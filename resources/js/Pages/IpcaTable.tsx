import React, { useState, useMemo } from "react";
import { Head, router, usePage } from "@inertiajs/react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from "recharts";
import { RefreshCw, Plus, Edit2, Check, X, TrendingUp, TrendingDown, Minus, Database } from "lucide-react";
import UnyPayLayout from "../Components/UnyPayLayout";

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
function formatMonth(m: string) {
  if (!m || m.length < 7) return m;
  const [y, mo] = m.split("-");
  return `${MONTH_NAMES[parseInt(mo) - 1]}/${y?.slice(2)}`;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const v = Number(payload[0]?.value ?? 0);
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 6, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: "#111827" }}>{label}</div>
      <div style={{ color: v < 0 ? "#dc2626" : v > 0.5 ? "#ea580c" : "#059669", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>
        {v > 0 ? "+" : ""}{v.toFixed(4)}%
      </div>
    </div>
  );
};

export default function IpcaTable({ indices }: any) {
  const { flash, errors }: any = usePage().props; // 🔄 Captura mensagens e erros vindos do Laravel Controller
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newForm, setNewForm] = useState({ referenceMonth: "", rate: "", source: "BCB - SGS Série 433" });
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [isSyncing, setIsSyncing] = useState(false);

  // Normalização de chaves resiliente (monthRef, reference_month ou referenceMonth)
  const sorted = useMemo(() => {
    const list = indices ?? [];
    return [...list]
      .map((i: any) => ({
        id: i.id,
        referenceMonth: i.monthRef ?? i.reference_month ?? i.referenceMonth ?? "",
        rate: Number(i.rate ?? (i.monthlyRate ? Number(i.monthlyRate) * 100 : 0)),
        source: i.source ?? i.sourceName ?? "BCB - SGS Série 433",
        referenceDate: i.referenceDate ?? i.reference_date ?? null,
      }))
      .filter(i => i.referenceMonth)
      .sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth));
  }, [indices]);

  const stats = useMemo(() => {
    if (!sorted.length) return null;
    const rates = sorted.map(i => i.rate);
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    const max = Math.max(...rates);
    const min = Math.min(...rates);
    const acum12 = sorted.slice(-12).reduce((acc, i) => acc * (1 + i.rate / 100), 1) - 1;
    return { avg, max, min, acum12: acum12 * 100, count: sorted.length };
  }, [sorted]);

  const chartData = useMemo(() =>
    sorted.map(i => ({ month: formatMonth(i.referenceMonth), rate: i.rate })),
  [sorted]);

  const handleSyncBCB = () => {
    setIsSyncing(true);
    router.post("/api/ipca/sync", {}, {
      onFinish: () => setIsSyncing(false)
    });
  };

  const handleSaveEdit = (id: number, month: string) => {
    const rate = parseFloat(editValue);
    if (isNaN(rate)) return;
    router.post("/api/ipca/upsert", { id, referenceMonth: month, rate, source: "Manual" }, {
      onSuccess: () => setEditingId(null)
    });
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(newForm.rate);
    if (!newForm.referenceMonth || isNaN(rate)) return;
    
    router.post("/api/ipca/upsert", { referenceMonth: newForm.referenceMonth, rate, source: newForm.source }, {
      onSuccess: () => {
        setAddOpen(false);
        setNewForm({ referenceMonth: "", rate: "", source: "BCB - SGS Série 433" });
      }
    });
  };

  return (
    <UnyPayLayout>
      <Head title="Tabela IPCA" />
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", padding: "0 24px 24px 24px", background: "#f8f9fa" }}>

        {/* ── ALERTA DE MENSAGENS E NOTIFICAÇÕES EM TELA ── */}
        {flash?.success && (
          <div style={{ padding: "10px 16px", background: "#dcfce7", color: "#15803d", borderRadius: 6, fontSize: 12, fontWeight: 600, marginTop: 10, border: "1px solid #bbf7d0" }}>
            ✓ {flash.success}
          </div>
        )}
        {(errors?.sync || flash?.error) && (
          <div style={{ padding: "10px 16px", background: "#fee2e2", color: "#b91c1c", borderRadius: 6, fontSize: 12, fontWeight: 600, marginTop: 10, border: "1px solid #fca5a5" }}>
            ⚠ {errors?.sync || flash?.error}
          </div>
        )}

        {/* Cabeçalho do Menu Fixo */}
        <div style={{ flexShrink: 0, background: "white", borderBottom: "1px solid #e5e7eb", padding: "12px 0", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "0 -24px 0 -24px", paddingLeft: 24, paddingRight: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: "linear-gradient(135deg, #059669, #0d9488)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={18} color="white" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>Tabela IPCA</h2>
              <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>Índices mensais — Fonte: Banco Central do Brasil (SGS Série 433) / IBGE</p>
            </div>
          </div>
          
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", border: "1px solid #d1d5db", borderRadius: 6, overflow: "hidden" }}>
              {(["bar", "line"] as const).map(v => (
                <button key={v} onClick={() => setChartType(v)} style={{
                  padding: "5px 12px", fontSize: 11, border: "none", cursor: "pointer",
                  background: chartType === v ? "#059669" : "white",
                  color: chartType === v ? "white" : "#6b7280",
                  fontWeight: chartType === v ? 700 : 400, transition: "all 0.1s",
                }}>
                  {v === "bar" ? "Barras" : "Linha"}
                </button>
              ))}
            </div>
            
            <button type="button" className="btn-secondary" onClick={handleSyncBCB} disabled={isSyncing} style={{ fontSize: 11, height: 32, display: "flex", alignItems: "center", gap: 4 }}>
              <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Sincronizando..." : "Sync Banco Central"}
            </button>
            <button type="button" className="btn-primary" onClick={() => setAddOpen(true)} style={{ fontSize: 11, height: 32, display: "flex", alignItems: "center", gap: 4 }}>
              <Plus size={12} /> Novo Índice
            </button>
          </div>
        </div>

        {/* Cards de Estatística */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", background: "white", borderBottom: "1px solid #e5e7eb", margin: "0 -24px", flexShrink: 0 }}>
            {[
              { label: "ÍNDICES CADASTRADOS", value: String(stats.count), color: "#1a2035", sub: "meses" },
              { label: "MÉDIA MENSAL", value: `${stats.avg.toFixed(4)}%`, color: "#2563eb", sub: "período completo" },
              { label: "MAIOR ÍNDICE", value: `${stats.max.toFixed(4)}%`, color: "#dc2626", sub: "pico do período" },
              { label: "MENOR ÍNDICE", value: `${stats.min.toFixed(4)}%`, color: "#059669", sub: "mínimo do período" },
              { label: "ACUM. 12 MESES", value: `${stats.acum12.toFixed(2)}%`, color: "#ea580c", sub: "últimos 12 meses" },
            ].map((c, i) => (
              <div key={c.label} style={{ padding: "12px 16px", borderLeft: i > 0 ? "1px solid #e5e7eb" : "none", borderTop: `3px solid ${c.color}` }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af", marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: c.color, fontFamily: "'IBM Plex Mono', monospace" }}>{c.value}</div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{c.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Grid Único Rolável (Gráfico + Tabela Juntos) */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 0", display: "flex", flexDirection: "column", gap: 16 }}>
          
          {addOpen && (
            <div style={{ background: "white", border: "1px solid #d1d5db", borderRadius: 8, padding: 16 }} onMouseDown={e => e.stopPropagation()}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: "#111827" }}>Adicionar Índice Manualmente</div>
              <form onSubmit={handleAdd} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div>
                  <label className="sigx-label">Mês/Ano (YYYY-MM)</label>
                  <input className="sigx-input" style={{ width: 130, fontFamily:"monospace" }} value={newForm.referenceMonth} onChange={e => setNewForm(p => ({ ...p, referenceMonth: e.target.value }))} placeholder="2026-05" required />
                </div>
                <div>
                  <label className="sigx-label">Taxa (%)</label>
                  <input type="number" step="0.0001" className="sigx-input" style={{ width: 110, fontFamily:"monospace" }} value={newForm.rate} onChange={e => setNewForm(p => ({ ...p, rate: e.target.value }))} placeholder="0.4200" required />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label className="sigx-label">Fonte</label>
                  <input className="sigx-input" value={newForm.source} onChange={e => setNewForm(p => ({ ...p, source: e.target.value }))} />
                </div>
                <button type="submit" className="btn-primary" style={{ fontSize: 12 }}>Salvar</button>
                <button type="button" className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setAddOpen(false)}>Cancelar</button>
              </form>
            </div>
          )}

          {/* Seção Gráfica Centralizada */}
          <div style={{ background: "white", border: "1px solid #d1d5db", borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #d1d5db", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#111827" }}>Evolução do IPCA Mensal</h3>
                <p style={{ margin: "3px 0 0", fontSize: 11, color: "#6b7280" }}>Variação percentual mensal — Fonte: BCB/IBGE</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 10 }}>
                {[{ color: "#059669", label: "Normal (≤0.5%)" }, { color: "#ea580c", label: "Alto (>0.5%)" }, { color: "#dc2626", label: "Negativo" }].map(l => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                    <span style={{ color: "#6b7280" }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: "14px 10px 10px 0px" }}>
              {chartData.length === 0 ? (
                <div style={{ height: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>
                  <Database size={32} style={{ opacity: 0.2, marginBottom: 6 }} />
                  <p style={{ fontSize: 12 }}>Nenhum índice localizado</p>
                </div>
              ) : chartType === "bar" ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(2)}%`} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1} />
                    <Bar dataKey="rate" radius={[2, 2, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.rate < 0 ? "#dc2626" : entry.rate > 0.5 ? "#ea580c" : "#059669"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(2)}%`} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1} />
                    <Line type="monotone" dataKey="rate" stroke="#059669" strokeWidth={2.5} dot={{ fill: "#059669", r: 2.5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Seção Grid de Dados Inferior */}
          <div style={{ background: "white", border: "1px solid #d1d5db", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid #d1d5db", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{sorted.length} índices cadastrados</span>
              <span style={{ fontSize: 11, color: "#6b7280" }}>Fonte: IBGE — IPCA / BCB SGS 433</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#1a2035", color: "white" }}>
                    {["MÊS/ANO", "TAXA MENSAL (%)", "VARIAÇÃO VISUAL", "ACUMULADO 12M", "FONTE", ""].map((col, i) => (
                      <th key={col} style={{ background: "#1a2035", color: "white", padding: "7px 14px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: i >= 1 && i <= 3 ? "center" : "left", borderRight: i < 5 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>{sorted.map((item, idx) => {
                    const rate = item.rate;
                    const isNeg = rate < 0;
                    const isHigh = rate > 0.5;
                    const rateColor = isNeg ? "#dc2626" : isHigh ? "#ea580c" : "#059669";
                    const barWidth = Math.min(100, Math.abs(rate) / 1.5 * 100);
                    const isEditing = editingId === item.id;
                    const acum12 = sorted.slice(Math.max(0, idx - 11), idx + 1).reduce((acc, i) => acc * (1 + i.rate / 100), 1) - 1;

                    return (
                      <tr key={item.id} style={{ background: idx % 2 === 1 ? "#fafafa" : "white" }} onMouseOver={e => (e.currentTarget.style.background = "#eff6ff")} onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 1 ? "#fafafa" : "white")}>
                        <td style={{ padding: "8px 14px", borderBottom: "1px solid #e5e7eb" }}>
                          <div style={{ fontWeight: 700, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>{item.referenceMonth}</div>
                        </td>
                        <td style={{ padding: "8px 14px", borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>
                          {isEditing ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }} onMouseDown={e => e.stopPropagation()}>
                              <input type="number" step="0.0001" className="sigx-input" style={{ width: 100, padding: "4px 8px", fontSize: 12, fontFamily: "monospace" }} value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus />
                              <button type="button" className="btn-icon" style={{ color: "#059669" }} onClick={() => handleSaveEdit(item.id, item.referenceMonth)}><Check size={12} /></button>
                              <button type="button" className="btn-icon" style={{ color: "#dc2626" }} onClick={() => setEditingId(null)}><X size={12} /></button>
                            </div>
                          ) : (
                            <span style={{ fontWeight: 700, fontSize: 13, color: rateColor, fontFamily: "'IBM Plex Mono', monospace" }}>
                              {rate > 0 ? "+" : ""}{rate.toFixed(4)}%
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "8px 14px", borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                            <div style={{ width: 80, height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${barWidth}%`, background: rateColor }} />
                            </div>
                            {isNeg ? <TrendingDown size={12} style={{ color: "#dc2626" }} /> : isHigh ? <TrendingUp size={12} style={{ color: "#ea580c" }} /> : <Minus size={12} style={{ color: "#059669" }} />}
                          </div>
                        </td>
                        <td style={{ padding: "8px 14px", borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>
                          <span style={{ fontSize: 11, color: acum12 > 0.05 ? "#dc2626" : "#059669", fontFamily: "'IBM Plex Mono', monospace" }}>
                            {(acum12 * 100).toFixed(2)}%
                          </span>
                        </td>
                        <td style={{ padding: "8px 14px", borderBottom: "1px solid #e5e7eb", fontSize: 11, color: "#6b7280" }}>{item.source}</td>
                        <td style={{ padding: "8px 14px", borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>
                          <button type="button" className="btn-icon" onClick={() => { setEditingId(item.id); setEditValue(String(rate)); }}><Edit2 size={11} /></button>
                        </td>
                      </tr>
                    );
                  })}</tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </UnyPayLayout>
  );
}