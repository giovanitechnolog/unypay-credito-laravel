import React, { useMemo, useState } from "react";
import { Head, router, usePage, Link } from "@inertiajs/react";
import { History, FileText, Trash2, ArrowRight, X, Calculator } from "lucide-react";
import UnyPayLayout from "../Components/UnyPayLayout";
import TableGroupBadges from "../Components/TableGroupBadges";
import TableColumnPicker from "../Components/TableColumnPicker";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import {
  SIM_HISTORY_COLUMNS,
  SIM_HISTORY_GROUP_META,
  SIM_HISTORY_GROUP_ORDER,
  type SimHistoryColumnDef,
  type SimHistoryColumnId,
} from "../lib/simulationHistoryColumns";

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

// largura da coluna especial de ações
const ACTIONS_WIDTH = 120;

const PAGE_SIZES = [20, 50, 100];

// estilos compactos
const headerCellStyle: React.CSSProperties = {
  background: "#f1f5f9", color: "#334155",
  padding: "5px 7px", fontSize: 9, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.04em",
  whiteSpace: "nowrap", borderBottom: "2px solid #cbd5e1",
};
const tdBase: React.CSSProperties = { padding: "3px 7px", borderBottom: "1px solid #f1f5f9", fontSize: 11, verticalAlign: "middle" };
const tdNum: React.CSSProperties = { ...tdBase, fontFamily: "'IBM Plex Mono', monospace", textAlign: "right" };
const tdCenter: React.CSSProperties = { ...tdBase, textAlign: "center" };

