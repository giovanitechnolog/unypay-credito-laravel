import { useState } from "react";
import { Head } from "@inertiajs/react";
import { 
  Upload, Sparkles, FileText, RefreshCw,
  CircleDollarSign, Landmark, Percent, Shield, Car, Check, FileCheck, AlertCircle, Plus, Trash2,
  Users, UserCheck, BookOpen, Home, X, Eye, Edit2, Scale, CreditCard, QrCode, MapPin
} from "lucide-react";
import { toast } from "sonner";
import UnyPayLayout from "../Components/UnyPayLayout";
import { api } from "../lib/api";

interface ConsignorLite {
  id: number;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  zipCode: string | null;
  complement: string | null;
  city: string | null;
  state: string | null;
}

interface AiIngestionProps {
  contractTypes: any[];
  existingClients: any[];
  consignors: ConsignorLite[];
}

type PersonRole = "fiadores" | "codevedores" | "testemunhas";
type VinculoSubTab = "FIADOR" | "CODEVEDOR";

/** Formata CPF/CNPJ a partir dos dígitos persistidos para exibir no select. */
const formatConsignorDocument = (doc: string | null | undefined): string => {
  const digits = (doc ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return digits;
};

/** Aplica máscara de CEP (00000-000). Espelha o helper homônimo de Contracts. */
const maskCEP = (zip: string | null | undefined): string => {
  const digits = (zip ?? "").replace(/\D/g, "").slice(0, 8);
  if (digits.length === 8) return digits.replace(/^(\d{5})(\d{3})$/, "$1-$2");
  return digits;
};

// 🎨 Espelha exatamente as máscaras usadas em Pages/Contracts.tsx
//    para que a UX de digitação de valores seja idêntica.
const maskMoneyDisplay = (value: number | string | null | undefined): string => {
  const num = typeof value === "string" ? parseFloat(value.replace(",", ".")) : Number(value);
  const cents = Math.round((num || 0) * 100);
  if (cents === 0) return "";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const intPart = Math.floor(abs / 100);
  const decPart = (abs % 100).toString().padStart(2, "0");
  return `${sign}${intPart.toLocaleString("pt-BR")},${decPart}`;
};

const maskMoneyParse = (raw: string): number => {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
};

// Para juros/mora/multa: o backend espera/devolve em formato % (ex 3.38 = 3,38%),
// pois o frontend já multiplica por 100 antes de exibir e divide por 100 antes de
// mandar para a API. Aqui aplicamos só o display no padrão pt-BR.
const maskPercentInputDisplay = (value: any): string => {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "string" ? parseFloat(value.replace(",", ".")) : Number(value);
  if (!isFinite(num) || num === 0) return "";
  const cents = Math.round(num * 100);
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const intPart = Math.floor(abs / 100);
  const decPart = (abs % 100).toString().padStart(2, "0");
  return `${sign}${intPart.toLocaleString("pt-BR")},${decPart}`;
};

const maskPercentInputParse = (raw: string): string => {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return (parseInt(digits, 10) / 100).toFixed(2);
};

const EMPTY_PERSON = {
  nome: "",
  documento: "",
  personType: "PF",
  rg: "",
  nacionalidade: "Brasileiro",
  estado_civil: "Não informado",
  tradeName: "",
  email: "",
  telefone: "",
  cep: "",
  rua: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
};

const EMPTY_WITNESS = {
  nome: "",
  documento: "",
  rg: "",
};

const EMPTY_VEHICLE_ASSET = {
  tipo: "vehicle",
  brand: "",
  model: "",
  manufactureYear: "",
  modelYear: "",
  plate: "",
  renavam: "",
  chassis: "",
};

const EMPTY_REAL_ESTATE_ASSET = {
  tipo: "real_estate",
  description: "",
  location: "",
  registryNumber: "",
  totalArea: "",
  boundaries: "",
};

export default function AiIngestion({ contractTypes, existingClients, consignors = [] }: AiIngestionProps) {
  // contractTypes/existingClients vêm hidratados pelo controller para futuras
  // melhorias (autocomplete de cliente cadastrado, sugestão de tipo já existente),
  // mas o fluxo atual cria sempre cadastros novos a partir do conteúdo do PDF.
  void contractTypes; void existingClients;

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeReviewTab, setActiveReviewTab] = useState("basico");
  // Sub-abas internas da guia "Fiadores e Codevedores" — espelha o padrão da
  // tela de Contratos (vinculoTabActive). Decide qual coleção é renderizada.
  const [vinculoTabActive, setVinculoTabActive] = useState<VinculoSubTab>("FIADOR");
  const [submitting, setSubmitting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);

  // 🚀 Estado da aba "Credor" — espelha o padrão de `selectedConsignor` em
  // Contracts.tsx. Guarda o objeto completo para que o painel read-only
  // (telefone, email, endereço) seja desenhado abaixo do <select>. A busca
  // por nome similar é feita pelo próprio <select> nativo do HTML5 quando
  // o usuário começa a digitar com a lista aberta.
  const [selectedConsignor, setSelectedConsignor] = useState<ConsignorLite | null>(null);

  // Resolve o credor selecionado a partir do nome textual extraído pela IA.
  // Em uma "ingestão fresca" (logo após análise do PDF), tentamos casar o
  // nome com a lista local; se houver match único e exato (case-insensitive),
  // hidratamos `selectedConsignor` para já mostrar os dados read-only.
  const handleSelectConsignor = (id: number) => {
    if (!id) {
      setSelectedConsignor(null);
      // Limpa também o consignor_id e mantém o credor_divida do PDF
      setExtractedData((prev: any) => ({
        ...prev,
        dados_basicos: {
          ...(prev?.dados_basicos || {}),
          consignor_id: null,
        },
      }));
      return;
    }
    const found = consignors.find(c => c.id === id) || null;
    setSelectedConsignor(found);
    setExtractedData((prev: any) => ({
      ...prev,
      dados_basicos: {
        ...(prev?.dados_basicos || {}),
        consignor_id: found?.id ?? null,
        // Sincroniza o texto livre com o nome canônico do credor escolhido.
        // Mantém compatibilidade com o campo legado `creditor`.
        credor_divida: found?.name ?? prev?.dados_basicos?.credor_divida,
      },
    }));
  };

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
    setSelectedConsignor(null);
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

      // 🔒 Garante todas as coleções como arrays para que o React/UI nunca
      //    quebre ao iterar (mesmo que o GPT esqueça uma chave).
      data.fiadores    = Array.isArray(data.fiadores)    ? data.fiadores    : [];
      data.codevedores = Array.isArray(data.codevedores) ? data.codevedores : [];
      data.testemunhas = Array.isArray(data.testemunhas) ? data.testemunhas : [];
      data.regras      = data.regras && typeof data.regras === "object" ? data.regras : {};

      // Compatibilidade com garantia antiga (objeto único) — converte para array
      if (data.garantias && !Array.isArray(data.garantias)) {
        const tipo = data.garantias.tipo_garantia;
        if (tipo === "veiculo" || tipo === "imovel") {
          const novoTipo = tipo === "veiculo" ? "vehicle" : "real_estate";
          data.garantias = [{
            ...(novoTipo === "vehicle" ? EMPTY_VEHICLE_ASSET : EMPTY_REAL_ESTATE_ASSET),
            description: data.garantias.descricao_detalhada || "",
            tipo: novoTipo,
          }];
        } else {
          data.garantias = [];
        }
      }
      if (!Array.isArray(data.garantias)) data.garantias = [];

      // 🚀 Pré-seleção do credor por nome similar — quando a IA conseguir
      // extrair `credor_divida`, tentamos casar com a lista local. Match
      // exato (case/diacritic-insensitive) tem prioridade; senão pegamos o
      // primeiro registro que contenha o termo.
      const extractedName: string = (data.dados_basicos?.credor_divida || "").trim();
      if (extractedName && consignors.length) {
        const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const target = norm(extractedName);
        const exact = consignors.find(c => norm(c.name || "") === target);
        const partial = exact ?? consignors.find(c => norm(c.name || "").includes(target) || target.includes(norm(c.name || "")));
        if (partial) {
          setSelectedConsignor(partial);
          data.dados_basicos = {
            ...(data.dados_basicos || {}),
            consignor_id: partial.id,
            credor_divida: partial.name,
          };
        }
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
      // O backend espera `consignor_id` no nível raiz (mesma convenção da
      // tela de Contracts). Promovemos o ID do estado React (fonte da
      // verdade do select) ou — como fallback — o que estiver embutido no
      // bloco `dados_basicos` (caso o usuário tenha trocado a aba após
      // selecionar e o estado tenha sido espelhado lá).
      const cid = selectedConsignor?.id ?? payload?.dados_basicos?.consignor_id;
      if (cid) {
        payload.consignor_id = Number(cid);
      }

      await api.post("/api/ai-ingestion/save", payload);
      toast.success("Ecosistema integrado gravado com sucesso!");
      setExtractedData(null);
      setFile(null);
      setSelectedConsignor(null);
    } catch (err: any) {
      const apiMessage =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message;
      toast.error(
        apiMessage
          ? `Falha ao salvar: ${apiMessage}`
          : "Falha ao persistir a ingestão no banco de dados."
      );
      console.error("[AiIngestion@save] erro detalhado:", err?.response?.data ?? err);
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

  // 🚀 Handlers genéricos para qualquer papel pessoal (fiador/codevedor/testemunha).
  //    O front envia exatamente as mesmas chaves para o backend; o que muda é o nó
  //    raiz no payload. Testemunhas usam um schema enxuto (só nome/documento/rg).
  const handleAddPerson = (role: PersonRole) => {
    setExtractedData((prev: any) => ({
      ...prev,
      [role]: [
        ...(prev?.[role] || []),
        role === "testemunhas" ? { ...EMPTY_WITNESS } : { ...EMPTY_PERSON },
      ],
    }));
  };

  const handleRemovePerson = (role: PersonRole, idxToRemove: number) => {
    setExtractedData((prev: any) => ({
      ...prev,
      [role]: (prev?.[role] || []).filter((_: any, idx: number) => idx !== idxToRemove),
    }));
  };

  const handleUpdatePersonField = (role: PersonRole, idx: number, field: string, value: any) => {
    setExtractedData((prev: any) => {
      const list = [...(prev?.[role] || [])];
      list[idx] = { ...list[idx], [field]: value };
      return { ...prev, [role]: list };
    });
  };

  // 🚀 Handlers para a aba "Garantias" — cada item é um bem em contract_assets.
  const handleAddAsset = (tipo: "vehicle" | "real_estate") => {
    const template = tipo === "vehicle" ? EMPTY_VEHICLE_ASSET : EMPTY_REAL_ESTATE_ASSET;
    setExtractedData((prev: any) => ({
      ...prev,
      garantias: [...(prev?.garantias || []), { ...template }],
    }));
  };

  const handleRemoveAsset = (idxToRemove: number) => {
    setExtractedData((prev: any) => ({
      ...prev,
      garantias: (prev?.garantias || []).filter((_: any, idx: number) => idx !== idxToRemove),
    }));
  };

  const handleUpdateAssetField = (idx: number, field: string, value: any) => {
    setExtractedData((prev: any) => {
      const list = [...(prev?.garantias || [])];
      list[idx] = { ...list[idx], [field]: value };
      return { ...prev, garantias: list };
    });
  };

  const handleUpdateRule = (field: string, value: any) => {
    setExtractedData((prev: any) => ({
      ...prev,
      regras: { ...(prev?.regras || {}), [field]: value },
    }));
  };

  const isTabInvalid = (tabKey: string): boolean => {
    if (!extractedData) return false;
    switch (tabKey) {
      case "basico":
        return !extractedData.dados_basicos?.cliente_devedor || !extractedData.dados_basicos?.documento || !extractedData.dados_basicos?.data_emissao || !extractedData.dados_basicos?.tipo;
      case "credor":
        // Aceitar tanto consignor_id (vínculo formal) quanto credor_divida
        // (texto livre extraído pela IA) — pelo menos um deles tem que estar
        // presente para o contrato ter um credor identificado.
        return !extractedData.dados_basicos?.consignor_id
            && !extractedData.dados_basicos?.credor_divida;
      case "financeiro":
        return !extractedData.valores?.valor_principal || !extractedData.valores?.numero_parcelas || !extractedData.valores?.valor_parcela || !extractedData.banco?.nome;
      case "taxas":
        return !extractedData.taxas?.juros_mes || !extractedData.taxas?.data_primeiro_vencimento;
      case "fiadores":
        // Fiadores E codevedores compartilham a mesma aba; basta um item inválido em qualquer das duas
        return (extractedData.fiadores || []).some((f: any) => !f.nome || !f.documento)
            || (extractedData.codevedores || []).some((f: any) => !f.nome || !f.documento);
      case "garantias":
        return (extractedData.garantias || []).some((g: any) => {
          if (g.tipo === "vehicle")     return !g.brand || !g.model || !g.plate;
          if (g.tipo === "real_estate") return !g.description;
          return true;
        });
      case "regras":
        // Aba opcional — só sinaliza erro quando alguma testemunha cadastrada
        // estiver com nome ou documento em branco (mesma regra da tela de
        // Contracts, onde testemunhas existem mas não são obrigatórias).
        return (extractedData.testemunhas || []).some((f: any) => !f.nome || !f.documento);
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
        
        {/* BLOCK 1 (ESQUERDA - 30%) — segue o mesmo cabeçalho dark gradient
            do BLOCK 2 para manter unidade visual com o modal de Contratos. */}
        <div style={{ width: "320px", display: "flex", flexDirection: "column", gap: "12px", flexShrink: 0 }}>
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            {/* Header escuro */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                background: "linear-gradient(135deg, #1e2139 0%, #2d3154 100%)",
                color: "white",
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Upload size={14} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Fonte de Entrada</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                  Documento PDF para análise
                </span>
              </div>
            </div>

            <div style={{ padding: "16px" }}>
            <input type="file" id="ai-pdf-uploader" accept=".pdf" onChange={handleFileChange} style={{ display: "none" }} />
              <label
                htmlFor="ai-pdf-uploader"
                style={{
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  padding: "24px 12px",
                  border: `2px dashed ${file ? "#2563eb" : "#cbd5e1"}`,
                  borderRadius: "8px",
                  background: file ? "#eff6ff" : "#f8fafc",
                  transition: "all 0.15s",
                }}
              >
                <Upload size={26} style={{ color: file ? "#2563eb" : "#94a3b8" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#334155", textAlign: "center", wordBreak: "break-all" }}>
                {file ? file.name : "Arraste ou clique para carregar minuta PDF"}
              </span>
                {!file && (
                  <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>
                    Aceita 1 arquivo PDF · Máx. 20 MB
                  </span>
                )}
            </label>

            {file && !loading && !extractedData && (
                <button
                  onClick={handleStartAnalysis}
                  className="btn-primary"
                  style={{
                    marginTop: "12px",
                    width: "100%",
                    padding: "9px",
                    fontSize: 12,
                    fontWeight: 700,
                    background: "linear-gradient(135deg, #1e2139 0%, #4f46e5 100%)",
                    border: "none",
                    borderRadius: "6px",
                    justifyContent: "center",
                  }}
                >
                  <Sparkles size={13} /> Analisar Cláusulas via IA
              </button>
            )}
            </div>
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
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "8px 10px", borderRadius: "6px" }}>
                    <FileCheck size={16} style={{ color: "#16a34a" }} />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#14532d" }}>Leitura Concluída</span>
                    <span style={{ fontSize: "10px", color: "#15803d" }}>Revise as abas à direita</span>
                  </div>
                </div>

                {/* Indicador de campos faltantes — exibe lista de abas com erro */}
                {(() => {
                  const tabs = ["basico", "credor", "financeiro", "taxas", "fiadores", "garantias", "regras"];
                  const labels: Record<string, string> = {
                    basico: "Dados Básicos",
                    credor: "Credor",
                    financeiro: "Valores e Bancos",
                    taxas: "Taxas e Encargos",
                    fiadores: "Fiadores e Codevedores",
                    garantias: "Garantias",
                    regras: "Regras Contratuais",
                  };
                  const invalid = tabs.filter(isTabInvalid);
                  if (invalid.length === 0) {
                    return (
                      <div style={{ padding: "8px 10px", background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 6, fontSize: 10, color: "#1e3a8a", display: "flex", alignItems: "center", gap: 6 }}>
                        <Check size={12} /> Todos os campos obrigatórios preenchidos
                      </div>
                    );
                  }
                  return (
                    <div style={{ padding: "8px 10px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 10, color: "#991b1b", display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                        <AlertCircle size={12} /> Pendências em {invalid.length} aba(s):
                      </span>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {invalid.map(k => <li key={k}>{labels[k]}</li>)}
                      </ul>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* BLOCK 2 (DIREITA - 70%) — replica o visual do modal de Contratos. */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          
          {extractedData ? (
            <>
              {/* Header escuro com gradiente — idêntico ao do modal de Contracts.tsx */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 18px",
                  background: "linear-gradient(135deg, #1e2139 0%, #2d3154 100%)",
                  color: "white",
                  borderBottom: "1px solid #2d3154",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Sparkles size={16} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>
                      Revisão dos Dados Extraídos
                    </span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                      Confirme os campos antes de gravar o contrato no banco
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setExtractedData(null); setSelectedConsignor(null); }}
                  title="Descartar e iniciar nova ingestão"
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

              {/* Barra de abas — idêntica em estilo ao modal de Contratos */}
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  background: "#f8fafc",
                  padding: "8px 12px",
                  borderBottom: "1px solid #e5e7eb",
                  overflowX: "auto",
                  flexWrap: "nowrap",
                  flexShrink: 0,
                }}
              >
                {[
                  { key: "basico",      label: "Dados Básicos",          icon: FileText },
                  { key: "credor",      label: "Credor",                 icon: Landmark },
                  { key: "financeiro",  label: "Valores e Bancos",       icon: CircleDollarSign },
                  { key: "taxas",       label: "Taxas e Encargos",       icon: Percent },
                  { key: "fiadores",    label: "Fiadores e Codevedores", icon: UserCheck },
                  { key: "garantias",   label: "Garantias",              icon: Shield },
                  { key: "regras",      label: "Regras Contratuais",     icon: BookOpen },
                ].map(tab => {
                  const Icon = tab.icon;
                  const active = activeReviewTab === tab.key;
                  const hasError = isTabInvalid(tab.key);
                  return (
                    <button 
                      type="button" 
                      key={tab.key}
                      onClick={() => setActiveReviewTab(tab.key)} 
                      style={{ 
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 12px",
                        fontSize: 11,
                        fontWeight: active ? 700 : 500, 
                        cursor: "pointer",
                        borderRadius: 6,
                        background: active ? "white" : "transparent", 
                        color: hasError ? "#ef4444" : active ? "#1e2139" : "#475569",
                        border: active ? "1px solid #e2e8f0" : "1px solid transparent",
                        boxShadow: active ? "0 1px 2px rgba(15,23,42,0.06)" : "none",
                        whiteSpace: "nowrap",
                        transition: "all 0.1s",
                      }}
                    >
                      <Icon size={12} style={{ color: active ? "#2563eb" : "#94a3b8" }} />
                      {tab.label}
                      {hasError && <AlertCircle size={10} className="text-red-500 animate-pulse" />}
                    </button>
                  );
                })}
              </div>

              {/* Corpo do Formulário — mesmas dimensões e padding do modal de Contracts */}
              <div
                className="sigx-modal-body contracts-modal-body"
                style={{
                  padding: 22,
                  flex: 1,
                  overflowY: "auto",
                  background: "white",
                }}
              >

                {/* TAB 1: DADOS BÁSICOS */}
                {activeReviewTab === "basico" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div style={{ gridColumn: "span 2" }}>
                      <label className="sigx-label">CLIENTE DEVEDOR *</label>
                      <input
                        className="sigx-input"
                        style={getInputStyle(extractedData.dados_basicos?.cliente_devedor)}
                        value={extractedData.dados_basicos?.cliente_devedor || ""}
                        onChange={e => updateNested("dados_basicos", "cliente_devedor", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="sigx-label">CNPJ/CPF *</label>
                      <input
                        className="sigx-input mono"
                        style={getInputStyle(extractedData.dados_basicos?.documento)}
                        value={extractedData.dados_basicos?.documento || ""}
                        onChange={e => updateNested("dados_basicos", "documento", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="sigx-label">CEP</label>
                      <input
                        className="sigx-input mono"
                        value={extractedData.dados_basicos?.cep || ""}
                        onChange={e => updateNested("dados_basicos", "cep", e.target.value)}
                      />
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <label className="sigx-label">ENDEREÇO</label>
                      <input
                        className="sigx-input"
                        value={extractedData.dados_basicos?.endereco || ""}
                        onChange={e => updateNested("dados_basicos", "endereco", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="sigx-label">CÓDIGO INTERNO *</label>
                      <input
                        className="sigx-input mono"
                        value={extractedData.dados_basicos?.codigo_interno || ""}
                        onChange={e => updateNested("dados_basicos", "codigo_interno", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="sigx-label">DATA DE EMISSÃO</label>
                      <input
                        type="date"
                        className="sigx-input"
                        style={getInputStyle(extractedData.dados_basicos?.data_emissao)}
                        value={extractedData.dados_basicos?.data_emissao || ""}
                        onChange={e => updateNested("dados_basicos", "data_emissao", e.target.value)}
                      />
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <label className="sigx-label">NOME OU OBJETO DO CONTRATO</label>
                      <input
                        className="sigx-input"
                        value={extractedData.dados_basicos?.objeto || (extractedData.dados_basicos?.cliente_devedor ? `CONTRATO INTEGRADOR IA - ${extractedData.dados_basicos.cliente_devedor}` : "")}
                        onChange={e => updateNested("dados_basicos", "objeto", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="sigx-label">TIPO ESTRUTURAL *</label>
                      <select
                        className="sigx-input"
                        style={getInputStyle(extractedData.dados_basicos?.tipo)}
                        value={extractedData.dados_basicos?.tipo || ""}
                        onChange={e => updateNested("dados_basicos", "tipo", e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        <option value="Mútuo">Mútuo</option>
                        <option value="Consignado">Consignado</option>
                        <option value="Confissão de Dívida">Confissão de Dívida</option>
                      </select>
                    </div>
                    <div>
                      <label className="sigx-label">STATUS OPERACIONAL DO CONTRATO *</label>
                      <select
                        className="sigx-input"
                        value={extractedData.dados_basicos?.status || "Ativo"}
                        onChange={e => updateNested("dados_basicos", "status", e.target.value)}
                      >
                        <option value="Ativo">Ativo / Regular</option>
                        <option value="Inadimplente">Inadimplente / Jurídico</option>
                        <option value="Quitado">Quitado / Baixado</option>
                        <option value="Renegociado">Renegociado</option>
                        <option value="Cancelado">Cancelado</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* TAB 2: CREDOR — espelha COMPLETAMENTE a aba homônima de Contracts.tsx
                    (banner azul, dica de credor legado, <select> de consignors com
                    busca por nome similar, painel read-only com endereço/telefone). */}
                {activeReviewTab === "credor" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Banner informativo no padrão das outras abas */}
                    <div
                      className="keep-case"
                      style={{
                        padding: "10px 12px",
                        background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)",
                        border: "1px solid #e0e7ff",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: "#2563eb", color: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Landmark size={15} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: 12, color: "#1e2139", display: "block" }}>Credor deste contrato</strong>
                        <span style={{ fontSize: 10.5, color: "#64748b" }}>
                          Escolha um credor cadastrado em "Credores". O endereço e os contatos serão exibidos abaixo apenas para conferência.
                        </span>
                      </div>
                      {selectedConsignor && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#065f46", background: "#ecfdf5", padding: "3px 8px", borderRadius: 6, border: "1px solid #a7f3d0" }}>
                          ✓ VINCULADO
                        </span>
                      )}
                    </div>

                    {/* Dica de credor legado — exibe o nome textual extraído do PDF
                        quando o operador ainda não vinculou um consignor cadastrado. */}
                    {!selectedConsignor && extractedData.dados_basicos?.credor_divida && (
                      <div
                        style={{
                          padding: "10px 12px",
                          background: "#fffbeb",
                          border: "1px solid #fde68a",
                          borderRadius: 8,
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 28, height: 28,
                            borderRadius: 6,
                            background: "#f59e0b",
                            color: "white",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                            fontWeight: 700,
                            fontSize: 14,
                          }}
                        >
                          !
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ fontSize: 11, color: "#92400e", display: "block", marginBottom: 2 }}>
                            Credor extraído do PDF (texto livre):
                          </strong>
                          <span
                            style={{
                              display: "inline-block",
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#0f172a",
                              background: "white",
                              padding: "3px 10px",
                              borderRadius: 4,
                              border: "1px solid #fde68a",
                              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                            }}
                          >
                            {extractedData.dados_basicos.credor_divida}
                          </span>
                          <div style={{ fontSize: 10.5, color: "#a16207", marginTop: 4, lineHeight: 1.4 }}>
                            Selecione o credor correspondente no campo abaixo para vincular formalmente.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Select nativo de credor — espelha o <select> da tela de
                        Contracts. O HTML5 já oferece busca incremental ao digitar
                        com o select aberto, então não precisamos de input próprio. */}
                    <div>
                      <label className="sigx-label" style={{ marginBottom: 4, display: "block" }}>
                        CREDOR{" "}
                        <span style={{ fontWeight: 400, color: "#94a3b8" }}>
                          ({consignors.length} disponíve{consignors.length === 1 ? "l" : "is"})
                        </span>
                      </label>
                      <select
                        className="sigx-input"
                        style={getInputStyle(selectedConsignor?.id)}
                        value={String(selectedConsignor?.id || "")}
                        onChange={(e) => handleSelectConsignor(Number(e.target.value))}
                      >
                        <option value="">— Sem credor vinculado —</option>
                        {consignors.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {c.document ? ` — ${formatConsignorDocument(c.document)}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Dados Gerais — read-only quando há credor selecionado */}
                    {selectedConsignor && (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                            <label className="sigx-label" style={{ marginBottom: 4, display: "block" }}>TELEFONE</label>
                            <input className="sigx-input" disabled readOnly value={selectedConsignor.phone ?? "—"} />
                    </div>
                    <div>
                            <label className="sigx-label" style={{ marginBottom: 4, display: "block" }}>E-MAIL</label>
                            <input className="sigx-input" disabled readOnly value={selectedConsignor.email ?? "—"} />
                    </div>
                  </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569", fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginTop: 4 }}>
                          <MapPin size={13} /> Endereço do Credor
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                          <div>
                            <label className="sigx-label" style={{ marginBottom: 4, display: "block" }}>CEP</label>
                            <input className="sigx-input mono" disabled readOnly value={selectedConsignor.zipCode ? maskCEP(selectedConsignor.zipCode) : "—"} />
                          </div>
                          <div style={{ gridColumn: "span 2" }}>
                            <label className="sigx-label" style={{ marginBottom: 4, display: "block" }}>RUA</label>
                            <input className="sigx-input" disabled readOnly value={selectedConsignor.street ?? "—"} />
                          </div>
                          <div>
                            <label className="sigx-label" style={{ marginBottom: 4, display: "block" }}>NÚMERO</label>
                            <input className="sigx-input" disabled readOnly value={selectedConsignor.number ?? "—"} />
                          </div>
                          <div>
                            <label className="sigx-label" style={{ marginBottom: 4, display: "block" }}>BAIRRO</label>
                            <input className="sigx-input" disabled readOnly value={selectedConsignor.neighborhood ?? "—"} />
                          </div>
                          <div>
                            <label className="sigx-label" style={{ marginBottom: 4, display: "block" }}>COMPLEMENTO</label>
                            <input className="sigx-input" disabled readOnly value={selectedConsignor.complement ?? "—"} />
                          </div>
                          <div style={{ gridColumn: "span 2" }}>
                            <label className="sigx-label" style={{ marginBottom: 4, display: "block" }}>CIDADE</label>
                            <input className="sigx-input" disabled readOnly value={selectedConsignor.city ?? "—"} />
                          </div>
                          <div>
                            <label className="sigx-label" style={{ marginBottom: 4, display: "block" }}>ESTADO (UF)</label>
                            <input className="sigx-input" disabled readOnly value={selectedConsignor.state ?? "—"} />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Estado vazio quando ainda não há credor selecionado */}
                    {!selectedConsignor && (
                      <div
                        style={{
                          border: "1px dashed #cbd5e1",
                          borderRadius: 8,
                          padding: 28,
                          background: "#f8fafc",
                          textAlign: "center",
                          color: "#94a3b8",
                        }}
                      >
                        <Landmark size={26} style={{ opacity: 0.3, margin: "0 auto 6px", display: "block" }} />
                        <span style={{ fontSize: 11.5 }}>
                          Nenhum credor vinculado. Use o campo de busca acima para selecionar um cadastrado em "Credores".
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: FINANCEIRO — valores + conta de destino (mesmo layout de Contracts) */}
                {activeReviewTab === "financeiro" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
                      <div>
                        <label className="sigx-label">VALOR PRINCIPAL (R$) *</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="sigx-input mono"
                          placeholder="0,00"
                          style={getInputStyle(extractedData.valores?.valor_principal)}
                          value={maskMoneyDisplay(extractedData.valores?.valor_principal)}
                          onChange={e => updateNested("valores", "valor_principal", maskMoneyParse(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="sigx-label">VALOR FINANCIADO (R$)</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="sigx-input mono"
                          placeholder="0,00"
                          value={maskMoneyDisplay(extractedData.valores?.valor_financiado)}
                          onChange={e => updateNested("valores", "valor_financiado", maskMoneyParse(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="sigx-label">Nº DE PARCELAS *</label>
                        <input
                          type="number"
                          className="sigx-input"
                          style={getInputStyle(extractedData.valores?.numero_parcelas)}
                          value={extractedData.valores?.numero_parcelas || ""}
                          onChange={e => updateNested("valores", "numero_parcelas", parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <label className="sigx-label">VALOR DA PARCELA (R$) *</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="sigx-input mono"
                          placeholder="0,00"
                          style={getInputStyle(extractedData.valores?.valor_parcela)}
                          value={maskMoneyDisplay(extractedData.valores?.valor_parcela)}
                          onChange={e => updateNested("valores", "valor_parcela", maskMoneyParse(e.target.value))}
                        />
                      </div>
                    </div>

                    <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: 14 }}>
                      <label className="sigx-label" style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 700, color: "#1e293b" }}>
                        <CreditCard size={13} /> CONTA DE DESTINO PARA LIQUIDAÇÃO
                      </label>
                      <span style={{ fontSize: 11, color: "#64748b", marginBottom: 10, display: "block" }}>
                        Conta bancária do credor extraída do PDF — será cadastrada como conta principal do cliente devedor:
                      </span>

                      {/* Card único da conta extraída — segue o estilo dos cards de bankAccount em Contracts */}
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 6,
                          border: "2px solid #2563eb",
                          background: "#eff6ff",
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 12,
                        }}
                      >
                    <div style={{ gridColumn: "span 2" }}>
                          <label className="sigx-label">NOME DO BANCO *</label>
                          <input
                            className="sigx-input"
                            style={getInputStyle(extractedData.banco?.nome)}
                            value={extractedData.banco?.nome || ""}
                            onChange={e => updateNested("banco", "nome", e.target.value)}
                            placeholder="Ex.: BANCO ITAÚ S.A."
                          />
                    </div>
                    <div>
                      <label className="sigx-label">AGÊNCIA</label>
                          <input
                            className="sigx-input mono"
                            value={extractedData.banco?.agencia || ""}
                            onChange={e => updateNested("banco", "agencia", e.target.value)}
                          />
                    </div>
                    <div>
                          <label className="sigx-label">NÚMERO DA CONTA *</label>
                          <input
                            className="sigx-input mono"
                            style={getInputStyle(extractedData.banco?.conta)}
                            value={extractedData.banco?.conta || ""}
                            onChange={e => updateNested("banco", "conta", e.target.value)}
                          />
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                          <label className="sigx-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <QrCode size={11} style={{ color: "#0d9488" }} /> CHAVE PIX DE REPASSE
                          </label>
                          <input
                            className="sigx-input mono"
                            value={extractedData.banco?.pix || ""}
                            onChange={e => updateNested("banco", "pix", e.target.value)}
                            placeholder="CPF/CNPJ, e-mail, celular ou chave aleatória"
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div>
                        <label className="sigx-label">VALOR DO IOF (R$)</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="sigx-input mono"
                          placeholder="0,00"
                          value={maskMoneyDisplay(extractedData.valores?.iof)}
                          onChange={e => updateNested("valores", "iof", maskMoneyParse(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: TAXAS E ENCARGOS — mesmo grid 3x2 do modal de Contracts */}
                {activeReviewTab === "taxas" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                    <div>
                        <label className="sigx-label">INDEXADOR DE CORREÇÃO MONETÁRIA</label>
                        <select
                          className="sigx-input"
                          value={extractedData.taxas?.correcao_monetaria || "PRE"}
                          onChange={e => updateNested("taxas", "correcao_monetaria", e.target.value)}
                        >
                          <option value="PRE">Pré-fixado (Sem Correção)</option>
                          <option value="IPCA">IPCA (IBGE - Inflação Oficial)</option>
                          <option value="IGPM">IGP-M (FGV - Mercado)</option>
                        </select>
                    </div>
                    <div>
                      <label className="sigx-label">DATA DO 1º VENCIMENTO</label>
                        <input
                          type="date"
                          className="sigx-input"
                          style={getInputStyle(extractedData.taxas?.data_primeiro_vencimento)}
                          value={extractedData.taxas?.data_primeiro_vencimento || ""}
                          onChange={e => updateNested("taxas", "data_primeiro_vencimento", e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="sigx-label" style={{ color: "#2563eb", fontWeight: 700 }}>TARIFA DE ESTRUTURAÇÃO (TAC R$)</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="sigx-input mono"
                          style={{ borderColor: "#2563eb" }}
                          placeholder="0,00"
                          value={maskMoneyDisplay(extractedData.taxas?.tac)}
                          onChange={e => updateNested("taxas", "tac", maskMoneyParse(e.target.value))}
                        />
                    </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, borderTop: "1px dashed #e2e8f0", paddingTop: 14 }}>
                    <div>
                        <label className="sigx-label">JUROS REMUNERATÓRIOS MENSAL (%)</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="sigx-input mono"
                          placeholder="0,00"
                          style={getInputStyle(extractedData.taxas?.juros_mes)}
                          value={maskPercentInputDisplay(extractedData.taxas?.juros_mes)}
                          onChange={e => updateNested("taxas", "juros_mes", maskPercentInputParse(e.target.value))}
                        />
                    </div>
                    <div>
                        <label className="sigx-label">MORA MENSAL (ATRASO) (%)</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="sigx-input mono"
                          placeholder="0,00"
                          value={maskPercentInputDisplay(extractedData.taxas?.mora_mes)}
                          onChange={e => updateNested("taxas", "mora_mes", maskPercentInputParse(e.target.value))}
                        />
                    </div>
                    <div>
                      <label className="sigx-label">MULTA PENAL POR ATRASO (%)</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="sigx-input mono"
                          placeholder="0,00"
                          value={maskPercentInputDisplay(extractedData.taxas?.multa_atraso)}
                          onChange={e => updateNested("taxas", "multa_atraso", maskPercentInputParse(e.target.value))}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                      <div>
                        <label className="sigx-label">HONORÁRIOS ADVOCATÍCIOS (%)</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="sigx-input mono"
                          placeholder="0,00"
                          value={maskPercentInputDisplay(extractedData.taxas?.honorarios)}
                          onChange={e => updateNested("taxas", "honorarios", maskPercentInputParse(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 5: FIADORES + CODEVEDORES — sub-abas controladas localmente
                    (mesmo padrão visual de Contracts.tsx — botões em pílula com
                    contador, fundo escuro quando ativos). */}
                {activeReviewTab === "fiadores" && (() => {
                  const isFiador = vinculoTabActive === "FIADOR";
                  const role: PersonRole = isFiador ? "fiadores" : "codevedores";
                  const list = (extractedData?.[role] || []) as any[];
                  const fiadoresCount = (extractedData?.fiadores || []).length;
                  const codevedoresCount = (extractedData?.codevedores || []).length;

                  const subTabBase: React.CSSProperties = {
                    flex: 1,
                    padding: "8px 12px",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    cursor: "pointer",
                    border: "1px solid #cbd5e1",
                    background: "white",
                    color: "#475569",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  };
                  const subTabActive: React.CSSProperties = {
                    background: "rgb(30, 58, 95)",
                    color: "white",
                    borderColor: "rgb(30, 58, 95)",
                  };

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden" }}>
                      <button 
                        type="button" 
                          onClick={() => setVinculoTabActive("FIADOR")}
                          style={{
                            ...subTabBase,
                            borderTopLeftRadius: 6,
                            borderBottomLeftRadius: 6,
                            ...(isFiador ? subTabActive : {}),
                          }}
                        >
                          <UserCheck size={12} /> Fiadores
                          <span style={{ marginLeft: 4, fontSize: 10, background: isFiador ? "rgba(255,255,255,0.22)" : "#e2e8f0", padding: "1px 7px", borderRadius: 10 }}>
                            {fiadoresCount}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVinculoTabActive("CODEVEDOR")}
                          style={{
                            ...subTabBase,
                            borderTopRightRadius: 6,
                            borderBottomRightRadius: 6,
                            borderLeft: "none",
                            ...(!isFiador ? subTabActive : {}),
                          }}
                        >
                          <Scale size={12} /> Codevedores
                          <span style={{ marginLeft: 4, fontSize: 10, background: !isFiador ? "rgba(255,255,255,0.22)" : "#e2e8f0", padding: "1px 7px", borderRadius: 10 }}>
                            {codevedoresCount}
                          </span>
                      </button>
                    </div>

                      {/* Botão de adicionar — segue o padrão "Adicionar Garantia" da aba Garantias em Contracts */}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => handleAddPerson(role)}
                          className="btn-primary"
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 11 }}
                        >
                          <Plus size={12} /> Adicionar {isFiador ? "Fiador" : "Codevedor"}
                        </button>
                      </div>

                      {/* Tabela compacta — mesma estilização da tabela de Garantias em Contracts.tsx */}
                      <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", background: "white" }}>
                        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 11 }}>
                          <thead>
                            <tr style={{ background: "#f1f5f9" }}>
                              <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 80 }}>Tipo</th>
                              <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Nome</th>
                              <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 180 }}>Documento</th>
                              <th style={{ padding: "7px 10px", textAlign: "center", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 80 }}>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {list.length === 0 ? (
                              <tr>
                                <td colSpan={4} style={{ padding: 28, textAlign: "center", color: "#94a3b8" }}>
                                  {isFiador ? <UserCheck size={24} style={{ opacity: 0.3, margin: "0 auto 6px", display: "block" }} /> : <Scale size={24} style={{ opacity: 0.3, margin: "0 auto 6px", display: "block" }} />}
                                  <span style={{ fontSize: 11.5 }}>
                                    Nenhum {isFiador ? "fiador" : "codevedor"} vinculado. Use o botão acima para adicionar.
                                  </span>
                                </td>
                              </tr>
                            ) : list.map((p: any, idx: number) => {
                              const isPJ = p.personType === "PJ";
                              return (
                                <tr key={idx} style={{ background: idx % 2 === 1 ? "#fafafa" : "white" }}>
                                  <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9" }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: isPJ ? "#fef3c7" : "#dbeafe", color: isPJ ? "#92400e" : "#1e40af" }}>
                                      {isPJ ? "PJ" : "PF"}
                                    </span>
                                  </td>
                                  <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", fontWeight: 600, color: "#0f172a" }}>
                                    {p.nome || <span style={{ color: "#ef4444", fontWeight: 700 }}>(sem nome)</span>}
                                  </td>
                                  <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", color: "#475569", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5 }}>
                                    {p.documento || "—"}
                                  </td>
                                  <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", textAlign: "center" }}>
                                    <button type="button" className="btn-icon" title="Remover" style={{ color: "#dc2626" }} onClick={() => handleRemovePerson(role, idx)}>
                                      <Trash2 size={11} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Cards de edição — um por item, com layout idêntico aos formulários de Contracts */}
                      {list.map((p: any, idx: number) => (
                        <div key={`edit-${idx}`} style={{ padding: 14, border: "1px solid #cbd5e1", borderRadius: 8, background: "#fafbfc" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 8, borderBottom: "1px dashed #e2e8f0" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.04em" }}>
                              {isFiador ? "FIADOR" : "CODEVEDOR"} #{idx + 1} {p.nome ? `— ${p.nome}` : ""}
                            </span>
                            <button type="button" onClick={() => handleRemovePerson(role, idx)} className="btn-icon" style={{ color: "#dc2626" }} title="Remover do contrato">
                              <Trash2 size={12} />
                            </button>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 10 }}>
                            <div>
                              <label className="sigx-label">TIPO DE PESSOA *</label>
                              <select className="sigx-input" value={p.personType || "PF"} onChange={e => handleUpdatePersonField(role, idx, "personType", e.target.value)}>
                                <option value="PF">Pessoa Física</option>
                                <option value="PJ">Pessoa Jurídica</option>
                              </select>
                            </div>
                            <div>
                              <label className="sigx-label">{p.personType === "PJ" ? "RAZÃO SOCIAL *" : "NOME COMPLETO *"}</label>
                              <input className="sigx-input" style={getInputStyle(p.nome)} value={p.nome || ""} onChange={e => handleUpdatePersonField(role, idx, "nome", e.target.value)} />
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
                            <div>
                              <label className="sigx-label">{p.personType === "PJ" ? "CNPJ *" : "CPF *"}</label>
                              <input className="sigx-input mono" style={getInputStyle(p.documento)} value={p.documento || ""} onChange={e => handleUpdatePersonField(role, idx, "documento", e.target.value)} />
                            </div>
                            {p.personType === "PJ" ? (
                              <div>
                                <label className="sigx-label">NOME FANTASIA</label>
                                <input className="sigx-input" value={p.tradeName || ""} onChange={e => handleUpdatePersonField(role, idx, "tradeName", e.target.value)} />
                      </div>
                    ) : (
                              <div>
                                <label className="sigx-label">RG</label>
                                <input className="sigx-input mono" value={p.rg || ""} onChange={e => handleUpdatePersonField(role, idx, "rg", e.target.value)} />
                              </div>
                            )}
                          </div>

                          {p.personType !== "PJ" && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
                              <div>
                                <label className="sigx-label">NACIONALIDADE</label>
                                <input className="sigx-input" value={p.nacionalidade || "Brasileiro"} onChange={e => handleUpdatePersonField(role, idx, "nacionalidade", e.target.value)} />
                              </div>
                              <div>
                                <label className="sigx-label">ESTADO CIVIL</label>
                                <select className="sigx-input" value={p.estado_civil || "Não informado"} onChange={e => handleUpdatePersonField(role, idx, "estado_civil", e.target.value)}>
                                  <option value="Não informado">Não informado</option>
                                  <option value="Solteiro(a)">Solteiro(a)</option>
                                  <option value="Casado(a)">Casado(a)</option>
                                  <option value="União Estável">União Estável</option>
                                  <option value="Divorciado(a)">Divorciado(a)</option>
                                  <option value="Viúvo(a)">Viúvo(a)</option>
                                  <option value="Separado(a)">Separado(a)</option>
                                </select>
                              </div>
                            </div>
                          )}

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
                            <div>
                              <label className="sigx-label">EMAIL</label>
                              <input type="email" className="sigx-input" value={p.email || ""} onChange={e => handleUpdatePersonField(role, idx, "email", e.target.value)} />
                            </div>
                            <div>
                              <label className="sigx-label">TELEFONE</label>
                              <input className="sigx-input mono" value={p.telefone || ""} onChange={e => handleUpdatePersonField(role, idx, "telefone", e.target.value)} />
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569", fontSize: 11, fontWeight: 700, textTransform: "uppercase", margin: "6px 0 4px" }}>
                            <MapPin size={13} /> Endereço
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                            <div>
                              <label className="sigx-label">CEP</label>
                              <input className="sigx-input mono" value={p.cep || ""} onChange={e => handleUpdatePersonField(role, idx, "cep", e.target.value)} />
                            </div>
                            <div style={{ gridColumn: "span 2" }}>
                              <label className="sigx-label">RUA</label>
                              <input className="sigx-input" value={p.rua || ""} onChange={e => handleUpdatePersonField(role, idx, "rua", e.target.value)} />
                            </div>
                            <div>
                              <label className="sigx-label">NÚMERO</label>
                              <input className="sigx-input" value={p.numero || ""} onChange={e => handleUpdatePersonField(role, idx, "numero", e.target.value)} />
                            </div>
                            <div>
                              <label className="sigx-label">BAIRRO</label>
                              <input className="sigx-input" value={p.bairro || ""} onChange={e => handleUpdatePersonField(role, idx, "bairro", e.target.value)} />
                            </div>
                            <div>
                              <label className="sigx-label">COMPLEMENTO</label>
                              <input className="sigx-input" value={p.complemento || ""} onChange={e => handleUpdatePersonField(role, idx, "complemento", e.target.value)} />
                            </div>
                            <div style={{ gridColumn: "span 2" }}>
                              <label className="sigx-label">CIDADE</label>
                              <input className="sigx-input" value={p.cidade || ""} onChange={e => handleUpdatePersonField(role, idx, "cidade", e.target.value)} />
                            </div>
                            <div>
                              <label className="sigx-label">ESTADO (UF)</label>
                              <input className="sigx-input mono" maxLength={2} value={p.uf || ""} onChange={e => handleUpdatePersonField(role, idx, "uf", e.target.value.toUpperCase())} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}


                {/* TAB 6: GARANTIAS — tabela compacta + cards de edição abaixo
                    (mesmo padrão visual da aba de Garantias em Contracts.tsx). */}
                {activeReviewTab === "garantias" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                            <button 
                              type="button" 
                        onClick={() => handleAddAsset("vehicle")}
                        className="btn-primary"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 11 }}
                      >
                        <Car size={12} /> Adicionar Veículo
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddAsset("real_estate")}
                        className="btn-secondary"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 11, background: "#0d9488", color: "white", border: "none" }}
                      >
                        <Home size={12} /> Adicionar Imóvel
                      </button>
                    </div>

                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", background: "white" }}>
                      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9" }}>
                            <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 90 }}>Tipo</th>
                            <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Identificação</th>
                            <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 220 }}>Detalhe</th>
                            <th style={{ padding: "7px 10px", textAlign: "center", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 80 }}>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(extractedData.garantias || []).length === 0 ? (
                            <tr>
                              <td colSpan={4} style={{ padding: 28, textAlign: "center", color: "#94a3b8" }}>
                                <Shield size={24} style={{ opacity: 0.3, margin: "0 auto 6px", display: "block" }} />
                                <span style={{ fontSize: 11.5 }}>
                                  Nenhum bem vinculado. Use os botões acima para adicionar.
                                </span>
                              </td>
                            </tr>
                          ) : (extractedData.garantias || []).map((a: any, idx: number) => {
                            const isVehicle = a.tipo === "vehicle";
                            const Icon = isVehicle ? Car : Home;
                            const title = isVehicle
                              ? [a.brand, a.model].filter(Boolean).join(" ") || "(sem identificação)"
                              : a.description || "(sem descrição)";
                            const detail = isVehicle
                              ? [a.plate, a.modelYear || a.manufactureYear].filter(Boolean).join(" · ")
                              : [a.location, a.registryNumber].filter(Boolean).join(" · ");
                            return (
                              <tr key={idx} style={{ background: idx % 2 === 1 ? "#fafafa" : "white" }}>
                                <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9" }}>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: isVehicle ? "#ecfdf5" : "#eff6ff", color: isVehicle ? "#065f46" : "#1e40af" }}>
                                    <Icon size={10} />
                                    {isVehicle ? "Veículo" : "Imóvel"}
                                  </span>
                                </td>
                                <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", fontWeight: 600, color: "#0f172a" }}>
                                  {title}
                                </td>
                                <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", color: "#475569" }}>
                                  {detail || "—"}
                                </td>
                                <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", textAlign: "center" }}>
                                  <button type="button" className="btn-icon" title="Remover" style={{ color: "#dc2626" }} onClick={() => handleRemoveAsset(idx)}>
                                    <Trash2 size={11} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Cards de edição (um por bem) */}
                    {(extractedData.garantias || []).map((g: any, idx: number) => (
                      <div key={`asset-${idx}`} style={{ padding: 14, border: "1px solid #cbd5e1", borderRadius: 8, background: "#fafbfc" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 8, borderBottom: "1px dashed #e2e8f0" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: "0.04em" }}>
                            {g.tipo === "vehicle" ? "VEÍCULO" : "IMÓVEL"} #{idx + 1}
                          </span>
                          <button type="button" onClick={() => handleRemoveAsset(idx)} className="btn-icon" style={{ color: "#dc2626" }} title="Remover bem">
                              <Trash2 size={12} />
                            </button>
                          </div>
                          
                        {g.tipo === "vehicle" ? (
                          <>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 100px", gap: 12, marginBottom: 10 }}>
                            <div>
                                <label className="sigx-label">MARCA *</label>
                                <input className="sigx-input" style={getInputStyle(g.brand)} value={g.brand || ""} onChange={e => handleUpdateAssetField(idx, "brand", e.target.value)} />
                            </div>
                            <div>
                                <label className="sigx-label">MODELO *</label>
                                <input className="sigx-input" style={getInputStyle(g.model)} value={g.model || ""} onChange={e => handleUpdateAssetField(idx, "model", e.target.value)} />
                            </div>
                              <div>
                                <label className="sigx-label">FABRICAÇÃO</label>
                                <input type="number" className="sigx-input mono" value={g.manufactureYear || ""} onChange={e => handleUpdateAssetField(idx, "manufactureYear", e.target.value)} />
                          </div>
                              <div>
                                <label className="sigx-label">ANO MODELO</label>
                                <input type="number" className="sigx-input mono" value={g.modelYear || ""} onChange={e => handleUpdateAssetField(idx, "modelYear", e.target.value)} />
                        </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr", gap: 12 }}>
                              <div>
                                <label className="sigx-label">PLACA *</label>
                                <input className="sigx-input mono" style={getInputStyle(g.plate)} value={g.plate || ""} onChange={e => handleUpdateAssetField(idx, "plate", e.target.value.toUpperCase())} />
                              </div>
                              <div>
                                <label className="sigx-label">RENAVAM</label>
                                <input className="sigx-input mono" value={g.renavam || ""} onChange={e => handleUpdateAssetField(idx, "renavam", e.target.value)} />
                              </div>
                              <div>
                                <label className="sigx-label">CHASSI</label>
                                <input className="sigx-input mono" value={g.chassis || ""} onChange={e => handleUpdateAssetField(idx, "chassis", e.target.value.toUpperCase())} />
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ marginBottom: 10 }}>
                              <label className="sigx-label">DESCRIÇÃO DO IMÓVEL *</label>
                              <input className="sigx-input" style={getInputStyle(g.description)} value={g.description || ""} onChange={e => handleUpdateAssetField(idx, "description", e.target.value)} />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
                              <div>
                                <label className="sigx-label">LOCALIZAÇÃO / ENDEREÇO</label>
                                <input className="sigx-input" value={g.location || ""} onChange={e => handleUpdateAssetField(idx, "location", e.target.value)} />
                              </div>
                              <div>
                                <label className="sigx-label">MATRÍCULA / REGISTRO</label>
                                <input className="sigx-input mono" value={g.registryNumber || ""} onChange={e => handleUpdateAssetField(idx, "registryNumber", e.target.value)} />
                              </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                              <div>
                                <label className="sigx-label">ÁREA TOTAL (m²)</label>
                                <input className="sigx-input mono" value={g.totalArea || ""} onChange={e => handleUpdateAssetField(idx, "totalArea", e.target.value)} />
                              </div>
                              <div>
                                <label className="sigx-label">CONFRONTAÇÕES</label>
                                <input className="sigx-input" value={g.boundaries || ""} onChange={e => handleUpdateAssetField(idx, "boundaries", e.target.value)} />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ))}

                    <div className="keep-case" style={{ fontSize: 10.5, color: "#64748b", lineHeight: 1.5 }}>
                      Bens (veículos e imóveis) são gravados junto com o contrato em uma única transação.
                    </div>
                  </div>
                )}

                {/* TAB 7: REGRAS CONTRATUAIS — espelha EXATAMENTE a aba homônima
                    de Contracts.tsx, contendo apenas três blocos:
                      1) FORO ELEITO DE ELEIÇÃO
                      2) TESTEMUNHAS (cartão com tabela editável)
                      3) OBSERVAÇÕES INTERNAS E HISTÓRICOS */}
                {activeReviewTab === "regras" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* ⚖️ FORO DE ELEIÇÃO JURÍDICA */}
                    <div>
                      <label className="sigx-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Scale size={12} style={{ color: "#0d9488" }} /> FORO ELEITO DE ELEIÇÃO (COMARCA COBRANÇA)
                      </label>
                      <input
                        className="sigx-input"
                        value={extractedData.regras?.foro || ""}
                        onChange={e => handleUpdateRule("foro", e.target.value)}
                        placeholder="Ex: Belo Horizonte / MG"
                      />
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>
                        Define o município jurídico responsável pela resolução de litígios e execução judicial deste ativo.
                      </span>
                    </div>

                    {/* TESTEMUNHAS — cartão branco igual ao da aba Regras em Contracts.tsx */}
                    <div
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: 14,
                        background: "white",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <label className="sigx-label" style={{ margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
                          <Users size={12} style={{ color: "#0d9488" }} /> TESTEMUNHAS
                        </label>
                        <span style={{ fontSize: 10, color: "#64748b" }}>
                          {(extractedData.testemunhas || []).length} vinculada(s)
                        </span>
                      </div>

                      <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", background: "white" }}>
                        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 11 }}>
                          <thead>
                            <tr style={{ background: "#f1f5f9" }}>
                              <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Nome</th>
                              <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 160 }}>CPF</th>
                              <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 140 }}>RG</th>
                              <th style={{ padding: "7px 10px", textAlign: "center", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 80 }}>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(extractedData.testemunhas || []).length === 0 ? (
                              <tr>
                                <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>
                                  <Users size={20} style={{ opacity: 0.3, margin: "0 auto 4px", display: "block" }} />
                                  <span style={{ fontSize: 11 }}>
                                    Nenhuma testemunha vinculada. Use o botão abaixo para adicionar.
                                  </span>
                                </td>
                              </tr>
                            ) : (extractedData.testemunhas || []).map((t: any, idx: number) => (
                              <tr key={idx} style={{ background: idx % 2 === 1 ? "#fafafa" : "white" }}>
                                <td style={{ padding: "6px 10px", borderBottom: "1px solid #f1f5f9" }}>
                                  <input
                                    className="sigx-input"
                                    style={{ ...getInputStyle(t.nome), padding: "4px 6px", fontSize: 11 }}
                                    value={t.nome || ""}
                                    onChange={e => handleUpdatePersonField("testemunhas", idx, "nome", e.target.value)}
                                  />
                                </td>
                                <td style={{ padding: "6px 10px", borderBottom: "1px solid #f1f5f9" }}>
                                  <input
                                    className="sigx-input mono"
                                    style={{ ...getInputStyle(t.documento), padding: "4px 6px", fontSize: 11 }}
                                    value={t.documento || ""}
                                    onChange={e => handleUpdatePersonField("testemunhas", idx, "documento", e.target.value)}
                                  />
                                </td>
                                <td style={{ padding: "6px 10px", borderBottom: "1px solid #f1f5f9" }}>
                                  <input
                                    className="sigx-input mono"
                                    style={{ padding: "4px 6px", fontSize: 11 }}
                                    value={t.rg || ""}
                                    onChange={e => handleUpdatePersonField("testemunhas", idx, "rg", e.target.value)}
                                  />
                                </td>
                                <td style={{ padding: "6px 10px", borderBottom: "1px solid #f1f5f9", textAlign: "center" }}>
                                  <button type="button" className="btn-icon" title="Remover" style={{ color: "#dc2626" }} onClick={() => handleRemovePerson("testemunhas", idx)}>
                                    <Trash2 size={11} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ display: "flex" }}>
                        <button
                          type="button"
                          onClick={() => handleAddPerson("testemunhas")}
                          className="btn-primary"
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 11 }}
                        >
                          <Plus size={12} /> Adicionar Testemunha
                        </button>
                      </div>
                    </div>

                    {/* OBSERVAÇÕES INTERNAS E HISTÓRICOS */}
                    <div>
                      <label className="sigx-label">OBSERVAÇÕES INTERNAS E HISTÓRICOS</label>
                      <textarea
                        className="sigx-input"
                        rows={4}
                        value={extractedData.regras?.observacoes || ""}
                        onChange={e => handleUpdateRule("observacoes", e.target.value)}
                      />
                    </div>
                  </div>
                )}

              </div>

              {/* Footer com botões — espelha o rodapé do modal de Contratos */}
              <div
                style={{
                  padding: "12px 22px",
                  borderTop: "1px solid #e5e7eb",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  background: "#f8fafc",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>
                  Os campos marcados com <b style={{ color: "#ef4444" }}>*</b> são obrigatórios para gravar o contrato
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => { setExtractedData(null); setSelectedConsignor(null); }}
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmIngestion}
                    disabled={submitting}
                    className="btn-primary"
                    style={{ minWidth: 180, justifyContent: "center", background: "#16a34a", border: "none" }}
                  >
                    <Check size={14} /> {submitting ? "Salvando..." : "Confirmar e Salvar Tudo"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            // Estado vazio — mantém o mesmo visual de Contracts (área central com ícone)
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#94a3b8", padding: 32, background: "#fafbfc" }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: "white", border: "1px dashed #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={28} style={{ color: "#94a3b8" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>Nenhum contrato em revisão</span>
                <span style={{ fontSize: 11, fontWeight: 500, textAlign: "center" }}>
                  Carregue um PDF na coluna esquerda e clique em <b>Analisar Cláusulas via IA</b> para começar.
                </span>
              </div>
            </div>
          )}
        </div>

      </div>
    </UnyPayLayout>
  );
}