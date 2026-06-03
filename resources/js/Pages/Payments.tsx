import React, { useState, useMemo, useEffect, Fragment } from "react";
import { Head, router } from "@inertiajs/react";
import { Search, ChevronDown, ChevronRight, X } from "lucide-react";
import UnyPayLayout from "../Components/UnyPayLayout";
import TableGroupBadges from "../Components/TableGroupBadges";
import TableColumnPicker from "../Components/TableColumnPicker";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import {
  PAYMENTS_COLUMNS,
  PAYMENTS_GROUP_META,
  PAYMENTS_GROUP_ORDER,
  type PaymentsColumnDef,
  type PaymentsColumnId,
} from "../lib/paymentsColumns";

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

// ── estilos compactos compartilhados ───────────────────────────────────────
const headerCellStyle: React.CSSProperties = {
  background: "#f1f5f9",
  color: "#334155",
  padding: "5px 7px",
  fontSize: 9,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
  borderBottom: "2px solid #cbd5e1",
};

const tdBase: React.CSSProperties = {
  padding: "3px 7px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: 11,
  verticalAlign: "middle",
};
const tdNum: React.CSSProperties = { ...tdBase, fontFamily: "'IBM Plex Mono', monospace", textAlign: "right", fontSize: 11 };
const tdCenter: React.CSSProperties = { ...tdBase, textAlign: "center" };

// sub-tabela cabeçalhos customizados
const subHeaderCellStyle: React.CSSProperties = {
  background: "#f1f5f9",
  color: "#334155",
  padding: "5px 7px",
  fontSize: 9,
  fontWeight: 700,
  textTransform: "uppercase",
  borderBottom: "2px solid #cbd5e1",
  whiteSpace: "nowrap",
};
const subBodyCellStyle: React.CSSProperties = {
  padding: "5px 7px",
  fontSize: 11,
  borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
};

const CHEVRON_WIDTH = 28;
const PAGE_SIZES = [20, 50, 100];

