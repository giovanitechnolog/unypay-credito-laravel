import { useState, useMemo } from "react";
import { Plus, Search, Eye, Trash2, FileText, CheckCircle, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, Head, router } from "@inertiajs/react";
import { toast } from "sonner";
import UnyPayLayout from "../Components/UnyPayLayout";

const fmt = (v: number | string) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
const fmtDate = (d?: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
const fmtPct = (v: number | string) => `${(Number(v) * 100).toFixed(2)}%`;

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  "Ativo":        { bg: "#d1fae5", color: "#065f46" },
  "Inadimplente": { bg: "#fee2e2", color: "#991b1b" },
  "Quitado":      { bg: "#dbeafe", color: "#1e40af" },
  "Renegociado":  { bg: "#f3e8ff", color: "#6b21a8" },
};

const PAGE_SIZES = [20, 50, 100];

const emptyForm = {
  clientId: 0, code: "", contractName: "", creditor: "UnyPay® S.A.",
  contractType: "Mútuo/Confissão de dívida", contractDate: new Date().toISOString().slice(0, 10), status: "Ativo" as const,
  validated: false, principalAmount: 0, financedTotal: 0, tacAmount: 0, iofAmount: 0,
  installmentCount: 12, installmentAmount: 0, firstDueDate: "",
  monthlyInterestRate: 0, moraRateMonthly: 0.02, penaltyRate: 0.1,
  penaltyBaseType: "installment" as const, penaltyScope: "per_installment" as const,
  correctionIndex: "IPCA", honoraryRate: 0, accelerates: false,
  accelerationRule: "", accelerationConsecutiveThreshold: undefined as number | undefined,
  accelerationAlternateThreshold: undefined as number | undefined,
  guarantees: "", guarantors: "", validationUrl: "", sourcePdfName: "", observations: "",
};

const TABS = [
  { key: "basico", label: "Dados Básicos" },
  { key: "financeiro", label: "Valores Financeiros" },
  { key: "taxas", label: "Taxas e Encargos" },
  { key: "garantias", label: "Garantias e Fiadores" },
  { key: "regras", label: "Regras Contratuais" },
];

const TH: React.CSSProperties = {
  background: "#1a2035", color: "rgba(255,255,255,0.85)", padding: "7px 10px", fontSize: 11, fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap", borderRight: "1px solid rgba(255,255,255,0.07)",
  position: "sticky", top: 0, zIndex: 10,
};

const TD = (align: "left"|"right"|"center" = "left"): React.CSSProperties => ({
  padding: "8px 10px", borderBottom: "1px solid #e5e7eb", textAlign: align, verticalAlign: "middle", fontSize: 12,
});

