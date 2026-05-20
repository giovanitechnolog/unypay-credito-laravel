import React, { useState } from "react";
import { Head, router, usePage, Link } from "@inertiajs/react";
import { History, FileText, Trash2, ArrowRight, X, Calculator } from "lucide-react";
import UnyPayLayout from "../Components/UnyPayLayout";

const fmt = (v: number | string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return d;
  return dateObj.toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
};

const MODE_LABELS: Record<string, string> = {
  price: "Tabela Price",
  simple: "Juros Simples",
  manual: "Manual",
};

export default function SimulationHistory() {
  const { simulations, clients, flash, errors }: any = usePage().props;
  const [convertOpen, setConvertOpen] = useState(false);
  const [selectedSim, setSelectedSim] = useState<any>(null);
  const [convertForm, setConvertForm] = useState({
    code: "",
    contractName: "",
    creditor: "UnyPay® S.A.",
    contractDate: new Date().toISOString().slice(0, 10),
    clientId: "",
  });

  const handleDelete = (id: number) => {
    if (!confirm("Tem certeza que deseja excluir esta simulação do histórico?")) return;
    router.delete(`/api/simulator/${id}`);
  };

  const handleOpenConvert = (sim: any) => {
    setSelectedSim(sim);
    setConvertForm({
      code: `SIM-${sim.id}-${new Date().getFullYear()}`,
      contractName: sim.clientName ? `Financiamento - {sim.clientName}` : `Empréstimo de ${fmt(sim.principal)}`,
      creditor: "UnyPay® S.A.",
      contractDate: new Date().toISOString().slice(0, 10),
      clientId: "",
    });
    setConvertOpen(true);
  };

  const handleConvertSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSim) return;

    router.post(`/api/simulator/${selectedSim.id}/convert`, convertForm, {
      onSuccess: () => setConvertOpen(false)
    });
  };

  return (
    <UnyPayLayout>
      <Head title="Histórico de Simulações" />
      <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "0 24px 24px 24px" }}>
        
        {/* Cabeçalho Superior conforme Imagem */}
        <div style={{ background: "white", borderBottom: "1px solid #e5e7eb", padding: "12px 0", display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 -24px 16px -24px", paddingLeft: 24, paddingRight: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: "linear-gradient(135deg, #7c3aed, #5b21b6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <History size={18} color="white" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>Histórico de Simulações</h2>
              <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>Simulações salvas — clique em "Converter" para criar um contrato a partir de uma simulação</p>
            </div>
          </div>
          <Link href="/simulador" className="btn-primary" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5, textDecoration: "none", padding: "6px 12px" }}>
            <Calculator size={14} /> Nova Simulação
          </Link>
        </div>

        {/* Alertas */}
        {flash?.success && (
          <div style={{ padding: "10px 16px", background: "#dcfce7", color: "#15803d", borderRadius: 6, fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
            ✓ {flash.success}
          </div>
        )}

        {/* Tabela de Auditoria com Cabeçalhos Coloridos Idêntica ao Print */}
        <div style={{ background: "white", border: "1px solid #d1d5db", borderRadius: 8, overflow: "hidden", flex: 1 }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 11, fontFamily: "'IBM Plex Sans', sans-serif" }}>
              <thead>
                {/* ── LINHA 1 DE GRUPOS DE CORES (CONFORME PRINT DO MANUS) ── */}
                <tr>
                  <th colSpan={4} style={{ background: "#1a243a", color: "white", textAlign: "center", padding: "5px 10px", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", borderRight: "1px solid rgba(255,255,255,0.15)" }}>
                    IDENTIFICAÇÃO
                  </th>
                  <th colSpan={4} style={{ background: "#0b4687", color: "white", textAlign: "center", padding: "5px 10px", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", borderRight: "1px solid rgba(255,255,255,0.15)" }}>
                    VALORES
                  </th>
                  <th colSpan={2} style={{ background: "#4a1204", color: "white", textAlign: "center", padding: "5px 10px", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", borderRight: "1px solid rgba(255,255,255,0.15)" }}>
                    JUROS
                  </th>
                  <th style={{ background: "#111622", color: "white", padding: "5px 10px" }} />
                </tr>
                {/* ── LINHA 2 DE COLUNAS (CONFORME PRINT DO MANUS) ── */}
                <tr>
                  {[
                    { label: "DATA", align: "left" },
                    { label: "CLIENTE", align: "left" },
                    { label: "MODO", align: "center" },
                    { label: "SALVO POR", align: "left" },
                    { label: "PRINCIPAL", align: "right" },
                    { label: "FINANCIADO", align: "right" },
                    { label: "PARCELAS", align: "center" },
                    { label: "VL. PARCELA", align: "right" },
                    { label: "JUROS TOTAIS", align: "right" },
                    { label: "CET MENSAL", align: "center" },
                    { label: "AÇÕES", align: "center" },
                  ].map(col => (
                    <th key={col.label} style={{
                      background: "#161b26", color: "white", padding: "6px 10px",
                      fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
                      textAlign: col.align as any, whiteSpace: "nowrap",
                    }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!simulations || simulations.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: "center", padding: 48, color: "#6b7280" }}>
                      Nenhuma simulação registrada no histórico.
                    </td>
                  </tr>
                ) : (
                  simulations.map((sim: any, idx: number) => {
                    const cMode = sim.calcMode ?? sim.calc_mode ?? "price";
                    const principalVal = sim.principal ?? 0;
                    const finTotal = sim.financedTotal ?? sim.financed_total ?? principalVal;
                    const pmt = sim.installmentAmount ?? sim.installment_amount ?? 0;
                    const totalInt = sim.totalInterest ?? sim.total_interest ?? 0;
                    const cetM = sim.cetMonthly ?? sim.cet_monthly ?? 0;
                    const instCount = sim.installmentCount ?? sim.installment_count ?? 0;
                    const created = sim.createdAt ?? sim.created_at;

                    return (
                      <tr key={sim.id} style={{ background: idx % 2 === 1 ? "#fafafa" : "white" }} onMouseOver={e => (e.currentTarget.style.background = "#eff6ff")} onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 1 ? "#fafafa" : "white")}>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb", color: "#6b7280", whiteSpace: "nowrap" }}>
                          {fmtDate(created)}
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>
                          {sim.clientName ? (
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 12, color: "#111827" }}>{sim.clientName}</div>
                              {sim.clientDocument && (
                                <div style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace" }}>{sim.clientDocument}</div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: "#9ca3af" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>
                          <span style={{ padding: "2px 6px", borderRadius: 4, background: "#dbeafe", color: "#1e40af", fontWeight: 600, fontSize: 10 }}>
                            {MODE_LABELS[cMode] || cMode}
                          </span>
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb", color: "#6b7280" }}>
                          {sim.savedBy ?? "Sistema"}
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb", textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>
                          {fmt(principalVal)}
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb", textAlign: "right", fontFamily: "monospace", color: "#4b5563" }}>
                          {fmt(finTotal)}
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb", textAlign: "center", color: "#4b5563" }}>
                          {instCount}×
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb", textAlign: "right", fontFamily: "monospace", color: "#1e40af", fontWeight: 600 }}>
                          {fmt(pmt)}
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb", textAlign: "right", fontFamily: "monospace", color: "#dc2626", fontWeight: 600 }}>
                          {fmt(totalInt)}
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb", textAlign: "center", fontFamily: "monospace", color: "#ea580c", fontWeight: 600 }}>
                          {cetM ? `${(Number(cetM) * 100).toFixed(2)}%` : "—"}
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            <button className="btn-primary" style={{ fontSize: 10, padding: "3px 10px", display: "flex", alignItems: "center", gap: 3 }} onClick={() => handleOpenConvert(sim)}>
                              <ArrowRight size={11} /> Converter
                            </button>
                            <button onClick={() => handleDelete(sim.id)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: 4 }} title="Excluir">
                              <Trash2 size={12} />
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
        </div>

        {/* Modal de Conversão */}
        {convertOpen && selectedSim && (
          <div className="sigx-modal-backdrop" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="sigx-modal-container" style={{ width: 460, background: "white", borderRadius: 10, overflow: "hidden" }}>
              <div className="sigx-modal-header" style={{ padding: "12px 16px", background: "#1a2035", color: "white", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <FileText size={15} />
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Converter Simulação em Contrato</h3>
                </div>
                <button type="button" onClick={() => setConvertOpen(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}><X size={16} /></button>
              </div>
              <form onSubmit={handleConvertSubmit}>
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  
                  <div style={{ padding: "10px 12px", background: "#f8f9fa", border: "1px solid #d1d5db", borderRadius: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 9, color: "#6b7280", display: "block" }}>VALOR FINANCIADO</span>
                      <strong style={{ fontSize: 12, color: "#111827" }} className="mono">{fmt(selectedSim.financedTotal ?? selectedSim.financed_total ?? selectedSim.principal)}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 9, color: "#6b7280", display: "block" }}>PRESTAÇÃO ({selectedSim.installmentCount ?? selectedSim.installment_count}x)</span>
                      <strong style={{ fontSize: 12, color: "#1e3a8a" }} className="mono">{fmt(selectedSim.installmentAmount ?? selectedSim.installment_amount)}</strong>
                    </div>
                  </div>

                  <div>
                    <label className="sigx-label">VINCULAR AO CLIENTE DO SISTEMA *</label>
                    <select className="sigx-input" value={convertForm.clientId} onChange={e => setConvertForm(p => ({ ...p, clientId: e.target.value }))} required style={{ fontSize: 12 }}>
                      <option value="">-- Selecione um cliente da base --</option>
                      {clients?.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.document})</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label className="sigx-label">CÓDIGO DO CONTRATO *</label>
                      <input className="sigx-input mono" value={convertForm.code} onChange={e => setConvertForm(p => ({ ...p, code: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="sigx-label">DATA DE ASSINATURA</label>
                      <input type="date" className="sigx-input" value={convertForm.contractDate} onChange={e => setConvertForm(p => ({ ...p, contractDate: e.target.value }))} required />
                    </div>
                  </div>

                  <div>
                    <label className="sigx-label">NOME DO CONTRATO *</label>
                    <input className="sigx-input" value={convertForm.contractName} onChange={e => setConvertForm(p => ({ ...p, contractName: e.target.value }))} required />
                  </div>

                  <div>
                    <label className="sigx-label">CREDOR</label>
                    <input className="sigx-input" value={convertForm.creditor} onChange={e => setConvertForm(p => ({ ...p, creditor: e.target.value }))} />
                  </div>

                </div>
                <div style={{ padding: "10px 16px", background: "#f9fafb", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button type="button" className="btn-secondary" onClick={() => setConvertOpen(false)} style={{ fontSize: 11 }}>Cancelar</button>
                  <button type="submit" className="btn-primary" style={{ fontSize: 11 }}>Criar Contrato Físico</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </UnyPayLayout>
  );
}