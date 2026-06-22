import { useState, useEffect } from "react";
import { Head } from "@inertiajs/react";
import {
  Upload, Sparkles, FileText, RefreshCw,
  CircleDollarSign, Landmark, Percent, Shield, Car, Check, FileCheck, AlertCircle,
  Users, UserCheck, BookOpen, Home, X, Scale, CreditCard, QrCode, MapPin,
  Edit2, Eye, Trash2, Plus,
} from "lucide-react";
import { toast } from "sonner";
import UnyPayLayout from "../Components/UnyPayLayout";
import VinculoPessoaList, {
  VinculoPessoaItem,
  VinculoPessoaType,
} from "../Components/VinculoPessoaList";
import GuarantorQuickCreateModal, { QuickCreateMode } from "../Components/GuarantorQuickCreateModal";
import GuarantorSearchModal, { GuarantorLite } from "../Components/GuarantorSearchModal";
import AssetQuickCreateModal, { AssetModalMode } from "../Components/AssetQuickCreateModal";
import ConsignorFormModal from "../Components/ConsignorFormModal";
import {
  GuarantorFormValues,
  EMPTY_GUARANTOR_FORM,
  maskCPF,
  maskCNPJ,
  maskCEP,
  onlyDigits,
} from "../Components/GuarantorFormFields";
import {
  AssetFormValues,
  EMPTY_ASSET_FORM,
  maskArea,
} from "../Components/AssetFormFields";
import { maskDocument, findGuarantorByDocument } from "../lib/documentValidation";
import {
  getEmptyFieldStyle,
  getAssetEmptyFieldLabels,
  isAssetItemIncomplete,
  isPersonItemIncomplete,
  isPersonItemInvalid,
  hasAnyEmptyField,
  missingFieldBadgeStyle,
} from "../lib/formValidation";
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
  bankAccounts?: { id: number; bankName: string; agency: string | null; accountNumber: string | null; accountType: string; pixKey: string | null }[];
}

const mapConsignorLite = (c: any): ConsignorLite => ({
  id: Number(c.id),
  name: c.name ?? "",
  document: c.document ?? null,
  phone: c.phone ?? null,
  email: c.email ?? null,
  street: c.street ?? null,
  number: c.number ?? null,
  neighborhood: c.neighborhood ?? null,
  zipCode: c.zipCode ?? null,
  complement: c.complement ?? null,
  city: c.city ?? null,
  state: c.state ?? null,
  bankAccounts: Array.isArray(c.bankAccounts) ? c.bankAccounts : [],
});

interface AiIngestionProps {
  contractTypes: any[];
  existingClients: any[];
  consignors: ConsignorLite[];
}

/* ────────────────────────────────────────────────────────────────────────────
 * 🚀 Tipos espelhados da tela de Contratos.
 *
 * Para garantir total paridade visual e comportamental com Contracts.tsx,
 * usamos as MESMAS estruturas de dados e os MESMOS componentes
 * (VinculoPessoaList / GuarantorQuickCreateModal / GuarantorSearchModal /
 * AssetQuickCreateModal).
 *
 * `ContractGuarantor` representa um vínculo pessoa↔contrato em memória.
 *   - isFromDb=true  → veio do banco (apenas remove permitido)
 *   - isFromDb=false → adicionado on-the-fly via modal; é editável e
 *                       será persistido quando a ingestão for confirmada.
 *
 * `ContractAssetItem` representa um bem em garantia em memória.
 * ──────────────────────────────────────────────────────────────────────── */

type ContractGuarantor = {
  localId: string;
  id?: number;
  isFromDb: boolean;
  name: string;
  personType: "PF" | "PJ";
  document: string | null;
  formValues?: GuarantorFormValues;
};

type ContractAssetItem = AssetFormValues & {
  localId: string;
  id?: number;
};