export default function Contracts({ contracts, clients, filters }: any) {
  const [search, setSearch] = useState(filters?.search || "");
  const [statusFilter, setStatusFilter] = useState(filters?.statusFilter || "Todos");
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("basico");
  const [form, setForm] = useState(emptyForm);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortCol, setSortCol] = useState("code");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("asc");

  const handleFilterChange = (newSearch: string, newStatus: string) => {
    router.get("/contracts", { search: newSearch, statusFilter: newStatus }, { preserveState: true, replace: true });
  };

 const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId) { toast.error("Selecione o cliente vinculado."); return; }
    
    // Envia exatamente para o endpoint POST '/contracts' mapeado no seu web.php
    router.post("/contracts", form, {
      preserveState: false, // Força o Inertia a reidratar os estados com os dados novos do banco
      onSuccess: () => { 
        toast.success("Contrato gravado com sucesso!"); 
        setOpen(false); 
        setForm(emptyForm); 
      },
      onError: (err: any) => { 
        toast.error("Erro ao registrar: " + Object.values(err).join(", ")); 
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Deseja expurgar este contrato e seus lançamentos da auditoria?")) return;
    router.delete(`/api/contracts/destroy/${id}`, { onSuccess: () => toast.success("Contrato excluído!") });
  };

  const n = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm(p => ({ ...p, [k]: val }));
  };

  const num = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: parseFloat(e.target.value) || 0 }));
  const numI = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: parseInt(e.target.value) || 0 }));

  const filtered = useMemo(() => {
    const list = Array.isArray(contracts) ? contracts : (contracts?.data ?? []);
    return [...list]
      .filter((item: any) => {
        const q = search.toLowerCase();
        const contractObj = item.contract ?? item;
        const cName = item.clientName ?? item.client_name ?? "";
        return (
          (!search || contractObj.contractName.toLowerCase().includes(q) || contractObj.code.toLowerCase().includes(q) || cName.toLowerCase().includes(q)) &&
          (statusFilter === "Todos" || contractObj.status === statusFilter)
        );
      })
      .sort((a: any, b: any) => {
        let va: any, vb: any;
        const cA = a.contract ?? a; const cB = b.contract ?? b;
        if (sortCol === "code") { va = cA.code; vb = cB.code; }
        else if (sortCol === "client") { va = a.clientName ?? ""; vb = b.clientName ?? ""; }
        else if (sortCol === "principal") { va = +cA.principalAmount; vb = +cB.principalAmount; }
        else if (sortCol === "status") { va = cA.status; vb = cB.status; }
        else { va = cA.code; vb = cB.code; }
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [contracts, search, statusFilter, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const doSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };
  const SortIco = ({ col }: { col: string }) => (
    <span style={{ marginLeft: 2, opacity: sortCol === col ? 1 : 0.4, fontSize: 8 }}>
      {sortCol === col ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  return (
    <UnyPayLayout>
      <Head title="Carteira de Contratos" />
      <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden", background:"#f8f9fa" }}>
        <div style={{ padding: "0px 24px 24px 24px", display:"flex", flexDirection:"column", height:"100%" }}>
          
          {/* Header */}
          <div style={{ background:"white", borderBottom:"1px solid #e5e7eb", padding:"10px 0", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
            <h1 style={{ margin:0, fontSize:18, fontWeight:700, color:"#111827" }}>Contratos e Ativos</h1>
            <button onClick={() => { setForm(emptyForm); setActiveTab("basico"); setOpen(true); }}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 16px", borderRadius:6, border:"none", background:"#1a2035", color:"white", fontSize:12, fontWeight:600, cursor:"pointer" }}>
              <Plus size={13}/> Novo Contrato
            </button>
          </div>

          {/* Filtros */}
          <div style={{ background:"white", borderBottom:"1px solid #e5e7eb", padding:"8px 0", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", flexShrink:0 }}>
            <div style={{ position:"relative", flex:"1 1 200px", maxWidth:300 }}>
              <Search size={13} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#9ca3af" }} />
              <input style={{ width:"100%", padding:"6px 10px 6px 32px", border:"1px solid #d1d5db", borderRadius:6, fontSize:12, outline:"none", background:"white", color:"#374151" }}
                placeholder="Buscar contratos..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <select style={{ padding:"6px 10px", border:"1px solid #d1d5db", borderRadius:6, fontSize:12, background:"white", color:"#374151", cursor:"pointer" }}
              value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); handleFilterChange(search, e.target.value); }}>
              <option value="Todos">Todos os status</option>
              <option value="Ativo">Ativo</option><option value="Inadimplente">Inadimplente</option><option value="Quitado">Quitado</option><option value="Renegociado">Renegociado</option>
            </select>
            <span style={{ fontSize:12, color:"#6b7280", fontWeight:500 }}>{filtered.length} contratos</span>
          </div>

          {/* Tabela de Lançamentos */}
          <div style={{ flex:1, overflow:"auto", border:"1px solid #d1d5db", borderRadius:"8px 8px 0 0", background:"white", marginTop:12 }}>
            <table style={{ width:"100%", borderCollapse:"separate", borderSpacing:0, fontSize:12, minWidth:900 }}>
              <thead>
                <tr>
                  <th colSpan={4} style={{ ...TH, textAlign:"center", background:"#1e3a5f", fontSize:9, letterSpacing:"0.08em", borderRight:"2px solid rgba(255,255,255,0.2)" }}>IDENTIFICAÇÃO</th>
                  <th colSpan={4} style={{ ...TH, textAlign:"center", background:"#2d3a8c", fontSize:9, letterSpacing:"0.08em", borderRight:"2px solid rgba(255,255,255,0.2)" }}>FINANCEIRO</th>
                  <th colSpan={4} style={{ ...TH, textAlign:"center", background:"#1e2139", fontSize:9, letterSpacing:"0.08em" }}>SITUAÇÃO</th>
                </tr>
                <tr>
                  <th onClick={() => doSort("code")} style={{ ...TH, cursor:"pointer", textAlign:"left", width:90 }}>CÓD. <SortIco col="code"/></th>
                  <th onClick={() => doSort("client")} style={{ ...TH, cursor:"pointer", textAlign:"left", minWidth:160 }}>CLIENTE <SortIco col="client"/></th>
                  <th style={{ ...TH, textAlign:"left", minWidth:180 }}>NOME DO CONTRATO</th>
                  <th style={{ ...TH, textAlign:"left", minWidth:120, borderRight:"2px solid rgba(255,255,255,0.2)" }}>CREDOR</th>
                  <th onClick={() => doSort("principal")} style={{ ...TH, cursor:"pointer", textAlign:"right" }}>PRINCIPAL <SortIco col="principal"/></th>
                  <th style={{ ...TH, textAlign:"right" }}>FINANCIADO</th>
                  <th style={{ ...TH, textAlign:"center", width:55 }}>PARC.</th>
                  <th style={{ ...TH, textAlign:"right", borderRight:"2px solid rgba(255,255,255,0.2)" }}>VL. PARCELA</th>
                  <th onClick={() => doSort("status")} style={{ ...TH, cursor:"pointer", textAlign:"center", width:110 }}>STATUS <SortIco col="status"/></th>
                  <th style={{ ...TH, textAlign:"center", width:58 }}>VALID.</th>
                  <th style={{ ...TH, textAlign:"center", width:90 }}>1ª VENC.</th>
                  <th style={{ ...TH, textAlign:"center", width:70, borderRight:"none" }}>MORA</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign:"center", padding:48, color:"#9ca3af" }}>
                      <FileText size={32} style={{ margin:"0 auto 8px", display:"block", opacity:0.2 }}/> Nenhum contrato encontrado
                    </td>
                  </tr>
                ) : (
                  paginated.map((item: any, rowIdx: number) => {
                    const contract = item.contract ?? item;
                    const sc = STATUS_BADGE[contract.status] ?? STATUS_BADGE["Ativo"];
                    const rowBg = rowIdx % 2 === 1 ? "#f9fafb" : "white";
                    return (
                      <tr key={contract.id} style={{ background:rowBg }} onMouseOver={e => (e.currentTarget.style.background = "#eff6ff")} onMouseOut={e => (e.currentTarget.style.background = rowBg)}>
                        <td style={TD()}><span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#6b7280", fontWeight:500 }}>{contract.code}</span></td>
                        <td style={TD()}><div style={{ fontWeight:700, fontSize:13, color:"#111827" }}>{item.clientName ?? item.client_name ?? "—"}</div></td>
                        <td style={TD()}><span style={{ fontSize:12, color:"#374151" }}>{contract.contractName}</span></td>
                        <td style={{ ...TD(), borderRight:"2px solid #e5e7eb" }}><span style={{ fontSize:11, color:"#6b7280" }}>{contract.creditor}</span></td>
                        <td style={TD("right")}><span style={{ fontFamily:"'IBM Plex Mono',monospace", fontWeight:800, fontSize:13 }}>{fmt(contract.principalAmount)}</span></td>
                        <td style={TD("right")}><span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:"#6b7280" }}>{fmt(contract.financedTotal)}</span></td>
                        <td style={TD("center")}><span style={{ fontSize:12, color:"#6b7280" }}>{contract.installmentCount}×</span></td>
                        <td style={{ ...TD("right"), borderRight:"2px solid #e5e7eb" }}><span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:"#6b7280" }}>{fmt(contract.installmentAmount)}</span></td>
                        <td style={TD("center")}><span style={{ display:"inline-block", padding:"3px 10px", borderRadius:5, fontSize:11, fontWeight:600, background:sc.bg, color:sc.color }}>{contract.status}</span></td>
                        <td style={TD("center")}>{contract.validated ? <CheckCircle size={14} style={{ color:"#059669" }}/> : <span style={{ color:"#9ca3af" }}>—</span>}</td>
                        <td style={TD("center")}><span style={{ fontSize:11, whiteSpace:"nowrap" }}>{fmtDate(contract.firstDueDate)}</span></td>
                        <td style={{ ...TD("center"), borderRight:"none" }}><span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11 }}>{fmtPct(contract.moraRateMonthly)}</span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação do Sistema */}
          <div style={{ padding:"8px 0", background:"white", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8, flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#6b7280" }}>
              <span>Exibir</span>
              <select style={{ padding:"3px 6px", border:"1px solid #d1d5db", borderRadius:4, fontSize:12, background:"white" }} value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(1); }}>
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <span>por página</span>
            </div>
            <span style={{ fontSize:12, color:"#6b7280" }}>Mostrando {Math.min((page-1)*pageSize+1, filtered.length)}–{Math.min(page*pageSize, filtered.length)} de {filtered.length}</span>
            <div style={{ display:"flex", alignItems:"center", gap:3 }}>
              <button type="button" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={{ padding:"4px 12px", border:"1px solid #d1d5db", borderRadius:4, background:"white", fontSize:12, cursor:page===1?"not-allowed":"pointer" }}>← Anterior</button>
              {Array.from({ length:totalPages }).map((_, i) => (
                <button type="button" key={i} onClick={() => setPage(i+1)} style={{ width:32, height:30, borderRadius:4, border:"1px solid", fontSize:12, background:i+1===page?"#1a2035":"white", color:i+1===page?"white":"#374151", borderColor:i+1===page?"#1a2035":"#d1d5db", fontWeight:i+1===page?700:400 }}>{i+1}</button>
              ))}
              <button type="button" onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page>=totalPages} style={{ padding:"4px 12px", border:"1px solid #d1d5db", borderRadius:4, background:"white", fontSize:12, cursor:page>=totalPages?"not-allowed":"pointer" }}>Próxima →</button>
            </div>
          </div>

        </div>

        {/* Modal Amortização / Cadastro */}
        {open && (
            <div className="sigx-modal-overlay" 
              onMouseDown={e => { 
                // Mudamos para onMouseDown para isolar cliques de arrasto de campos de texto
                if (e.target === e.currentTarget) setOpen(false); 
              }}
            >
              <div className="sigx-modal" style={{ maxWidth:860 }} onMouseDown={e => e.stopPropagation()}>
              <div className="sigx-modal-header">
                <span className="sigx-modal-title">Novo Contrato</span>
                <button type="button" onClick={() => setOpen(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--muted-foreground)", display:"flex" }}><X size={18}/></button>
              </div>
              <div className="sigx-tabs" style={{ display:"flex", gap:2, background:"#f3f4f6", padding:4 }}>
                {TABS.map(tab => (
                  <div key={tab.key} className={`sigx-tab${activeTab===tab.key?" active":""}`} onClick={() => setActiveTab(tab.key)} style={{ padding:"6px 12px", fontSize:11, cursor:"pointer", borderRadius:4, background:activeTab===tab.key?"white":"transparent", fontWeight:activeTab===tab.key?700:400 }}>{tab.label}</div>
                ))}
              </div>
              <form onSubmit={handleSubmit}>
                <div className="sigx-modal-body" style={{ padding:20, maxHeight:"55vh", overflowY:"auto" }}>
                  {activeTab === "basico" && (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                      <div style={{ gridColumn:"span 2" }}>
                        <label className="sigx-label">CLIENTE *</label>
                        <select className="sigx-input" value={String(form.clientId||"")} onChange={e => setForm(p => ({ ...p, clientId:Number(e.target.value) }))}>
                          <option value="">Selecione o cliente</option>
                          {clients?.map((c:any) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                        </select>
                      </div>
                      <div><label className="sigx-label">CÓDIGO *</label><input className="sigx-input" value={form.code} onChange={n("code")} required placeholder="Ex: BeloSanta1"/></div>
                      <div><label className="sigx-label">DATA DO CONTRATO</label><input type="date" className="sigx-input" value={form.contractDate} onChange={n("contractDate")}/></div>
                      <div style={{ gridColumn:"span 2" }}><label className="sigx-label">NOME DO CONTRATO *</label><input className="sigx-input" value={form.contractName} onChange={n("contractName")} required/></div>
                      <div><label className="sigx-label">CREDOR *</label><input className="sigx-input" value={form.creditor} onChange={n("creditor")} required/></div>
                      <div><label className="sigx-label">TIPO DE CONTRATO</label><input className="sigx-input" value={form.contractType} onChange={n("contractType")}/></div>
                      <div>
                        <label className="sigx-label">STATUS</label>
                        <select className="sigx-input" value={form.status} onChange={n("status") as any}>
                          {["Ativo","Quitado","Inadimplente","Renegociado"].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, paddingTop:20 }}>
                        <input type="checkbox" id="validated" checked={form.validated} onChange={e => setForm(p => ({ ...p, validated:e.target.checked }))} style={{ width:14, height:14 }}/>
                        <label htmlFor="validated" className="sigx-label" style={{ marginBottom:0, cursor:"pointer" }}>Contrato validado digitalmente</label>
                      </div>
                      <div style={{ gridColumn:"span 2" }}><label className="sigx-label">URL DE VALIDAÇÃO</label><input className="sigx-input" value={form.validationUrl} onChange={n("validationUrl")} placeholder="https://valida.ae/..."/></div>
                    </div>
                  )}
                  {activeTab === "financeiro" && (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>
                      <div><label className="sigx-label">VALOR PRINCIPAL (R$) *</label><input type="number" step="0.01" className="sigx-input" value={form.principalAmount||""} onChange={num("principalAmount")} required/></div>
                      <div><label className="sigx-label">TOTAL FINANCIADO (R$)</label><input type="number" step="0.01" className="sigx-input" value={form.financedTotal||""} onChange={num("financedTotal")}/></div>
                      <div><label className="sigx-label">TAC (R$)</label><input type="number" step="0.01" className="sigx-input" value={form.tacAmount||""} onChange={num("tacAmount")}/></div>
                      <div><label className="sigx-label">IOF (R$)</label><input type="number" step="0.01" className="sigx-input" value={form.iofAmount||""} onChange={num("iofAmount")}/></div>
                      <div><label className="sigx-label">Nº DE PARCELAS *</label><input type="number" min="1" className="sigx-input" value={form.installmentCount} onChange={numI("installmentCount")} required/></div>
                      <div><label className="sigx-label">VALOR DA PARCELA (R$) *</label><input type="number" step="0.01" className="sigx-input" value={form.installmentAmount||""} onChange={num("installmentAmount")} required/></div>
                      <div><label className="sigx-label">PRIMEIRO VENCIMENTO</label><input type="date" className="sigx-input" value={form.firstDueDate} onChange={n("firstDueDate")}/></div>
                      <div><label className="sigx-label">JUROS MENSAL (%)</label><input type="number" step="0.001" className="sigx-input" value={(form.monthlyInterestRate*100).toFixed(3)} onChange={e => setForm(p => ({ ...p, monthlyInterestRate:parseFloat(e.target.value)/100||0 }))}/></div>
                    </div>
                  )}
                  {activeTab === "taxas" && (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>
                      <div><label className="sigx-label">MORA MENSAL (%)</label><input type="number" step="0.001" className="sigx-input" value={(form.moraRateMonthly*100).toFixed(3)} onChange={e => setForm(p => ({ ...p, moraRateMonthly:parseFloat(e.target.value)/100||0 }))}/></div>
                      <div><label className="sigx-label">MULTA (%)</label><input type="number" step="0.001" className="sigx-input" value={(form.penaltyRate*100).toFixed(3)} onChange={e => setForm(p => ({ ...p, penaltyRate:parseFloat(e.target.value)/100||0 }))}/></div>
                      <div><label className="sigx-label">HONORÁRIOS (%)</label><input type="number" step="0.001" className="sigx-input" value={(form.honoraryRate*100).toFixed(3)} onChange={e => setForm(p => ({ ...p, honoraryRate:parseFloat(e.target.value)/100||0 }))}/></div>
                      <div>
                        <label className="sigx-label">BASE DA MULTA</label>
                        <select className="sigx-input" value={form.penaltyBaseType} onChange={n("penaltyBaseType") as any}>
                          <option value="installment">Parcela</option><option value="debt">Débito atualizado</option><option value="contract">Contrato</option>
                        </select>
                      </div>
                      <div>
                        <label className="sigx-label">ESCOPO DA MULTA</label>
                        <select className="sigx-input" value={form.penaltyScope} onChange={n("penaltyScope") as any}>
                          <option value="per_installment">Por parcela</option><option value="contract_once">Uma vez no contrato</option>
                        </select>
                      </div>
                      <div>
                        <label className="sigx-label">CORREÇÃO MONETÁRIA</label>
                        <select className="sigx-input" value={form.correctionIndex} onChange={n("correctionIndex")}>
                          <option value="IPCA">IPCA</option><option value="IGPM">IGPM</option><option value="Nenhuma">Nenhuma</option>
                        </select>
                      </div>
                    </div>
                  )}
                  {activeTab === "garantias" && (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                      <div style={{ gridColumn:"span 2" }}><label className="sigx-label">GARANTIAS REAIS</label><textarea className="sigx-input" value={form.guarantees} onChange={n("guarantees")} rows={3}/></div>
                      <div style={{ gridColumn:"span 2" }}><label className="sigx-label">FIADORES</label><textarea className="sigx-input" value={form.guarantors} onChange={n("guarantors")} rows={3}/></div>
                      <div style={{ gridColumn:"span 2" }}><label className="sigx-label">OBSERVAÇÕES</label><textarea className="sigx-input" value={form.observations} onChange={n("observations")} rows={3}/></div>
                    </div>
                  )}
                  {activeTab === "regras" && (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                      <div style={{ gridColumn:"span 2", display:"flex", alignItems:"center", gap:8 }}>
                        <input type="checkbox" id="accelerates" checked={form.accelerates} onChange={e => setForm(p => ({ ...p, accelerates:e.target.checked }))} style={{ width:14, height:14 }}/>
                        <label htmlFor="accelerates" className="sigx-label" style={{ marginBottom:0, cursor:"pointer" }}>Vencimento antecipado habilitado</label>
                      </div>
                      {form.accelerates && (
                        <>
                          <div><label className="sigx-label">PARCELAS CONSECUTIVAS</label><input type="number" min="1" className="sigx-input" value={form.accelerationConsecutiveThreshold??""} onChange={e => setForm(p => ({ ...p, accelerationConsecutiveThreshold:parseInt(e.target.value)||undefined }))}/></div>
                          <div><label className="sigx-label">PARCELAS ALTERNADAS</label><input type="number" min="1" className="sigx-input" value={form.accelerationAlternateThreshold??""} onChange={e => setForm(p => ({ ...p, accelerationAlternateThreshold:parseInt(e.target.value)||undefined }))}/></div>
                          <div style={{ gridColumn:"span 2" }}><label className="sigx-label">REGRA DE ATRASO (TEXTO)</label><textarea className="sigx-input" value={form.accelerationRule} onChange={n("accelerationRule")} rows={3}/></div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="sigx-modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary">Salvar Contrato</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </UnyPayLayout>
  );
}