export default function Payments({ contracts, interestData, filters }: any) {
  const [search, setSearch] = useState(filters?.search || "");
  const [statusFilter, setStatusFilter] = useState(filters?.statusFilter || "Todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [schedLoading, setSchedLoading] = useState(false);

  const [payOpen, setPayOpen] = useState(false);
  const [payInstId, setPayInstId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState("PIX");
  const [baseDate] = useState(new Date().toISOString().slice(0, 10));

  // ── Visibilidade de colunas (Restaurado hook original sem erros) ───────
  const { visibleIds, toggleColumn, setColumnsVisible, resetDefaults } =
    useColumnVisibility<PaymentsColumnId>("unypay.payments.columns.v1", PAYMENTS_COLUMNS);

  const visibleOrdered: PaymentsColumnDef[] = useMemo(
    () => PAYMENTS_COLUMNS.filter((c) => visibleIds.has(c.id)),
    [visibleIds]
  );

  const stickyOffsets = useMemo(() => {
    const offsets = new Map<PaymentsColumnId, number>();
    let acc = CHEVRON_WIDTH;
    for (const col of visibleOrdered) {
      if (col.sticky) {
        offsets.set(col.id, acc);
        acc += col.width;
      }
    }
    return offsets;
  }, [visibleOrdered]);

  useEffect(() => {
    if (expandedId) {
      setSchedLoading(true);
      fetch(`/api/payments/schedule/${expandedId}?baseDate=${baseDate}`)
        .then(res => res.json())
        .then(data => { setSchedule(data); setSchedLoading(false); })
        .catch(err => { console.error(err); setSchedLoading(false); });
    } else {
      setSchedule(null);
    }
  }, [expandedId, baseDate]);

  const handleFilterChange = (newSearch: string, newStatus: string) => {
    setPage(1);
    router.get("/payments", { search: newSearch, statusFilter: newStatus }, { preserveState: true, replace: true });
  };

  const interestMap = useMemo(() => {
    if (!interestData) return new Map<number, any>();
    return new Map(interestData.map((i: any) => [i.contractId, i]));
  }, [interestData]);

  // 🚀 Totais acumulados da tabela filha mapeando as colunas separadas
  const schedTotals = useMemo(() => {
    if (!schedule) return null;
    const rows = schedule.schedule || [];
    const totals = schedule.totals || { totalPaid: 0 };
    const vencidas = rows.filter((r: any) => r.status === "Vencido" || r.status === "Atrasado");
    const pagas = rows.filter((r: any) => r.status === "Pago");
    const totalOriginal = rows.reduce((s: number, r: any) => s + (r.originalAmount ?? 0), 0);
    const totalIpca = rows.reduce((s: number, r: any) => s + (r.ipcaCorrection ?? 0), 0);
    const totalMora = rows.reduce((s: number, r: any) => s + (r.moraAmount ?? 0), 0);
    const totalMulta = rows.reduce((s: number, r: any) => s + (r.penaltyAmount ?? 0), 0);
    const totalHonorarios = rows.reduce((s: number, r: any) => s + (r.honoraryAmount ?? 0), 0);
    const totalAtualizado = rows.reduce((s: number, r: any) => s + (r.status !== "Pago" ? r.updatedAmount : 0), 0);
    const totalVencendoAcelerado = rows.filter((r: any) => r.isAccelerated).reduce((s: number, r: any) => s + r.updatedAmount, 0);
    return {
      parcVencidas: vencidas.length,
      parcPagas: pagas.length,
      totalOriginal,
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
          .then(data => data && setSchedule(data));
      }
    });
  };

  const renderCellContent = (col: PaymentsColumnDef, row: any): React.ReactNode => {
    const contract = row.contract;
    const interest = interestMap.get(contract.id);

    switch (col.id) {
      case "code":
        return <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: "#1e40af" }}>{contract.code}</span>;
      case "client":
        return (
          <div style={{ maxWidth: col.width - 14, overflow: "hidden" }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row.clientName}
            </div>
            <div style={{ fontSize: 9, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {contract.contractName}
            </div>
          </div>
        );
      case "date":
        return <span style={{ color: "#6b7280" }}>{fmtDate(contract.contractDate)}</span>;
      case "creditor":
        return <span style={{ color: "#6b7280" }}>{contract.creditor}</span>;
      case "principal":
        return <span className="mono" style={{ fontWeight: 700 }}>{fmt(contract.principalAmount)}</span>;
      case "financed":
        return <span className="mono" style={{ color: "#6b7280" }}>{fmt(contract.financedTotal)}</span>;
      case "installments":
        return <>{contract.installmentCount}×</>;
      case "installmentAmt":
        return <span className="mono">{fmt(contract.installmentAmount)}</span>;
      case "paid":
        return <span className="mono" style={{ color: "#059669", fontWeight: 600 }}>{Number(interest?.paidInstallments ?? 0)}</span>;
      case "overdue": {
        const totalInst = Number(contract.installmentCount ?? 0);
        const paidCount = Number(interest?.paidInstallments ?? 0);
        return <span className="mono" style={{ color: "#dc2626", fontWeight: 600 }}>{totalInst - paidCount}</span>;
      }
      case "daysOverdue": {
        const cleanDays = Math.floor(Number(interest?.maxDaysOverdue ?? 0));
        return (
          <span className="mono" style={{ color: cleanDays > 0 ? "#dc2626" : "#059669", fontWeight: 600 }}>
            {cleanDays > 0 ? `${cleanDays} dias` : "0 dias"}
          </span>
        );
      }
      case "toReceive":
        return <span className="mono" style={{ color: "#2563eb", fontWeight: 600 }}>{fmt(interest?.remainingBalance)}</span>;
      case "totalInterest":
        return <span className="mono" style={{ color: "#dc2626", fontWeight: 600 }}>{fmt(interest?.totalInterest)}</span>;
      case "cetMonthly":
        return <span className="mono">{interest ? `${(interest.cetMonthly * 100).toFixed(2)}%` : "—"}</span>;
      case "status":
        return (
          <span style={{
            padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: "uppercase",
            background: contract.status === "Ativo" ? "#d1fae5" : "#fee2e2",
            color: contract.status === "Ativo" ? "#065f46" : "#991b1b",
          }}>
            {contract.status}
          </span>
        );
      case "firstDue":
        return <span style={{ color: "#6b7280" }}>{fmtDate(contract.firstDueDate)}</span>;
      default:
        return null;
    }
  };

  const visibleGroupRuns = useMemo(() => {
    const runs: { group: typeof PAYMENTS_GROUP_ORDER[number]; count: number }[] = [];
    for (const col of visibleOrdered) {
      const last = runs[runs.length - 1];
      if (last && last.group === col.group) last.count += 1;
      else runs.push({ group: col.group, count: 1 });
    }
    return runs;
  }, [visibleOrdered]);

  const totalRows = contracts?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const paginated = useMemo(
    () => (contracts ?? []).slice((page - 1) * pageSize, page * pageSize),
    [contracts, page, pageSize]
  );

  return (
    <UnyPayLayout>
      <Head title="Controle de Pagamentos" />

      <div style={{ padding: "12px 20px 16px 20px", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", gap: 12 }}>
        <div style={{ flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>Controle de Pagamentos</h1>
        </div>

        <div style={{
          background: "white", border: "1px solid #e5e7eb", borderRadius: 6,
          padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input
                type="text"
                style={{ paddingLeft: 26, width: 260, fontSize: 11, height: 28, border: "1px solid #d1d5db", borderRadius: 6, outline: "none", color: "#374151" }}
                placeholder="Buscar cliente, código, contrato..."
                value={search}
                onChange={e => { setSearch(e.target.value); handleFilterChange(e.target.value, statusFilter); }}
              />
            </div>
            <select
              style={{ width: 140, fontSize: 11, height: 28, background: "white", border: "1px solid #d1d5db", borderRadius: 6, color: "#374151", cursor: "pointer", flexShrink: 0 }}
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); handleFilterChange(search, e.target.value); }}
            >
              <option value="Todos">Todos os status</option>
              <option value="Ativo">Ativo</option>
              <option value="Inadimplente">Inadimplente</option>
              <option value="Quitado">Quitado</option>
            </select>
            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, flexShrink: 0 }}>{contracts?.length ?? 0} contratos</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <TableGroupBadges
              allColumns={PAYMENTS_COLUMNS}
              groupOrder={PAYMENTS_GROUP_ORDER}
              groupMeta={PAYMENTS_GROUP_META}
              visibleIds={visibleIds}
              setColumnsVisible={setColumnsVisible}
            />
            <TableColumnPicker
              allColumns={PAYMENTS_COLUMNS}
              groupOrder={PAYMENTS_GROUP_ORDER}
              groupMeta={PAYMENTS_GROUP_META}
              visibleIds={visibleIds}
              toggleColumn={toggleColumn}
              setColumnsVisible={setColumnsVisible}
              resetDefaults={resetDefaults}
            />
          </div>
        </div>

        <div style={{
          flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
          border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden", background: "white",
        }}>
          <div style={{ flex: 1, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 11 }}>
              <colgroup>
                <col style={{ width: CHEVRON_WIDTH }} />
                {visibleOrdered.map(col => <col key={col.id} style={{ width: col.width }} />)}
              </colgroup>

              <thead>
                <tr>
                  {(() => {
                    const firstGroup = visibleGroupRuns[0]?.group;
                    const firstMeta = firstGroup ? PAYMENTS_GROUP_META[firstGroup] : null;
                    return (
                      <th
                        aria-hidden="true"
                        style={{
                          background: firstMeta?.bg ?? "#1f2937",
                          padding: "4px 8px",
                          fontSize: 9,
                          lineHeight: 1.2,
                        }}
                      />
                    );
                  })()}
                  {visibleGroupRuns.map((run, i) => {
                    const meta = PAYMENTS_GROUP_META[run.group];
                    return (
                      <th
                        key={`${run.group}-${i}`}
                        colSpan={run.count}
                        style={{
                          background: meta.bg, color: meta.color,
                          textAlign: "center", padding: "4px 8px",
                          fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          lineHeight: 1.2,
                        }}
                      >
                        {meta.label}
                      </th>
                    );
                  })}
                </tr>
                <tr>
                  <th style={{ ...headerCellStyle, position: "sticky", left: 0, zIndex: 3, width: CHEVRON_WIDTH }} />
                  {visibleOrdered.map(col => {
                    const stickyStyle: React.CSSProperties = col.sticky
                      ? { position: "sticky", left: stickyOffsets.get(col.id), zIndex: 2, background: "#f1f5f9" }
                      : {};
                    return (
                      <th key={col.id} style={{ ...headerCellStyle, textAlign: col.align, ...stickyStyle }}>
                        {col.label.toUpperCase()}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {!contracts || contracts.length === 0 ? (
                  <tr>
                    <td colSpan={visibleOrdered.length + 1} style={{ textAlign: "center", padding: 30, color: "#9ca3af", fontSize: 12 }}>
                      Nenhum contrato ativo localizado.
                    </td>
                  </tr>
                ) : (
                  paginated.map((row: any, rowIdx: number) => {
                    const isExpanded = expandedId === row.contract.id;
                    const rowBg = rowIdx % 2 === 1 ? "#fafafa" : "white";

                    return (
                      <Fragment key={`pay-${row.contract.id}`}>
                        <tr
                          style={{ background: rowBg, cursor: "pointer" }}
                          onClick={() => setExpandedId(isExpanded ? null : row.contract.id)}
                          onMouseOver={e => (e.currentTarget.style.background = "#eff6ff")}
                          onMouseOut={e => (e.currentTarget.style.background = rowBg)}
                        >
                          <td style={{ ...tdCenter, position: "sticky", left: 0, zIndex: 1, background: "inherit" }}>
                            {isExpanded
                              ? <ChevronDown size={12} style={{ color: "#2563eb" }} />
                              : <ChevronRight size={12} style={{ color: "#9ca3af" }} />}
                          </td>
                          {visibleOrdered.map(col => {
                            const stickyStyle: React.CSSProperties = col.sticky
                              ? { position: "sticky", left: stickyOffsets.get(col.id), zIndex: 1, background: "inherit" }
                              : {};
                            const base = col.align === "right" ? tdNum : col.align === "center" ? tdCenter : tdBase;
                            return (
                              <td key={col.id} style={{ ...base, ...stickyStyle }}>
                                {renderCellContent(col, row)}
                              </td>
                            );
                          })}
                        </tr>

                        {isExpanded && (
                          <tr key={`exp-${row.contract.id}`}>
                            <td colSpan={visibleOrdered.length + 1} style={{ padding: 0, borderBottom: "2px solid #1a2035" }}>
                              <ExpandedContractDetail
                                contract={row.contract}
                                schedule={schedule}
                                schedTotals={schedTotals}
                                schedLoading={schedLoading}
                                openPayment={openPayment}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

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
              Mostrando {Math.min((page - 1) * pageSize + 1, totalRows)}–{Math.min(page * pageSize, totalRows)} de {totalRows}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: "3px 10px", border: "1px solid #d1d5db", borderRadius: 4, background: "white", fontSize: 11, cursor: page === 1 ? "not-allowed" : "pointer", color: page === 1 ? "#9ca3af" : "#374151" }}>
                ← Anterior
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const n = page <= 3 ? i + 1 : page - 2 + i;
                if (n < 1 || n > totalPages) return null;
                return (
                  <button type="button" key={n} onClick={() => setPage(n)}
                    style={{
                      width: 28, height: 26, borderRadius: 4, border: "1px solid",
                      fontSize: 11, background: n === page ? "#1a2035" : "white",
                      color: n === page ? "white" : "#374151",
                      borderColor: n === page ? "#1a2035" : "#d1d5db",
                      fontWeight: n === page ? 700 : 400, cursor: "pointer"
                    }}>
                    {n}
                  </button>
                );
              })}
              <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                style={{ padding: "3px 10px", border: "1px solid #d1d5db", borderRadius: 4, background: "white", fontSize: 11, cursor: page >= totalPages ? "not-allowed" : "pointer", color: page >= totalPages ? "#9ca3af" : "#374151" }}>
                Próxima →
              </button>
            </div>
          </div>
        </div>

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
                      {["PIX", "TED", "Boleto", "Cheque", "Dinheiro", "Cartão"].map(m => <option key={m} value={m}>{m}</option>)}
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

interface ExpandedDetailProps {
  contract: any;
  schedule: any;
  schedTotals: any;
  schedLoading: boolean;
  openPayment: (id: number, amount: number) => void;
}

function ExpandedContractDetail({ contract, schedule, schedTotals, schedLoading, openPayment }: ExpandedDetailProps) {
  return (
    <div style={{ background: "#f8f9fa", padding: "4px 0" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ padding: 12, borderRight: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "white", background: "#1a2035", padding: "4px 8px", marginBottom: 6, borderRadius: 3 }}>
            PARÂMETROS DO CONTRATO
          </div>
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

        <div style={{ padding: 12, borderRight: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "white", background: "#1e3a5f", padding: "4px 8px", marginBottom: 6, borderRadius: 3 }}>
            PAINEL DO CONTRATO
          </div>
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

        <div style={{ padding: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "white", background: "#ea580c", padding: "4px 8px", marginBottom: 6, borderRadius: 3 }}>
            REGRA DE VENCIMENTO ANTECIPADO
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5, background: "#fff", padding: 8, borderRadius: 4, border: "1px solid #e5e7eb", marginBottom: 12 }}>
            {contract.accelerationRule || "Qualquer atraso gera vencimento antecipado da dívida, conforme cláusula 4.1; encargos da cláusula 2.2."}
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "white", background: "#7c3aed", padding: "4px 8px", marginBottom: 6, borderRadius: 3 }}>
            GARANTIAS / FIADORES
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5, background: "#fff", padding: 8, borderRadius: 4, border: "1px solid #e5e7eb" }}>
            {(() => {
              // Após a refatoração da pivot contract_guarantor, contract.guarantors
              // chega como array de fiadores. Mantemos compatibilidade com o texto
              // legado (string) caso o backend ainda devolva no formato antigo.
              if (Array.isArray(contract.guarantors) && contract.guarantors.length > 0) {
                return contract.guarantors.map((g: any) => g.name).join(", ");
              }
              if (typeof contract.guarantors === "string" && contract.guarantors.trim() !== "") {
                return contract.guarantors;
              }
              return contract.guarantees || "Fiadores solidários identificados no instrumento regulamentar da dívida.";
            })()}
          </div>
        </div>
      </div>

      {schedLoading ? (
        <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "#6b7280" }}>
          Calculando indexadores e juros diários do banco...
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 11 }}>
            <thead>
              <tr style={{ background: "#2d3748", color: "white" }}>
                {["PARCELA", "VENCIMENTO", "VALOR PARCELA", "STATUS ORIGEM", "DATA PAGAMENTO", "TOTAL PAGO", "PAGO?", "ABERTA?", "DIAS ATRASO", "FATOR IPCA", "CORREÇÃO IPCA", "JUROS MORA", "MULTA", "TOTAL ATUALIZADO", "VINCENDO ACELERADO?", "VALOR VINCENDO ACELERADO", "AÇÕES"].map((h, i) => (
                  <th key={`th-inst-${i}`} style={{
                    background: i === 0 ? "#1a2035" : i < 6 ? "#1e3a5f" : i < 9 ? "#5f2d11" : i < 13 ? "#2a1a5f" : "#1a3a2a",
                    color: "white", padding: "5px 8px", fontSize: 8, fontWeight: 700, textTransform: "uppercase",
                    textAlign: ["VALOR PARCELA", "TOTAL PAGO", "FATOR IPCA", "CORREÇÃO IPCA", "JUROS MORA", "MULTA", "TOTAL ATUALIZADO", "VALOR VINCENDO ACELERADO"].includes(h) ? "right" : "center",
                    whiteSpace: "nowrap", borderRight: "1px solid rgba(255,255,255,0.1)",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedule?.schedule?.map((inst: any) => {
                const isPago = inst.status === "Pago";
                const isVencido = inst.status === "Vencido" || inst.status === "Vencida" || inst.status === "Atrasado";
                const rBg = isPago ? "#f0fdf4" : isVencido ? "#fff5f5" : "white";
                const cleanRowDays = Math.floor(Number(inst.daysOverdue ?? 0));
                return (
                  <tr key={`inst-row-${inst.installmentId}`} style={{ background: rBg }} onMouseOver={e => (e.currentTarget.style.background = "#eff6ff")} onMouseOut={e => (e.currentTarget.style.background = rBg)}>
                    <td style={{ textAlign: "center", padding: "5px 8px", fontFamily: "monospace", fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>{inst.installmentNumber}</td>
                    <td style={{ textAlign: "center", padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>{fmtDate(inst.dueDate)}</td>
                    <td style={{ textAlign: "right", padding: "5px 8px", fontFamily: "monospace", borderBottom: "1px solid #e5e7eb" }}>{fmt(inst.originalAmount)}</td>
                    <td style={{ textAlign: "center", padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: isPago ? "#059669" : "#dc2626" }}>{isPago ? "Pago" : "vencido"}</span>
                    </td>
                    <td style={{ textAlign: "center", padding: "5px 8px", color: "#059669", borderBottom: "1px solid #e5e7eb" }}>{inst.payments?.[0] ? fmtDate(inst.payments[0].paidAt) : "—"}</td>
                    <td style={{ textAlign: "right", padding: "5px 8px", fontFamily: "monospace", color: "#059669", fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>{inst.paidAmount > 0 ? fmt(inst.paidAmount) : "—"}</td>
                    <td style={{ textAlign: "center", padding: "5px 8px", color: isPago ? "#059669" : "#6b7280", borderBottom: "1px solid #e5e7eb", fontWeight: 700 }}>{isPago ? "Sim" : "Não"}</td>
                    <td style={{ textAlign: "center", padding: "5px 8px", color: isVencido ? "#dc2626" : "#6b7280", borderBottom: "1px solid #e5e7eb", fontWeight: 700 }}>{isVencido ? "Sim" : "Não"}</td>
                    <td style={{ textAlign: "center", padding: "5px 8px", fontFamily: "monospace", color: cleanRowDays > 0 ? "#dc2626" : "#6b7280", fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>
                      {cleanRowDays > 0 ? cleanRowDays : "—"}
                    </td>
                    <td style={{ textAlign: "right", padding: "5px 8px", fontFamily: "monospace", color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>{inst.ipcaCorrection > 0 ? fmtN(1 + inst.ipcaCorrection / inst.originalAmount, 4) : "1,00"}</td>
                    <td style={{ textAlign: "right", padding: "5px 8px", fontFamily: "monospace", color: "#7c3aed", borderBottom: "1px solid #e5e7eb" }}>{inst.ipcaCorrection > 0 ? fmt(inst.ipcaCorrection) : "—"}</td>
                    <td style={{ textAlign: "right", padding: "5px 8px", fontFamily: "monospace", color: "#ea580c", borderBottom: "1px solid #e5e7eb" }}>{inst.moraAmount > 0 ? fmt(inst.moraAmount) : "—"}</td>
                    <td style={{ textAlign: "right", padding: "5px 8px", fontFamily: "monospace", color: "#dc2626", borderBottom: "1px solid #e5e7eb" }}>{inst.penaltyAmount > 0 ? fmt(inst.penaltyAmount) : "—"}</td>
                    <td style={{ textAlign: "right", padding: "5px 8px", fontFamily: "monospace", fontWeight: 700, color: isVencido ? "#dc2626" : "#111827", borderBottom: "1px solid #e5e7eb" }}>{fmt(isPago ? inst.paidAmount : inst.updatedAmount)}</td>
                    <td style={{ textAlign: "center", padding: "5px 8px", borderBottom: "1px solid #e5e7eb" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: inst.isAccelerated ? "#dc2626" : "#6b7280" }}>{inst.isAccelerated ? "Sim" : "Não"}</span>
                    </td>
                    <td style={{ textAlign: "right", padding: "5px 8px", fontFamily: "monospace", color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>{inst.isAccelerated ? fmt(inst.updatedAmount) : "—"}</td>
                    <td style={{ padding: "5px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>
                      {!isPago && (
                        <button className="btn-primary" style={{ fontSize: 9, padding: "2px 8px", height: 20 }} onClick={e => { e.stopPropagation(); openPayment(inst.installmentId, inst.openBalance); }}>
                          Pagar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {schedTotals && (
              <tfoot>
                <tr style={{ background: "#1e2139", color: "white", fontWeight: 700 }}>
                  <td colSpan={2} style={{ padding: "6px 8px", fontSize: 10, textTransform: "uppercase" }}>TOTAL</td>
                  <td style={{ textAlign: "right", padding: "6px 8px", fontFamily: "monospace" }}>{fmt(schedTotals.totalOriginal)}</td>
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
  );
}