export default function SimulationHistory() {
  const { simulations, clients, flash }: any = usePage().props;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [convertOpen, setConvertOpen] = useState(false);
  const [selectedSim, setSelectedSim] = useState<any>(null);
  const [convertForm, setConvertForm] = useState({
    code: "",
    contractName: "",
    creditor: "UnyPay® S.A.",
    contractDate: new Date().toISOString().slice(0, 10),
    clientId: "",
  });

  // ── Visibilidade de colunas ────────────────────────────────────────────
  const { visibleIds, toggleColumn, setColumnsVisible, resetDefaults } =
    useColumnVisibility<SimHistoryColumnId>(
      "unypay.simHistory.columns.v1",
      SIM_HISTORY_COLUMNS,
    );

  const visibleOrdered: SimHistoryColumnDef[] = useMemo(
    () => SIM_HISTORY_COLUMNS.filter((c) => visibleIds.has(c.id)),
    [visibleIds],
  );

  const stickyOffsets = useMemo(() => {
    const offsets = new Map<SimHistoryColumnId, number>();
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
    const runs: { group: typeof SIM_HISTORY_GROUP_ORDER[number]; count: number }[] = [];
    for (const col of visibleOrdered) {
      const last = runs[runs.length - 1];
      if (last && last.group === col.group) last.count += 1;
      else runs.push({ group: col.group, count: 1 });
    }
    return runs;
  }, [visibleOrdered]);

  const handleDelete = (id: number) => {
    if (!confirm("Tem certeza que deseja excluir esta simulação do histórico?")) return;
    router.delete(`/api/simulator/${id}`);
  };

  const handleOpenConvert = (sim: any) => {
    setSelectedSim(sim);
    // 🛠️ Recupera o nome correto respeitando o mapeamento snake_case do banco de dados
    const currentClientName = sim.client_name ?? sim.clientName ?? "";

    setConvertForm({
      code: `SIM-${sim.id}-${new Date().getFullYear()}`,
      // 🛠️ Corrigido o uso de template literals de aspas simples para crases (``)
      contractName: currentClientName ? `Financiamento - ${currentClientName}` : `Empréstimo de ${fmt(sim.principal)}`,
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

  // ── Paginação (client-side) ────────────────────────────────────────────
  const totalRows = simulations?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const paginated = useMemo(
    () => (simulations ?? []).slice((page - 1) * pageSize, page * pageSize),
    [simulations, page, pageSize],
  );

  // ── células ────────────────────────────────────────────────────────────
  const renderCellContent = (col: SimHistoryColumnDef, sim: any): React.ReactNode => {
    const cMode = sim.calcMode ?? sim.calc_mode ?? "price";
    const principalVal = sim.principal ?? 0;
    const finTotal = sim.financedTotal ?? sim.financed_total ?? principalVal;
    const pmt = sim.installmentAmount ?? sim.installment_amount ?? 0;
    const totalInt = sim.totalInterest ?? sim.total_interest ?? 0;
    const cetM = sim.cetMonthly ?? sim.cet_monthly ?? 0;
    const instCount = sim.installmentCount ?? sim.installment_count ?? 0;
    const created = sim.createdAt ?? sim.created_at;

    switch (col.id) {
      case "date":
        return <span style={{ color: "#6b7280", whiteSpace: "nowrap" }}>{fmtDate(created)}</span>;
      case "client": {
        const clientName = sim.client_name ?? sim.clientName;
        const clientDocument = sim.client_document ?? sim.clientDocument;
        return clientName ? (
          <div style={{ maxWidth: col.width - 14, overflow: "hidden" }}>
            <div style={{ fontWeight: 600, fontSize: 11, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clientName}</div>
            {clientDocument && (
              <div style={{ fontSize: 9, color: "#6b7280", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clientDocument}</div>
            )}
          </div>
        ) : (
          <span style={{ color: "#9ca3af" }}>—</span>
        );
      }
      case "mode":
        return (
          <span style={{ padding: "2px 6px", borderRadius: 4, background: "#dbeafe", color: "#1e40af", fontWeight: 600, fontSize: 9 }}>
            {MODE_LABELS[cMode] || cMode}
          </span>
        );
      case "savedBy":
        return <span style={{ color: "#6b7280" }}>{sim.savedBy ?? "Sistema"}</span>;
      case "principal":
        return <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{fmt(principalVal)}</span>;
      case "financed":
        return <span style={{ fontFamily: "monospace", color: "#4b5563" }}>{fmt(finTotal)}</span>;
      case "installments":
        return <span style={{ color: "#4b5563" }}>{instCount}×</span>;
      case "installmentAmt":
        return <span style={{ fontFamily: "monospace", color: "#1e40af", fontWeight: 600 }}>{fmt(pmt)}</span>;
      case "totalInterest":
        return <span style={{ fontFamily: "monospace", color: "#dc2626", fontWeight: 600 }}>{fmt(totalInt)}</span>;
      case "cetMonthly":
        return <span style={{ fontFamily: "monospace", color: "#ea580c", fontWeight: 600 }}>{cetM ? `${(Number(cetM) * 100).toFixed(2)}%` : "—"}</span>;
      default:
        return null;
    }
  };

  return (
    <UnyPayLayout>
      <Head title="Histórico de Simulações" />

      <div style={{ padding: "12px 20px 16px 20px", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", gap: 12 }}>

        {/* Cabeçalho */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #7c3aed, #5b21b6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <History size={16} color="white" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>Histórico de Simulações</h2>
              <p style={{ margin: 0, fontSize: 10, color: "#6b7280" }}>
                Simulações salvas — clique em "Converter" para criar um contrato a partir de uma simulação
              </p>
            </div>
          </div>
          <Link href="/simulador" className="btn-primary" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 5, textDecoration: "none", padding: "6px 12px" }}>
            <Calculator size={12} /> Nova Simulação
          </Link>
        </div>

        {/* Alertas */}
        {flash?.success && (
          <div style={{ padding: "8px 14px", background: "#dcfce7", color: "#15803d", borderRadius: 6, fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
            ✓ {flash.success}
          </div>
        )}

        {/* Barra de filtros (badges + picker) */}
        <div style={{
          background: "white", border: "1px solid #e5e7eb", borderRadius: 6,
          padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 auto", minWidth: 0 }}>
            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, flexShrink: 0 }}>
              {simulations?.length ?? 0} simulações
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <TableGroupBadges
              allColumns={SIM_HISTORY_COLUMNS}
              groupOrder={SIM_HISTORY_GROUP_ORDER}
              groupMeta={SIM_HISTORY_GROUP_META}
              visibleIds={visibleIds}
              setColumnsVisible={setColumnsVisible}
            />
            <TableColumnPicker
              allColumns={SIM_HISTORY_COLUMNS}
              groupOrder={SIM_HISTORY_GROUP_ORDER}
              groupMeta={SIM_HISTORY_GROUP_META}
              visibleIds={visibleIds}
              toggleColumn={toggleColumn}
              setColumnsVisible={setColumnsVisible}
              resetDefaults={resetDefaults}
            />
          </div>
        </div>

        {/* Container unificado da tabela */}
        <div style={{
          flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
          border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden", background: "white",
        }}>
          <div style={{ flex: 1, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 11 }}>
              <colgroup>
                {visibleOrdered.map(col => <col key={col.id} style={{ width: col.width }} />)}
                <col style={{ width: ACTIONS_WIDTH }} />
              </colgroup>

              <thead>
                <tr>
                  {visibleGroupRuns.map((run, i) => {
                    const meta = SIM_HISTORY_GROUP_META[run.group];
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
                  <th style={{ background: "#1e2139", color: "white", textAlign: "center", padding: "4px 8px", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Ações
                  </th>
                </tr>
                <tr>
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
                  <th style={{ ...headerCellStyle, textAlign: "center" }}>AÇÕES</th>
                </tr>
              </thead>

              <tbody>
                {!simulations || simulations.length === 0 ? (
                  <tr>
                    <td colSpan={visibleOrdered.length + 1} style={{ textAlign: "center", padding: 48, color: "#6b7280" }}>
                      Nenhuma simulação registrada no histórico.
                    </td>
                  </tr>
                ) : (
                  paginated.map((sim: any, idx: number) => {
                    const rowBg = idx % 2 === 1 ? "#fafafa" : "white";
                    return (
                      <tr key={sim.id} style={{ background: rowBg }}
                        onMouseOver={e => (e.currentTarget.style.background = "#eff6ff")}
                        onMouseOut={e => (e.currentTarget.style.background = rowBg)}>
                        {visibleOrdered.map(col => {
                          const stickyStyle: React.CSSProperties = col.sticky
                            ? { position: "sticky", left: stickyOffsets.get(col.id), zIndex: 1, background: "inherit" }
                            : {};
                          const base =
                            col.align === "right" ? tdNum :
                              col.align === "center" ? tdCenter : tdBase;
                          return (
                            <td key={col.id} style={{ ...base, ...stickyStyle }}>
                              {renderCellContent(col, sim)}
                            </td>
                          );
                        })}
                        <td style={tdCenter}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            <button className="btn-primary" style={{ fontSize: 9, padding: "2px 8px", display: "flex", alignItems: "center", gap: 3 }} onClick={() => handleOpenConvert(sim)}>
                              <ArrowRight size={10} /> Converter
                            </button>
                            <button onClick={() => handleDelete(sim.id)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: 2 }} title="Excluir">
                              <Trash2 size={11} />
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

        {/* Modal de Conversão */}
        {convertOpen && selectedSim && (
          <div className="sigx-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setConvertOpen(false); }}>
            <div
              className="sigx-modal"
              style={{
                width: "min(520px, 96vw)",
                maxWidth: "96vw",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                boxShadow: "0 24px 60px rgba(15, 23, 42, 0.25)",
              }}
              onMouseDown={e => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 22px",
                  background: "linear-gradient(135deg, #1e2139 0%, #2d3154 100%)",
                  color: "white",
                  borderBottom: "1px solid #2d3154",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FileText size={16} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>Converter Simulação em Contrato</span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>Vincule a simulação a um cliente para gerar o contrato físico</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConvertOpen(false)}
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "none",
                    cursor: "pointer",
                    color: "white",
                    width: 30, height: 30,
                    borderRadius: 6,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleConvertSubmit}>
                <div className="sigx-modal-body" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12, background: "white" }}>

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
                <div className="sigx-modal-footer" style={{ padding: "12px 22px", borderTop: "1px solid #e5e7eb", background: "#f8fafc", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button type="button" className="btn-secondary" onClick={() => setConvertOpen(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary">Criar Contrato Físico</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </UnyPayLayout>
  );
}
