import { useCallback, useEffect, useMemo, useState } from "react";
import { Head } from "@inertiajs/react";
import {
  Plus, Search, Edit2, Trash2, Users, Building2, User,
  RefreshCw, Mail, Phone, Download, CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import UnyPayLayout from "../Components/UnyPayLayout";
import ConfirmDialog from "../Components/ConfirmDialog";
import ConsignorFormModal, { Consignor } from "../Components/ConsignorFormModal";
import { api, extractFirstError } from "../lib/api";
import { downloadExcelWithState } from "../lib/exportHelper";
import {
  onlyDigits,
  personTypeFromDocument,
} from "../lib/documentValidation";

export type { Consignor, ConsignorBankAccount } from "../Components/ConsignorFormModal";

const headerCellStyle: React.CSSProperties = {
  background: "#f1f5f9", color: "#334155",
  padding: "6px 8px", fontSize: 10, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.04em",
  whiteSpace: "nowrap", borderBottom: "2px solid #cbd5e1",
};
const tdBase: React.CSSProperties = { padding: "5px 8px", borderBottom: "1px solid #f1f5f9", fontSize: 11, verticalAlign: "middle" };
const tdCenter: React.CSSProperties = { ...tdBase, textAlign: "center" };

const PAGE_SIZES = [20, 50, 100];

const formatDocumentForGrid = (doc: string | null | undefined): string => {
  const d = onlyDigits(doc);
  if (!d) return "—";
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  return d;
};

export default function CredoresPage() {
  const [consignors, setConsignors] = useState<Consignor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Consignor | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Consignor | null>(null);

  /* ── Carregamento da listagem ─────────────────────────────────────── */
  const fetchConsignors = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/consignors", {
        params: { search: search.trim(), per_page: 200 },
      });
      // O endpoint retorna o paginator do Laravel — usamos só o array `data`.
      const rows: Consignor[] = data?.data ?? [];
      setConsignors(rows);
    } catch (err) {
      toast.error(extractFirstError(err, "Falha ao carregar credores."));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    // Debounce simples para a busca livre.
    const t = setTimeout(() => fetchConsignors(), 250);
    return () => clearTimeout(t);
  }, [fetchConsignors]);

  const handleExportExcel = useCallback(() => {
    downloadExcelWithState(
      "/credores/export",
      "credores.xlsx",
      setExporting,
      { params: { search: search.trim() || undefined } },
    );
  }, [search]);

  /* ── Abrir modal para criar / editar ──────────────────────────────── */
  const openCreateModal = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEditModal = async (consignor: Consignor) => {
    try {
      const { data } = await api.get(`/api/consignors/${consignor.id}`);
      const c: Consignor = data?.consignor ?? consignor;
      setEditing(c);
      setFormOpen(true);
    } catch (err) {
      toast.error(extractFirstError(err, "Falha ao carregar credor."));
    }
  };

  /* ── Delete ───────────────────────────────────────────────────────── */
  const executeDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/consignors/${deleteTarget.id}`);
      toast.success("Credor removido com sucesso.");
      setDeleteTarget(null);
      await fetchConsignors();
    } catch (err) {
      toast.error(extractFirstError(err, "Falha ao remover credor."));
    }
  };

  /* ── Paginação local ──────────────────────────────────────────────── */
  const totalRows = consignors.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const paginated = useMemo(
    () => consignors.slice((page - 1) * pageSize, page * pageSize),
    [consignors, page, pageSize],
  );

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <UnyPayLayout>
      <Head title="Gerenciamento de Credores" />

      <style>{`
        /* —— Caixa alta visual da tela inteira (incluindo modal) —— */
        .credores-page,
        .credores-page input,
        .credores-page select,
        .credores-page textarea,
        .credores-page button,
        .credores-page option,
        .credores-page label,
        .credores-page h1, .credores-page h2, .credores-page h3,
        .credores-page p, .credores-page span, .credores-page strong,
        .credores-page td, .credores-page th { text-transform: uppercase; }

        .credores-page input.mono,
        .credores-page input[type="email"],
        .credores-page input[type="password"],
        .credores-page input[type="date"],
        .credores-page input[type="number"] { text-transform: none; }
        .credores-page input::placeholder,
        .credores-page textarea::placeholder { text-transform: none; }
        .credores-page .keep-case,
        .credores-page .keep-case * { text-transform: none !important; }
      `}</style>

      <div className="credores-page" style={{ padding: "12px 20px 16px 20px", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", gap: 12 }}>
        {/* Topo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>Gerenciamento de Credores</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button className="btn-primary" onClick={openCreateModal} style={{ padding: "6px 14px", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={12} /> Novo Credor
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleExportExcel}
              disabled={exporting}
              style={{ padding: "6px 14px", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}
            >
              <Download size={12} /> {exporting ? "Exportando..." : "Exportar Excel"}
            </button>
          </div>
        </div>

        {/* Barra de busca */}
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input
                style={{ paddingLeft: 26, width: 300, fontSize: 11, height: 28, border: "1px solid #d1d5db", borderRadius: 6, outline: "none", color: "#374151" }}
                placeholder="Buscar por nome, documento, e-mail ou telefone..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, flexShrink: 0 }}>{totalRows} credor(es)</span>
          </div>
          <button
            type="button"
            onClick={() => fetchConsignors()}
            title="Atualizar"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", fontSize: 11, cursor: "pointer", color: "#374151" }}
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Atualizar
          </button>
        </div>

        {/* Grade */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden", background: "white" }}>
          <div style={{ flex: 1, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 11 }}>
              <colgroup>
                <col style={{ width: 60 }} />
                <col style={{ width: 280 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 180 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 130 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...headerCellStyle, textAlign: "center" }}>#</th>
                  <th style={{ ...headerCellStyle, textAlign: "left" }}>Nome / Razão Social</th>
                  <th style={{ ...headerCellStyle, textAlign: "center" }}>Tipo</th>
                  <th style={{ ...headerCellStyle, textAlign: "left" }}>Documento</th>
                  <th style={{ ...headerCellStyle, textAlign: "left" }}>E-mail</th>
                  <th style={{ ...headerCellStyle, textAlign: "left" }}>Telefone</th>
                  <th style={{ ...headerCellStyle, textAlign: "left" }}>Cidade / UF</th>
                  <th style={{ ...headerCellStyle, textAlign: "center" }}>Contas</th>
                  <th style={{ ...headerCellStyle, textAlign: "center" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
                    <RefreshCw size={22} className="animate-spin" style={{ margin: "0 auto 8px", display: "block", opacity: 0.6 }} />
                    Carregando credores...
                  </td></tr>
                ) : totalRows === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
                    <Users size={28} style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }} />
                    Nenhum credor cadastrado.
                  </td></tr>
                ) : (
                  paginated.map((c, idx) => {
                    const personType = personTypeFromDocument(c.document);
                    const isPJ = personType === "PJ";
                    const rowBg = idx % 2 === 1 ? "#fafafa" : "white";
                    return (
                      <tr key={c.id} style={{ background: rowBg }}
                        onMouseOver={(e) => (e.currentTarget.style.background = "#eff6ff")}
                        onMouseOut={(e) => (e.currentTarget.style.background = rowBg)}
                      >
                        <td style={tdCenter}>
                          <span className="mono" style={{ fontSize: 10, color: "#6b7280" }}>#{c.id}</span>
                        </td>
                        <td style={tdBase}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#1a2035", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600, color: "#111827" }}>{c.name}</span>
                          </div>
                        </td>
                        <td style={tdCenter}>
                          <span
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700,
                              background: isPJ ? "#eff6ff" : "#ecfdf5",
                              color:      isPJ ? "#1e40af" : "#065f46",
                            }}
                          >
                            {isPJ ? <Building2 size={10} /> : <User size={10} />} {personType}
                          </span>
                        </td>
                        <td style={{ ...tdBase, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: "#475569" }}>
                          {formatDocumentForGrid(c.document)}
                        </td>
                        <td style={{ ...tdBase, color: "#6b7280" }}>
                          {c.email ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Mail size={11} style={{ opacity: 0.6 }} /> {c.email}
                            </span>
                          ) : "—"}
                        </td>
                        <td style={{ ...tdBase, color: "#6b7280" }}>
                          {c.phone ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Phone size={11} style={{ opacity: 0.6 }} /> {c.phone}
                            </span>
                          ) : "—"}
                        </td>
                        <td style={{ ...tdBase, color: "#6b7280" }}>
                          {c.city ? `${c.city}${c.state ? `/${c.state}` : ""}` : "—"}
                        </td>
                        <td style={tdCenter}>
                          {(() => {
                            const count = c.bank_accounts_count ?? c.bankAccounts?.length ?? 0;
                            return (
                              <span
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700,
                                  background: count > 0 ? "#eff6ff" : "#f1f5f9",
                                  color:      count > 0 ? "#1d4ed8" : "#94a3b8",
                                  border:     count > 0 ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                                }}
                              >
                                <CreditCard size={11} /> {count}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={tdCenter}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            <button className="btn-icon" title="Editar" onClick={() => openEditModal(c)}>
                              <Edit2 size={11} />
                            </button>
                            <button className="btn-icon" title="Excluir" style={{ color: "#dc2626" }} onClick={() => setDeleteTarget(c)}>
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
          <div style={{ padding: "6px 12px", background: "#fafbfc", borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6b7280" }}>
              <span>Exibir</span>
              <select style={{ padding: "2px 6px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 11, background: "white" }} value={pageSize} onChange={(e) => { setPageSize(+e.target.value); setPage(1); }}>
                {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <span>por página</span>
            </div>
            <span style={{ fontSize: 11, color: "#6b7280" }}>
              Mostrando {Math.min((page - 1) * pageSize + 1, totalRows)}–{Math.min(page * pageSize, totalRows)} de {totalRows}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "3px 10px", border: "1px solid #d1d5db", borderRadius: 4, background: "white", fontSize: 11, cursor: page === 1 ? "not-allowed" : "pointer", color: page === 1 ? "#9ca3af" : "#374151" }}>← Anterior</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const n = page <= 3 ? i + 1 : page - 2 + i;
                if (n < 1 || n > totalPages) return null;
                return (
                  <button type="button" key={n} onClick={() => setPage(n)} style={{ width: 28, height: 26, borderRadius: 4, border: "1px solid", fontSize: 11, background: n === page ? "#1a2035" : "white", color: n === page ? "white" : "#374151", borderColor: n === page ? "#1a2035" : "#d1d5db", fontWeight: n === page ? 700 : 400, cursor: "pointer" }}>{n}</button>
                );
              })}
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ padding: "3px 10px", border: "1px solid #d1d5db", borderRadius: 4, background: "white", fontSize: 11, cursor: page >= totalPages ? "not-allowed" : "pointer", color: page >= totalPages ? "#9ca3af" : "#374151" }}>Próxima →</button>
            </div>
          </div>
        </div>


        <ConsignorFormModal
          open={formOpen}
          editing={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); void fetchConsignors(); }}
        />
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        tone="danger"
        title="Excluir Credor"
        description="Esta ação remove permanentemente o cadastro do credor e suas contas bancárias vinculadas."
        entityLabel={personTypeFromDocument(deleteTarget?.document) === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}
        entityName={deleteTarget?.name}
        entityDetail={formatDocumentForGrid(deleteTarget?.document) ?? undefined}
        consequences={[
          "Todas as contas bancárias vinculadas serão removidas em cascata.",
          "Contratos ou lançamentos que referenciem este credor podem ser afetados.",
        ]}
        confirmLabel="Excluir Credor"
        onConfirm={executeDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </UnyPayLayout>
  );
}