const newLocalId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `g-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

/* ────────────────────────────────────────────────────────────────────────────
 * 🚀 Conversores entre o formato "legado da IA" e o formato canônico da UI.
 *
 * A IA devolve pessoas como objetos com chaves em português
 * (`nome`/`documento`/`rua`/...) e bens com `tipo` em vez de `assetType`.
 * Para reusar exatamente os mesmos componentes da tela de Contratos,
 * fazemos uma tradução bidirecional aqui.
 * ──────────────────────────────────────────────────────────────────────── */

const personTypeFromDoc = (doc: string): "PF" | "PJ" =>
  onlyDigits(doc).length > 11 ? "PJ" : "PF";

/** AI → ContractGuarantor (com formValues pré-preenchidos). */
const aiPersonToContractGuarantor = (p: any): ContractGuarantor => {
  const rawDoc = String(p?.documento ?? "");
  const personType: "PF" | "PJ" = p?.personType === "PJ"
    ? "PJ"
    : p?.personType === "PF"
      ? "PF"
      : personTypeFromDoc(rawDoc);

  const formValues: GuarantorFormValues = {
    ...EMPTY_GUARANTOR_FORM,
    personType,
    name: String(p?.nome ?? p?.name ?? ""),
    email: String(p?.email ?? ""),
    phone: String(p?.telefone ?? p?.phone ?? ""),
    nationality: String(p?.nacionalidade ?? p?.nationality ?? (personType === "PF" ? "Brasileiro" : "")),
    // 🚀 Default "Não Informado" quando a IA não extrai o estado civil
    // (regra de negócio: nova pessoa sem estado civil entra como tal).
    maritalStatus: String(p?.estado_civil ?? p?.maritalStatus ?? "") || "Não Informado",
    cpf: personType === "PF" ? maskCPF(rawDoc) : "",
    rg: String(p?.rg ?? ""),
    cnpj: personType === "PJ" ? maskCNPJ(rawDoc) : "",
    tradeName: String(p?.tradeName ?? ""),
    stateRegistration: String(p?.stateRegistration ?? ""),
    street: String(p?.rua ?? p?.street ?? ""),
    number: String(p?.numero ?? p?.number ?? ""),
    complement: String(p?.complemento ?? p?.complement ?? ""),
    neighborhood: String(p?.bairro ?? p?.neighborhood ?? ""),
    city: String(p?.cidade ?? p?.city ?? ""),
    state: String(p?.uf ?? p?.state ?? "").toUpperCase(),
    zipCode: maskCEP(String(p?.cep ?? p?.zipCode ?? "")),
  };

  return {
    localId: newLocalId(),
    isFromDb: false,
    name: formValues.name,
    personType,
    document: personType === "PJ" ? onlyDigits(formValues.cnpj) : onlyDigits(formValues.cpf),
    formValues,
  };
};

/**
 * Recebe um array de pessoas no formato cru da IA e devolve uma lista de
 * `ContractGuarantor` já deduplicada contra o catálogo do banco.
 *
 * Para cada pessoa:
 *  - Se o documento (CPF/CNPJ) já existe em `guarantors`, a entrada nasce
 *    como `isFromDb=true` com o id correto — equivalente à pessoa ter
 *    sido escolhida via `GuarantorSearchModal`.
 *  - Caso contrário, mantém-se como "Novo" (formValues preenchidos),
 *    para que o operador revise/complete antes do save.
 *
 * Dentro do mesmo array, duplicatas (mesmo documento aparecendo duas
 * vezes na resposta da IA) são colapsadas para uma única entrada.
 */
const dedupeAiPersons = async (arr: any[]): Promise<ContractGuarantor[]> => {
  if (!Array.isArray(arr) || arr.length === 0) return [];

  const seenDbIds = new Set<number>();
  const seenDocs  = new Set<string>();
  const results: ContractGuarantor[] = [];

  // Resolve em paralelo — uma chamada por pessoa, tipicamente <10 itens.
  const matches = await Promise.all(
    arr.map((p) => findGuarantorByDocument(String(p?.documento ?? "")))
  );

  for (let i = 0; i < arr.length; i++) {
    const raw   = arr[i];
    const match = matches[i];
    const docKey = onlyDigits(String(raw?.documento ?? ""));

    if (match) {
      if (seenDbIds.has(match.id)) continue;
      seenDbIds.add(match.id);
      results.push({
        localId: newLocalId(),
        id: match.id,
        isFromDb: true,
        name: match.name,
        personType: match.personType,
        document: match.document,
      });
      continue;
    }

    // Mesmo doc aparecendo 2x na resposta da IA → mantém só a 1ª ocorrência.
    if (docKey && seenDocs.has(docKey)) continue;
    if (docKey) seenDocs.add(docKey);

    results.push(aiPersonToContractGuarantor(raw));
  }

  return results;
};

/** ContractGuarantor → payload no formato esperado pelo AiIngestionController. */
const contractGuarantorToAi = (g: ContractGuarantor) => {
  // Pessoa já cadastrada — manda o id para que o backend pule a busca por
  // documento e reaproveite o registro diretamente.
  if (g.isFromDb && g.id) {
    return {
      id: g.id,
      nome: g.name,
      documento: g.document ?? "",
      personType: g.personType,
    };
  }
  const fv = g.formValues ?? EMPTY_GUARANTOR_FORM;
  return {
    personType: fv.personType,
    nome: fv.name,
    documento: fv.personType === "PJ" ? onlyDigits(fv.cnpj) : onlyDigits(fv.cpf),
    rg: fv.rg || null,
    nacionalidade: fv.nationality || null,
    estado_civil: fv.maritalStatus || null,
    tradeName: fv.tradeName || null,
    stateRegistration: fv.stateRegistration || null,
    email: fv.email?.trim() || null,
    telefone: fv.phone ? onlyDigits(fv.phone) : null,
    cep: fv.zipCode ? onlyDigits(fv.zipCode) : null,
    rua: fv.street || null,
    numero: fv.number || null,
    complemento: fv.complement || null,
    bairro: fv.neighborhood || null,
    cidade: fv.city || null,
    uf: fv.state ? fv.state.toUpperCase() : null,
  };
};

/** AI → ContractAssetItem (totalArea convertida à máscara monetária BR). */
const aiAssetToContractAssetItem = (a: any): ContractAssetItem | null => {
  const tipo = a?.tipo ?? a?.tipo_garantia ?? a?.assetType;
  const assetType: "vehicle" | "real_estate" | null =
    tipo === "vehicle" || tipo === "veiculo" ? "vehicle"
      : tipo === "real_estate" || tipo === "imovel" ? "real_estate"
        : null;
  if (!assetType) return null;

  const base: ContractAssetItem = {
    ...EMPTY_ASSET_FORM,
    localId: newLocalId(),
    assetType,
    brand: String(a?.brand ?? ""),
    model: String(a?.model ?? ""),
    manufactureYear: a?.manufactureYear != null && a.manufactureYear !== ""
      ? String(a.manufactureYear)
      : "",
    modelYear: a?.modelYear != null && a.modelYear !== "" ? String(a.modelYear) : "",
    plate: String(a?.plate ?? ""),
    renavam: String(a?.renavam ?? ""),
    chassis: String(a?.chassis ?? ""),
    description: String(a?.description ?? a?.descricao_detalhada ?? ""),
    location: String(a?.location ?? ""),
    registryNumber: String(a?.registryNumber ?? ""),
    totalArea: a?.totalArea != null && a.totalArea !== ""
      ? maskArea(String(a.totalArea).replace(".", ","))
      : "",
    boundaries: String(a?.boundaries ?? ""),
  };
  return base;
};

/** ContractAssetItem → payload no formato esperado pelo AiIngestionController. */
const contractAssetItemToAi = (a: ContractAssetItem) => {
  const isVehicle = a.assetType === "vehicle";
  const totalAreaNumeric = a.totalArea
    ? Number(a.totalArea.replace(/\./g, "").replace(",", "."))
    : null;
  return {
    tipo: a.assetType,
    ...(isVehicle ? {
      brand: a.brand || null,
      model: a.model || null,
      manufactureYear: a.manufactureYear ? Number(a.manufactureYear) : null,
      modelYear: a.modelYear ? Number(a.modelYear) : null,
      plate: a.plate || null,
      renavam: a.renavam || null,
      chassis: a.chassis || null,
    } : {
      description: a.description || null,
      location: a.location || null,
      registryNumber: a.registryNumber || null,
      totalArea: isFinite(totalAreaNumeric ?? NaN) ? totalAreaNumeric : null,
      boundaries: a.boundaries || null,
    }),
  };
};

const formatGuarantorDocument = (doc: string | null | undefined, type: "PF" | "PJ"): string => {
  const digits = (doc ?? "").replace(/\D/g, "");
  if (!digits) return "—";
  if (type === "PJ" && digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (type === "PF" && digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return digits;
};

const formatAssetTitle = (a: ContractAssetItem): string => {
  if (a.assetType === "vehicle") {
    return [a.brand, a.model].filter(Boolean).join(" ").trim() || "Veículo sem identificação";
  }
  return a.description?.trim() || a.location?.trim() || "Imóvel sem descrição";
};

const formatAssetDetail = (a: ContractAssetItem): string => {
  if (a.assetType === "vehicle") {
    const years = [a.manufactureYear, a.modelYear].filter(Boolean).join("/");
    return [a.plate ? `Placa ${a.plate}` : null, years || null].filter(Boolean).join(" · ") || "—";
  }
  return [
    a.registryNumber ? `Mat. ${a.registryNumber}` : null,
    a.totalArea ? `${a.totalArea} m²` : null,
  ].filter(Boolean).join(" · ") || "—";
};

export default function AiIngestion({ contractTypes, existingClients, consignors = [] }: AiIngestionProps) {
  // contractTypes/existingClients vêm hidratados pelo controller para futuras
  // melhorias (autocomplete de cliente cadastrado, sugestão de tipo já existente),
  // mas o fluxo atual cria sempre cadastros novos a partir do conteúdo do PDF.
  void contractTypes; void existingClients;

  const [consignorList, setConsignorList] = useState<ConsignorLite[]>(consignors);
  useEffect(() => { setConsignorList(consignors); }, [consignors]);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeReviewTab, setActiveReviewTab] = useState("basico");
  // 🚀 Sub-aba da guia "Fiadores e Codevedores". Quando o operador navega
  // para a aba Regras, este estado vira "TESTEMUNHA" para que o modal
  // compartilhado (criação/busca) saiba em qual lista inserir o resultado.
  const [vinculoTabActive, setVinculoTabActive] = useState<VinculoPessoaType>("FIADOR");
  const [submitting, setSubmitting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);

  // 🚀 Listas EM MEMÓRIA — espelham 1-para-1 o estado da tela de Contratos.
  // Cada item carrega ou um ID do banco (isFromDb=true) ou um formValues
  // completo para criação on-the-fly. A persistência acontece no submit.
  const [selectedFiadores,    setSelectedFiadores]    = useState<ContractGuarantor[]>([]);
  const [selectedCodevedores, setSelectedCodevedores] = useState<ContractGuarantor[]>([]);
  const [selectedTestemunhas, setSelectedTestemunhas] = useState<ContractGuarantor[]>([]);
  const [selectedAssets,      setSelectedAssets]      = useState<ContractAssetItem[]>([]);

  // 🚀 Estado dos modais compartilhados (mesmos componentes da tela de Contratos).
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [quickModalState, setQuickModalState] = useState<{
    open: boolean;
    mode: QuickCreateMode;
    editIndex?: number;
    initialValue?: Partial<GuarantorFormValues>;
    target: VinculoPessoaType;
  }>({ open: false, mode: "create", target: "FIADOR" });
  const [assetModalState, setAssetModalState] = useState<{
    open: boolean;
    mode: AssetModalMode;
    editIndex?: number;
    initialValue?: Partial<AssetFormValues>;
  }>({ open: false, mode: "create" });

  // 🚀 Estado da aba "Credor" — espelha o padrão de `selectedConsignor` em
  // Contracts.tsx. Guarda o objeto completo para que o painel read-only
  // (telefone, email, endereço) seja desenhado abaixo do <select>. A busca
  // por nome similar é feita pelo próprio <select> nativo do HTML5 quando
  // o usuário começa a digitar com a lista aberta.
  const [selectedConsignor, setSelectedConsignor] = useState<ConsignorLite | null>(null);
  const [consignorModalOpen, setConsignorModalOpen] = useState(false);

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
    const found = consignorList.find(c => c.id === id) || null;
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
      // O formato final é o mesmo aceito por `aiAssetToContractAssetItem`, que
      // monta um `ContractAssetItem` a partir do shape { tipo, description, ... }.
      if (data.garantias && !Array.isArray(data.garantias)) {
        const tipo = data.garantias.tipo_garantia;
        if (tipo === "veiculo" || tipo === "imovel") {
          const novoTipo = tipo === "veiculo" ? "vehicle" : "real_estate";
          data.garantias = [{
            tipo: novoTipo,
            description: data.garantias.descricao_detalhada || "",
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
      if (extractedName && consignorList.length) {
        const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const target = norm(extractedName);
        const exact = consignorList.find(c => norm(c.name || "") === target);
        const partial = exact ?? consignorList.find(c => norm(c.name || "").includes(target) || target.includes(norm(c.name || "")));
        if (partial) {
          setSelectedConsignor(partial);
          data.dados_basicos = {
            ...(data.dados_basicos || {}),
            consignor_id: partial.id,
            credor_divida: partial.name,
          };
        }
      }

      // 🚀 Promove as coleções da IA para o formato em memória usado por
      // VinculoPessoaList / AssetQuickCreateModal — totalmente compatível
      // com a UX da tela de Contratos.
      const fiadoresIA    = Array.isArray(data?.fiadores)    ? data.fiadores    : [];
      const codevIA       = Array.isArray(data?.codevedores) ? data.codevedores : [];
      const testIA        = Array.isArray(data?.testemunhas) ? data.testemunhas : [];
      const garantiasIA   = Array.isArray(data?.garantias)   ? data.garantias   : [];

      // 🚀 Deduplicação automática no startup — para cada pessoa extraída
      // pela IA, consultamos o catálogo pelo documento. Quando há match,
      // a entrada nasce como "Cadastrado" (isFromDb=true) com o ID do
      // banco; do contrário, fica como "Novo" para edição/criação.
      // Roda em paralelo (uma chamada por pessoa) para minimizar latência.
      const dedupedFiadores    = await dedupeAiPersons(fiadoresIA);
      const dedupedCodevedores = await dedupeAiPersons(codevIA);
      const dedupedTestemunhas = await dedupeAiPersons(testIA);

      setSelectedFiadores(dedupedFiadores);
      setSelectedCodevedores(dedupedCodevedores);
      setSelectedTestemunhas(dedupedTestemunhas);
      setSelectedAssets(garantiasIA.map(aiAssetToContractAssetItem).filter(Boolean) as ContractAssetItem[]);

      // Mantém apenas o "esqueleto" no extractedData — os arrays de pessoas e
      // garantias agora vivem em estado próprio (selectedFiadores etc.).
      setExtractedData({
        ...data,
        fiadores: [],
        codevedores: [],
        testemunhas: [],
        garantias: [],
      });
      toast.success("Leitura estruturada concluída!");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Erro ao processar as cláusulas do PDF via IA.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmIngestion = async () => {
    // ── Validação local (mesmo espírito do `handleSubmit` de Contracts) ──
    for (const list of [selectedFiadores, selectedCodevedores, selectedTestemunhas]) {
      for (const g of list) {
        if (!g.name?.trim()) {
          toast.error("Existe uma pessoa vinculada sem nome.");
          return;
        }
        if (!g.isFromDb) {
          const doc = g.personType === "PJ"
            ? onlyDigits(g.formValues?.cnpj ?? "")
            : onlyDigits(g.formValues?.cpf ?? "");
          const need = g.personType === "PJ" ? 14 : 11;
          if (doc.length !== need) {
            toast.error(`Documento inválido para "${g.name}".`);
            return;
          }
        }
      }
    }

    setSubmitting(true);
    try {
      const payload: any = JSON.parse(JSON.stringify(extractedData ?? {}));

      // Normaliza CPF/CNPJ do cliente devedor para apenas dígitos antes de enviar.
      if (payload?.dados_basicos?.documento) {
        payload.dados_basicos.documento = onlyDigits(String(payload.dados_basicos.documento));
      }
      if (payload?.dados_basicos?.cep) {
        payload.dados_basicos.cep = onlyDigits(String(payload.dados_basicos.cep));
      }

      if (payload.taxas) {
        payload.taxas.juros_mes    = parseFloat(payload.taxas.juros_mes)    / 100;
        payload.taxas.mora_mes     = parseFloat(payload.taxas.mora_mes)     / 100;
        payload.taxas.multa_atraso = parseFloat(payload.taxas.multa_atraso) / 100;
      }

      // Reescreve as coleções a partir do estado em memória (formato AI legado,
      // 100% compatível com o que o AiIngestionController@save já aceita).
      payload.fiadores    = selectedFiadores.map(contractGuarantorToAi);
      payload.codevedores = selectedCodevedores.map(contractGuarantorToAi);
      payload.testemunhas = selectedTestemunhas.map(contractGuarantorToAi);
      payload.garantias   = selectedAssets.map(contractAssetItemToAi);

      const cid = selectedConsignor?.id ?? payload?.dados_basicos?.consignor_id;
      if (cid) payload.consignor_id = Number(cid);

      await api.post("/api/ai-ingestion/save", payload);
      toast.success("Ecosistema integrado gravado com sucesso!");
      setExtractedData(null);
      setFile(null);
      setSelectedConsignor(null);
      setSelectedFiadores([]);
      setSelectedCodevedores([]);
      setSelectedTestemunhas([]);
      setSelectedAssets([]);
    } catch (err: any) {
      const apiMessage =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message;
      toast.error(
        apiMessage
          ? `Falha ao salvar: ${apiMessage}`
          : "Falha ao persistir a importação no banco de dados."
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

  const handleUpdateRule = (field: string, value: any) => {
    setExtractedData((prev: any) => ({
      ...prev,
      regras: { ...(prev?.regras || {}), [field]: value },
    }));
  };

  /* ──────────────────────────────────────────────────────────────────────
   * 🚀 Helpers dos modais — espelham 1-para-1 a tela de Contracts.tsx.
   * ───────────────────────────────────────────────────────────────────── */

  const setterForRole = (target: VinculoPessoaType) => {
    if (target === "CODEVEDOR")  return setSelectedCodevedores;
    if (target === "TESTEMUNHA") return setSelectedTestemunhas;
    return setSelectedFiadores;
  };

  const listForRole = (target: VinculoPessoaType): ContractGuarantor[] => {
    if (target === "CODEVEDOR")  return selectedCodevedores;
    if (target === "TESTEMUNHA") return selectedTestemunhas;
    return selectedFiadores;
  };

  const addPersonFromDb = (g: GuarantorLite, target: VinculoPessoaType) => {
    setterForRole(target)((prev) => {
      if (prev.some((it) => it.isFromDb && it.id === g.id)) return prev;
      return [
        ...prev,
        {
          localId: newLocalId(),
          id: g.id,
          isFromDb: true,
          name: g.name,
          personType: g.personType,
          document: g.document,
        },
      ];
    });
  };

  const selectedDbIdsByRole = {
    FIADOR:     selectedFiadores.filter((g) => g.isFromDb && typeof g.id === "number").map((g) => g.id as number),
    CODEVEDOR:  selectedCodevedores.filter((g) => g.isFromDb && typeof g.id === "number").map((g) => g.id as number),
    TESTEMUNHA: selectedTestemunhas.filter((g) => g.isFromDb && typeof g.id === "number").map((g) => g.id as number),
  };

  const openGuarantorViewModal = async (guarantorId: number, target: VinculoPessoaType) => {
    try {
      const { data } = await api.get(`/api/guarantors/${guarantorId}`);
      const g = data?.guarantor;
      if (!g) { toast.error("Pessoa não encontrada."); return; }
      const initialValue: Partial<GuarantorFormValues> = {
        personType: g.personType,
        name: g.name ?? "",
        email: g.email ?? "",
        phone: g.phone ?? "",
        nationality: g.nationality ?? "",
        maritalStatus: g.maritalStatus ?? "",
        cpf: g.cpf ? maskCPF(g.cpf) : "",
        rg: g.rg ?? "",
        cnpj: g.cnpj ? maskCNPJ(g.cnpj) : "",
        tradeName: g.tradeName ?? "",
        stateRegistration: g.stateRegistration ?? "",
        street: g.street ?? "",
        number: g.number ?? "",
        complement: g.complement ?? "",
        neighborhood: g.neighborhood ?? "",
        city: g.city ?? "",
        state: g.state ?? "",
        zipCode: g.zipCode ? maskCEP(g.zipCode) : "",
      };
      setQuickModalState({ open: true, mode: "view", initialValue, target });
    } catch {
      toast.error("Falha ao carregar dados da pessoa.");
    }
  };

  const isTabInvalid = (tabKey: string): boolean => {
    if (!extractedData) return false;
    const b = extractedData.dados_basicos ?? {};
    const v = extractedData.valores ?? {};
    const bank = extractedData.banco ?? {};
    const t = extractedData.taxas ?? {};

    switch (tabKey) {
      case "basico": {
        const objeto = b.objeto || (b.cliente_devedor ? `CONTRATO INTEGRADOR IA - ${b.cliente_devedor}` : "");
        return hasAnyEmptyField([
          b.cliente_devedor,
          b.documento,
          b.cep,
          b.endereco,
          b.codigo_interno,
          b.data_emissao,
          objeto,
          b.tipo,
        ]);
      }
      case "credor":
        return !selectedConsignor?.id && !b.consignor_id;
      case "financeiro":
        return hasAnyEmptyField([
          v.valor_principal,
          v.valor_financiado,
          v.numero_parcelas,
          v.valor_parcela,
          bank.nome,
          bank.agencia,
          bank.conta,
          bank.pix,
          v.iof,
        ]);
      case "taxas":
        return hasAnyEmptyField([
          t.data_primeiro_vencimento,
          t.tac,
          t.juros_mes,
          t.mora_mes,
          t.multa_atraso,
          t.honorarios,
        ]);
      case "fiadores":
        return [...selectedFiadores, ...selectedCodevedores].some(isPersonItemIncomplete);
      case "garantias":
        return selectedAssets.some(isAssetItemIncomplete);
      case "regras":
        return selectedTestemunhas.some(isPersonItemInvalid);
      default:
        return false;
    }
  };

  const getInputStyle = getEmptyFieldStyle;

  const getTabButtonStyle = (active: boolean, hasError: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 12px",
    fontSize: 11,
    fontWeight: active || hasError ? 700 : 500,
    cursor: "pointer",
    borderRadius: 6,
    background: hasError ? "#fef2f2" : active ? "white" : "transparent",
    color: hasError ? "#ef4444" : active ? "#1e2139" : "#475569",
    border: hasError ? "1px solid #fca5a5" : active ? "1px solid #e2e8f0" : "1px solid transparent",
    boxShadow: active ? "0 1px 2px rgba(15,23,42,0.06)" : "none",
    whiteSpace: "nowrap",
    transition: "all 0.1s",
  });

  const getTabIconColor = (active: boolean, hasError: boolean) =>
    hasError ? "#ef4444" : active ? "#2563eb" : "#94a3b8";

  const handleConsignorSaved = (saved: { id: number; name?: string; [key: string]: any }) => {
    const lite = mapConsignorLite(saved);
    setConsignorList(prev => {
      const exists = prev.some(c => c.id === lite.id);
      return exists ? prev.map(c => c.id === lite.id ? lite : c) : [...prev, lite];
    });
    handleSelectConsignor(lite.id);
    setConsignorModalOpen(false);
  };

  /**
   * Renderiza o painel "VinculoPessoaList" parametrizado para um papel
   * específico (FIADOR/CODEVEDOR/TESTEMUNHA). Espelha 1-para-1 a UX da
   * tela de Contratos — mesma tabela, mesmos botões e os mesmos modais
   * compartilhados (busca/criação rápida).
   */
  const renderPersonPanel = (target: VinculoPessoaType) => {
    const list = listForRole(target);
    const setList = setterForRole(target);
    return (
      <VinculoPessoaList
        type={target}
        data={list as VinculoPessoaItem[]}
        onRemove={(idx) => setList((prev) => prev.filter((_, i) => i !== idx))}
        clientId={1 /* AI: cliente é resolvido no submit; placeholder ativa os botões */}
        suggested={[]}
        onAddSuggested={(g) => addPersonFromDb(g, target)}
        onOpenCreate={() => {
          setVinculoTabActive(target);
          setQuickModalState({ open: true, mode: "create", target, initialValue: {} });
        }}
        onOpenSearch={() => {
          setVinculoTabActive(target);
          setSearchModalOpen(true);
        }}
        onOpenEditNew={(idx, item) => {
          if (!item || item.isFromDb) return;
          setVinculoTabActive(target);
          setQuickModalState({
            open: true,
            mode: "edit-new",
            editIndex: idx,
            initialValue: item.formValues,
            target,
          });
        }}
        onOpenView={(id) => openGuarantorViewModal(id, target)}
        formatDocument={formatGuarantorDocument}
        isItemInvalid={target === "TESTEMUNHA" ? isPersonItemInvalid : isPersonItemIncomplete}
      />
    );
  };

  return (
    <UnyPayLayout>
      <Head title="Importação Inteligente via IA" />

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
                  title="Descartar e iniciar nova importação"
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
                      style={getTabButtonStyle(active, hasError)}
                    >
                      <Icon size={12} style={{ color: getTabIconColor(active, hasError) }} />
                      {tab.label}
                      {hasError && <AlertCircle size={10} style={{ color: "#ef4444" }} className="animate-pulse" />}
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
                        maxLength={255}
                      />
                    </div>
                    <div>
                      <label className="sigx-label">CNPJ/CPF *</label>
                      <input
                        className="sigx-input mono"
                        style={getInputStyle(extractedData.dados_basicos?.documento)}
                        value={extractedData.dados_basicos?.documento || ""}
                        onChange={e => updateNested("dados_basicos", "documento", maskDocument(e.target.value))}
                        placeholder="000.000.000-00 ou 00.000.000/0000-00"
                        maxLength={18}
                      />
                    </div>
                    <div>
                      <label className="sigx-label">CEP</label>
                      <input
                        className="sigx-input mono"
                        style={getInputStyle(extractedData.dados_basicos?.cep)}
                        value={extractedData.dados_basicos?.cep || ""}
                        onChange={e => updateNested("dados_basicos", "cep", maskCEP(e.target.value))}
                        placeholder="00000-000"
                        maxLength={9}
                      />
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <label className="sigx-label">ENDEREÇO</label>
                      <input
                        className="sigx-input"
                        style={getInputStyle(extractedData.dados_basicos?.endereco)}
                        value={extractedData.dados_basicos?.endereco || ""}
                        onChange={e => updateNested("dados_basicos", "endereco", e.target.value)}
                        maxLength={255}
                      />
                    </div>
                    <div>
                      <label className="sigx-label">CÓDIGO INTERNO *</label>
                      <input
                        className="sigx-input mono"
                        style={getInputStyle(extractedData.dados_basicos?.codigo_interno)}
                        value={extractedData.dados_basicos?.codigo_interno || ""}
                        onChange={e => updateNested("dados_basicos", "codigo_interno", e.target.value)}
                        maxLength={50}
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
                        style={getInputStyle(
                          extractedData.dados_basicos?.objeto
                          || (extractedData.dados_basicos?.cliente_devedor
                            ? `CONTRATO INTEGRADOR IA - ${extractedData.dados_basicos.cliente_devedor}`
                            : "")
                        )}
                        value={extractedData.dados_basicos?.objeto || (extractedData.dados_basicos?.cliente_devedor ? `CONTRATO INTEGRADOR IA - ${extractedData.dados_basicos.cliente_devedor}` : "")}
                        onChange={e => updateNested("dados_basicos", "objeto", e.target.value)}
                        maxLength={255}
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
                          ({consignorList.length} disponíve{consignorList.length === 1 ? "l" : "is"})
                        </span>
                      </label>
                      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                        <select
                          className="sigx-input"
                          style={{ ...getInputStyle(selectedConsignor?.id), flex: 1 }}
                          value={String(selectedConsignor?.id || "")}
                          onChange={(e) => handleSelectConsignor(Number(e.target.value))}
                        >
                          <option value="">— Sem credor vinculado —</option>
                          {consignorList.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                              {c.document ? ` — ${formatConsignorDocument(c.document)}` : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => setConsignorModalOpen(true)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 14px", fontSize: 11, whiteSpace: "nowrap" }}
                        >
                          <Plus size={12} /> Novo Credor
                        </button>
                      </div>
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
                          border: "1px dashed #fca5a5",
                          borderRadius: 8,
                          padding: 28,
                          background: "#fef2f2",
                          textAlign: "center",
                          color: "#991b1b",
                        }}
                      >
                        <Landmark size={26} style={{ opacity: 0.4, margin: "0 auto 6px", display: "block", color: "#ef4444" }} />
                        <span style={{ fontSize: 11.5, fontWeight: 600 }}>
                          Nenhum credor vinculado. Selecione um cadastrado ou clique em "Novo Credor" para cadastrar.
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
                          style={getInputStyle(extractedData.valores?.valor_financiado)}
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
                            style={getInputStyle(extractedData.banco?.agencia)}
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
                            style={getInputStyle(extractedData.banco?.pix)}
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
                          style={getInputStyle(extractedData.valores?.iof)}
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
                          style={getInputStyle(extractedData.taxas?.tac)}
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
                          style={getInputStyle(extractedData.taxas?.mora_mes)}
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
                          style={getInputStyle(extractedData.taxas?.multa_atraso)}
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
                          style={getInputStyle(extractedData.taxas?.honorarios)}
                          value={maskPercentInputDisplay(extractedData.taxas?.honorarios)}
                          onChange={e => updateNested("taxas", "honorarios", maskPercentInputParse(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 5: FIADORES + CODEVEDORES — sub-abas controladas
                    localmente, exatamente como na tela de Contratos.
                    Usa o mesmo VinculoPessoaList + modais compartilhados. */}
                {activeReviewTab === "fiadores" && (() => {
                  const isFiador = vinculoTabActive === "FIADOR";
                  const fiadoresCount    = selectedFiadores.length;
                  const codevedoresCount = selectedCodevedores.length;

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
                    <div style={{ display: "flex", flexDirection: "column", gap: 14, ...(isTabInvalid("fiadores") ? { padding: 12, border: "1px solid #fca5a5", borderRadius: 8, background: "#fef2f2" } : {}) }}>
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

                      {isFiador
                        ? renderPersonPanel("FIADOR")
                        : renderPersonPanel("CODEVEDOR")}
                    </div>
                  );
                })()}


                {/* TAB 6: GARANTIAS — tabela compacta + AssetQuickCreateModal
                    (mesmo padrão visual da aba de Garantias em Contracts.tsx). */}
                {activeReviewTab === "garantias" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, ...(isTabInvalid("garantias") ? { padding: 12, border: "1px solid #fca5a5", borderRadius: 8, background: "#fef2f2" } : {}) }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setAssetModalState({ open: true, mode: "create", initialValue: { assetType: "vehicle" } })}
                        className="btn-primary"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 11 }}
                      >
                        <Shield size={12} /> Adicionar Garantia
                      </button>
                    </div>

                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", background: "white" }}>
                      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9" }}>
                            <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 90 }}>Tipo</th>
                            <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Identificação</th>
                            <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 220 }}>Detalhe</th>
                            <th style={{ padding: "7px 10px", textAlign: "center", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", width: 110 }}>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedAssets.length === 0 ? (
                            <tr>
                              <td colSpan={4} style={{ padding: 28, textAlign: "center", color: "#94a3b8" }}>
                                <Shield size={24} style={{ opacity: 0.3, margin: "0 auto 6px", display: "block" }} />
                                <span style={{ fontSize: 11.5 }}>
                                  Nenhum bem vinculado. Use o botão acima para adicionar.
                                </span>
                              </td>
                            </tr>
                          ) : selectedAssets.map((a, idx) => {
                            const isVehicle = a.assetType === "vehicle";
                            const Icon = isVehicle ? Car : Home;
                            const missing = getAssetEmptyFieldLabels(a);
                            const invalid = missing.length > 0;
                            return (
                              <tr key={a.localId} style={{ background: invalid ? "#fef2f2" : idx % 2 === 1 ? "#fafafa" : "white", borderLeft: invalid ? "3px solid #ef4444" : undefined }}>
                                <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9" }}>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: isVehicle ? "#ecfdf5" : "#eff6ff", color: isVehicle ? "#065f46" : "#1e40af" }}>
                                    <Icon size={10} />
                                    {isVehicle ? "Veículo" : "Imóvel"}
                                  </span>
                                </td>
                                <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", fontWeight: 600, color: invalid && isVehicle && missing.includes("Marca") && missing.includes("Modelo") ? "#ef4444" : "#0f172a" }}>
                                  {formatAssetTitle(a)}
                                </td>
                                <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", color: "#475569" }}>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <span>{formatAssetDetail(a)}</span>
                                    {missing.length > 0 && (
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                        {missing.map((label) => (
                                          <span key={label} style={missingFieldBadgeStyle}>{label} ausente</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", textAlign: "center" }}>
                                  <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                                    <button
                                      type="button"
                                      className="btn-icon"
                                      title="Visualizar dados"
                                      onClick={() => setAssetModalState({ open: true, mode: "view", editIndex: idx, initialValue: a })}
                                    >
                                      <Eye size={11} style={{ color: "#2563eb" }} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-icon"
                                      title="Editar bem"
                                      onClick={() => setAssetModalState({ open: true, mode: "edit", editIndex: idx, initialValue: a })}
                                    >
                                      <Edit2 size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-icon"
                                      title="Remover do contrato"
                                      style={{ color: "#dc2626" }}
                                      onClick={() => setSelectedAssets((prev) => prev.filter((_, i) => i !== idx))}
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="keep-case" style={{ fontSize: 10.5, color: "#64748b", lineHeight: 1.5 }}>
                      Bens (veículos e imóveis) são gravados junto com o contrato em uma única transação.
                      {selectedAssets.some(isAssetItemIncomplete) && (
                        <span style={{ display: "block", marginTop: 6, color: "#991b1b", fontWeight: 600 }}>
                          Itens com campos ausentes estão destacados em vermelho — clique em editar para completar os dados.
                        </span>
                      )}
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
                        style={getInputStyle(extractedData.regras?.foro)}
                        value={extractedData.regras?.foro || ""}
                        onChange={e => handleUpdateRule("foro", e.target.value)}
                        placeholder="Ex: Belo Horizonte / MG"
                      />
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>
                        Define o município jurídico responsável pela resolução de litígios e execução judicial deste ativo.
                      </span>
                    </div>

                    {/* 🚀 TESTEMUNHAS — usam o MESMO VinculoPessoaList e os
                        MESMOS modais (criação rápida + busca no cadastro)
                        que a tela de Contratos. */}
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
                          {selectedTestemunhas.length} vinculada(s)
                        </span>
                      </div>

                      {renderPersonPanel("TESTEMUNHA")}
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
                  Campos vazios ou zerados aparecem em vermelho. Os marcados com <b style={{ color: "#ef4444" }}>*</b> são obrigatórios para gravar o contrato
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

      {/* ── SUB-MODAL: Criar/Editar pessoa on-the-fly (mesmo da tela de Contratos) ── */}
      <GuarantorQuickCreateModal
        open={quickModalState.open}
        mode={quickModalState.mode}
        initialValue={quickModalState.initialValue}
        highlightEmpty
        onClose={() => setQuickModalState({ open: false, mode: "create", target: vinculoTabActive })}
        onConfirm={async (values) => {
          const target = quickModalState.target;
          const setList = setterForRole(target);
          const docDigits = values.personType === "PJ" ? onlyDigits(values.cnpj) : onlyDigits(values.cpf);

          if (quickModalState.mode === "edit-new" && typeof quickModalState.editIndex === "number") {
            const idx = quickModalState.editIndex;
            setList((prev) =>
              prev.map((it, i) =>
                i === idx
                  ? {
                      ...it,
                      name: values.name,
                      personType: values.personType,
                      document: docDigits,
                      formValues: values,
                    }
                  : it
              )
            );
            setQuickModalState({ open: false, mode: "create", target: vinculoTabActive });
            return;
          }

          // 🚀 Deduplicação on-the-fly — quando o operador "cria" alguém
          // cujo documento já existe no catálogo de Pessoas, vinculamos
          // a pessoa já cadastrada em vez de tentar criar duplicata
          // (mesmo comportamento da tela de Contratos).
          const existing = await findGuarantorByDocument(docDigits);
          if (existing) {
            const currentList = listForRole(target);
            const alreadyLinked = currentList.some((it) => it.isFromDb && it.id === existing.id);
            if (alreadyLinked) {
              toast.info(`${existing.name} já está vinculado(a) a este contrato.`);
            } else {
              setList((prev) => [
                ...prev,
                {
                  localId: newLocalId(),
                  id: existing.id,
                  isFromDb: true,
                  name: existing.name,
                  personType: existing.personType,
                  document: existing.document,
                },
              ]);
              toast.success(`Pessoa já cadastrada — vinculando ${existing.name} ao contrato.`);
            }
            setQuickModalState({ open: false, mode: "create", target: vinculoTabActive });
            return;
          }

          // Documento não encontrado: insere como pessoa nova on-the-fly.
          setList((prev) => [
            ...prev,
            {
              localId: newLocalId(),
              isFromDb: false,
              name: values.name,
              personType: values.personType,
              document: docDigits,
              formValues: values,
            },
          ]);
          setQuickModalState({ open: false, mode: "create", target: vinculoTabActive });
        }}
      />

      {/* ── SUB-MODAL: Buscar pessoa no cadastro (mesmo da tela de Contratos) ── */}
      <GuarantorSearchModal
        open={searchModalOpen}
        excludeIds={selectedDbIdsByRole[vinculoTabActive]}
        onClose={() => setSearchModalOpen(false)}
        onPick={(picked) => {
          picked.forEach((g) => addPersonFromDb(g, vinculoTabActive));
          setSearchModalOpen(false);
        }}
      />

      {/* ── SUB-MODAL: Bens em Garantia (mesmo da tela de Contratos) ── */}
      <AssetQuickCreateModal
        open={assetModalState.open}
        mode={assetModalState.mode}
        initialValue={assetModalState.initialValue}
        highlightEmpty
        onClose={() => setAssetModalState({ open: false, mode: "create" })}
        onConfirm={(values) => {
          if (
            (assetModalState.mode === "edit" || assetModalState.mode === "view") &&
            typeof assetModalState.editIndex === "number"
          ) {
            const idx = assetModalState.editIndex;
            setSelectedAssets((prev) =>
              prev.map((it, i) => (i === idx ? { ...it, ...values } : it))
            );
          } else {
            setSelectedAssets((prev) => [...prev, { ...values, localId: newLocalId() }]);
          }
          setAssetModalState({ open: false, mode: "create" });
        }}
      />
      <ConsignorFormModal
        open={consignorModalOpen}
        onClose={() => setConsignorModalOpen(false)}
        onSaved={handleConsignorSaved}
      />
    </UnyPayLayout>
  );
}