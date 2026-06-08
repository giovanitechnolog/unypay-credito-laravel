import { useState } from "react";
import { Head } from "@inertiajs/react";
import { 
  Upload, Sparkles, FileText, CheckCircle, RefreshCw, 
  User, CircleDollarSign, Landmark, Percent, Shield, Car, Check, FileCheck, AlertCircle, Plus, Trash2
} from "lucide-react";
import { toast } from "sonner";
import UnyPayLayout from "../Components/UnyPayLayout";
import { api } from "../lib/api";

interface AiIngestionProps {
  contractTypes: any[];
  existingClients: any[];
}

export default function AiIngestion({ contractTypes, existingClients }: AiIngestionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeReviewTab, setActiveReviewTab] = useState("dados_basicos");
  const [submitting, setSubmitting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.type !== "application/pdf") {
        toast.error("Por favor, selecione apenas arquivos digitais em formato PDF.");
        return;
      }
      setFile(selected);
    }
  };

  const handleStartAnalysis = async () => {
    if (!file) {
      toast.warning("Selecione um arquivo PDF primeiro.");
      return;
    }

    setLoading(true);
    setExtractedData(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post("/api/ai-ingestion/process", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      const data = response.data;
      
      if (data.taxas) {
        if (data.taxas.juros_mes) data.taxas.juros_mes = (parseFloat(data.taxas.juros_mes) * 100).toFixed(2);
        if (data.taxas.mora_mes) data.taxas.mora_mes = (parseFloat(data.taxas.mora_mes) * 100).toFixed(2);
        if (data.taxas.multa_atraso) data.taxas.multa_atraso = (parseFloat(data.taxas.multa_atraso) * 100).toFixed(2);
      }

      // Garante que a chave fiadores sempre venha como array para o React não quebrar
      if (!data.fiadores) {
        data.fiadores = [];
      }

      setExtractedData(data);
      toast.success("Leitura estruturada concluída!");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erro ao processar as cláusulas do PDF via IA.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmIngestion = async () => {
    setSubmitting(true);
    try {
      const payload = JSON.parse(JSON.stringify(extractedData));
      if (payload.taxas) {
        payload.taxas.juros_mes = parseFloat(payload.taxas.juros_mes) / 100;
        payload.taxas.mora_mes = parseFloat(payload.taxas.mora_mes) / 100;
        payload.taxas.multa_atraso = parseFloat(payload.taxas.multa_atraso) / 100;
      }

      await api.post("/api/ai-ingestion/save", payload);
      toast.success("Ecosistema integrado gravado com sucesso!");
      setExtractedData(null);
      setFile(null);
    } catch (err: any) {
      toast.error("Falha ao persistir a ingestão no banco de dados.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateNested = (section: string, field: string, value: any) => {
    setExtractedData((prev: any) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }));
  };

  // 🚀 ADICIONADO: Função para inserir uma linha de fiador em branco dinamicamente
  const handleAddGuarantorManual = () => {
    setExtractedData((prev: any) => ({
      ...prev,
      fiadores: [...(prev.fiadores || []), { nome: "", documento: "", cidade: "Não Informada" }]
    }));
    toast.info("Nova ficha de fiador manual aberta para digitação.");
  };

  // 🚀 ADICIONADO: Função para remover um fiador específico caso o usuário mude de ideia
  const handleRemoveGuarantor = (idxToRemove: number) => {
    setExtractedData((prev: any) => ({
      ...prev,
      fiadores: prev.fiadores.filter((_: any, idx: number) => idx !== idxToRemove)
    }));
  };

  const isTabInvalid = (tabKey: string): boolean => {
    if (!extractedData) return false;
    switch (tabKey) {
      case "dados_basicos":
        return !extractedData.dados_basicos?.cliente_devedor || !extractedData.dados_basicos?.documento || !extractedData.dados_basicos?.data_emissao || !extractedData.dados_basicos?.tipo;
      case "valores":
        return !extractedData.valores?.valor_principal || !extractedData.valores?.numero_parcelas || !extractedData.valores?.valor_parcela;
      case "banco":
        return !extractedData.banco?.nome || !extractedData.banco?.conta;
      case "taxas":
        return !extractedData.taxas?.juros_mes || !extractedData.taxas?.data_primeiro_vencimento;
      case "fiadores":
        return !extractedData.fiadores || extractedData.fiadores.length === 0 || extractedData.fiadores.some((f: any) => !f.nome || !f.documento);
      case "garantias":
        return extractedData.garantias?.tipo_garantia !== "nenhuma" && !extractedData.garantias?.descricao_detalhada;
      default:
        return false;
    }
  };

  const getInputStyle = (value: any) => {
    const isEmpty = value === undefined || value === null || value === "" || value === 0;
    return {
      borderColor: isEmpty ? "#ef4444" : "#cbd5e1",
      backgroundColor: isEmpty ? "#fef2f2" : "white",
      transition: "all 0.1s"
    };
  };

  return (
    <UnyPayLayout>
      <Head title="Ingestão Inteligente via IA" />

      <div style={{ display: "flex", gap: "16px", height: "100%", padding: "12px", boxSizing: "border-box", background: "#f1f5f9" }}>
        
        {/* BLOCK 1 (ESQUERDA - 30%) */}
        <div style={{ width: "320px", display: "flex", flexDirection: "column", gap: "12px", flexShrink: 0 }}>
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "8px", letterSpacing: "0.05em" }}>FONTE DE ENTRADA</span>
            <input type="file" id="ai-pdf-uploader" accept=".pdf" onChange={handleFileChange} style={{ display: "none" }} />
            <label htmlFor="ai-pdf-uploader" style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", padding: "24px 12px", border: "2px dashed #cbd5e1", borderRadius: "6px", background: "#f8fafc" }}>
              <Upload size={24} style={{ color: file ? "#2563eb" : "#94a3b8" }} />
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#334155", textAlign: "center", wordBreak: "break-all" }}>
                {file ? file.name : "Arraste ou clique para carregar minuta PDF"}
              </span>
            </label>

            {file && !loading && !extractedData && (
              <button onClick={handleStartAnalysis} className="btn-primary" style={{ marginTop: "12px", width: "100%", padding: "7px", fontSize: "11px", fontWeight: 700, background: "linear-gradient(135deg, #1e2139 0%, #4f46e5 100%)", border: "none", borderRadius: "4px", justifyContent: "center" }}>
                <Sparkles size={12} /> Analisar Cláusulas via IA
              </button>
            )}
          </div>

          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px", flex: 1, display: "flex", flexDirection: "column", gap: "10px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", display: "block", letterSpacing: "0.05em" }}>ESTADO DO PROCESSAMENTO</span>
            
            {loading && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <RefreshCw size={24} className="animate-spin" style={{ color: "#4f46e5" }} />
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#1e293b" }}>ChatGPT lendo e separando as abas...</span>
              </div>
            )}

            {!loading && !extractedData && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px", color: "#94a3b8", textAlign: "center" }}>
                <FileText size={28} style={{ opacity: 0.4 }} />
                <span style={{ fontSize: "11px" }}>Aguardando upload de contrato para iniciar extração.</span>
              </div>
            )}

            {extractedData && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "8px", borderRadius: "6px" }}>
                    <FileCheck size={16} style={{ color: "#16a34a" }} />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#14532d" }}>Leitura Concluída</span>
                      <span style={{ fontSize: "10px", color: "#15803d" }}>Campos prontos para revisão</span>
                    </div>
                  </div>
                </div>

                <button type="button" onClick={handleConfirmIngestion} disabled={submitting} className="btn-primary" style={{ width: "100%", padding: "8px", fontSize: "12px", fontWeight: 700, background: "#16a34a", border: "none", borderRadius: "4px", justifyContent: "center", marginTop: "auto" }}>
                  <Check size={14} /> {submitting ? "Salvando tabelas..." : "Confirmar e Salvar Tudo 🚀"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* BLOCK 2 (DIREITA - 70%) */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          
          {extractedData ? (
            <>
              {/* Navegação por Abas Horizontal */}
              <div style={{ display: "flex", background: "#f8fafc", padding: "4px 4px 0 4px", gap: "2px", borderBottom: "1px solid #e2e8f0" }}>
                {[
                  { key: "dados_basicos",     label: "Dados Básicos",     icon: User },
                  { key: "valores",           label: "Valores",           icon: CircleDollarSign },
                  { key: "banco",             label: "Banco",             icon: Landmark },
                  { key: "taxas",             label: "Taxas",             icon: Percent },
                  { key: "fiadores",          label: "Fiadores NxN",      icon: Shield },
                  { key: "garantias",         label: "Garantias",         icon: Car },
                ].map(tab => {
                  const Icon = tab.icon;
                  const active = activeReviewTab === tab.key;
                  const hasError = isTabInvalid(tab.key);
                  
                  return (
                    <button 
                      key={tab.key}
                      type="button" 
                      onClick={() => setActiveReviewTab(tab.key)} 
                      style={{ 
                        padding: "8px 14px", fontSize: "11px", border: "none", cursor: "pointer", borderRadius: "6px 6px 0 0", 
                        fontWeight: active ? 700 : 500, 
                        background: active ? "white" : "transparent", 
                        color: hasError ? "#ef4444" : active ? "#1e2139" : "#64748b", 
                        borderTop: active ? "2px solid #2563eb" : "2px solid transparent", 
                        transition: "all 0.1s",
                        display: "flex", alignItems: "center", gap: "4px"
                      }}
                    >
                      <Icon size={12} style={{ verticalAlign: "middle" }} /> 
                      {tab.label}
                      {hasError && <AlertCircle size={10} className="text-red-500 animate-pulse" />}
                    </button>
                  );
                })}
              </div>

              {/* Corpo do Formulário */}
              <div style={{ padding: "16px", flex: 1, overflowY: "auto" }}>
                
                {/* TAB: DADOS BÁSICOS */}
                {activeReviewTab === "dados_basicos" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div style={{ gridColumn: "span 2" }}>
                      <label className="sigx-label">CLIENTE DEVEDOR PRINCIPAL</label>
                      <input className="sigx-input font-semibold" style={getInputStyle(extractedData.dados_basicos?.cliente_devedor)} value={extractedData.dados_basicos?.cliente_devedor || ""} onChange={e => updateNested("dados_basicos", "cliente_devedor", e.target.value)} />
                    </div>
                    <div>
                      <label className="sigx-label">CNPJ OU CPF</label>
                      <input className="sigx-input mono" style={getInputStyle(extractedData.dados_basicos?.documento)} value={extractedData.dados_basicos?.documento || ""} onChange={e => updateNested("dados_basicos", "documento", e.target.value)} />
                    </div>
                    <div>
                      <label className="sigx-label">CEP</label>
                      <input className="sigx-input mono" style={getInputStyle(extractedData.dados_basicos?.cep)} value={extractedData.dados_basicos?.cep || ""} onChange={e => updateNested("dados_basicos", "cep", e.target.value)} />
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <label className="sigx-label">ENDEREÇO RESIDENCIAL / COMERCIAL</label>
                      <input className="sigx-input" style={getInputStyle(extractedData.dados_basicos?.endereco)} value={extractedData.dados_basicos?.endereco || ""} onChange={e => updateNested("dados_basicos", "endereco", e.target.value)} />
                    </div>
                    <div>
                      <label className="sigx-label">CÓDIGO INTERNO DO CONTRATO</label>
                      <input className="sigx-input mono" style={getInputStyle(extractedData.dados_basicos?.codigo_interno)} value={extractedData.dados_basicos?.codigo_interno || ""} onChange={e => updateNested("dados_basicos", "codigo_interno", e.target.value)} />
                    </div>
                    <div>
                      <label className="sigx-label">DATA DE EMISSÃO</label>
                      <input type="date" className="sigx-input" style={getInputStyle(extractedData.dados_basicos?.data_emissao)} value={extractedData.dados_basicos?.data_emissao || ""} onChange={e => updateNested("dados_basicos", "data_emissao", e.target.value)} />
                    </div>
                    <div>
                      <label className="sigx-label">CREDOR DA DÍVIDA</label>
                      <input className="sigx-input" style={getInputStyle(extractedData.dados_basicos?.credor_divida)} value={extractedData.dados_basicos?.credor_divida || ""} onChange={e => updateNested("dados_basicos", "credor_divida", e.target.value)} />
                    </div>
                    <div>
                      <label className="sigx-label">TIPO ESTRUTURAL</label>
                      <input className="sigx-input" style={getInputStyle(extractedData.dados_basicos?.tipo)} value={extractedData.dados_basicos?.tipo || ""} onChange={e => updateNested("dados_basicos", "tipo", e.target.value)} />
                    </div>
                  </div>
                )}

                {/* TAB: VALORES */}
                {activeReviewTab === "valores" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label className="sigx-label">VALOR PRINCIPAL (R$)</label>
                      <input type="number" step="0.01" className="sigx-input" style={getInputStyle(extractedData.valores?.valor_principal)} value={extractedData.valores?.valor_principal || ""} onChange={e => updateNested("valores", "valor_principal", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="sigx-label">VALOR FINANCIADO TOTAL (R$)</label>
                      <input type="number" step="0.01" className="sigx-input" style={getInputStyle(extractedData.valores?.valor_financiado)} value={extractedData.valores?.valor_financiado || ""} onChange={e => updateNested("valores", "valor_financiado", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="sigx-label">NÚMERO DE PARCELAS</label>
                      <input type="number" className="sigx-input" style={getInputStyle(extractedData.valores?.numero_parcelas)} value={extractedData.valores?.numero_parcelas || ""} onChange={e => updateNested("valores", "numero_parcelas", parseInt(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="sigx-label">VALOR DA PARCELA MENSAL (R$)</label>
                      <input type="number" step="0.01" className="sigx-input" style={getInputStyle(extractedData.valores?.valor_parcela)} value={extractedData.valores?.valor_parcela || ""} onChange={e => updateNested("valores", "valor_parcela", parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                )}

                {/* TAB: BANCO */}
                {activeReviewTab === "banco" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div style={{ gridColumn: "span 2" }}>
                      <label className="sigx-label">NOME DO BANCO DE DESTINO</label>
                      <input className="sigx-input" style={getInputStyle(extractedData.banco?.nome)} value={extractedData.banco?.nome || ""} onChange={e => updateNested("banco", "nome", e.target.value)} />
                    </div>
                    <div>
                      <label className="sigx-label">AGÊNCIA</label>
                      <input className="sigx-input mono" style={getInputStyle(extractedData.banco?.agencia)} value={extractedData.banco?.agencia || ""} onChange={e => updateNested("banco", "agencia", e.target.value)} />
                    </div>
                    <div>
                      <label className="sigx-label">NÚMERO DA CONTA</label>
                      <input className="sigx-input mono" style={getInputStyle(extractedData.banco?.conta)} value={extractedData.banco?.conta || ""} onChange={e => updateNested("banco", "conta", e.target.value)} />
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <label className="sigx-label">CHAVE PIX DE REPASSE</label>
                      <input className="sigx-input mono" style={getInputStyle(extractedData.banco?.pix)} value={extractedData.banco?.pix || ""} onChange={e => updateNested("banco", "pix", e.target.value)} />
                    </div>
                  </div>
                )}

                {/* TAB: TAXAS */}
                {activeReviewTab === "taxas" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label className="sigx-label">CORREÇÃO MONETÁRIA / INDEXADOR</label>
                      <input className="sigx-input" style={getInputStyle(extractedData.taxas?.correcao_monetaria)} value={extractedData.taxas?.correcao_monetaria || ""} onChange={e => updateNested("taxas", "correcao_monetaria", e.target.value)} />
                    </div>
                    <div>
                      <label className="sigx-label">DATA DO 1º VENCIMENTO</label>
                      <input type="date" className="sigx-input" style={getInputStyle(extractedData.taxas?.data_primeiro_vencimento)} value={extractedData.taxas?.data_primeiro_vencimento || ""} onChange={e => updateNested("taxas", "data_primeiro_vencimento", e.target.value)} />
                    </div>
                    <div>
                      <label className="sigx-label">TARIFA DE ESTRUTURAÇÃO (TAC R$)</label>
                      <input type="number" step="0.01" className="sigx-input" style={getInputStyle(extractedData.taxas?.tac)} value={extractedData.taxas?.tac || ""} onChange={e => updateNested("taxas", "tac", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="sigx-label">JUROS MENSAL CONTRATUAL (%)</label>
                      <input type="number" step="0.01" className="sigx-input font-bold" style={getInputStyle(extractedData.taxas?.juros_mes)} value={extractedData.taxas?.juros_mes || ""} onChange={e => updateNested("taxas", "juros_mes", e.target.value)} />
                    </div>
                    <div>
                      <label className="sigx-label">MORA MENSAL DE INADIMPLÊNCIA (%)</label>
                      <input type="number" step="0.01" className="sigx-input" style={getInputStyle(extractedData.taxas?.mora_mes)} value={extractedData.taxas?.mora_mes || ""} onChange={e => updateNested("taxas", "mora_mes", e.target.value)} />
                    </div>
                    <div>
                      <label className="sigx-label">MULTA PENAL POR ATRASO (%)</label>
                      <input type="number" step="0.01" className="sigx-input" style={getInputStyle(extractedData.taxas?.multa_atraso)} value={extractedData.taxas?.multa_atraso || ""} onChange={e => updateNested("taxas", "multa_atraso", e.target.value)} />
                    </div>
                  </div>
                )}

                {/* TAB: FIADORES (🚀 ENGENHARIA DE CADASTRO MANUAL NxN) */}
                {activeReviewTab === "fiadores" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    
                    {/* Botão Global de Inserção de Coobrigado */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>Catálogo de Fiadores Interconectados</span>
                      <button 
                        type="button" 
                        onClick={handleAddGuarantorManual}
                        style={{ display: "flex", alignItems: "center", gap: "4px", background: "#2563eb", color: "white", border: "none", padding: "4px 10px", borderRadius: "4px", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}
                      >
                        <Plus size={10} /> Incluir Fiador Manual
                      </button>
                    </div>

                    {!extractedData.fiadores || extractedData.fiadores.length === 0 ? (
                      <div style={{ padding: "20px", textAlign: "center", color: "#ef4444", background: "#fef2f2", border: "1px dashed #fca5a5", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>
                        ⚠️ NENHUM FIADOR DETECTADO: Use o botão acima para inserir os coobrigados manualmente.
                      </div>
                    ) : (
                      extractedData.fiadores.map((fiador: any, idx: number) => (
                        <div key={idx} style={{ padding: "12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fafbfc", position: "relative" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <span style={{ fontSize: "9px", fontWeight: 700, color: "#64748b" }}>FIADOR VINCULADO N° {idx + 1}</span>
                            <button 
                              type="button" 
                              onClick={() => handleRemoveGuarantor(idx)}
                              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", display: "flex", padding: "2px" }}
                              title="Remover este fiador"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          
                          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px" }}>
                            <div>
                              <label className="sigx-label">NOME DO COOBRIGADO</label>
                              <input className="sigx-input" style={getInputStyle(fiador.nome)} value={fiador.nome || ""} onChange={e => {
                                const updated = [...extractedData.fiadores];
                                updated[idx].nome = e.target.value;
                                setExtractedData({...extractedData, fiadores: updated});
                              }} />
                            </div>
                            <div>
                              <label className="sigx-label">CPF DO FIADOR</label>
                              <input className="sigx-input mono" style={getInputStyle(fiador.documento)} value={fiador.documento || ""} onChange={e => {
                                const updated = [...extractedData.fiadores];
                                updated[idx].documento = e.target.value;
                                setExtractedData({...extractedData, fiadores: updated});
                              }} />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TAB: GARANTIAS */}
                {activeReviewTab === "garantias" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
                    <div>
                      <label className="sigx-label">CATEGORIA DA GARANTIA REAL</label>
                      <select className="sigx-input" value={extractedData.garantias?.tipo_garantia || "nenhuma"} onChange={e => updateNested("garantias", "tipo_garantia", e.target.value)}>
                        <option value="nenhuma">Sem Garantia Real Acoplada (Apenas Aval)</option>
                        <option value="veiculo">Garantia Veicular (Carro / Caminhão / Frota)</option>
                        <option value="imovel">Garantia Imobiliária (Lote / Casa / Matrícula)</option>
                      </select>
                    </div>
                    <div>
                      <label className="sigx-label">DESCRIÇÃO DETALHADA DO LASTRO / BEM</label>
                      <textarea className="sigx-input" rows={5} style={getInputStyle(extractedData.garantias?.tipo_garantia !== "nenhuma" ? extractedData.garantias?.descricao_detalhada : "pass") ?? {}} value={extractedData.garantias?.descricao_detalhada || ""} onChange={e => updateNested("garantias", "descricao_detalhada", e.target.value)} placeholder="Dados estruturados de placas, chassis ou números de registro cartorário..." />
                    </div>
                  </div>
                )}

              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", color: "#94a3b8" }}>
              <FileText size={36} style={{ opacity: 0.3 }} />
              <span style={{ fontSize: "12px", fontWeight: 500 }}>Aguardando processamento cognitivo para abrir as abas.</span>
            </div>
          )}
        </div>

      </div>
    </UnyPayLayout>
  );
}