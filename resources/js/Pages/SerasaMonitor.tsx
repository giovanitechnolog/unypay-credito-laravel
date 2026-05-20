import React, { useState } from "react";
import { Head, router, usePage } from "@inertiajs/react";
import {
  Shield, AlertTriangle, CheckCircle, Search, Plus, X,
  RefreshCw, TrendingDown, Info
} from "lucide-react";
import UnyPayLayout from "../Components/UnyPayLayout";

const fmt = (v: number | string) => 
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const TIPO_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  negativacao:       { label: "Negativação",       color: "#dc2626", bg: "#fee2e2", icon: AlertTriangle },
  protesto:          { label: "Protesto",           color: "#7c2d12", bg: "#fed7aa", icon: AlertTriangle },
  cheque_sem_fundo:  { label: "Cheque s/ Fundo",   color: "#b45309", bg: "#fef3c7", icon: AlertTriangle },
  acao_judicial:     { label: "Ação Judicial",      color: "#6b21a8", bg: "#f3e8ff", icon: AlertTriangle },
  inadimplencia:     { label: "Inadimplência",      color: "#dc2626", bg: "#fee2e2", icon: TrendingDown },
  consulta_cpf:      { label: "Consulta CPF",       color: "#2563eb", bg: "#dbeafe", icon: Search },
  consulta_cnpj:     { label: "Consulta CNPJ",      color: "#2563eb", bg: "#dbeafe", icon: Search },
  regularizado:      { label: "Regularizado",       color: "#059669", bg: "#dcfce7", icon: CheckCircle },
  consulta_credito:  { label: "Consulta Crédito",   color: "#0891b2", bg: "#cffafe", icon: Search },
  outro:             { label: "Outro",               color: "#6b7280", bg: "#f3f4f6", icon: Info },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ativo:        { label: "Ativo",        color: "#dc2626", bg: "#fee2e2" },
  regularizado: { label: "Regularizado", color: "#059669", bg: "#dcfce7" },
  em_analise:   { label: "Em Análise",   color: "#d97706", bg: "#fef3c7" },
};

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
function formatMonth(m: string) {
  if (!m || m.length < 7) return m;
  const parts = m.split("-");
  const year = parts[0];
  const monthIdx = parseInt(parts[1]) - 1;
  return `${MONTH_NAMES[monthIdx]}/${year?.slice(2)}`;
}

