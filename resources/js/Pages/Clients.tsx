import React, { useMemo, useState } from "react";
import { Head, router } from "@inertiajs/react";
import {
  Plus, Search, Edit2, Trash2, Users, Building2,
  User, Shield, FileText, X, Eye, Upload, Loader2,
} from "lucide-react";
import UnyPayLayout from "../Components/UnyPayLayout";
import TableGroupBadges from "../Components/TableGroupBadges";
import TableColumnPicker from "../Components/TableColumnPicker";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import {
  CLIENTS_COLUMNS,
  CLIENTS_GROUP_META,
  CLIENTS_GROUP_ORDER,
  type ClientsColumnDef,
  type ClientsColumnId,
} from "../lib/clientsColumns";

const RISK_COLORS: Record<string, { bg: string; color: string }> = {
  A: { bg: "oklch(92% .08 145)", color: "oklch(35% .15 145)" },
  B: { bg: "oklch(92% .06 240)", color: "oklch(35% .15 240)" },
  C: { bg: "oklch(92% .08 75)",  color: "oklch(40% .15 75)" },
  D: { bg: "oklch(92% .08 50)",  color: "oklch(40% .15 50)" },
  E: { bg: "oklch(92% .08 27)",  color: "oklch(40% .2 27)" },
};

const LISTA_BANCOS = [
  { codigo: "001", nome: "001 - Banco do Brasil S.A." },
  { codigo: "033", nome: "033 - Banco Santander (Brasil) S.A." },
  { codigo: "104", nome: "104 - Caixa Econômica Federal" },
  { codigo: "237", nome: "237 - Banco Bradesco S.A." },
  { codigo: "260", nome: "260 - Nu Pagamentos S.A. (Nubank)" },
  { codigo: "341", nome: "341 - Itaú Unibanco S.A." },
  { codigo: "077", nome: "077 - Banco Inter S.A." },
  { codigo: "212", nome: "212 - Banco Original S.A." },
  { codigo: "422", nome: "422 - Banco Safra S.A." },
  { codigo: "748", nome: "748 - Banco Cooperativo Sicredi S.A." },
  { codigo: "756", nome: "756 - Banco Cooperativo do Brasil S.A. (Sicoob)" },
];

interface BankAccount { banco: string; agencia: string; conta: string; tipo: string; }

const emptyBankAccount = (): BankAccount => ({ banco: "", agencia: "", conta: "", tipo: "corrente" });

const emptyForm = {
  name: "", document: "", email: "", phone: "",
  address: "", city: "", state: "", zipCode: "",
  personType: "PF" as "PF" | "PJ",
  riskRating: "A" as "A" | "B" | "C" | "D" | "E",
  profissao: "", rendaMensal: "",
  bankAccounts: [emptyBankAccount()] as BankAccount[],
  pixKey: "",
  notes: "",
  fiador1Nome: "", fiador1Cpf: "", fiador1Cnpj: "", fiador1Telefone: "",
  fiador1Endereco: "", fiador1Cidade: "", fiador1Estado: "", fiador1Cep: "",
  fiador2Nome: "", fiador2Cpf: "", fiador2Cnpj: "", fiador2Telefone: "",
  fiador2Endereco: "", fiador2Cidade: "", fiador2Estado: "", fiador2Cep: "",
  observacoesJuridicas: "",
};

type FormType = typeof emptyForm;

function parseNotes(notes: string | null | undefined): Partial<FormType> {
  if (!notes) return {};
  try { const p = JSON.parse(notes); return typeof p === "object" ? p : {}; } catch { return {}; }
}

function buildNotes(form: FormType): string {
  const { name, document, email, phone, address, city, state, zipCode, personType, riskRating, ...extra } = form;
  return JSON.stringify(extra);
}

const maskCEP = (v: string) => v.replace(/\D/g, "").replace(/^(\d{5})(\d)/, "$1-$2").slice(0, 9);
const maskCPF = (v: string) => v.replace(/\D/g, "").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2").slice(0, 14);
const maskCNPJ = (v: string) => v.replace(/\D/g, "").replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2").slice(0, 18);
const maskPhone = (v: string) => v.replace(/\D/g, "").replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").slice(0, 15);

