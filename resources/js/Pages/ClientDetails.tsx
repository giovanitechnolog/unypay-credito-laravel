import { useState } from "react";
import { Head, router } from "@inertiajs/react";
import { 
  ArrowLeft, Building2, User, Shield, Upload,
  Mail, Phone, Landmark, FileText, X
} from "lucide-react";
import UnyPayLayout from "../Components/UnyPayLayout";

const RISK_COLORS: Record<string, { bg: string; color: string }> = {
  A: { bg: "oklch(92% .08 145)", color: "oklch(35% .15 145)" },
  B: { bg: "oklch(92% .06 240)", color: "oklch(35% .15 240)" },
  C: { bg: "oklch(92% .08 75)",  color: "oklch(40% .15 75)" },
  D: { bg: "oklch(92% .08 50)",  color: "oklch(40% .15 50)" },
  E: { bg: "oklch(92% .08 27)",  color: "oklch(40% .2 27)" },
};

const TABS = [
  { key: "dados", label: "Dados Cadastrais" },
  { key: "contratos", label: "Contratos" },
  { key: "documentos", label: "Documentos / PDFs" },
  { key: "fiadores", label: "Fiadores" },
  { key: "obs", label: "Observações Jurídicas" },
];

function parseNotes(notes: string | null | undefined) {
  if (!notes) return {};
  try { const p = JSON.parse(notes); return typeof p === "object" ? p : {}; } catch { return {}; }
}

