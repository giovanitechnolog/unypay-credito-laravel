import { useState } from "react";
import { Head, router } from "@inertiajs/react";
import { 
  Users, DollarSign, Wallet, AlertTriangle, Clock, 
  Search, Filter, ChevronRight, ChevronDown, MessageSquare
} from "lucide-react";
import UnyPayLayout from "../Components/UnyPayLayout";

interface PanelProps {
  records: any[];
  cards: any;
  filters: any;
}

export default function ContractPanel({ records, cards, filters }: PanelProps) {
  const [search, setSearch] = useState(filters.search || "");
  const [situation, setSituation] = useState(filters.situation || "Todas");
  
  // 🚀 ADICIONADO: Estado para monitorar quais clientes estão expandidos na tela
  const [expandedClients, setExpandedClients] = useState<number[]>([]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    router.get("/contract-panel", { search, situation }, { preserveState: true });
  };

  const handleClear = () => {
    setSearch("");
    setSituation("Todas");
    router.get("/contract-panel", {}, { preserveState: true });
  };

  const toggleExpandClient = (clientId: number) => {
    if (expandedClients.includes(clientId)) {
      setExpandedClients(expandedClients.filter(id => id !== clientId));
    } else {
      setExpandedClients([...expandedClients, clientId]);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);
  };

  const formatDocument = (doc: string) => {
    if (!doc) return "";
    const clean = doc.replace(/\D/g, "");
    if (clean.length === 11) {
      return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  const getStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case "quitado": return { bg: "#d1fae5", text: "#065f46" };
      case "em atraso": return { bg: "#fee2e2", text: "#991b1b" };
      case "a vencer": return { bg: "#ffedd5", text: "#9a3412" };
      default: return { bg: "#e0f2fe", text: "#075985" };
    }
  };

  return (
    <UnyPayLayout>
      <Head title="Painel Consolidado de Contratos" />

      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc" }}>
        
        {/* ROW 1: CARDS SUPERIORES */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", padding: "16px 20px 8px" }}>
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ background: "#eff6ff", color: "#2563eb", padding: "8px", borderRadius: "8px" }}><Users size={18} /></div>
            <div>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b" }}>CLIENTES</div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b" }}>{cards.clientes_qtd}</div>
            </div>
          </div>
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ background: "#f0fdf4", color: "#16a34a", padding: "8px", borderRadius: "8px" }}><DollarSign size={18} /></div>
            <div>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b" }}>FATURAMENTO</div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b" }}>{formatCurrency(cards.faturamento_global)}</div>
            </div>
          </div>
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ background: "#f5f3ff", color: "#7c3aed", padding: "8px", borderRadius: "8px" }}><Wallet size={18} /></div>
            <div>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b" }}>TOTAL PAGO</div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b" }}>{formatCurrency(cards.pago_global)}</div>
            </div>
          </div>
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ background: "#fff5f5", color: "#e11d48", padding: "8px", borderRadius: "8px" }}><AlertTriangle size={18} /></div>
            <div>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b" }}>SALDO DEVEDOR</div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#e11d48" }}>{formatCurrency(cards.saldo_global)}</div>
            </div>
          </div>
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ background: "#fff7ed", color: "#ea580c", padding: "8px", borderRadius: "8px" }}><Clock size={18} /></div>
            <div>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b" }}>EM ATRASO</div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#ea580c" }}>{formatCurrency(cards.atraso_global)}</div>
            </div>
          </div>
        </div>

        {/* ROW 2: FILTROS */}
        <div style={{ margin: "0 20px 12px 20px", background: "white", padding: "14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <form onSubmit={handleFilter} style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "10px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>BUSCA POR NOME OU DOCUMENTO</label>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: "10px", top: "10px", color: "#94a3b8" }} />
                <input type="text" className="sigx-input" style={{ paddingLeft: "32px", height: "34px", fontSize: "12px" }} placeholder="Nome do devedor, CPF ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div style={{ width: "180px" }}>
              <label style={{ fontSize: "10px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "4px" }}>SITUAÇÃO</label>
              <select className="sigx-input" style={{ height: "34px", fontSize: "12px" }} value={situation} onChange={e => setSituation(e.target.value)}>
                <option value="Todas">Todas as Situações</option>
                <option value="Ativo">Ativo / Regular</option>
                <option value="Em Atraso">Em Atraso</option>
                <option value="Quitado">Quitado</option>
              </select>
            </div>
            <button type="submit" className="btn-primary" style={{ padding: "0 16px", height: "34px", fontSize: "11px", background: "#2563eb", border: "none", borderRadius: "4px", fontWeight: 700 }}>Filtrar</button>
            <button type="button" onClick={handleClear} style={{ padding: "0 16px", height: "34px", fontSize: "11px", background: "transparent", border: "1px solid #cbd5e1", color: "#475569", borderRadius: "4px", cursor: "pointer" }}>Limpar</button>
          </form>
        </div>

        {/* ROW 3: TABELA EXPANSÍVEL MASTER-DETAIL */}
        <div style={{ flex: 1, margin: "0 20px 16px 20px", background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ overflowX: "auto", flex: 1 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", fontSize: "10px", fontWeight: 700, color: "#475569" }}>
                  <th style={{ padding: "10px 12px", width: "40px" }}></th>
                  <th style={{ padding: "10px 12px" }}>Cliente / Devedor Principal</th>
                  <th style={{ padding: "10px 12px", background: "rgba(219, 39, 119, 0.02)" }}>Próx. Venc.</th>
                  <th style={{ padding: "10px 12px", background: "rgba(37, 99, 235, 0.02)" }}>Vlr. Compra Total</th>
                  <th style={{ padding: "10px 12px", background: "rgba(37, 99, 235, 0.02)" }}>Saldo Dev.</th>
                  <th style={{ padding: "10px 12px", background: "rgba(22, 163, 74, 0.02)" }}>Valor Pago</th>
                  <th style={{ padding: "10px 12px", background: "rgba(22, 163, 74, 0.02)" }}>Em Atraso</th>
                  <th style={{ padding: "10px 12px", background: "rgba(124, 58, 237, 0.02)" }}>% Pago</th>
                  <th style={{ padding: "10px 12px", background: "rgba(124, 58, 237, 0.02)" }}>% Saldo</th>
                  <th style={{ padding: "10px 12px", textAlign: "center" }}>Situação</th>
                </tr>
              </thead>

              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>Nenhum contrato localizado.</td>
                  </tr>
                ) : (
                  records.map((row) => {
                    const isExpanded = expandedClients.includes(row.client_id);
                    const badge = getStatusStyle(row.situacao_geral);
                    
                    return (
                      <>
                        {/* LINHA PAI: CONSOLIDADA DO CLIENTE */}
                        <tr key={row.client_id} style={{ borderBottom: "1px solid #f1f5f9", background: isExpanded ? "#f8fafc" : "white" }}>
                          
                          {/* Botão de Setinha para Expansão */}
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <button 
                              type="button" 
                              onClick={() => toggleExpandClient(row.client_id)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              {isExpanded ? <ChevronDown size={16} style={{ color: "#2563eb" }} /> : <ChevronRight size={16} />}
                            </button>
                          </td>

                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ fontWeight: 700, color: "#1e293b" }}>{row.cliente_nome}</div>
                            <div style={{ fontSize: "10px", color: "#64748b" }}>{formatDocument(row.cnpj_cpf)} • <strong style={{ color: "#2563eb" }}>{row.qtd_contratos} Operação(ões)</strong></div>
                          </td>

                          <td style={{ padding: "10px 12px", color: "#475569" }}>
                            {row.prox_vencimento ? new Date(row.prox_vencimento).toLocaleDateString("pt-BR") : "---"}
                          </td>

                          <td style={{ padding: "10px 12px", fontWeight: 600, color: "#334155" }}>{formatCurrency(row.total_faturamento)}</td>
                          <td style={{ padding: "10px 12px", fontWeight: 600, color: "#e11d48" }}>{formatCurrency(row.saldo_devedor)}</td>
                          <td style={{ padding: "10px 12px", fontWeight: 600, color: "#16a34a" }}>{formatCurrency(row.total_pago)}</td>
                          <td style={{ padding: "10px 12px", color: row.em_atraso > 0 ? "#ef4444" : "#64748b" }}>{formatCurrency(row.em_atraso)}</td>

                          <td>
                            <div style={{ fontSize: "10px", color: "#475569", marginBottom: "2px", fontWeight: 600 }}>{row.pct_pago}%</div>
                            <div style={{ width: "80px", height: "5px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
                              <div style={{ width: `${row.pct_pago}%`, height: "100%", background: "#10b981" }} />
                            </div>
                          </td>

                          <td>
                            <div style={{ fontSize: "10px", color: "#475569", marginBottom: "2px", fontWeight: 700 }}>{row.pct_saldo}%</div>
                            <div style={{ width: "80px", height: "5px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
                              <div style={{ width: `${row.pct_saldo}%`, height: "100%", background: "#ef4444" }} />
                            </div>
                          </td>

                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <span style={{ background: badge.bg, color: badge.text, padding: "3px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, display: "inline-block", minWidth: "75px" }}>
                              {row.situacao_geral}
                            </span>
                          </td>
                        </tr>

                        {/* 🚀 LINHA FILHO EXPANSÍVEL: DETALHAMENTO DE CONTRATOS E ADITIVOS */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={10} style={{ padding: "12px 16px 16px 40px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                              
                              {/* Header do Acoplamento idêntico ao Print */}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                <div style={{ fontSize: "11px", fontWeight: 700, color: "#1e293b" }}>
                                  ☰ Lançamentos e Linhas de Crédito de <strong>{row.cliente_nome}</strong>
                                </div>
                                <button 
                                  onClick={() => toggleExpandClient(row.client_id)}
                                  style={{ padding: "3px 10px", fontSize: "10px", border: "1px solid #cbd5e1", borderRadius: "4px", background: "white", cursor: "pointer", color: "#64748b" }}
                                >
                                  ✕ Fechar Painel
                                </button>
                              </div>

                              {/* Subtabela de Contratos Isolados */}
                              <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                                  <thead>
                                    <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", fontSize: "9px", fontWeight: 700, color: "#475569" }}>
                                      <th style={{ padding: "8px" }}>Código / Id</th>
                                      <th style={{ padding: "8px" }}>Tipo</th>
                                      <th style={{ padding: "8px" }}>Descrição do Lastro</th>
                                      <th style={{ padding: "8px" }}>Dt. Emissão</th>
                                      <th style={{ padding: "8px" }}>Dt. Vencimento</th>
                                      <th style={{ padding: "8px" }}>Vlr. Compra</th>
                                      <th style={{ padding: "8px" }}>Vlr. Pago</th>
                                      <th style={{ padding: "8px" }}>Saldo Dev.</th>
                                      <th style={{ padding: "8px" }}>Dias Atr.</th>
                                      <th style={{ padding: "8px", textAlign: "center" }}>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.contratos_detalhe.map((ct: any) => {
                                      const subBadge = getStatusStyle(ct.status);
                                      return (
                                        <tr key={ct.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                          <td style={{ padding: "8px", fontWeight: 700, color: "#2563eb", fontFamily: "monospace" }}>{ct.code}</td>
                                          <td style={{ padding: "8px" }}>
                                            <span style={{ fontSize: "9px", background: "#e0f2fe", color: "#0369a1", padding: "1px 5px", borderRadius: "3px", fontWeight: 600 }}>
                                              {ct.tipo}
                                            </span>
                                          </td>
                                          <td style={{ padding: "8px", color: "#475569" }}>{ct.descricao}</td>
                                          <td style={{ padding: "8px", color: "#64748b" }}>{new Date(ct.dt_emissao).toLocaleDateString("pt-BR")}</td>
                                          <td style={{ padding: "8px", color: "#64748b" }}>{ct.dt_vencimento ? new Date(ct.dt_vencimento).toLocaleDateString("pt-BR") : "---"}</td>
                                          <td style={{ padding: "8px", fontWeight: 600 }}>{formatCurrency(ct.vlr_compra)}</td>
                                          <td style={{ padding: "8px", color: "#16a34a" }}>{formatCurrency(ct.vlr_pago)}</td>
                                          <td style={{ padding: "8px", color: "#ef4444", fontWeight: 600 }}>{formatCurrency(ct.saldo_dev)}</td>
                                          <td style={{ padding: "8px", color: ct.em_atraso > 0 ? "#ef4444" : "#94a3b8" }}>{ct.em_atraso > 0 ? "Sim" : "---"}</td>
                                          <td style={{ padding: "8px", textAlign: "center" }}>
                                            <span style={{ background: subBadge.bg, color: subBadge.text, padding: "2px 6px", borderRadius: "3px", fontSize: "9px", fontWeight: 700 }}>
                                              {ct.status}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </UnyPayLayout>
  );
}