const TABS = [
  { key: "dados", label: "Dados Pessoais" },
  { key: "endereco", label: "Endereço" },
  { key: "financeiro", label: "Dados Financeiros" },
  { key: "fiadores", label: "Fiadores" },
  { key: "obs", label: "Obs. Jurídicas" },
];

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="sigx-label" style={{ marginBottom: 4, display: "block" }}>{children}</label>
);

// largura da coluna especial de ações
const ACTIONS_WIDTH = 130;

const PAGE_SIZES = [20, 50, 100];

// estilos compactos
const headerCellStyle: React.CSSProperties = {
  background: "#f1f5f9", color: "#334155",
  padding: "5px 7px", fontSize: 9, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.04em",
  whiteSpace: "nowrap", borderBottom: "2px solid #cbd5e1",
};
const tdBase: React.CSSProperties = { padding: "3px 7px", borderBottom: "1px solid #f1f5f9", fontSize: 11, verticalAlign: "middle" };
const tdCenter: React.CSSProperties = { ...tdBase, textAlign: "center" };

export default function Clients({ clients, filters }: any) {
  const [search, setSearch] = useState(filters?.search || "");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState("dados");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [focusedBankIdx, setFocusedBankIdx] = useState<number | null>(null);
  const [cepMeta, setCepMeta] = useState({ main: "", fiador1: "", fiador2: "" });

  // ── Visibilidade de colunas ────────────────────────────────────────────
  const { visibleIds, toggleColumn, setColumnsVisible, resetDefaults } =
    useColumnVisibility<ClientsColumnId>(
      "unypay.clients.columns.v1",
      CLIENTS_COLUMNS,
    );

  const visibleOrdered: ClientsColumnDef[] = useMemo(
    () => CLIENTS_COLUMNS.filter((c) => visibleIds.has(c.id)),
    [visibleIds],
  );

  const stickyOffsets = useMemo(() => {
    const offsets = new Map<ClientsColumnId, number>();
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
    const runs: { group: typeof CLIENTS_GROUP_ORDER[number]; count: number }[] = [];
    for (const col of visibleOrdered) {
      const last = runs[runs.length - 1];
      if (last && last.group === col.group) last.count += 1;
      else runs.push({ group: col.group, count: 1 });
    }
    return runs;
  }, [visibleOrdered]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    router.get("/clients", { search: value }, { preserveState: true, replace: true });
  };

  const handleOpen = (client?: any) => {
    if (client) {
      setEditing(client.id);
      const extra = parseNotes(client.notes);
      setForm({
        name: client.name ?? "", document: client.document ?? "",
        email: client.email ?? "", phone: client.phone ?? "",
        address: client.address ?? "", city: client.city ?? "",
        state: client.state ?? "", zipCode: client.zipCode ?? "",
        personType: client.personType ?? "PF", riskRating: client.riskRating ?? "A",
        profissao: extra.profissao ?? "", rendaMensal: extra.rendaMensal ?? "",
        bankAccounts: extra.bankAccounts ?? [emptyBankAccount()],
        pixKey: extra.pixKey ?? "", notes: extra.notes ?? "",
        fiador1Nome: extra.fiador1Nome ?? "", fiador1Cpf: extra.fiador1Cpf ?? "",
        fiador1Cnpj: extra.fiador1Cnpj ?? "", fiador1Telefone: extra.fiador1Telefone ?? "",
        fiador1Endereco: extra.fiador1Endereco ?? "", fiador1Cidade: extra.fiador1Cidade ?? "",
        fiador1Estado: extra.fiador1Estado ?? "", fiador1Cep: extra.fiador1Cep ?? "",
        fiador2Nome: extra.fiador2Nome ?? "", fiador2Cpf: extra.fiador2Cpf ?? "",
        fiador2Cnpj: extra.fiador2Cnpj ?? "", fiador2Telefone: extra.fiador2Telefone ?? "",
        fiador2Endereco: extra.fiador2Endereco ?? "", fiador2Cidade: extra.fiador2Cidade ?? "",
        fiador2Estado: extra.fiador2Estado ?? "", fiador2Cep: extra.fiador2Cep ?? "",
        observacoesJuridicas: extra.observacoesJuridicas ?? "",
      });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setActiveTab("dados");
    setOpen(true);
  };

  const handleFetchCep = async (cep: string, targetPrefix: "main" | "fiador1" | "fiador2") => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (data.erro) return;

      const summary = `${data.logradouro}, ${data.bairro} — ${data.localidade}/${data.uf}`;
      setCepMeta(prev => ({ ...prev, [targetPrefix]: summary }));

      setForm(prev => {
        if (targetPrefix === "main") return { ...prev, address: `${data.logradouro}, ${data.bairro}`, city: data.localidade, state: data.uf };
        if (targetPrefix === "fiador1") return { ...prev, fiador1Endereco: `${data.logradouro}, ${data.bairro}`, fiador1Cidade: data.localidade, fiador1Estado: data.uf };
        return { ...prev, fiador2Endereco: `${data.logradouro}, ${data.bairro}`, fiador2Cidade: data.localidade, fiador2Estado: data.uf };
      });
    } catch (err) { console.error(err); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: form.name, document: form.document || null,
      email: form.email || null, phone: form.phone || null,
      address: form.address || null, city: form.city || null,
      state: form.state || null, zipCode: form.zipCode || null,
      personType: form.personType, riskRating: form.riskRating,
      notes: buildNotes(form),
    };

    if (editing) {
      router.put(`/clients/${editing}`, data, { onSuccess: () => setOpen(false) });
    } else {
      router.post("/clients", data, { onSuccess: () => setOpen(false) });
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Excluir "${name}"?`)) {
      router.delete(`/clients/${id}`);
    }
  };

  const handleOcrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    router.post("/clients/ocr", formData, {
      onSuccess: (page: any) => {
        const data = page.props.flash?.ocrData;
        if (data) {
          setForm(prev => ({
            ...prev,
            name: data.debtorName || prev.name, document: data.debtorDocument || prev.document,
            address: data.debtorAddress || prev.address, city: data.city || prev.city, state: data.state || prev.state,
            pixKey: data.pixKey || prev.pixKey, fiador1Nome: data.guarantors || prev.fiador1Nome
          }));
          setActiveTab("dados");
        }
      },
      onFinish: () => setOcrLoading(false)
    });
  };

  const f = (k: keyof FormType) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  // ── Paginação (client-side sobre a lista vinda do servidor) ────────────
  const totalRows = clients?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const paginated = useMemo(
    () => (clients ?? []).slice((page - 1) * pageSize, page * pageSize),
    [clients, page, pageSize],
  );

  // ── células ────────────────────────────────────────────────────────────
  const renderCellContent = (col: ClientsColumnDef, client: any): React.ReactNode => {
    const extra = parseNotes(client.notes);
    const risk = RISK_COLORS[client.riskRating ?? "A"] ?? RISK_COLORS.A;
    switch (col.id) {
      case "name":
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 6, maxWidth: col.width - 14, overflow: "hidden" }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#1a2035", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
              {client.name.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontWeight: 600, fontSize: 11, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client.name}</span>
          </div>
        );
      case "document":
        return <span className="mono" style={{ fontSize: 10, color: "#6b7280" }}>{client.document || "—"}</span>;
      case "personType":
        return (
          <span className={`badge ${client.personType === "PJ" ? "badge-pj" : "badge-pf"}`} style={{ fontSize: 9 }}>
            {client.personType === "PJ" ? <Building2 size={9} /> : <User size={9} />}{client.personType}
          </span>
        );
      case "profession":
        return <span style={{ fontSize: 10, color: "#6b7280" }}>{extra.profissao || "—"}</span>;
      case "email":
        return <span style={{ fontSize: 10, color: "#6b7280" }}>{client.email || "—"}</span>;
      case "phone":
        return <span style={{ fontSize: 10, color: "#6b7280" }}>{client.phone || "—"}</span>;
      case "cityState":
        return <span style={{ fontSize: 10, color: "#6b7280" }}>{client.city ? `${client.city}${client.state ? `/${client.state}` : ""}` : "—"}</span>;
      case "rating":
        return (
          <span className="badge" style={{ background: risk.bg, color: risk.color, fontSize: 9 }}>
            <Shield size={9} /> {client.riskRating ?? "A"}
          </span>
        );
      case "pixKey":
        return <span style={{ fontSize: 10, color: "#6b7280", maxWidth: col.width - 14, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "middle" }}>{extra.pixKey || "—"}</span>;
      case "fiador1":
        return <span style={{ fontSize: 10, color: "#6b7280", maxWidth: col.width - 14, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "middle" }}>{extra.fiador1Nome || "—"}</span>;
      case "fiador2":
        return <span style={{ fontSize: 10, color: "#6b7280", maxWidth: col.width - 14, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "middle" }}>{extra.fiador2Nome || "—"}</span>;
      default:
        return null;
    }
  };

  return (
    <UnyPayLayout>
      <Head title="Gerenciamento de Clientes" />

      <div style={{ padding: "12px 20px 16px 20px", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", gap: 12 }}>

        {/* Cabeçalho */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>Gerenciamento de Clientes</h1>
          <button className="btn-primary" onClick={() => handleOpen()} style={{ padding: "6px 14px", fontSize: 11 }}>
            <Plus size={12} /> Novo Cliente
          </button>
        </div>

        {/* Barra de filtros */}
        <div style={{
          background: "white", border: "1px solid #e5e7eb", borderRadius: 6,
          padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input
                style={{ paddingLeft: 26, width: 280, fontSize: 11, height: 28, border: "1px solid #d1d5db", borderRadius: 6, outline: "none", color: "#374151" }}
                placeholder="Buscar clientes..." value={search} onChange={e => handleSearchChange(e.target.value)}
              />
            </div>
            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, flexShrink: 0 }}>{clients?.length ?? 0} clientes</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <TableGroupBadges
              allColumns={CLIENTS_COLUMNS}
              groupOrder={CLIENTS_GROUP_ORDER}
              groupMeta={CLIENTS_GROUP_META}
              visibleIds={visibleIds}
              setColumnsVisible={setColumnsVisible}
            />
            <TableColumnPicker
              allColumns={CLIENTS_COLUMNS}
              groupOrder={CLIENTS_GROUP_ORDER}
              groupMeta={CLIENTS_GROUP_META}
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
                    const meta = CLIENTS_GROUP_META[run.group];
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
                {!clients || clients.length === 0 ? (
                  <tr>
                    <td colSpan={visibleOrdered.length + 1} style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
                      <Users size={28} style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }} />
                      Nenhum cliente cadastrado
                    </td>
                  </tr>
                ) : (
                  paginated.map((client: any, rowIdx: number) => {
                    const rowBg = rowIdx % 2 === 1 ? "#fafafa" : "white";
                    return (
                      <tr key={client.id} style={{ background: rowBg }}
                        onMouseOver={e => (e.currentTarget.style.background = "#eff6ff")}
                        onMouseOut={e => (e.currentTarget.style.background = rowBg)}>
                        {visibleOrdered.map(col => {
                          const stickyStyle: React.CSSProperties = col.sticky
                            ? { position: "sticky", left: stickyOffsets.get(col.id), zIndex: 1, background: "inherit" }
                            : {};
                          const base =
                            col.align === "right" ? { ...tdBase, fontFamily: "'IBM Plex Mono', monospace", textAlign: "right" as const } :
                              col.align === "center" ? tdCenter : tdBase;
                          return (
                            <td key={col.id} style={{ ...base, ...stickyStyle }}>
                              {renderCellContent(col, client)}
                            </td>
                          );
                        })}
                        <td style={tdCenter}>
                          <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                            <button className="btn-icon" title="Ver detalhes" onClick={() => router.get(`/clients/${client.id}`)}><Eye size={11} /></button>
                            <button className="btn-icon" title="Ver contratos" onClick={() => router.get(`/contracts?clientId=${client.id}`)}><FileText size={11} /></button>
                            <button className="btn-icon" title="Editar" onClick={() => handleOpen(client)}><Edit2 size={11} /></button>
                            <button className="btn-icon" title="Excluir" style={{ color: "#dc2626" }} onClick={() => handleDelete(client.id, client.name)}><Trash2 size={11} /></button>
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

        {/* Modal de Formulário Completo */}
        {open && (
          <div className="sigx-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
            <div className="sigx-modal" style={{ maxWidth: 860 }} onMouseDown={e => e.stopPropagation()}>

              <div className="sigx-modal-header">
                <span className="sigx-modal-title">{editing ? "Editar Cliente" : "Novo Cliente"}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ cursor: "pointer" }}>
                    <button type="button" className="btn-secondary" style={{ fontSize: 11 }} onClick={() => document.getElementById("ocr-upload")?.click()} disabled={ocrLoading}>
                      {ocrLoading ? <><Loader2 size={11} className="animate-spin" /> Lendo PDF...</> : <><Upload size={11} /> Preencher via PDF (OCR)</>}
                    </button>
                    <input id="ocr-upload" type="file" style={{ display: "none" }} onChange={handleOcrUpload} accept=".pdf" />
                  </label>
                  <button type="button" onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", display: "flex" }}><X size={18} /></button>
                </div>
              </div>

              <div className="sigx-tabs">
                {TABS.map(tab => (
                  <div key={tab.key} className={`sigx-tab${activeTab === tab.key ? " active" : ""}`} onClick={() => setActiveTab(tab.key)}>{tab.label}</div>
                ))}
              </div>

              <form onSubmit={handleSubmit}>
                <div className="sigx-modal-body" style={{ maxHeight: "60vh", overflowY: "auto", padding: 20 }}>

                  {activeTab === "dados" && (
                    <div className="form-grid-3">
                      <div className="col-span-3">
                        <Label>NOME COMPLETO / RAZÃO SOCIAL *</Label>
                        <input className="sigx-input" value={form.name} onChange={f("name")} required placeholder="Nome completo ou razão social" />
                      </div>
                      <div>
                        <Label>TIPO DE PESSOA</Label>
                        <select className="sigx-input" value={form.personType} onChange={f("personType")}>
                          <option value="PF">Pessoa Física</option>
                          <option value="PJ">Pessoa Jurídica</option>
                        </select>
                      </div>
                      <div>
                        <Label>{form.personType === "PJ" ? "CNPJ" : "CPF"}</Label>
                        <input className="sigx-input" value={form.document}
                          onChange={(e) => setForm(p => ({ ...p, document: form.personType === "PJ" ? maskCNPJ(e.target.value) : maskCPF(e.target.value) }))}
                          placeholder="Apenas números" />
                      </div>
                      <div>
                        <Label>RATING DE RISCO</Label>
                        <select className="sigx-input" value={form.riskRating} onChange={f("riskRating")}>
                          <option value="A">Rating A (Excelente)</option>
                          <option value="B">Rating B (Bom)</option>
                          <option value="C">Rating C (Regular)</option>
                          <option value="D">Rating D (Ruim)</option>
                          <option value="E">Rating E (Péssimo)</option>
                        </select>
                      </div>
                      <div>
                        <Label>TELEFONE / WHATSAPP</Label>
                        <input className="sigx-input" value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" />
                      </div>
                      <div className="col-span-2">
                        <Label>E-MAIL</Label>
                        <input type="email" className="sigx-input" value={form.email} onChange={f("email")} placeholder="email@exemplo.com" />
                      </div>
                      <div>
                        <Label>PROFISSÃO / ATIVIDADE</Label>
                        <input className="sigx-input" value={form.profissao} onChange={f("profissao")} placeholder="Ex: Empresário, Transportador..." />
                      </div>
                      <div>
                        <Label>RENDA MENSAL (R$)</Label>
                        <input className="sigx-input mono" value={form.rendaMensal} onChange={f("rendaMensal")} placeholder="0,00" />
                      </div>
                    </div>
                  )}

                  {activeTab === "endereco" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <Label>CEP</Label>
                        <input className="sigx-input" style={{ width: "38%" }} value={form.zipCode}
                          onChange={(e) => {
                            const masked = maskCEP(e.target.value);
                            setForm(p => ({ ...p, zipCode: masked }));
                            if (masked.replace(/\D/g, "").length === 8) handleFetchCep(masked, "main");
                          }} placeholder="00000-000" />
                        {cepMeta.main && <div style={{ color: "var(--color-green)", fontSize: 11, fontWeight: 600, marginTop: 4 }}>{cepMeta.main}</div>}
                      </div>
                      <div>
                        <Label>ENDEREÇO COMPLETO</Label>
                        <input className="sigx-input" value={form.address} onChange={f("address")} />
                      </div>
                      <div className="form-grid-3">
                        <div className="col-span-2">
                          <Label>CIDADE</Label>
                          <input className="sigx-input" value={form.city} onChange={f("city")} />
                        </div>
                        <div>
                          <Label>ESTADO (UF)</Label>
                          <input className="sigx-input" value={form.state} onChange={f("state")} maxLength={2} />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "financeiro" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {form.bankAccounts.map((acc, idx) => (
                        <div key={idx} style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 6, background: "#fafafa" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700 }}>CONTA {idx + 1}</span>
                            {form.bankAccounts.length > 1 && <button type="button" style={{ background: "none", border: "none", color: "var(--color-red)", cursor: "pointer" }} onClick={() => setForm(p => ({ ...p, bankAccounts: p.bankAccounts.filter((_, i) => i !== idx) }))}><X size={14} /></button>}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 2fr 1.2fr", gap: 10 }}>
                            <div style={{ position: "relative" }}>
                              <input className="sigx-input" value={acc.banco} placeholder="Buscar banco..." onFocus={() => setFocusedBankIdx(idx)} onBlur={() => setTimeout(() => setFocusedBankIdx(null), 200)}
                                onChange={e => setForm(p => ({ ...p, bankAccounts: form.bankAccounts.map((a, i) => i === idx ? { ...a, banco: e.target.value } : a) }))} />
                              {focusedBankIdx === idx && (
                                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid var(--border)", borderRadius: 6, zIndex: 100, maxHeight: 140, overflowY: "auto" }}>
                                  {LISTA_BANCOS.filter(b => b.nome.toLowerCase().includes(acc.banco.toLowerCase())).map(b => (
                                    <div key={b.codigo} style={{ padding: "8px 12px", fontSize: 12, cursor: "pointer" }} onMouseDown={() => setForm(p => ({ ...p, bankAccounts: form.bankAccounts.map((a, i) => i === idx ? { ...a, banco: b.nome } : a) }))}>{b.nome}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <input className="sigx-input" value={acc.agencia} placeholder="Ag." onChange={e => setForm(p => ({ ...p, bankAccounts: form.bankAccounts.map((a, i) => i === idx ? { ...a, agencia: e.target.value } : a) }))} />
                            <input className="sigx-input" value={acc.conta} placeholder="Conta" onChange={e => setForm(p => ({ ...p, bankAccounts: form.bankAccounts.map((a, i) => i === idx ? { ...a, conta: e.target.value } : a) }))} />
                            <select className="sigx-input" value={acc.tipo} onChange={e => setForm(p => ({ ...p, bankAccounts: form.bankAccounts.map((a, i) => i === idx ? { ...a, tipo: e.target.value } : a) }))}>
                              <option value="corrente">C/C</option><option value="poupanca">C/P</option>
                            </select>
                          </div>
                        </div>
                      ))}
                      <button type="button" className="btn-secondary" style={{ fontSize: 11, width: "max-content" }} onClick={() => setForm(p => ({ ...p, bankAccounts: [...p.bankAccounts, emptyBankAccount()] }))}>+ Adicionar outra conta</button>
                      <div><Label>Chave PIX</Label><input className="sigx-input mono" value={form.pixKey} onChange={f("pixKey")} /></div>
                      <div><Label>Observações Financeiras</Label><textarea className="sigx-input" value={form.notes} onChange={f("notes")} rows={3} style={{ resize: "vertical" }} /></div>
                    </div>
                  )}

                  {activeTab === "fiadores" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      <div>
                        <div className="section-header" style={{ background: "#1a2035", color: "white", padding: "6px 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", borderRadius: 3, marginBottom: 12 }}>Fiador / Avalista 1</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div style={{ gridColumn: "span 2" }}>
                            <Label>NOME COMPLETO</Label>
                            <input className="sigx-input" value={form.fiador1Nome} onChange={f("fiador1Nome")} placeholder="Nome completo do fiador" />
                          </div>
                          <div>
                            <Label>CPF DO FIADOR</Label>
                            <input className="sigx-input" value={form.fiador1Cpf} onChange={(e) => setForm(p => ({ ...p, fiador1Cpf: maskCPF(e.target.value) }))} placeholder="000.000.000-00" />
                          </div>
                          <div>
                            <Label>TELEFONE DO FIADOR</Label>
                            <input className="sigx-input" value={form.fiador1Telefone} onChange={(e) => setForm(p => ({ ...p, fiador1Telefone: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" />
                          </div>
                          <div>
                            <Label>CEP DO FIADOR</Label>
                            <input className="sigx-input" value={form.fiador1Cep} onChange={(e) => { const masked = maskCEP(e.target.value); setForm(p => ({ ...p, fiador1Cep: masked })); if (masked.replace(/\D/g, "").length === 8) handleFetchCep(masked, "fiador1"); }} placeholder="00000-000" />
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 8 }}>
                            <div>
                              <Label>CIDADE / ESTADO</Label>
                              <input className="sigx-input" value={form.fiador1Cidade} onChange={f("fiador1Cidade")} placeholder="Cidade" />
                            </div>
                            <div>
                              <label className="sigx-label" style={{ marginBottom: 4, display: "block" }}>&nbsp;</label>
                              <input className="sigx-input" value={form.fiador1Estado} onChange={f("fiador1Estado")} placeholder="UF" maxLength={2} />
                            </div>
                          </div>
                          <div style={{ gridColumn: "span 2" }}>
                            <Label>ENDEREÇO DO FIADOR</Label>
                            <input className="sigx-input" value={form.fiador1Endereco} onChange={f("fiador1Endereco")} placeholder="Endereço completo" />
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="section-header" style={{ background: "#0f3a5f", color: "white", padding: "6px 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", borderRadius: 3, marginBottom: 12 }}>Fiador / Avalista 2 (Opcional)</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div style={{ gridColumn: "span 2" }}>
                            <Label>NOME COMPLETO</Label>
                            <input className="sigx-input" value={form.fiador2Nome} onChange={f("fiador2Nome")} placeholder="Nome completo do fiador" />
                          </div>
                          <div>
                            <Label>CPF DO FIADOR</Label>
                            <input className="sigx-input" value={form.fiador2Cpf} onChange={(e) => setForm(p => ({ ...p, fiador2Cpf: maskCPF(e.target.value) }))} placeholder="000.000.000-00" />
                          </div>
                          <div>
                            <Label>TELEFONE DO FIADOR</Label>
                            <input className="sigx-input" value={form.fiador2Telefone} onChange={(e) => setForm(p => ({ ...p, fiador2Telefone: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" />
                          </div>
                          <div>
                            <Label>CEP DO FIADOR</Label>
                            <input className="sigx-input" value={form.fiador2Cep} onChange={(e) => { const masked = maskCEP(e.target.value); setForm(p => ({ ...p, fiador2Cep: masked })); if (masked.replace(/\D/g, "").length === 8) handleFetchCep(masked, "fiador2"); }} placeholder="00000-000" />
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 8 }}>
                            <div>
                              <Label>CIDADE / ESTADO</Label>
                              <input className="sigx-input" value={form.fiador2Cidade} onChange={f("fiador2Cidade")} placeholder="Cidade" />
                            </div>
                            <div>
                              <label className="sigx-label" style={{ marginBottom: 4, display: "block" }}>&nbsp;</label>
                              <input className="sigx-input" value={form.fiador2Estado} onChange={f("fiador2Estado")} placeholder="UF" maxLength={2} />
                            </div>
                          </div>
                          <div style={{ gridColumn: "span 2" }}>
                            <Label>ENDEREÇO DO FIADOR</Label>
                            <input className="sigx-input" value={form.fiador2Endereco} onChange={f("fiador2Endereco")} placeholder="Endereço completo" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "obs" && (
                    <div><Label>Observações Jurídicas e Contratuais</Label><textarea className="sigx-input" value={form.observacoesJuridicas} onChange={f("observacoesJuridicas")} rows={8} style={{ resize: "vertical" }} /></div>
                  )}

                </div>

                <div className="sigx-modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary">{editing ? "Atualizar Cliente" : "Cadastrar Cliente"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </UnyPayLayout>
  );
}