export default function SerasaMonitor() {
  const { clients, overview, apontamentos, selectedClientId, flash }: any = usePage().props;
  const [addOpen, setAddOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const [newForm, setNewForm] = useState({
    clientId: selectedClientId || 0,
    tipo: "negativacao",
    descricao: "",
    valor: "",
    credor: "",
    dataOcorrencia: new Date().toISOString().slice(0, 10),
    status: "ativo",
    fonte: "serasa",
  });

  const handleSelectClient = (id: number) => {
    router.get("/serasa", { clientId: id }, { preserveState: true });
  };

  const handleManualQuery = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setIsSyncing(true);
    router.post(`/api/serasa/consultar/${id}`, {}, {
      onFinish: () => setIsSyncing(false)
    });
  };

  const handleUpdateStatus = (apontamentoId: number) => {
    router.put(`/api/serasa/apontamento/${apontamentoId}/regularizar`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.clientId) return;
    setIsPending(true);

    router.post("/api/serasa/apontamento", newForm, {
      onSuccess: () => {
        setAddOpen(false);
        setNewForm({ clientId: selectedClientId || 0, tipo: "negativacao", descricao: "", valor: "", credor: "", dataOcorrencia: new Date().toISOString().slice(0, 10), status: "ativo", fonte: "serasa" });
      },
      onFinish: () => setIsPending(false)
    });
  };

  return (
    <UnyPayLayout>
      <Head title="Monitoramento Serasa" />
      <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: "'IBM Plex Sans', sans-serif" }}>
        
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: "linear-gradient(135deg, #dc2626, #7c2d12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Shield size={20} color="white" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>
              Monitoramento de Crédito — Serasa/SPC
            </h2>
            <p style={{ margin: 0, fontSize: 11, color: "var(--muted-foreground)" }}>
              Acompanhamento mensal de apontamentos e restrições dos clientes
            </p>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <button className="btn-primary" onClick={() => { setNewForm(p => ({ ...p, clientId: selectedClientId || 0 })); setAddOpen(true); }}>
              <Plus size={13} /> Registrar Apontamento
            </button>
          </div>
        </div>

        {/* Notificação Flash */}
        {flash?.success && (
          <div style={{ padding: "10px 16px", background: "#dcfce7", color: "#15803d", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
            ✓ {flash.success}
          </div>
        )}

        {/* Aviso de Integração */}
        <div style={{ padding: "12px 16px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Info size={16} style={{ color: "#2563eb", flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: "#1e40af" }}>
            <strong>Integração Serasa Experian:</strong> Para ativar a consulta automática mensal, configure as credenciais da API Serasa (SERASA_CLIENT_ID e SERASA_CLIENT_SECRET) nas configurações do sistema. Enquanto isso, os apontamentos podem ser registrados manualmente ou via consulta manual por cliente.
          </div>
        </div>

        {/* Visão Geral Mensal */}
        {overview && overview.length > 0 && (
          <div className="sigx-card">
            <div className="sigx-card-header">
              <span className="sigx-card-title">Histórico Mensal de Apontamentos</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="sigx-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "10px", textAlign: "left", fontSize: 11 }}>Mês</th>
                    <th style={{ padding: "10px", textAlign: "center", fontSize: 11 }}>Total Apontamentos</th>
                    <th style={{ padding: "10px", textAlign: "center", fontSize: 11 }}>Clientes Afetados</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.map((row: any) => (
                    <tr key={row.month} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "10px", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 12 }}>{formatMonth(row.month)}</td>
                      <td style={{ padding: "10px", textAlign: "center" }}>
                        <span style={{ background: Number(row.count) > 0 ? "#fee2e2" : "#dcfce7", color: Number(row.count) > 0 ? "#dc2626" : "#059669", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                          {row.count}
                        </span>
                      </td>
                      <td style={{ padding: "10px", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{row.clientCount ?? row.client_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Grid de Operação Lateral */}
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 14 }}>
          
          {/* Coluna Esquerda: Clientes */}
          <div className="sigx-card" style={{ overflow: "hidden", background: "white", border: "1px solid #d1d5db", borderRadius: 8 }}>
            <div className="sigx-card-header" style={{ padding: "12px", borderBottom: "1px solid #d1d5db", background: "#f8f9fa" }}>
              <span className="sigx-card-title" style={{ fontSize: 12, fontWeight: 700 }}>Clientes</span>
            </div>
            <div style={{ maxHeight: 500, overflowY: "auto" }}>
              {clients?.map((client: any) => {
                const isSelected = Number(selectedClientId) === Number(client.id);
                const cDoc = client.document ?? client.clientDocument;
                const pType = client.personType ?? client.person_type ?? "PF";

                return (
                  <div
                    key={client.id}
                    onClick={() => handleSelectClient(client.id)}
                    style={{
                      padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                      borderBottom: "1px solid #e5e7eb",
                      background: isSelected ? "#eff6ff" : "white",
                      borderLeft: isSelected ? "3px solid #2563eb" : "3px solid transparent",
                      transition: "all 0.1s",
                    }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a2035", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {client.name?.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#111827" }}>{client.name}</div>
                      <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{cDoc || pType}</div>
                    </div>
                    {isSelected && (
                      <button
                        className="btn-secondary"
                        style={{ fontSize: 10, padding: "4px 8px", flexShrink: 0 }}
                        onClick={e => handleManualQuery(e, client.id)}
                        disabled={isSyncing}
                      >
                        {isSyncing ? <RefreshCw size={10} className="animate-spin" /> : <Search size={10} />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coluna Direita: Apontamentos */}
          <div className="sigx-card" style={{ overflow: "hidden", background: "white", border: "1px solid #d1d5db", borderRadius: 8 }}>
            <div className="sigx-card-header" style={{ padding: "12px", borderBottom: "1px solid #d1d5db", background: "#f8f9fa", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="sigx-card-title" style={{ fontSize: 12, fontWeight: 700 }}>
                {selectedClientId
                  ? `Apontamentos — ${clients?.find((c: any) => Number(c.id) === Number(selectedClientId))?.name ?? "Cliente"}`
                  : "Selecione um cliente para ver os apontamentos"}
              </span>
              {selectedClientId && (
                <button className="btn-primary" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => { setNewForm(p => ({ ...p, clientId: selectedClientId })); setAddOpen(true); }}>
                  <Plus size={11} /> Adicionar
                </button>
              )}
            </div>

            {!selectedClientId ? (
              <div style={{ padding: 60, textAlign: "center", color: "var(--muted-foreground)" }}>
                <Shield size={36} style={{ margin: "0 auto 10px", display: "block", opacity: 0.2 }} />
                <p style={{ margin: 0, fontSize: 13 }}>Selecione um cliente na lista ao lado</p>
              </div>
            ) : !apontamentos || apontamentos.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center", color: "var(--muted-foreground)" }}>
                <CheckCircle size={36} style={{ margin: "0 auto 10px", display: "block", color: "#059669", opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>Nenhum apontamento registrado</p>
                <p style={{ margin: "4px 0 0", fontSize: 11, opacity: 0.7 }}>Este cliente não possui restrições cadastradas</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="sigx-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #e5e7eb", textAlign: "left" }}>
                      <th style={{ padding: "8px 10px" }}>Tipo</th>
                      <th style={{ padding: "8px 10px" }}>Descrição</th>
                      <th style={{ padding: "8px 10px" }}>Data</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Valor</th>
                      <th style={{ padding: "8px 10px" }}>Credor</th>
                      <th style={{ padding: "8px 10px" }}>Fonte</th>
                      <th style={{ padding: "8px 10px" }}>Status</th>
                      <th style={{ padding: "8px 10px", textAlign: "center" }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apontamentos.map((ap: any) => {
                      const tc = TIPO_CONFIG[ap.tipo] ?? TIPO_CONFIG.outro;
                      const sc = STATUS_CONFIG[ap.status] ?? STATUS_CONFIG.ativo;
                      const Icon = tc.icon;
                      
                      const rawDate = ap.dataOcorrencia ?? ap.data_ocorrencia;
                      const rawValue = ap.valor;
                      const rawCredor = ap.credor;
                      const rawFonte = ap.fonte ?? "Serasa";

                      return (
                        <tr key={ap.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                          <td style={{ padding: "8px 10px" }}>
                            <span style={{ background: tc.bg, color: tc.color, fontSize: 10, padding: "2px 6px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 600 }}>
                              <Icon size={9} /> {tc.label}
                            </span>
                          </td>
                          <td style={{ padding: "8px 10px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={ap.descricao}>{ap.descricao}</td>
                          <td style={{ padding: "8px 10px", fontFamily: "'IBM Plex Mono', monospace" }}>{fmtDate(rawDate)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: rawValue ? "#dc2626" : "var(--muted-foreground)", fontWeight: rawValue ? 600 : 400 }}>
                            {rawValue ? fmt(rawValue) : "—"}
                          </td>
                          <td style={{ padding: "8px 10px", color: "var(--muted-foreground)" }}>{rawCredor || "—"}</td>
                          <td style={{ padding: "8px 10px" }}>
                            <span style={{ background: "#f3f4f6", color: "#374151", padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>{rawFonte}</span>
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <span style={{ background: sc.bg, color: sc.color, padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{sc.label}</span>
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "center" }}>
                            {ap.status !== "regularizado" && (
                              <button className="btn-icon" style={{ width: 22, height: 22, border: "none", background: "none", cursor: "pointer" }} title="Marcar como regularizado"
                                onClick={() => handleUpdateStatus(ap.id)}>
                                <CheckCircle size={13} style={{ color: "#059669" }} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Modal de Registro Manual */}
      {/* ── MODAL DE REGISTRO MANUAL COM CORREÇÃO DE ALTURA E CENTRALIZAÇÃO ── */}
      {addOpen && (
        <div 
          className="sigx-modal-backdrop" 
          style={{ 
            position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
            background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 
          }}
        >
          <div 
            className="sigx-modal-container" 
            style={{ 
              width: 540, maxWidth: "95vw", maxHeight: "90vh", 
              background: "white", borderRadius: 10, overflowY: "auto", 
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)", display: "flex", flexDirection: "column"
            }}
          >
            {/* Header Fixo */}
            <div style={{ padding: "12px 16px", background: "#1a2035", color: "white", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Registrar Apontamento de Crédito</span>
              <button type="button" onClick={() => setAddOpen(false)} style={{ background: "none", border: "none", color: "white", cursor: "pointer" }}><X size={16} /></button>
            </div>
            
            {/* Formulário Rolável Internamente */}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label className="sigx-label">CLIENTE *</label>
                  <select className="sigx-input" value={newForm.clientId || ""} onChange={e => setNewForm(p => ({ ...p, clientId: Number(e.target.value) }))} required style={{ fontSize: 12 }}>
                    <option value="">Selecione o cliente</option>
                    {clients?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="sigx-label">TIPO DE APONTAMENTO *</label>
                    <select className="sigx-input" value={newForm.tipo} onChange={e => setNewForm(p => ({ ...p, tipo: e.target.value }))} style={{ fontSize: 12 }}>
                      {Object.entries(TIPO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="sigx-label">FONTE</label>
                    <select className="sigx-input" value={newForm.fonte} onChange={e => setNewForm(p => ({ ...p, fonte: e.target.value }))} style={{ fontSize: 12 }}>
                      <option value="serasa">Serasa</option>
                      <option value="spc">SPC</option>
                      <option value="bacen">Banco Central</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="sigx-label">DESCRIÇÃO *</label>
                  <input className="sigx-input" value={newForm.descricao} onChange={e => setNewForm(p => ({ ...p, descricao: e.target.value }))} required placeholder="Descreva o motivo do apontamento..." />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="sigx-label">VALOR (R$)</label>
                    <input type="number" step="0.01" className="sigx-input mono" value={newForm.valor} onChange={e => setNewForm(p => ({ ...p, valor: e.target.value }))} placeholder="0,00" />
                  </div>
                  <div>
                    <label className="sigx-label">CREDOR</label>
                    <input className="sigx-input" value={newForm.credor} onChange={e => setNewForm(p => ({ ...p, credor: e.target.value }))} placeholder="Nome da empresa/banco" />
                  </div>
                  <div>
                    <label className="sigx-label">DATA DE OCORRÊNCIA</label>
                    <input type="date" className="sigx-input" value={newForm.dataOcorrencia} onChange={e => setNewForm(p => ({ ...p, dataOcorrencia: e.target.value }))} required />
                  </div>
                </div>
                <div>
                  <label className="sigx-label">STATUS</label>
                  <select className="sigx-input" value={newForm.status} onChange={e => setNewForm(p => ({ ...p, status: e.target.value as any }))} style={{ fontSize: 12 }}>
                    <option value="ativo">Ativo</option>
                    <option value="em_analise">Em Análise</option>
                    <option value="regularizado">Regularizado</option>
                  </select>
                </div>
              </div>

              {/* Rodapé Fixo */}
              <div style={{ padding: "10px 16px", background: "#f9fafb", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 8, position: "sticky", bottom: 0, zIndex: 10 }}>
                <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={isPending}>
                  {isPending ? "Registrando..." : "Registrar Apontamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </UnyPayLayout>
  );
}