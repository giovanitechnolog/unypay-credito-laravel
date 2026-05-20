import { useState } from "react";
import { Head, router } from "@inertiajs/react";
import { 
  Plus, Search, Edit2, Trash2, Users, Building2, 
  User, Shield, FileText, X, Eye, Upload, Loader2 
} from "lucide-react";
import UnyPayLayout from "../Components/UnyPayLayout";

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
  riskRating: "A" as "A"|"B"|"C"|"D"|"E",
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

export default function Clients({ clients, filters }: any) {
  const [search, setSearch] = useState(filters?.search || "");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState("dados");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [focusedBankIdx, setFocusedBankIdx] = useState<number | null>(null);
  const [cepMeta, setCepMeta] = useState({ main: "", fiador1: "", fiador2: "" });

  const handleSearchChange = (value: string) => {
    setSearch(value);
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
        observacoesJuridicas: extra.observacoesJuridicas ?? extra.observacoesJuridicas ?? "",
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

  return (
    <UnyPayLayout>
      <Head title="Gerenciamento de Clientes" />

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        
        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 320 }}>
            <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }} />
            <input className="sigx-input" style={{ paddingLeft: 30 }} placeholder="Buscar clientes..." value={search} onChange={e => handleSearchChange(e.target.value)} />
          </div>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{clients?.length ?? 0} clientes</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn-primary" onClick={() => handleOpen()}>
              <Plus size={13} /> Novo Cliente
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div className="sigx-card">
          <div className="sigx-table-wrapper">
            <table className="sigx-table">
              <thead>
                <tr>
                  <th colSpan={4} className="group-header group-id" style={{ textAlign: "center" }}>IDENTIFICAÇÃO</th>
                  <th colSpan={3} className="group-header group-fin" style={{ textAlign: "center" }}>CONTATO</th>
                  <th colSpan={2} className="group-header group-status" style={{ textAlign: "center" }}>CLASSIFICAÇÃO</th>
                  <th colSpan={2} className="group-header group-taxas" style={{ textAlign: "center" }}>FIADORES</th>
                  <th className="group-header group-acoes"></th>
                </tr>
                <tr>
                  <th>Nome</th><th>Documento</th><th>Tipo</th><th>Profissão</th>
                  <th>E-mail</th><th>Telefone</th><th>Cidade/UF</th>
                  <th style={{ textAlign: "center" }}>Rating</th><th>PIX</th>
                  <th>Fiador 1</th><th>Fiador 2</th>
                  <th style={{ textAlign: "center" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {!clients || clients.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: "center", padding: 40, color: "var(--muted-foreground)" }}>
                      <Users size={32} style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }} />
                      Nenhum cliente cadastrado
                    </td>
                  </tr>
                ) : (
                  clients.map((client: any) => {
                    const risk = RISK_COLORS[client.riskRating ?? "A"] ?? RISK_COLORS.A;
                    const extra = parseNotes(client.notes);
                    return (
                      <tr key={client.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--table-header-bg)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                              {client.name.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600, fontSize: 12 }}>{client.name}</span>
                          </div>
                        </td>
                        <td className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{client.document || "—"}</td>
                        <td>
                          <span className={`badge ${client.personType === "PJ" ? "badge-pj" : "badge-pf"}`}>
                            {client.personType === "PJ" ? <Building2 size={9} /> : <User size={9} />}{client.personType}
                          </span>
                        </td>
                        <td style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{extra.profissao || "—"}</td>
                        <td style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{client.email || "—"}</td>
                        <td style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{client.phone || "—"}</td>
                        <td style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{client.city ? `${client.city}${client.state ? `/${client.state}` : ""}` : "—"}</td>
                        <td style={{ textAlign: "center" }}>
                          <span className="badge" style={{ background: risk.bg, color: risk.color }}>
                            <Shield size={9} /> {client.riskRating ?? "A"}
                          </span>
                        </td>
                        <td style={{ fontSize: 11, color: "var(--muted-foreground)", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis" }}>{extra.pixKey || "—"}</td>
                        <td style={{ fontSize: 11, color: "var(--muted-foreground)", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis" }}>{extra.fiador1Nome || "—"}</td>
                        <td style={{ fontSize: 11, color: "var(--muted-foreground)", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis" }}>{extra.fiador2Nome || "—"}</td>
                        <td>
                          <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                            <button className="btn-icon" title="Ver detalhes" onClick={() => router.get(`/clients/${client.id}`)}><Eye size={11} /></button>
                            <button className="btn-icon" title="Ver contratos" onClick={() => router.get(`/contracts?clientId=${client.id}`)}><FileText size={11} /></button>
                            <button className="btn-icon" title="Editar" onClick={() => handleOpen(client)}><Edit2 size={11} /></button>
                            <button className="btn-icon" title="Excluir" style={{ color: "var(--color-red)" }} onClick={() => handleDelete(client.id, client.name)}><Trash2 size={11} /></button>
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

        {/* Modal de Formulário Completo */}
        {open && (
          <div className="sigx-modal-overlay" 
            onMouseDown={e => { 
              // Mudamos para onMouseDown para isolar cliques de arrasto de campos de texto
              if (e.target === e.currentTarget) setOpen(false); 
            }}
          >
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

                  {/* Tab 1: Dados Pessoais */}
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
                        <input 
                          className="sigx-input"
                          value={form.document} 
                          onChange={(e) => setForm(p => ({ ...p, document: form.personType === "PJ" ? maskCNPJ(e.target.value) : maskCPF(e.target.value) }))} 
                          placeholder="Apenas números" 
                        />
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

                  {/* Tab 2: Endereço */}
                  {activeTab === "endereco" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <Label>CEP</Label>
                        <input 
                          className="sigx-input" 
                          style={{ width: "38%" }}
                          value={form.zipCode} 
                          onChange={(e) => {
                            const masked = maskCEP(e.target.value);
                            setForm(p => ({ ...p, zipCode: masked }));
                            if (masked.replace(/\D/g, "").length === 8) handleFetchCep(masked, "main");
                          }}
                          placeholder="00000-000" 
                        />
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

                  {/* Tab 3: Dados Financeiros */}
                  {activeTab === "financeiro" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {form.bankAccounts.map((acc, idx) => (
                        <div key={idx} style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 6, background: "#fafafa" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 11, fontWeight: 700 }}>CONTA {idx + 1}</span>
                            {form.bankAccounts.length > 1 && <button type="button" style={{ background:"none", border:"none", color:"var(--color-red)", cursor:"pointer" }} onClick={() => setForm(p => ({ ...p, bankAccounts: p.bankAccounts.filter((_, i) => i !== idx) }))}><X size={14} /></button>}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 2fr 1.2fr", gap: 10 }}>
                            <div style={{ position: "relative" }}>
                              <input className="sigx-input" value={acc.banco} placeholder="Buscar banco..." onFocus={() => setFocusedBankIdx(idx)} onBlur={() => setTimeout(() => setFocusedBankIdx(null), 200)} onChange={e => setForm(p => ({ ...p, bankAccounts: form.bankAccounts.map((a, i) => i === idx ? { ...a, banco: e.target.value } : a) }))} />
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
                            <select className="sigx-input" value={acc.tipo} onChange={e => setForm(p => ({ ...p, bankAccounts: form.bankAccounts.map((a, i) => i === idx ? { ...a, tipo: e.target.value } : a) }))}><option value="corrente">C/C</option><option value="poupanca">C/P</option></select>
                          </div>
                        </div>
                      ))}
                      <button type="button" className="btn-secondary" style={{ fontSize: 11, width: "max-content" }} onClick={() => setForm(p => ({ ...p, bankAccounts: [...p.bankAccounts, emptyBankAccount()] }))}>+ Adicionar outra conta</button>
                      <div><Label>Chave PIX</Label><input className="sigx-input mono" value={form.pixKey} onChange={f("pixKey")} /></div>
                      <div><Label>Observações Financeiras</Label><textarea className="sigx-input" value={form.notes} onChange={f("notes")} rows={3} style={{ resize: "vertical" }} /></div>
                    </div>
                  )}

                  {/* Tab 4: Fiadores — AJUSTADO RIGOROSAMENTE IGUAL À IMAGEM COM OS DOIS FIADORES */}
                  {activeTab === "fiadores" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      
                      {/* Bloco Fiador 1 */}
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

                      {/* Bloco Fiador 2 — ADICIONADO CONFORME IMAGEM */}
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

                  {/* Tab 5: Obs Jurídicas */}
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