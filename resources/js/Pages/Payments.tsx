import React, { useState, useMemo, useEffect, Fragment } from "react";
import { Head, router } from "@inertiajs/react";
import {
  Search, Eye, ChevronDown, ChevronRight, X,
  CheckCircle, DollarSign, RefreshCw, Minus, TrendingUp, TrendingDown
} from "lucide-react";
import UnyPayLayout from "../Components/UnyPayLayout";

const fmt = (v: number | string | null | undefined) => {
  const n = Number(v ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
};

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const [year, month, day] = d.split("-");
  return `${day}/${month}/${year}`;
};

const fmtN = (v: number, dec = 2) => v.toFixed(dec).replace(".", ",");

export default function Payments({ contracts, interestData, filters }: any) {
  const [search, setSearch] = useState(filters?.search || "");
  const [statusFilter, setStatusFilter] = useState(filters?.statusFilter || "Todos");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [schedLoading, setSchedLoading] = useState(false);
  
  const [payOpen, setPayOpen] = useState(false);
  const [payInstId, setPayInstId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState("PIX");
  const [baseDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (expandedId) {
      setSchedLoading(true);
      fetch(`/api/payments/schedule/${expandedId}?baseDate=${baseDate}`)
        .then(res => res.json())
        .then(data => {
          setSchedule(data);
          setSchedLoading(false);
        })
        .catch(err => {
          console.error(err);
          setSchedLoading(false);
        });
    } else {
      setSchedule(null);
    }
  }, [expandedId]);

  const handleFilterChange = (newSearch: string, newStatus: string) => {
    router.get("/payments", { search: newSearch, statusFilter: newStatus }, { preserveState: true, replace: true });
  };

  const interestMap = useMemo(() => {
    if (!interestData) return new Map<number, any>();
    return new Map(interestData.map((i: any) => [i.contractId, i]));
  }, [interestData]);

  const schedTotals = useMemo(() => {
    if (!schedule) return null;
    const rows = schedule.schedule || [];
    const totals = schedule.totals || { totalPaid: 0 };
    const vencidas = rows.filter((r: any) => r.status === "Vencido" || r.status === "Atrasado");
    const pagas = rows.filter((r: any) => r.status === "Pago");
    const totalIpca = rows.reduce((s: number, r: any) => s + (r.ipcaCorrection ?? 0), 0);
    const totalMora = rows.reduce((s: number, r: any) => s + (r.moraAmount ?? 0), 0);
    const totalMulta = rows.reduce((s: number, r: any) => s + (r.penaltyAmount ?? 0), 0);
    const totalHonorarios = rows.reduce((s: number, r: any) => s + (r.honoraryAmount ?? 0), 0);
    const totalAtualizado = rows.reduce((s: number, r: any) => s + (r.status !== "Pago" ? r.updatedAmount : 0), 0);
    const totalVencendoAcelerado = rows.filter((r: any) => r.isAccelerated).reduce((s: number, r: any) => s + r.updatedAmount, 0);
    return {
      parcVencidas: vencidas.length,
      parcPagas: pagas.length,
      totalPago: totals.totalPaid,
      totalIpca, totalMora, totalMulta, totalHonorarios, totalAtualizado, totalVencendoAcelerado,
      totalExigivel: totalAtualizado,
    };
  }, [schedule]);

  const openPayment = (installmentId: number, amount: number) => {
    setPayInstId(installmentId);
    setPayAmount(amount.toFixed(2));
    setPayOpen(true);
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payInstId || !expandedId) return;

    router.post("/api/payments/record", {
      installmentId: payInstId,       
      amount: parseFloat(payAmount),  
      paidAt: payDate,                
      method: payMethod,   
      contractId: expandedId,          
    }, {
      preserveState: true,
      onSuccess: () => {
        setPayOpen(false);
        fetch(`/api/payments/schedule/${expandedId}?baseDate=${baseDate}`)
          .then(res => res.json())
          .then(data => setSchedule(data));
      }
    });
  };

  const STATUS_COLORS: Record<string, string> = {
    "Ativo": "#059669", "Inadimplente": "#dc2626", "Quitado": "#2563eb", "Renegociado": "#7c3aed",
  };

  return (
    <UnyPayLayout>
      <Head title="Controle de Pagamentos" />

      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8f9fa", padding: "0 24px 24px 24px" }}>
        
        {/* TÍTULO LIMPO "Controle de Pagamentos" (IGUAL À IMAGEM) */}
        <div style={{ padding: "16px 0 10px 0", flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>Controle de Pagamentos</h1>
        </div>

        {/* BARRA DE FILTROS CIMENTADA NO TOPO DO CONTAINER DA TABELA */}
        <div style={{ background: "white", border: "1px solid #d1d5db", borderBottom: "none", borderRadius: "8px 8px 0 0", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input 
              type="text" 
              className="sigx-input" 
              style={{ paddingLeft: 30, width: 260, fontSize: 12, height: 32 }} 
              placeholder="Buscar cliente, código, contrato..." 
              value={search} 
              onChange={e => { setSearch(e.target.value); handleFilterChange(e.target.value, statusFilter); }} 
            />
          </div>
          <select 
            className="sigx-input" 
            style={{ width: 140, fontSize: 12, height: 32, background: "white" }} 
            value={statusFilter} 
            onChange={e => { setStatusFilter(e.target.value); handleFilterChange(search, e.target.value); }}
          >
            <option value="Todos">Todos os status</option>
            <option value="Ativo">Ativo</option>
            <option value="Inadimplente">Inadimplente</option>
            <option value="Quitado">Quitado</option>
          </select>
          <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>{contracts?.length ?? 0} contratos</span>
        </div>

        {/* TABELA INTEGRAL — CABEÇALHO E CORPO VIVEM NO MESMO BLOCO SEM QUEBRAS DE LAYOUT */}
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: "16px" }}>
          <div style={{ background: "white", border: "1px solid #d1d5db", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#1a2035", color: "white" }}>
                  <th style={{ width: 28, background: "#1a2035" }} />
                  <th colSpan={4} style={{ background: "#1e3a5f", color: "white", textAlign: "center", padding: "5px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>IDENTIFICAÇÃO</th>
                  <th colSpan={4} style={{ background: "#2d3a8c", color: "white", textAlign: "center", padding: "5px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>FINANCEIRO</th>
                  <th colSpan={4} style={{ background: "#1a3a2a", color: "white", textAlign: "center", padding: "5px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>PARCELAS</th>
                  <th colSpan={2} style={{ background: "#5f3d11", color: "white", textAlign: "center", padding: "5px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>JUROS</th>
                  <th colSpan={2} style={{ background: "#11265f", color: "white", textAlign: "center", padding: "5px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>SITUAÇÃO</th>
                </tr>
                <tr style={{ background: "#202945", color: "rgba(255,255,255,0.9)" }}>
                  <th style={{ width: 28 }} />
                  <th style={{ padding: "6px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", textAlign: "left" }}>CÓD.</th>
                  <th style={{ padding: "6px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", textAlign: "left" }}>CLIENTE</th>
                  <th style={{ padding: "6px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", textAlign: "left" }}>DATA</th>
                  <th style={{ padding: "6px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", textAlign: "left" }}>CREDOR</th>
                  <th style={{ padding: "6px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>PRINCIPAL</th>
                  <th style={{ padding: "6px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>FINANCIADO</th>
                  <th style={{ padding: "6px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", textAlign: "center" }}>PARCELAS</th>
                  <th style={{ padding: "6px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>VL. PARCELA</th>
                  <th style={{ padding: "6px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", textAlign: "center" }}>PAGAS</th>
                  <th style={{ padding: "6px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", textAlign: "center" }}>EM ABERTO</th>
                  <th style={{ padding: "6px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", textAlign: "center" }}>DIAS ATR.</th>
                  <th style={{ padding: "6px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>VL. RECEBER</th>
                  <th style={{ padding: "6px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", textAlign: "right" }}>JUROS TOTAIS</th>
                  <th style={{ padding: "6px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", textAlign: "center" }}>CET MENSAL</th>
                  <th style={{ padding: "6px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", textAlign: "left" }}>STATUS</th>
                  <th style={{ padding: "6px 10px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", textAlign: "left" }}>1º VENC.</th>
                </tr>
              </thead>
              <tbody>{contracts?.length === 0 ? (
                  <tr><td colSpan={17} style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>Nenhum contrato ativo localizado.</td></tr>
                ) : (
                  contracts?.map(({ contract, clientName }: any, rowIdx: number) => {
                    const interest = interestMap.get(contract.id);
                    const isExpanded = expandedId === contract.id;
                    const rowBg = rowIdx % 2 === 1 ? "#fafafa" : "white";

                    return (
                      <Fragment key={`ct-wrapper-${contract.id}`}>
                        <tr style={{ background: rowBg, cursor: "pointer" }} onClick={() => setExpandedId(isExpanded ? null : contract.id)} onMouseOver={e => (e.currentTarget.style.background = "#eff6ff")} onMouseOut={e => (e.currentTarget.style.background = rowBg)}>
                          <td style={{ padding: "7px 8px", textAlign: "center", borderBottom: "1px solid #e5e7eb" }}>
                            {isExpanded ? <ChevronDown size={13} style={{ color: "#2563eb" }} /> : <ChevronRight size={13} style={{ color: "#9ca3af" }} />}
                          </td>
                          <td style={{ padding: "7px 10px", borderBottom: "1px solid #e5e7eb" }}><span className="mono" style={{ fontSize: 11, fontWeight: 600, color: "#1e40af" }}>{contract.code}</span></td>
                          <td style={{ padding: "7px 10px", borderBottom: "1px solid #e5e7eb", maxWidth: 160 }}>
                            <div style={{ fontWeight: 700, fontSize: 12, color: "#111827" }}>{clientName}</div>
                            <div style={{ fontSize: 9, color: "#6b7280" }}>{contract.contractName}</div>
                          </td>
                          <td style={{ padding: "7px 10px", color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>{fmtDate(contract.contractDate)}</td>
                          <td style={{ padding: "7px 10px", color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>{contract.creditor}</td>
                          <td style={{ padding: "7px 10px", textAlign: "right", borderBottom: "1px solid #e5e7eb" }}><span className="mono" style={{ fontWeight: 700 }}>{fmt(contract.principalAmount)}</span></td>
                          <td style={{ padding: "7px 10px", textAlign: "right", borderBottom: "1px solid #e5e7eb" }}><span className="mono" style={{ color: "#6b7280" }}>{fmt(contract.financedTotal)}</span></td>
                          <td style={{ padding: "7px 10px", textAlign: "center", borderBottom: "1px solid #e5e7eb" }}>{contract.installmentCount}×</td>
                          <td style={{ padding: "7px 10px", textAlign: "right", borderBottom: "1px solid #e5e7eb" }}><span className="mono">{fmt(contract.installmentAmount)}</span></td>
                          <td style={{ padding: "7px 10px", textAlign: "center", borderBottom: "1px solid #e5e7eb" }}><span className="mono" style={{ color: "#059669", fontWeight: 600 }}>{interest?.paidInstallments ?? 0}</span></td>
                          <td style={{ padding: "7px 10px", textAlign: "center", borderBottom: "1px solid #e5e7eb" }}><span className="mono" style={{ color: "#dc2626", fontWeight: 600 }}>{interest?.overdueInstallments ?? 0}</span></td>
                          <td style={{ padding: "7px 10px", textAlign: "center", borderBottom: "1px solid #e5e7eb" }}><span className="mono" style={{ color: (interest?.maxDaysOverdue ?? 0) > 0 ? "#dc2626" : "inherit" }}>{interest?.maxDaysOverdue ? `${interest.maxDaysOverdue}d` : "—"}</span></td>
                          <td style={{ padding: "7px 10px", textAlign: "right", borderBottom: "1px solid #e5e7eb" }}><span className="mono" style={{ color: "#2563eb", fontWeight: 600 }}>{fmt(interest?.remainingBalance)}</span></td>
                          <td style={{ padding: "7px 10px", textAlign: "right", borderBottom: "1px solid #e5e7eb" }}><span className="mono" style={{ color: "#dc2626", fontWeight: 600 }}>{fmt(interest?.totalInterest)}</span></td>
                          <td style={{ padding: "7px 10px", textAlign: "center", borderBottom: "1px solid #e5e7eb" }}><span className="mono">{interest ? `${(interest.cetMonthly * 100).toFixed(2)}%` : "—"}</span></td>
                          <td style={{ padding: "7px 10px", borderBottom: "1px solid #e5e7eb" }}><span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: "uppercase", background: contract.status === "Ativo" ? "#d1fae5" : "#fee2e2", color: contract.status === "Ativo" ? "#065f46" : "#991b1b" }}>{contract.status}</span></td>
                          <td style={{ padding: "7px 10px", color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>{fmtDate(contract.firstDueDate)}</td>
                        </tr>

                        {/* SUB-PAINEL SANFONADO DETALHADO DO CONTRATO */}
                        {isExpanded && (
                          <tr key={`exp-${contract.id}`}>
                            <td colSpan={17} style={{ padding: 0, borderBottom: "2px solid #1a2035" }}>
                              <div style={{ background: "#f8f9fa", padding: "4px 0" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, borderBottom: "1px solid #e5e7eb" }}>
                                  
                                  {/* Parâmetros */}
                                  <div style={{ padding: 12, borderRight: "1px solid #e5e7eb" }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: "white", background: "#1a2035", padding: "4px 8px", marginBottom: 6, borderRadius: 3 }}>PARÂMETROS DO CONTRATO</div>
                                    {[
                                      { label: "Credor", value: contract.creditor },
                                      { label: "Data base", value: fmtDate(contract.contractDate) },
                                      { label: "Último IPCA", value: "20/05/2026" },
                                      { label: "Data do contrato", value: fmtDate(contract.contractDate) },
                                      { label: "Valor liberado", value: fmt(contract.principalAmount) },
                                      { label: "Valor contrato", value: fmt(contract.financedTotal) },
                                      { label: "Número de parcelas", value: String(contract.installmentCount) },
                                      { label: "Juros mora a.m.", value: `${(Number(contract.moraRateMonthly) * 100).toFixed(2)}%` },
                                      { label: "Multa", value: `${(Number(contract.penaltyRate) * 100).toFixed(2)}%` },
                                      { label: "Base multa", value: contract.penaltyBaseType },
                                      { label: "Honorários", value: `${(Number(contract.honoraryRate) * 100).toFixed(2)}%` },
                                      { label: "Indexador", value: contract.correctionIndex },
                                      { label: "Vencimento antecipado", value: contract.accelerates ? "SIM" : "NÃO" },
                                    ].map(row => (
                                      <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #f0f0f0", fontSize: 11 }}>
                                        <span style={{ color: "#6b7280" }}>{row.label}</span>
                                        <span style={{ fontWeight: 600, fontFamily: "monospace" }}>{row.value}</span>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Demonstrativo */}
                                  <div style={{ padding: 12, borderRight: "1px solid #e5e7eb" }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: "white", background: "#1e3a5f", padding: "4px 8px", marginBottom: 6, borderRadius: 3 }}>PAINEL DO CONTRATO</div>
                                    {schedTotals && [
                                      { label: "Parcelas vencidas em aberto", value: String(schedTotals.parcVencidas), color: "#dc2626" },
                                      { label: "Principal vencido", value: fmt((schedule?.schedule ?? []).filter((r: any) => r.status === "Vencido" || r.status === "Atrasado").reduce((s: number, r: any) => s + r.originalAmount, 0)), color: "#dc2626" },
                                      { label: "Correção IPCA", value: fmt(schedTotals.totalIpca), color: "#7c3aed" },
                                      { label: "Juros mora", value: fmt(schedTotals.totalMora), color: "#ea580c" },
                                      { label: "Multa", value: fmt(schedTotals.totalMulta), color: "#dc2626" },
                                      { label: "Total vencido updatedAmount", value: fmt(schedTotals.totalAtualizado), color: "#dc2626", bold: true },
                                      { label: "Saldo vincendo acelerado", value: fmt(schedTotals.totalVencendoAcelerado), color: "#7c3aed" },
                                      { label: "Total exigível sem honorários", value: fmt(schedTotals.totalExigivel), color: "#1e2139", bold: true },
                                      { label: "Honorários contratuais", value: fmt(schedTotals.totalHonorarios), color: "#6b7280" },
                                      { label: "Total exigível com honorários", value: fmt(schedTotals.totalExigivel + schedTotals.totalHonorarios), color: "#1e2139", bold: true },
                                    ].map(row => (
                                      <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #f0f0f0", fontSize: 11 }}>
                                        <span style={{ color: "#6b7280" }}>{row.label}</span>
                                        <span style={{ fontWeight: row.bold ? 800 : 600, color: row.color, fontFamily: "monospace" }}>{row.value}</span>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Cláusulas e Garantias */}
                                  <div style={{ padding: 12 }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: "white", background: "#ea580c", padding: "4px 8px", marginBottom: 6, borderRadius: 3 }}>REGRA DE VENCIMENTO ANTECIPADO</div>
                                    <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5, background: "#fff", padding: 8, borderRadius: 4, border: "1px solid #e5e7eb", marginBottom: 12 }}>
                                      {contract.accelerationRule || "Qualquer atraso gera vencimento antecipado da dívida, conforme cláusula 4.1; encargos da cláusula 2.2."}
                                    </div>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: "white", background: "#7c3aed", padding: "4px 8px", marginBottom: 6, borderRadius: 3 }}>GARANTIAS / FIADORES</div>
                                    <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5, background: "#fff", padding: 8, borderRadius: 4, border: "1px solid #e5e7eb" }}>
                                      {contract.guarantors || contract.guarantees || "Fiadores solidários identificados no instrumento regulamentar da dívida."}
                                    </div>
                                  </div>
                                </div>

                                {/* CRONOGRAMA DE AUDITORIA INTERNA DA SANFONA */}
                                {schedLoading ? (
                                  <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "#6b7280" }}>Calculando indexadores e juros diários do banco...</div>
                                ) : (
                                  <div style={{ overflowX: "auto" }}>
                                    <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 11 }}>
                                      <thead>
                                        <tr style={{ background: "#2d3748", color: "white" }}>
                                          {["PARCELA","VENCIMENTO","VALOR PARCELA","STATUS ORIGEM","DATA PAGAMENTO","TOTAL PAGO","PAGO?","ABERTA?","DIAS ATRASO","FATOR IPCA","CORREÇÃO IPCA","JUROS MORA","MULTA","TOTAL ATUALIZADO","VINCENDO ACELERADO?","VALOR VINCENDO ACELERADO","OBSERVAÇÃO"].map((h, i) => (
                                            <th key={`th-inst-${i}`} style={{ background: i === 0 ? "#1a2035" : i < 6 ? "#1e3a5f" : i < 9 ? "#5f2d11" : i < 13 ? "#2a1a5f" : "#1a3a2a", color: "white", padding: "5px 8px", fontSize: 8, fontWeight: 700, textTransform: "uppercase", textAlign: ["VALOR PARCELA","TOTAL PAGO","FATOR IPCA","CORREÇÃO IPCA","JUROS MORA","MULTA","TOTAL ATUALIZADO","VALOR VINCENDO ACELERADO"].includes(h) ? "right" : "center", whiteSpace: "nowrap", borderRight: "1px solid rgba(255,255,255,0.1)" }}>{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>{schedule?.schedule?.map((inst: any) => {
                                          const isPago = inst.status === "Pago";
                                          const isVencido = inst.status === "Vencido" || inst.status === "Vencida" || inst.status === "Atrasado";
                                          const rBg = isPago ? "#f0fdf4" : isVencido ? "#fff5f5" : "white";
                                          return (
                                            <tr key={`inst-row-${inst.installmentId}`} style={{ background: rBg }} onMouseOver={e => (e.currentTarget.style.background = "#eff6ff")} onMouseOut={e => (e.currentTarget.style.background = rBg)}>
                                              <td style={{ textAlign: "center", padding: "5px 8px", fontFamily: "monospace", fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>{inst.installmentNumber}</td>
                                              <td style={{ textAlign: "center", padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{fmtDate(inst.dueDate)}</td>
                                              <td style={{ textAlign: "right", padding: "5px 8px", fontFamily: "monospace", borderBottom: "1px solid #e5e7eb" }}>{fmt(inst.originalAmount)}</td>
                                              <td style={{ textAlign: "center", padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}><span style={{ fontSize: 9, fontWeight: 600, color: isPago ? "#059669" : "#dc2626" }}>{isPago ? "Pago" : "vencido"}</span></td>
                                              <td style={{ textAlign: "center", padding: "5px 8px", color: "#059669", borderBottom: "1px solid #e5e7eb" }}>{inst.payments?.[0] ? fmtDate(inst.payments[0].paidAt) : "—"}</td>
                                              <td style={{ textAlign: "right", padding: "5px 8px", fontFamily: "monospace", color: "#059669", fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>{inst.paidAmount > 0 ? fmt(inst.paidAmount) : "—"}</td>
                                              <td style={{ textAlign: "center", padding: "5px 8px", color: isPago ? "#059669" : "#6b7280", borderBottom: "1px solid #e5e7eb", fontWeight: 700 }}>{isPago ? "Sim" : "Não"}</td>
                                              <td style={{ textAlign: "center", padding: "5px 8px", color: isVencido ? "#dc2626" : "#6b7280", borderBottom: "1px solid #e5e7eb", fontWeight: 700 }}>{isVencido ? "Sim" : "Não"}</td>
                                              <td style={{ textAlign: "center", padding: "5px 8px", fontFamily: "monospace", color: inst.daysOverdue > 0 ? "#dc2626" : "#6b7280", fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>{inst.daysOverdue > 0 ? inst.daysOverdue : "—"}</td>
                                              <td style={{ textAlign: "right", padding: "5px 8px", fontFamily: "monospace", color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>{inst.ipcaCorrection > 0 ? fmtN(1 + inst.ipcaCorrection / inst.originalAmount, 4) : "1,00"}</td>
                                              <td style={{ textAlign: "right", padding: "5px 8px", fontFamily: "monospace", color: "#7c3aed", borderBottom: "1px solid #e5e7eb" }}>{inst.ipcaCorrection > 0 ? fmt(inst.ipcaCorrection) : "—"}</td>
                                              <td style={{ textAlign: "right", padding: "5px 8px", fontFamily: "monospace", color: "#ea580c", borderBottom: "1px solid #e5e7eb" }}>{inst.moraAmount > 0 ? fmt(inst.moraAmount) : "—"}</td>
                                              <td style={{ textAlign: "right", padding: "5px 8px", fontFamily: "monospace", color: "#dc2626", borderBottom: "1px solid #e5e7eb" }}>{inst.penaltyAmount > 0 ? fmt(inst.penaltyAmount) : "—"}</td>
                                              <td style={{ textAlign: "right", padding: "5px 8px", fontFamily: "monospace", fontWeight: 700, color: isVencido ? "#dc2626" : "#111827", borderBottom: "1px solid #e5e7eb" }}>{fmt(isPago ? inst.paidAmount : inst.updatedAmount)}</td>
                                              <td style={{ textAlign: "center", padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}><span style={{ fontSize: 9, fontWeight: 700, color: inst.isAccelerated ? "#dc2626" : "#6b7280" }}>{inst.isAccelerated ? "Sim" : "Não"}</span></td>
                                              <td style={{ textAlign: "right", padding: "5px 8px", fontFamily: "monospace", color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>{inst.isAccelerated ? fmt(inst.updatedAmount) : "—"}</td>
                                              <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>
                                                {!isPago && <button className="btn-primary" style={{ fontSize: 9, padding: "2px 8px", height: 20 }} onClick={e => { e.stopPropagation(); openPayment(inst.installmentId, inst.openBalance); }}>Pagar</button>}
                                              </td>
                                            </tr>
                                          );
                                        })}</tbody>
                                      
                                      {/* RODAPÉ FINANCEIRO CONSOLIDADO DA SANFONA */}
                                      {schedTotals && (
                                        <tfoot>
                                          <tr style={{ background: "#1e2139", color: "white", fontWeight: 700 }}>
                                            <td colSpan={2} style={{ padding: "6px 8px", fontSize: 10, textTransform: "uppercase" }}>TOTAL</td>
                                            <td style={{ textAlign: "right", padding: "6px 8px", fontFamily: "monospace" }}>{fmt((schedule?.schedule ?? []).reduce((s: number, r: any) => s + r.originalAmount, 0))}</td>
                                            <td colSpan={7} />
                                            <td style={{ textAlign: "right", padding: "6px 8px", fontFamily: "monospace", color: "#c4b5fd" }}>{fmt(schedTotals.totalIpca)}</td>
                                            <td style={{ textAlign: "right", padding: "6px 8px", fontFamily: "monospace", color: "#fca5a5" }}>{fmt(schedTotals.totalMora)}</td>
                                            <td style={{ textAlign: "right", padding: "6px 8px", fontFamily: "monospace", color: "#fca5a5" }}>{fmt(schedTotals.totalMulta)}</td>
                                            <td style={{ textAlign: "right", padding: "6px 8px", fontFamily: "monospace", color: "#86efac" }}>{fmt(schedTotals.totalAtualizado)}</td>
                                            <td colSpan={2} style={{ textAlign: "right", padding: "6px 8px", fontFamily: "monospace", color: "#fca5a5" }}>{fmt(schedTotals.totalVencendoAcelerado)}</td>
                                            <td />
                                          </tr>
                                        </tfoot>
                                      )}
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}</tbody>
            </table>
          </div>
        </div>

        {/* MODAL DE BAIXA PROTEGIDA CONTRA CLIQUES ACIDENTAIS */}
        {payOpen && (
          <div className="sigx-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setPayOpen(false); }}>
            <div className="sigx-modal" style={{ maxWidth: 380 }} onMouseDown={e => e.stopPropagation()}>
              <div className="sigx-modal-header">
                <span className="sigx-modal-title">Registrar Pagamento</span>
                <button type="button" onClick={() => setPayOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", display: "flex" }}><X size={18} /></button>
              </div>
              <form onSubmit={handlePaySubmit}>
                <div className="sigx-modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label className="sigx-label">Valor pago (R$) *</label>
                    <input type="number" step="0.01" min="0.01" className="sigx-input mono" value={payAmount} onChange={e => setPayAmount(e.target.value)} required />
                  </div>
                  <div>
                    <label className="sigx-label">Data do pagamento *</label>
                    <input type="date" className="sigx-input" value={payDate} onChange={e => setPayDate(e.target.value)} required />
                  </div>
                  <div>
                    <label className="sigx-label">Método</label>
                    <select className="sigx-input" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                      {["PIX","TED","Boleto","Cheque","Dinheiro","Cartão"].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div className="sigx-modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setPayOpen(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary">Confirmar Pagamento</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </UnyPayLayout>
  );
}