export default function ClientDetails({ client }: any) {
  const [activeTab, setActiveTab] = useState("dados");
  const extra = parseNotes(client.notes);
  const risk = RISK_COLORS[client.riskRating ?? "A"] ?? RISK_COLORS.A;

  // Cálculos para os KPI Cards superiores
  const totalContracts = client.contracts?.length ?? 0;
  const totalValue = client.contracts?.reduce((acc: number, c: any) => acc + (Number(c.value) || 0), 0) ?? 0;
  const formattedTotal = totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <UnyPayLayout>
      <Head title={`Detalhe - ${client.name}`} />

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        
        {/* Cabeçalho de Perfil Superior */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={() => router.get("/clients")} style={{ padding: "6px 10px", display: "flex", alignItems: "center" }}>
            <ArrowLeft size={14} />
          </button>
          
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--table-header-bg)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>
            {client.name.charAt(0).toUpperCase()}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>{client.name}</h2>
              <span className={`badge ${client.personType === "PJ" ? "badge-pj" : "badge-pf"}`} style={{ fontSize: 10 }}>
                {client.personType}
              </span>
              <span className="badge" style={{ background: risk.bg, color: risk.color, fontSize: 10 }}>
                <Shield size={9} /> Rating {client.riskRating ?? "A"}
              </span>
              <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{client.document}</span>
            </div>
          </div>

          <button className="btn-primary" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Upload size={13} /> Enviar Documento
          </button>
        </div>

        {/* Linha de KPI Cards Coloridos */}
        <div className="form-grid-4">
          <div className="kpi-card dark">
            <span className="sigx-label" style={{ fontSize: 9 }}>CONTRATOS</span>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)", marginTop: 4 }}>{totalContracts}</div>
          </div>
          <div className="kpi-card purple">
            <span className="sigx-label" style={{ fontSize: 9 }}>PRINCIPAL TOTAL</span>
            <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: "oklch(55% .2 290)", marginTop: 4 }}>R$ {formattedTotal}</div>
          </div>
          <div className="kpi-card blue">
            <span className="sigx-label" style={{ fontSize: 9 }}>TOTAL FINANCIADO</span>
            <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--color-blue)", marginTop: 4 }}>R$ {formattedTotal}</div>
          </div>
          <div className="kpi-card green">
            <span className="sigx-label" style={{ fontSize: 9 }}>DOCUMENTOS</span>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-green)", marginTop: 4 }}>0</div>
          </div>
        </div>

        {/* Abas de Navegação SIGx */}
        <div className="sigx-card" style={{ background: "white" }}>
          <div className="sigx-tabs" style={{ padding: 0, borderBottom: "1px solid var(--border)" }}>
            {TABS.map(tab => {
              let label = tab.label;
              if (tab.key === "contratos") label = `Contratos (${totalContracts})`;
              if (tab.key === "documentos") label = `Documentos / PDFs (0)`;
              
              return (
                <div 
                  key={tab.key} 
                  className={`sigx-tab${activeTab === tab.key ? " active" : ""}`} 
                  onClick={() => setActiveTab(tab.key)}
                  style={{ padding: "12px 20px" }}
                >
                  {label}
                </div>
              );
            })}
          </div>

          {/* Conteúdo das Abas */}
          <div className="sigx-modal-body" style={{ padding: 20 }}>
            
            {/* Aba 1: Dados Cadastrais */}
            {activeTab === "dados" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="form-grid-2">
                  <div>
                    <div className="section-header" style={{ background: "var(--table-header-bg)", marginBottom: 12 }}>IDENTIFICAÇÃO</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "0 4px" }}>
                      <div>
                        <span className="sigx-label" style={{ fontSize: 10 }}>NOME / RAZÃO SOCIAL</span>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{client.name}</div>
                      </div>
                      <div>
                        <span className="sigx-label" style={{ fontSize: 10 }}>TIPO DE PESSOA</span>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{client.personType === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}</div>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <span className="sigx-label" style={{ fontSize: 10 }}>CPF / CNPJ</span>
                        <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{client.document || "—"}</div>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <span className="sigx-label" style={{ fontSize: 10 }}>RATING DE RISCO</span>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>Rating {client.riskRating ?? "A"}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="section-header" style={{ background: "var(--table-header-bg)", marginBottom: 12 }}>CONTATO</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "0 4px" }}>
                      <div>
                        <span className="sigx-label" style={{ fontSize: 10 }}>E-MAIL</span>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{client.email || "—"}</div>
                      </div>
                      <div>
                        <span className="sigx-label" style={{ fontSize: 10 }}>TELEFONE / WHATSAPP</span>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{client.phone || "—"}</div>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <span className="sigx-label" style={{ fontSize: 10 }}>PROFISSÃO / RENDA</span>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{extra.profissao || "—"} {extra.rendaMensal ? `(R$ ${extra.rendaMensal})` : ""}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-grid-2" style={{ marginTop: 10 }}>
                  <div>
                    <div className="section-header" style={{ background: "var(--table-header-bg)", marginBottom: 12 }}>LOCALIZAÇÃO / ENDEREÇO</div>
                    <div style={{ padding: "0 4px" }}>
                      <span className="sigx-label" style={{ fontSize: 10 }}>ENDEREÇO RESIDENCIAL/COMERCIAL</span>
                      <div style={{ fontSize: 13, marginBottom: 10 }}>{client.address || "Não informado"}</div>
                      <div style={{ display: "flex", gap: 40 }}>
                        <div>
                          <span className="sigx-label" style={{ fontSize: 10 }}>CIDADE / UF</span>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{client.city ? `${client.city}/${client.state || ""}` : "—"}</div>
                        </div>
                        <div>
                          <span className="sigx-label" style={{ fontSize: 10 }}>CEP</span>
                          <div className="mono" style={{ fontSize: 13 }}>{client.zipCode || "—"}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="section-header" style={{ background: "var(--table-header-bg)", marginBottom: 12 }}>CONTAS BANCÁRIAS & PIX</div>
                    <div style={{ padding: "0 4px", display: "flex", flexDirection: "column", gap: 10 }}>
                      {extra.bankAccounts?.map((acc: any, idx: number) => (
                        <div key={idx} style={{ padding: "6px 10px", background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12 }}>
                          <span className="mono" style={{ textTransform: "uppercase", fontSize: 9, fontWeight: 700, color: "var(--muted-foreground)", display: "block" }}>{acc.tipo} — {acc.banco || "Banco não informado"}</span>
                          <div style={{ marginTop: 2 }}>Agência: <strong>{acc.agencia || "—"}</strong> | Conta: <strong>{acc.conta || "—"}</strong></div>
                        </div>
                      ))}
                      <div>
                        <span className="sigx-label" style={{ fontSize: 10 }}>CHAVE PIX CADASTRADA</span>
                        <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--color-blue)" }}>{extra.pixKey || "—"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Aba 2: Lista de Contratos */}
            {activeTab === "contratos" && (
              <div className="sigx-table-wrapper">
                <table className="sigx-table">
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ color: "var(--foreground)" }}>Nº Contrato</th>
                      <th style={{ color: "var(--foreground)" }}>Data de Emissão</th>
                      <th style={{ color: "var(--foreground)" }}>Valor Total</th>
                      <th style={{ color: "var(--foreground)" }}>Parcelas</th>
                      <th style={{ color: "var(--foreground)", textAlign: "center" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!client.contracts || client.contracts.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", padding: 30, color: "var(--muted-foreground)" }}>
                          Nenhum contrato ativo encontrado para este cliente.
                        </td>
                      </tr>
                    ) : (
                      client.contracts.map((contract: any) => (
                        <tr key={contract.id}>
                          <td className="mono" style={{ fontWeight: 600 }}>#{contract.code || contract.id}</td>
                          <td>{contract.created_at || "—"}</td>
                          <td className="money-neu">R$ {contract.value || "0,00"}</td>
                          <td>{contract.installments_count || "—"}</td>
                          <td style={{ textAlign: "center" }}>
                            <span className={`badge ${contract.status === "pago" ? "badge-pago" : "badge-vencido"}`}>
                              {contract.status || "Pendente"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Aba 3: Documentos */}
            {activeTab === "documentos" && (
              <div style={{ textAlign: "center", padding: "30px 0", color: "var(--muted-foreground)" }}>
                Nenhum arquivo digitalizado ou PDF anexado a este perfil.
              </div>
            )}

            {/* Aba 4: Fiadores */}
            {activeTab === "fiadores" && (
              <div>
                {!extra.fiador1Nome ? (
                  <div style={{ textAlign: "center", padding: 20, color: "var(--muted-foreground)" }}>Nenhum avalista associado a este cadastro.</div>
                ) : (
                  <div className="form-grid-2">
                    <div>
                      <div className="section-header" style={{ background: "oklch(30% .12 290)", marginBottom: 12 }}>FIADOR / AVALISTA 1</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "0 4px" }}>
                        <div><span className="sigx-label">NOME COMPLETO</span><div style={{ fontSize: 13, fontWeight: 600 }}>{extra.fiador1Nome}</div></div>
                        <div><span className="sigx-label">CPF</span><div className="mono" style={{ fontSize: 13 }}>{extra.fiador1Cpf || "—"}</div></div>
                        <div style={{ marginTop: 6 }}><span className="sigx-label">TELEFONE</span><div style={{ fontSize: 13 }}>{extra.fiador1Telefone || "—"}</div></div>
                        <div style={{ marginTop: 6 }}><span className="sigx-label">ENDEREÇO</span><div style={{ fontSize: 13 }}>{extra.fiador1Endereco || "—"} ({extra.fiador1Cidade || ""})</div></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Aba 5: Observações Jurídicas */}
            {activeTab === "obs" && (
              <div>
                <span className="sigx-label">HISTÓRICO JURÍDICO / RESTRIÇÕES</span>
                {/* CORREÇÃO DO borderRadius: "var(--radius)" COM ASPAS */}
                <div style={{ padding: 14, background: "#fafafa", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, whiteSpace: "pre-wrap", color: "var(--foreground)" }}>
                  {extra.observacoesJuridicas || "Nenhuma anotação jurídica registrada para este cliente."}
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </UnyPayLayout>
  );
}