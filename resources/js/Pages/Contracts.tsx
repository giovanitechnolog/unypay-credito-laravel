import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Plus, Search, FileText, CheckCircle, X, Edit2, Trash2, Upload, Eye,
  CreditCard, QrCode, UserCheck, Scale, Ban, RotateCcw, Paperclip,
  CircleDollarSign, Percent, Landmark, Shield, BookOpen,
  UserPlus, Users, Sparkles, Building2, User as UserIcon,
  Car, Home,
} from "lucide-react";
import { Head, router } from "@inertiajs/react";
import { toast } from "sonner";
import UnyPayLayout from "../Components/UnyPayLayout";
import ConfirmDialog from "../Components/ConfirmDialog";
import TableGroupBadges from "../Components/TableGroupBadges";
import TableColumnPicker from "../Components/TableColumnPicker";
import GuarantorQuickCreateModal, { QuickCreateMode } from "../Components/GuarantorQuickCreateModal";
import GuarantorSearchModal, { GuarantorLite } from "../Components/GuarantorSearchModal";
import VinculoPessoaList, {
  VinculoPessoaItem,
  VinculoPessoaType,
} from "../Components/VinculoPessoaList";
import {
  GuarantorFormValues,
  EMPTY_GUARANTOR_FORM,
  maskCPF,
  maskCNPJ,
  maskCEP,
  onlyDigits,
} from "../Components/GuarantorFormFields";
import AssetQuickCreateModal, { AssetModalMode } from "../Components/AssetQuickCreateModal";
import {
  AssetFormValues,
  maskArea,
} from "../Components/AssetFormFields";
import { api, extractFirstError } from "../lib/api";
import { useColumnVisibility } from "../hooks/useColumnVisibility";
import {
  CONTRACTS_COLUMNS,
  CONTRACTS_GROUP_META,
  CONTRACTS_GROUP_ORDER,
  type ContractsColumnDef,
  type ContractsColumnId,
} from "../lib/contractsColumns";

const fmt = (v: number | string) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
const fmtDate = (d?: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
const fmtPct = (v: number | string) => `${(Number(v) * 100).toFixed(2)}%`;

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  "Ativo":        { bg: "#d1fae5", color: "#065f46" },
  "Inadimplente": { bg: "#fee2e2", color: "#991b1b" },
  "Quitado":      { bg: "#dbeafe", color: "#1e40af" },
  "Renegociado":  { bg: "#f3e8ff", color: "#6b21a8" },
  "Cancelado":    { bg: "#e5e7eb", color: "#4b5563" },
};

const PAGE_SIZES = [20, 50, 100];
const ACTIONS_WIDTH = 168;
const MAX_PDF_MB = 20;
const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024;

type ContractStatus = "Ativo" | "Quitado" | "Inadimplente" | "Renegociado" | "Cancelado";
type PenaltyBaseType = "installment" | "debt" | "contract";
type PenaltyScope = "per_installment" | "contract_once";

const emptyForm = {
  clientId: 0, code: "", contractName: "", creditor: "UnyPay® S.A.",
  contract_type_id: "", 
  contractType: "Mútuo/Confissão de dívida", contractDate: new Date().toISOString().slice(0, 10),
  status: "Ativo" as ContractStatus,
  validated: false, principalAmount: 0, financedTotal: 0, tacAmount: 0, iofAmount: 0,
  installmentCount: 12, installmentAmount: 0, firstDueDate: "",
  monthlyInterestRate: 0, moraRateMonthly: 0.02, penaltyRate: 0.1,
  penaltyBaseType: "installment" as PenaltyBaseType, penaltyScope: "per_installment" as PenaltyScope,
  correctionIndex: "IPCA", honoraryRate: 0, accelerates: false,
  accelerationRule: "", accelerationConsecutiveThreshold: undefined as number | undefined,
  accelerationAlternateThreshold: undefined as number | undefined,
  guarantees: "", guarantors: "", validationUrl: "", observations: "",
  chosenBankAccount: "",
  paymentMethod: "Boleto Bancário",
  forumLocation: "Belo Horizonte / MG",

  // 🚀 Confissão de Dívida (checkbox da guia "Garantias e Fiadores")
  confessionOfDebt: false,
};

const TABS = [
  { key: "basico",     label: "Dados Básicos",         icon: FileText },
  { key: "financeiro", label: "Valores e Bancos",      icon: CircleDollarSign },
  { key: "taxas",      label: "Taxas e Encargos",      icon: Percent },
  { key: "fiadores",   label: "Fiador / Codevedor",   icon: UserCheck },
  { key: "garantias",  label: "Garantias",             icon: Shield },
  { key: "regras",     label: "Regras Contratuais",    icon: BookOpen },
  { key: "bancarios",  label: "Dados Bancários",       icon: Landmark },
];

/**
 * Item de fiador associado ao contrato em edição.
 *
 * Existe em dois "estados":
 *   - isFromDb=true  → veio do banco (já tem ID). Imutável: o usuário só pode remover.
 *   - isFromDb=false → adicionado on-the-fly. Editável; será persistido apenas
 *                       quando o contrato for salvo.
 */
type ContractGuarantor = {
  /** Chave estável usada como key do React (também distingue novos antes do POST). */
  localId: string;
  /** Presente apenas quando isFromDb=true. */
  id?: number;
  isFromDb: boolean;
  // ── Dados resumidos para a tabela ─────────────────────────
  name: string;
  personType: "PF" | "PJ";
  document: string | null; // já formatado para exibição
  // ── Dados completos (apenas para isFromDb=false, para reedição) ──
  formValues?: GuarantorFormValues;
};

const newLocalId = () =>
  // crypto.randomUUID falha em alguns browsers antigos; fallback timestamp+rand
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `g-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Formata CPF/CNPJ para exibição na tabela (a partir dos dígitos persistidos).
 */
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

/**
 * Item de Bem em Garantia associado ao contrato em edição (1:N).
 *
 * Diferente de fiadores, todos os bens são internos do contrato — não há
 * distinção isFromDb. O campo `id` só vem preenchido quando o bem já está
 * persistido (modo edição). O backend usa diff manual: ids existentes são
 * UPDATE, ausentes viram CREATE, removidos do array viram DELETE.
 */
type ContractAssetItem = AssetFormValues & {
  /** Chave estável usada como key do React. */
  localId: string;
  /** ID do registro em `contract_assets` (apenas em modo edição). */
  id?: number;
};

/**
 * Converte a string de área formatada (ex.: "1.000.000,00") em float ou null.
 * Aceita formato BR "1.234,56", "521,81", "521.81" e dígitos puros.
 *
 * Estratégia: remove TODOS os pontos (separador de milhar BR), troca a
 * vírgula por ponto (separador decimal) e converte para número.
 */
const parseAreaForBackend = (raw: string): number | null => {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw.replace(/\./g, "").replace(",", ".");
  const num = Number(cleaned);
  return isFinite(num) && num > 0 ? num : null;
};

/**
 * Serializa a lista de bens para o backend — mantém só os campos que o
 * `ContractController@store/@update` espera receber dentro de `assets[]`.
 *
 * Regras importantes:
 *   - O `id` só vai quando >0 (no create, todos os bens são novos);
 *   - Strings vazias viram null para baterem com `nullable` no banco;
 *   - manufactureYear/modelYear viram inteiros;
 *   - totalArea vira float (parseAreaForBackend lida com vírgula/ponto);
 *   - localId nunca é enviado (é interno do React).
 */
const serializeAssetsForBackend = (assets: ContractAssetItem[]) =>
  assets.map((a) => ({
    ...(a.id && a.id > 0 ? { id: a.id } : {}),
    assetType: a.assetType,
    brand:           a.brand?.trim() || null,
    model:           a.model?.trim() || null,
    manufactureYear: a.manufactureYear ? Number(a.manufactureYear) : null,
    modelYear:       a.modelYear       ? Number(a.modelYear)       : null,
    plate:           a.plate?.trim()   || null,
    renavam:         a.renavam?.trim() || null,
    chassis:         a.chassis?.trim() || null,
    description:     a.description?.trim()    || null,
    location:        a.location?.trim()       || null,
    registryNumber:  a.registryNumber?.trim() || null,
    totalArea:       parseAreaForBackend(a.totalArea),
    boundaries:      a.boundaries?.trim() || null,
  }));

/**
 * Devolve uma string curta usada na tabela da aba "Garantias" para
 * identificar o bem (linha "Identificação").
 */
const formatAssetTitle = (a: ContractAssetItem): string => {
  if (a.assetType === "vehicle") {
    return [a.brand, a.model].filter(Boolean).join(" ").trim() || "Veículo sem identificação";
  }
  return a.description?.trim() || a.location?.trim() || "Imóvel sem descrição";
};

/**
 * Devolve a linha de detalhe usada na tabela ("Detalhe").
 */
const formatAssetDetail = (a: ContractAssetItem): string => {
  if (a.assetType === "vehicle") {
    const years = [a.manufactureYear, a.modelYear].filter(Boolean).join("/");
    return [a.plate ? `Placa ${a.plate}` : null, years || null].filter(Boolean).join(" · ") || "—";
  }
  return [
    a.registryNumber ? `Mat. ${a.registryNumber}` : null,
    // a.totalArea já vem formatado (ex.: "1.000.000,00") porque a hidratação
    // aplicou maskArea. Para bens recém-criados em memória, o valor também
    // está mascarado pelo onChange do input.
    a.totalArea ? `${a.totalArea} m²` : null,
  ].filter(Boolean).join(" · ") || "—";
};

// Tradução amigável dos tipos de conta para exibição na guia "Dados Bancários"
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  corrente: "Corrente",
  poupanca: "Poupança",
  pagamentos: "Pagamentos",
  salario: "Conta Salário",
  conjunta: "Conta Conjunta",
};

// Separa o código do banco do nome, dado que o cliente grava no formato "001 - Banco do Brasil S.A."
function splitBank(label?: string): { code: string; name: string } {
  if (!label) return { code: "", name: "" };
  const match = label.match(/^\s*(\d{3,4})\s*[-–]\s*(.+)$/);
  if (match) return { code: match[1], name: match[2].trim() };
  return { code: "", name: label.trim() };
}

const headerCellStyle: React.CSSProperties = {
  background: "#f1f5f9", color: "#334155",
  padding: "5px 7px", fontSize: 9, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.04em",
  whiteSpace: "nowrap", borderBottom: "2px solid #cbd5e1",
};
const tdBase: React.CSSProperties = { padding: "3px 7px", borderBottom: "1px solid #f1f5f9", fontSize: 11, verticalAlign: "middle" };
// 🛠️ FIX 1: Recolocada a constante tdNum para formatação alinhada à direita dos valores financeiros
const tdNum: React.CSSProperties = { ...tdBase, fontFamily: "'IBM Plex Mono',monospace", textAlign: "right" };
const tdCenter: React.CSSProperties = { ...tdBase, textAlign: "center" };

// 🚀 Máscaras estilo maskmoney — armazenam o valor como número (Reais ou fração)
// e re-renderizam a string formatada a cada keystroke. Evita o sofrimento do
// `type="number"` com vírgula/ponto e dá UX consistente com sistemas bancários.
//
//   maskMoneyDisplay(1234.5)         → "1.234,50"
//   maskMoneyParse("1.234,50")       → 1234.5 (reais)
//   maskPercentDisplay(0.0125)       → "1,25"
//   maskPercentParse("125")          → 0.0125 (taxa decimal)
const maskMoneyDisplay = (value: number | null | undefined): string => {
  const cents = Math.round((Number(value) || 0) * 100);
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

const maskPercentDisplay = (value: number | null | undefined): string => {
  // O valor é armazenado como decimal (0.0125 = 1,25%). Multiplico por 100 para obter
  // a representação percentual exibida ao usuário e mantenho 2 casas via centavos.
  const cents = Math.round((Number(value) || 0) * 10000);
  if (cents === 0) return "";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const intPart = Math.floor(abs / 100);
  const decPart = (abs % 100).toString().padStart(2, "0");
  return `${sign}${intPart.toLocaleString("pt-BR")},${decPart}`;
};

const maskPercentParse = (raw: string): number => {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10) / 10000;
};

export default function Contracts({ contracts, clients, contractTypes = [], filters }: any) {
  const [search, setSearch] = useState(filters?.search || "");
  const [statusFilter, setStatusFilter] = useState(filters?.statusFilter || "Todos");
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("basico");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [contractPdfFiles, setContractPdfFiles] = useState<File[]>([]);
  const [existingPdfNames, setExistingPdfNames] = useState<string[]>([]);
  const [existingPdfPaths, setExistingPdfPaths] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const [pdfPreview, setPdfPreview] = useState<{ id: number; code: string; names: string[] } | null>(null);
  const [activePdfIndex, setActivePdfIndex] = useState<number>(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortCol, setSortCol] = useState<string>("code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Diálogos de confirmação (excluir / cancelar / reativar)
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<any | null>(null);
  const [confirmReactivate, setConfirmReactivate] = useState<any | null>(null);

  // 🚀 Estados da aba "Fiador / Codevedor" — gerenciados em memória até o submit.
  // Mantemos LISTAS SEPARADAS por papel (FIADOR / CODEVEDOR), pois o backend
  // sincroniza cada papel de forma independente na pivot contract_guarantor.
  // O modal de busca/criação rápida é compartilhado e sabe em qual lista
  // inserir através do estado `vinculoTabActive`.
  const [selectedGuarantors, setSelectedGuarantors] = useState<ContractGuarantor[]>([]);
  const [selectedCodebtors,  setSelectedCodebtors]  = useState<ContractGuarantor[]>([]);
  const [suggestedGuarantors, setSuggestedGuarantors] = useState<GuarantorLite[]>([]);
  const [vinculoTabActive,  setVinculoTabActive]  = useState<VinculoPessoaType>("FIADOR");
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [quickModalState, setQuickModalState] = useState<{
    open: boolean;
    mode: QuickCreateMode;
    editIndex?: number;
    initialValue?: Partial<GuarantorFormValues>;
    /** Indica em qual lista o item criado/editado deve ser inserido. */
    target: VinculoPessoaType;
  }>({ open: false, mode: "create", target: "FIADOR" });

  // 🚀 Estados da seção "Bens em Garantia" (aba Garantias) — também em memória
  // até o submit do contrato. Ao salvar, viram JSON dentro do FormData; o
  // backend faz diff manual contra contract_assets preservando ids/createdAt.
  const [selectedAssets, setSelectedAssets] = useState<ContractAssetItem[]>([]);
  const [assetModalState, setAssetModalState] = useState<{
    open: boolean;
    mode: AssetModalMode;
    editIndex?: number;
    initialValue?: Partial<AssetFormValues>;
  }>({ open: false, mode: "create" });

  const selectedClientMeta = useMemo(() => {
    if (!form.clientId) return null;
    const clientFound = clients?.find((c: any) => c.id === form.clientId);
    if (!clientFound || !clientFound.notes) return null;
    try { return JSON.parse(clientFound.notes); } catch { return null; }
  }, [form.clientId, clients]);

  // 🚀 Cliente vinculado completo — usado nas guias "Dados Básicos" (CNPJ/CPF, CEP, Endereço)
  // e "Dados Bancários" (lista read-only de contas + PIX).
  const selectedClient = useMemo(() => {
    if (!form.clientId) return null;
    return (clients ?? []).find((c: any) => Number(c.id) === Number(form.clientId)) ?? null;
  }, [clients, form.clientId]);

  // 🚀 Carrega os fiadores já vinculados ao cliente (tabela client_guarantor) para
  // exibi-los como "Sugeridos" na aba Fiadores. Roda apenas quando o cliente muda.
  useEffect(() => {
    if (!open) return;
    if (!form.clientId) {
      setSuggestedGuarantors([]);
      return;
    }
    let cancelled = false;
    api
      .get<GuarantorLite[]>(`/api/clients/${form.clientId}/guarantors`)
      .then(({ data }) => {
        if (!cancelled) setSuggestedGuarantors(data ?? []);
      })
      .catch(() => {
        if (!cancelled) setSuggestedGuarantors([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, form.clientId]);

  /**
   * IDs (do banco) já selecionados em CADA papel — usados para excluí-los
   * dos resultados do modal de busca. Tratamos cada papel separadamente
   * porque a mesma pessoa pode (em tese) figurar como Fiador num contrato
   * e Codevedor em outro — mas dentro de um mesmo papel, não duplica.
   */
  const selectedDbIdsByRole = useMemo(
    () => ({
      FIADOR: selectedGuarantors
        .filter((g) => g.isFromDb && typeof g.id === "number")
        .map((g) => g.id as number),
      CODEVEDOR: selectedCodebtors
        .filter((g) => g.isFromDb && typeof g.id === "number")
        .map((g) => g.id as number),
    }),
    [selectedGuarantors, selectedCodebtors]
  );

  /** Helper único — escolhe o setter da lista correta baseado no papel. */
  const setterFor = useCallback(
    (target: VinculoPessoaType) =>
      target === "CODEVEDOR" ? setSelectedCodebtors : setSelectedGuarantors,
    []
  );

  /**
   * Adiciona uma pessoa do banco à lista correta (Fiadores OU Codevedores).
   * Usado tanto pelos chips "Sugeridos" quanto pelo modal de busca.
   */
  const addPersonFromDb = useCallback(
    (g: GuarantorLite, target: VinculoPessoaType) => {
      setterFor(target)((prev) => {
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
    },
    [setterFor]
  );

  /**
   * Abre o sub-modal em modo "view" (somente leitura) com TODOS os dados
   * da pessoa. Como a tabela na aba mantém apenas um resumo (nome, tipo,
   * documento), precisamos buscar o detalhe completo no backend antes
   * de exibir endereço, RG, nacionalidade, etc.
   */
  const openGuarantorViewModal = useCallback(async (guarantorId: number, target: VinculoPessoaType) => {
    try {
      const { data } = await api.get(`/api/guarantors/${guarantorId}`);
      const g = data?.guarantor;
      if (!g) {
        toast.error("Pessoa não encontrada.");
        return;
      }
      const initialValue: Partial<GuarantorFormValues> = {
        personType: g.personType,
        name: g.name ?? "",
        nationality: g.nationality ?? "",
        maritalStatus: g.maritalStatus ?? "",
        cpf: g.cpf ? maskCPF(g.cpf) : "",
        rg: g.rg ?? "",
        cnpj: g.cnpj ? maskCNPJ(g.cnpj) : "",
        tradeName: g.tradeName ?? "",
        stateRegistration: g.stateRegistration ?? "",
        street: g.street ?? "",
        number: g.number ?? "",
        neighborhood: g.neighborhood ?? "",
        city: g.city ?? "",
        state: g.state ?? "",
        zipCode: g.zipCode ? maskCEP(g.zipCode) : "",
      };
      setQuickModalState({ open: true, mode: "view", initialValue, target });
    } catch (err) {
      toast.error(extractFirstError(err, "Falha ao carregar dados da pessoa."));
    }
  }, []);

  // 🚀 Juros Total = ((p × n) / q) − 1
  //   p = Valor da Prestação (installmentAmount)
  //   n = Número de Meses (installmentCount)
  //   q = Valor Principal (principalAmount) — campo obrigatório do formulário
  const jurosTotalInfo = useMemo(() => {
    const p = Number(form.installmentAmount) || 0;
    const n = Number(form.installmentCount) || 0;
    const q = Number(form.principalAmount) || 0;

    if (q <= 0 || n <= 0 || p <= 0) {
      return { value: null as number | null, q };
    }
    return { value: (p * n) / q - 1, q };
  }, [form.installmentAmount, form.installmentCount, form.principalAmount]);
  const jurosTotal = jurosTotalInfo.value;

  const { visibleIds, toggleColumn, setColumnsVisible, resetDefaults } =
    useColumnVisibility<ContractsColumnId>("unypay.contracts.columns.v1", CONTRACTS_COLUMNS);

  const visibleOrdered: ContractsColumnDef[] = useMemo(
    () => CONTRACTS_COLUMNS.filter((c) => visibleIds.has(c.id)),
    [visibleIds]
  );

  const stickyOffsets = useMemo(() => {
    const offsets = new Map<ContractsColumnId, number>();
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
    const runs: { group: typeof CONTRACTS_GROUP_ORDER[number]; count: number }[] = [];
    for (const col of visibleOrdered) {
      const last = runs[runs.length - 1];
      if (last && last.group === col.group) last.count += 1;
      else runs.push({ group: col.group, count: 1 });
    }
    return runs;
  }, [visibleOrdered]);

  const handleFilterChange = (newSearch: string, newStatus: string) => {
    setPage(1);
    router.get("/contracts", { search: newSearch, statusFilter: newStatus }, { preserveState: true, replace: true });
  };

  const resetModal = () => {
    setForm(emptyForm);
    setEditingId(null);
    setContractPdfFiles([]);
    setExistingPdfNames([]);
    setExistingPdfPaths([]);
    setActiveTab("basico");
    setSelectedGuarantors([]);
    setSelectedCodebtors([]);
    setSuggestedGuarantors([]);
    setVinculoTabActive("FIADOR");
    setSearchModalOpen(false);
    setQuickModalState({ open: false, mode: "create", target: "FIADOR" });
    setSelectedAssets([]);
    setAssetModalState({ open: false, mode: "create" });
  };

  const handleOpenCreate = () => {
    resetModal();
    setOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    const c = item.contract ?? item;
    setEditingId(c.id);
    setForm({
      clientId: Number(c.clientId ?? 0),
      code: c.code ?? "",
      contractName: c.contractName ?? "",
      creditor: c.creditor ?? "UnyPay® S.A.",
      contract_type_id: c.contract_type_id ? String(c.contract_type_id) : "",
      contractType: c.contractType ?? "Mútuo/Confissão de dívida",
      contractDate: c.contractDate ?? new Date().toISOString().slice(0, 10),
      status: (c.status ?? "Ativo") as ContractStatus,
      validated: !!c.validated,
      principalAmount: Number(c.principalAmount ?? 0),
      financedTotal: Number(c.financedTotal ?? 0),
      tacAmount: Number(c.tacAmount ?? 0),
      iofAmount: Number(c.iofAmount ?? 0),
      installmentCount: Number(c.installmentCount ?? 12),
      installmentAmount: Number(c.installmentAmount ?? 0),
      firstDueDate: c.firstDueDate ?? "",
      monthlyInterestRate: Number(c.monthlyInterestRate ?? 0),
      moraRateMonthly: Number(c.moraRateMonthly ?? 0.02),
      penaltyRate: Number(c.penaltyRate ?? 0.1),
      penaltyBaseType: (c.penaltyBaseType ?? "installment") as PenaltyBaseType,
      penaltyScope: (c.penaltyScope ?? "per_installment") as PenaltyScope,
      correctionIndex: c.correctionIndex ?? "IPCA",
      honoraryRate: Number(c.honoraryRate ?? 0),
      accelerates: !!c.accelerates,
      accelerationRule: c.accelerationRule ?? "",
      accelerationConsecutiveThreshold: c.accelerationConsecutiveThreshold ?? undefined,
      accelerationAlternateThreshold: c.accelerationAlternateThreshold ?? undefined,
      guarantees: c.guarantees ?? "",
      guarantors: c.guarantors ?? "",
      validationUrl: c.validationUrl ?? "",
      observations: c.observations ?? "",
      chosenBankAccount: c.chosenBankAccount ?? "",
      paymentMethod: c.paymentMethod ?? "Boleto Bancário",
      forumLocation: c.forumLocation ?? "Belo Horizonte / MG",
      confessionOfDebt: !!c.confessionOfDebt,
    });
    setContractPdfFiles([]);

    try {
      const decodedNames = JSON.parse(c.sourcePdfName || "[]");
      setExistingPdfNames(Array.isArray(decodedNames) ? decodedNames : []);
    } catch {
      setExistingPdfNames(c.sourcePdfName ? [c.sourcePdfName] : []);
    }

    try {
      const decodedPaths = JSON.parse(c.contractPdfPath || "[]");
      setExistingPdfPaths(Array.isArray(decodedPaths) ? decodedPaths : []);
    } catch {
      setExistingPdfPaths(c.contractPdfPath ? [c.contractPdfPath] : []);
    }

    // 🚀 Popula a tabela de fiadores associados a partir do payload do backend.
    // O ContractController@index agora devolve c.guarantors como array (NxN);
    // o "?? []" cobre contratos antigos cuja coluna texto vinha como string.
    const incomingGuarantors = Array.isArray(c.guarantors) ? c.guarantors : [];
    setSelectedGuarantors(
      incomingGuarantors.map((g: any) => ({
        localId: newLocalId(),
        id: g.id,
        isFromDb: true,
        name: g.name,
        personType: g.personType,
        document: g.document ?? null,
      }))
    );

    // 🚀 Mesma estratégia para Codevedores — vêm em c.codebtors (array NxN
    // já filtrado por role='CODEVEDOR' no controller). Como contratos antigos
    // não tinham essa chave, o "?? []" garante compatibilidade retroativa.
    const incomingCodebtors = Array.isArray(c.codebtors) ? c.codebtors : [];
    setSelectedCodebtors(
      incomingCodebtors.map((g: any) => ({
        localId: newLocalId(),
        id: g.id,
        isFromDb: true,
        name: g.name,
        personType: g.personType,
        document: g.document ?? null,
      }))
    );

    // 🚀 Popula a lista de bens em garantia a partir do c.assets que o
    // ContractController@index hidrata. O id preservado aqui é fundamental
    // para o backend fazer UPDATE em vez de DELETE+INSERT (estratégia
    // diff manual definida na Etapa 2).
    const incomingAssets = Array.isArray(c.assets) ? c.assets : [];
    setSelectedAssets(
      incomingAssets.map((a: any): ContractAssetItem => ({
        localId: newLocalId(),
        id: a.id,
        assetType: a.assetType,
        brand:           a.brand           ?? "",
        model:           a.model           ?? "",
        manufactureYear: a.manufactureYear != null ? String(a.manufactureYear) : "",
        modelYear:       a.modelYear       != null ? String(a.modelYear)       : "",
        plate:           a.plate           ?? "",
        renavam:         a.renavam         ?? "",
        chassis:         a.chassis         ?? "",
        description:     a.description     ?? "",
        location:        a.location        ?? "",
        registryNumber:  a.registryNumber  ?? "",
        // 🚀 Aplica a máscara monetária BR (1.234,56) na hidratação para
        // bater visualmente com o formato exigido pelo input.
        // .toFixed(2) garante os 2 decimais mesmo quando o valor é "1234.5".
        totalArea:       a.totalArea != null ? maskArea(Number(a.totalArea).toFixed(2)) : "",
        boundaries:      a.boundaries      ?? "",
      }))
    );

    setActiveTab("basico");
    setOpen(true);
  };

  const ingestPdfFiles = (files: FileList | File[] | null) => {
    if (!files || (files as FileList).length === 0) return;
    const list = Array.from(files as FileList);
    const validFiles: File[] = [];
    for (const file of list) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        toast.error(`O arquivo "${file.name}" não é um PDF válido.`);
        continue;
      }
      if (file.size > MAX_PDF_BYTES) {
        toast.error(`O arquivo "${file.name}" ultrapassa o limite de ${MAX_PDF_MB} MB.`);
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length > 0) {
      setContractPdfFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handlePdfFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    ingestPdfFiles(e.target.files);
    e.target.value = "";
  };

  const handlePdfDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files) ingestPdfFiles(e.dataTransfer.files);
  };

  const removeNewPdf = (idx: number) => {
    setContractPdfFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const removeExistingPdf = (idx: number) => {
    setExistingPdfNames(prev => prev.filter((_, i) => i !== idx));
    setExistingPdfPaths(prev => prev.filter((_, i) => i !== idx));
  };

  /**
   * Monta o FormData do contrato. Recebe as listas FINAIS de IDs (Fiadores e
   * Codevedores), porque o handleSubmit já resolveu as criações on-the-fly
   * antes de chegar aqui. Cada papel é enviado em uma chave própria para
   * que o backend faça syncs independentes na pivot.
   */
  const buildFormData = (
    finalGuarantorIds: number[],
    finalCodebtorIds: number[]
  ): FormData => {
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (typeof v === "boolean") fd.append(k, v ? "1" : "0");
      else fd.append(k, String(v));
    });
    contractPdfFiles.forEach((file) => {
      fd.append("contractPdfs[]", file);
    });
    // Em modo de edição, manda explicitamente quais PDFs existentes manter,
    // permitindo que o backend exclua somente os que o usuário removeu.
    if (editingId) {
      existingPdfPaths.forEach((path) => fd.append("existingPdfPaths[]", path));
      existingPdfNames.forEach((name) => fd.append("existingPdfNames[]", name));
      // Garante que o array vazio chegue ao backend (todos removidos)
      if (existingPdfPaths.length === 0) fd.append("existingPdfPaths", "");
      if (existingPdfNames.length === 0) fd.append("existingPdfNames", "");
    }
    // 🚀 Fiadores (role='FIADOR') e Codevedores (role='CODEVEDOR') na mesma
    // pivot contract_guarantor. Sentinels (chave vazia) servem para sinalizar
    // ao backend que a chave veio MESMO sendo lista vazia — assim ele faz o
    // detach completo daquele papel sem afetar o outro.
    finalGuarantorIds.forEach((id) => fd.append("guarantor_ids[]", String(id)));
    if (finalGuarantorIds.length === 0) fd.append("guarantor_ids", "");

    finalCodebtorIds.forEach((id) => fd.append("codebtor_ids[]", String(id)));
    if (finalCodebtorIds.length === 0) fd.append("codebtor_ids", "");

    // 🚀 Bens em garantia (1:N — tabela contract_assets).
    // Vai como JSON string dentro do FormData porque o request também
    // carrega PDFs (multipart). O ContractController decodifica em
    // `extractAssets` antes de validar e aplicar o diff manual.
    fd.append("assets", JSON.stringify(serializeAssetsForBackend(selectedAssets)));

    return fd;
  };

  /**
   * Persiste no banco as pessoas marcadas como "Novo" (isFromDb=false) de uma
   * lista qualquer (Fiadores OU Codevedores) e devolve a lista final de IDs
   * prontos para o sync da pivot.
   *
   * Estratégia: faz POST sequencial em /api/guarantors com clientIds=[clientId]
   * para já criar a vinculação cliente↔pessoa na tabela client_guarantor.
   * O cadastro mestre é unificado, então mesmo um Codevedor "novo" entra
   * na tabela `guarantors` — o que diferencia o papel é a pivot, no save final.
   */
  const persistNewPersons = async (
    list: ContractGuarantor[],
    label: "fiador" | "codevedor"
  ): Promise<number[]> => {
    const finalIds: number[] = [];

    for (const g of list) {
      if (g.isFromDb && typeof g.id === "number") {
        finalIds.push(g.id);
        continue;
      }
      // Pessoa "Nova" — persistir agora
      if (!g.formValues) {
        // Defesa: não deveria acontecer, mas evita 500 no backend
        toast.error(`${label[0].toUpperCase() + label.slice(1)} "${g.name}" sem dados completos.`);
        throw new Error("person-missing-data");
      }
      const fv = g.formValues;
      const basePayload = {
        personType: fv.personType,
        name: fv.name,
        street: fv.street,
        number: fv.number,
        neighborhood: fv.neighborhood,
        city: fv.city,
        state: fv.state.toUpperCase(),
        zipCode: onlyDigits(fv.zipCode),
        // 🔗 Já vincula ao cliente devedor — atende ao requisito do PRD
        clientIds: form.clientId ? [form.clientId] : [],
      };
      const payload =
        fv.personType === "PF"
          ? {
              ...basePayload,
              nationality: fv.nationality,
              maritalStatus: fv.maritalStatus,
              cpf: onlyDigits(fv.cpf),
              rg: fv.rg,
              cnpj: null,
              tradeName: null,
              stateRegistration: null,
            }
          : {
              ...basePayload,
              cnpj: onlyDigits(fv.cnpj),
              tradeName: fv.tradeName,
              stateRegistration: fv.stateRegistration,
              nationality: null,
              maritalStatus: null,
              cpf: null,
              rg: null,
            };
      const { data } = await api.post("/api/guarantors", payload);
      const createdId = Number(data?.guarantor?.id);
      if (!createdId) throw new Error("person-create-failed");
      finalIds.push(createdId);
    }

    return finalIds;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId) { toast.error("Selecione o cliente vinculado."); return; }
    setSubmitting(true);

    let finalGuarantorIds: number[] = [];
    let finalCodebtorIds: number[]  = [];
    try {
      // 1️⃣ Persiste pessoas marcadas como "Novo" em CADA papel antes de enviar
      // o contrato. Os IDs retornados (existentes + recém-criados) entram no
      // FormData para o backend sincronizar a pivot por papel.
      finalGuarantorIds = await persistNewPersons(selectedGuarantors, "fiador");
      finalCodebtorIds  = await persistNewPersons(selectedCodebtors,  "codevedor");
    } catch (err) {
      setSubmitting(false);
      toast.error(extractFirstError(err, "Falha ao gravar fiador/codevedor novo(s) — verifique os dados."));
      return;
    }

    // 2️⃣ Salva o contrato com os IDs prontos
    const url = editingId ? `/contracts/${editingId}` : "/contracts";
    const fd = buildFormData(finalGuarantorIds, finalCodebtorIds);
    if (editingId) fd.append("_method", "PUT");

    router.post(url, fd, {
      preserveState: false,
      forceFormData: true,
      onSuccess: () => {
        toast.success(editingId ? "Contrato atualizado com sucesso!" : "Contrato gravado com sucesso!");
        setOpen(false);
        resetModal();
      },
      onError: (err: any) => {
        const message = Object.values(err || {}).join(", ") || "Verifique as regras do formulário.";
        toast.error("Erro ao salvar: " + message);
      },
      onFinish: () => setSubmitting(false),
    });
  };

  const handleViewPdf = (item: any) => {
    const c = item.contract ?? item;
    if (!c.hasContractPdf) {
      toast.info("Este contrato não possui minutas digitais anexadas.");
      return;
    }
    let decodedNames: string[] = [];
    try { decodedNames = JSON.parse(c.sourcePdfName || "[]"); } catch { decodedNames = [c.sourcePdfName || "documento.pdf"]; }
    setActivePdfIndex(0);
    setPdfPreview({ id: c.id, code: c.code ?? "", names: decodedNames });
  };

  const handleDelete = (item: any) => {
    const c = item.contract ?? item;
    setConfirmDelete({ ...c, _client: item.client_name ?? item.clientName ?? null });
  };

  const handleCancel = (item: any) => {
    const c = item.contract ?? item;
    const enriched = { ...c, _client: item.client_name ?? item.clientName ?? null };
    if (c.status === "Cancelado") {
      setConfirmReactivate(enriched);
    } else {
      setConfirmCancel(enriched);
    }
  };

  // Handlers chamados pelos ConfirmDialog
  const executeDelete = () => {
    if (!confirmDelete) return;
    router.delete(`/contracts/${confirmDelete.id}`, {
      preserveScroll: true,
      onSuccess: () => { toast.success("Contrato removido."); setConfirmDelete(null); },
      onError:   () => { toast.error("Falha ao deletar o registro."); setConfirmDelete(null); },
    });
  };

  const executeCancel = () => {
    if (!confirmCancel) return;
    router.post(`/contracts/${confirmCancel.id}/cancel`, {}, {
      preserveScroll: true,
      onSuccess: () => { toast.success("Contrato cancelado."); setConfirmCancel(null); },
      onError:   () => { toast.error("Falha ao cancelar o contrato."); setConfirmCancel(null); },
    });
  };

  const executeReactivate = () => {
    if (!confirmReactivate) return;
    router.post(`/contracts/${confirmReactivate.id}/reactivate`, {}, {
      preserveScroll: true,
      onSuccess: () => { toast.success("Contrato reativado."); setConfirmReactivate(null); },
      onError:   () => { toast.error("Falha ao reativar o contrato."); setConfirmReactivate(null); },
    });
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
        const cName = item.client_name ?? item.clientName ?? "";
        return (
          (!search || contractObj.contractName.toLowerCase().includes(q) || contractObj.code.toLowerCase().includes(q) || cName.toLowerCase().includes(q)) &&
          (statusFilter === "Todos" || contractObj.status === statusFilter)
        );
      })
      .sort((a: any, b: any) => {
        let va: any, vb: any;
        const cA = a.contract ?? a; const cB = b.contract ?? b;
        if (sortCol === "code") { va = cA.code; vb = cB.code; }
        else if (sortCol === "client") { va = a.client_name ?? a.clientName ?? ""; vb = b.client_name ?? b.clientName ?? ""; }
        else if (sortCol === "principal") { va = +cA.principalAmount; vb = +cB.principalAmount; }
        else if (sortCol === "status") { va = cA.status; vb = cB.status; }
        else { va = cA.code; vb = cB.code; }
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [contracts, search, statusFilter, sortCol, sortDir]);

  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const renderCellContent = (col: ContractsColumnDef, item: any): React.ReactNode => {
    const contract = item.contract ?? item;
    const sc = STATUS_BADGE[contract.status] ?? STATUS_BADGE["Ativo"];
    switch (col.id) {
      case "code": return <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "#6b7280", fontWeight: 500 }}>{contract.code}</span>;
      case "client": return <div style={{ maxWidth: col.width - 14, fontWeight: 700, fontSize: 11, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.client_name ?? item.clientName ?? "—"}</div>;
      case "contractType": return <span style={{ fontSize: 10, padding: "2px 6px", background: "#f3f4f6", borderRadius: 4, fontWeight: 500, color: "#4b5563" }}>{contract.contract_type_name ?? contract.contractType ?? "Mútuo"}</span>;
      case "contractName": return <span style={{ fontSize: 11, color: "#374151" }}>{contract.contractName}</span>;
      case "creditor": return <span style={{ fontSize: 10, color: "#6b7280" }}>{contract.creditor}</span>;
      case "principal": return <span style={{ ...tdNum, fontWeight: 700, fontSize: 11 }}>{fmt(contract.principalAmount)}</span>;
      case "financed": return <span style={{ ...tdNum, fontSize: 11, color: "#6b7280" }}>{fmt(contract.financedTotal)}</span>;
      case "installments": return <span style={{ color: "#6b7280" }}>{contract.installmentCount}×</span>;
      case "installmentAmt": return <span style={{ ...tdNum, fontSize: 11, color: "#6b7280" }}>{fmt(contract.installmentAmount)}</span>;
      case "status": return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: "uppercase", background: sc.bg, color: sc.color }}>{contract.status}</span>;
      case "validated": return contract.validated ? <CheckCircle size={12} style={{ color: "#059669" }} /> : <span style={{ color: "#9ca3af" }}>—</span>;
      case "firstDue": return <span style={{ fontSize: 10, whiteSpace: "nowrap" }}>{fmtDate(contract.firstDueDate)}</span>;
      case "moraRate": return <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10 }}>{fmtPct(contract.moraRateMonthly)}</span>;
      default: return null;
    }
  };

  return (
    <UnyPayLayout>
      <Head title="Carteira de Contratos" />

      <style>{`
        /* —— Caixa alta visual da tela inteira (incluindo modal) —— */
        .contracts-page,
        .contracts-page input,
        .contracts-page select,
        .contracts-page textarea,
        .contracts-page button,
        .contracts-page option,
        .contracts-page label { text-transform: uppercase; }

        /* Mantém placeholders e dados monoespaçados sensíveis (PIX, conta, urls)
           legíveis sem quebra cosmética */
        .contracts-page input.mono,
        .contracts-page input[type="email"],
        .contracts-page input[type="url"],
        .contracts-page input[type="date"],
        .contracts-page input[type="number"] { text-transform: none; }
        .contracts-page input::placeholder,
        .contracts-page textarea::placeholder { text-transform: none; }

        /* —— Refinamentos do modal de contratos —— */
        .contracts-modal { border-radius: 10px; }
        .contracts-modal-body { scroll-behavior: smooth; }
        .contracts-modal-body::-webkit-scrollbar { width: 8px; }
        .contracts-modal-body::-webkit-scrollbar-track { background: #f1f5f9; }
        .contracts-modal-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .contracts-modal-body::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        .contracts-page .sigx-input {
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .contracts-page .sigx-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }
        .contracts-page .sigx-input[readonly] { cursor: default; }

        .contracts-page .btn-icon { transition: all 0.12s; }
        .contracts-page .btn-icon:hover { transform: translateY(-1px); }
      `}</style>

      <div className="contracts-page" style={{ padding: "12px 20px 16px 20px", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", gap: 12 }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>Contratos e Ativos</h1>
          <button onClick={handleOpenCreate} className="btn-primary" style={{ padding: "6px 14px", fontSize: 11 }}>
            <Plus size={12} /> Novo Contrato
          </button>
        </div>

        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input style={{ paddingLeft: 26, width: 260, fontSize: 11, height: 28, border: "1px solid #d1d5db", borderRadius: 6, outline: "none", color: "#374151" }} placeholder="Buscar contratos..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <select style={{ width: 150, fontSize: 11, height: 28, background: "white", border: "1px solid #d1d5db", borderRadius: 6, color: "#374151", cursor: "pointer", flexShrink: 0 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); handleFilterChange(search, e.target.value); }}>
              <option value="Todos">Todos os status</option>
              <option value="Ativo">Ativo</option>
              <option value="Inadimplente">Inadimplente</option>
              <option value="Quitado">Quitado</option>
              <option value="Renegociado">Renegociado</option>
              <option value="Cancelado">Cancelado</option>
            </select>
            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, flexShrink: 0 }}>{totalRows} contratos</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <TableGroupBadges allColumns={CONTRACTS_COLUMNS} groupOrder={CONTRACTS_GROUP_ORDER} groupMeta={CONTRACTS_GROUP_META} visibleIds={visibleIds} setColumnsVisible={setColumnsVisible} />
            <TableColumnPicker allColumns={CONTRACTS_COLUMNS} groupOrder={CONTRACTS_GROUP_ORDER} groupMeta={CONTRACTS_GROUP_META} visibleIds={visibleIds} toggleColumn={toggleColumn} setColumnsVisible={setColumnsVisible} resetDefaults={resetDefaults} />
          </div>
        </div>

        <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "white" }}>
          <div style={{ flex: 1, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 11, minWidth: 900 }}>
              <colgroup>
                {visibleOrdered.map(col => <col key={col.id} style={{ width: col.width }} />)}
                <col style={{ width: ACTIONS_WIDTH }} />
              </colgroup>
              <thead>
                <tr>
                  {visibleGroupRuns.map((run, i) => {
                    const meta = CONTRACTS_GROUP_META[run.group];
                    return (
                      <th key={`${run.group}-${i}`} colSpan={run.count} style={{ background: meta.bg, color: meta.color, textAlign: "center", padding: "4px 8px", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        {meta.label}
                      </th>
                    );
                  })}
                  <th style={{ background: "#1e2139", color: "white", textAlign: "center", padding: "4px 8px", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Ações</th>
                </tr>
                <tr>
                  {visibleOrdered.map(col => {
                    const stickyStyle: React.CSSProperties = col.sticky ? { position: "sticky", left: stickyOffsets.get(col.id), zIndex: 2, background: "#f1f5f9" } : {};
                    return <th key={col.id} style={{ ...headerCellStyle, textAlign: col.align, ...stickyStyle }}>{col.label.toUpperCase()}</th>;
                  })}
                  <th style={{ ...headerCellStyle, textAlign: "center" }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={visibleOrdered.length + 1} style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
                      <FileText size={28} style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }} /> Nenhum contrato localizado
                    </td>
                  </tr>
                ) : (
                  paginated.map((item: any, rowIdx: number) => {
                    const c = item.contract ?? item;
                    const rowBg = rowIdx % 2 === 1 ? "#fafafa" : "white";
                    return (
                      <tr key={c.id} style={{ background: rowBg }} onMouseOver={e => (e.currentTarget.style.background = "#eff6ff")} onMouseOut={e => (e.currentTarget.style.background = rowBg)}>
                        {visibleOrdered.map(col => {
                          const stickyStyle: React.CSSProperties = col.sticky ? { position: "sticky", left: stickyOffsets.get(col.id), zIndex: 1, background: "inherit" } : {};
                          const base = col.align === "right" ? { ...tdBase, textAlign: "right" as const } : col.align === "center" ? tdCenter : tdBase;
                          return <td key={col.id} style={{ ...base, ...stickyStyle }}>{renderCellContent(col, item)}</td>;
                        })}
                        <td style={tdCenter}>
                          <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                            {c.hasContractPdf && (
                              <button type="button" className="btn-icon" onClick={() => handleViewPdf(item)} title="Visualizar Minutas Anexas">
                                <Eye size={11} style={{ color: "#2563eb" }} />
                              </button>
                            )}
                            <button type="button" className="btn-icon" onClick={() => handleOpenEdit(item)} title="Editar Contrato"><Edit2 size={11} /></button>
                            {c.status === "Cancelado" ? (
                              <button type="button" className="btn-icon" onClick={() => handleCancel(item)} title="Reativar Contrato">
                                <RotateCcw size={11} style={{ color: "#059669" }} />
                              </button>
                            ) : (
                              <button type="button" className="btn-icon" onClick={() => handleCancel(item)} title="Cancelar Contrato">
                                <Ban size={11} style={{ color: "#d97706" }} />
                              </button>
                            )}
                            <button type="button" className="btn-icon text-danger" onClick={() => handleDelete(item)} title="Excluir Contrato"><Trash2 size={11} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ padding: "6px 12px", background: "#fafbfc", borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6b7280" }}>
              <span>Exibir</span>
              <select style={{ padding: "2px 6px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 11, background: "white" }} value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(1); }}>
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <span>por página</span>
            </div>
            <span style={{ fontSize: 11, color: "#6b7280" }}>Mostrando {Math.min((page - 1) * pageSize + 1, totalRows)}–{Math.min(page * pageSize, totalRows)} de {totalRows}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "3px 10px", border: "1px solid #d1d5db", borderRadius: 4, background: "white", fontSize: 11, cursor: page === 1 ? "not-allowed" : "pointer", color: page === 1 ? "#9ca3af" : "#374151" }}>← Anterior</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const n = page <= 3 ? i + 1 : page - 2 + i;
                if (n < 1 || n > totalPages) return null;
                return (
                  <button type="button" key={n} onClick={() => setPage(n)} style={{ width: 28, height: 26, borderRadius: 4, border: "1px solid", fontSize: 11, background: n === page ? "#1a2035" : "white", color: n === page ? "white" : "#374151", borderColor: n === page ? "#1a2035" : "#d1d5db", fontWeight: n === page ? 700 : 400, cursor: "pointer" }}>{n}</button>
                );
              })}
              <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ padding: "3px 10px", border: "1px solid #d1d5db", borderRadius: 4, background: "white", fontSize: 11, cursor: page >= totalPages ? "not-allowed" : "pointer", color: page >= totalPages ? "#9ca3af" : "#374151" }}>Próxima →</button>
            </div>
          </div>
        </div>

        {/* Modal Principal Cadastro / Edição */}
        {open && (
          <div className="sigx-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
            <div
              className="sigx-modal contracts-modal"
              style={{
                width: "min(1020px, 96vw)",
                maxWidth: "96vw",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                boxShadow: "0 24px 60px rgba(15, 23, 42, 0.25)",
              }}
              onMouseDown={e => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 22px",
                  background: "linear-gradient(135deg, #1e2139 0%, #2d3154 100%)",
                  color: "white",
                  borderBottom: "1px solid #2d3154",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FileText size={16} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>
                      {editingId ? "Editar Contrato" : "Novo Contrato"}
                    </span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                      {editingId ? `Atualizando registro #${editingId}` : "Preencha as guias abaixo para registrar o ativo"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setOpen(false); resetModal(); }}
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

              <div
                style={{
                  display: "flex",
                  gap: 4,
                  background: "#f8fafc",
                  padding: "8px 12px",
                  borderBottom: "1px solid #e5e7eb",
                  overflowX: "auto",
                  flexWrap: "nowrap",
                }}
              >
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.key;
                  return (
                    <button
                      type="button"
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
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
                        color: active ? "#1e2139" : "#475569",
                        border: active ? "1px solid #e2e8f0" : "1px solid transparent",
                        boxShadow: active ? "0 1px 2px rgba(15,23,42,0.06)" : "none",
                        whiteSpace: "nowrap",
                        transition: "all 0.1s",
                      }}
                    >
                      <Icon size={12} style={{ color: active ? "#2563eb" : "#94a3b8" }} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                <div
                  className="sigx-modal-body contracts-modal-body"
                  style={{
                    padding: 22,
                    height: "clamp(440px, 60vh, 68vh)",
                    overflowY: "auto",
                    background: "white",
                  }}
                >
                  
                  {/* TAB 1: BÁSICO */}
                  {activeTab === "basico" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div style={{ gridColumn: "span 2" }}>
                        <label className="sigx-label">CLIENTE DEVEDOR *</label>
                        <select className="sigx-input" value={String(form.clientId || "")} onChange={e => setForm(p => ({ ...p, clientId: Number(e.target.value), chosenBankAccount: "" }))}>
                          <option value="">Selecione o cliente</option>
                          {clients?.map((c: any) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                        </select>
                      </div>

                      {/* 🚀 Campos do cliente vinculado (somente leitura — editados no CRUD de Clientes) */}
                      <div>
                        <label className="sigx-label">CNPJ/CPF</label>
                        <input
                          className="sigx-input"
                          value={selectedClient?.document ?? ""}
                          readOnly
                          placeholder={selectedClient ? "—" : "Selecione um cliente"}
                          style={{ background: "#f9fafb", color: "#4b5563" }}
                        />
                      </div>
                      <div>
                        <label className="sigx-label">CEP</label>
                        <input
                          className="sigx-input"
                          value={selectedClient?.zipCode ?? ""}
                          readOnly
                          placeholder={selectedClient ? "—" : "Selecione um cliente"}
                          style={{ background: "#f9fafb", color: "#4b5563" }}
                        />
                      </div>
                      <div style={{ gridColumn: "span 2" }}>
                        <label className="sigx-label">ENDEREÇO</label>
                        <input
                          className="sigx-input"
                          value={
                            selectedClient
                              ? [selectedClient.address, selectedClient.city, selectedClient.state]
                                  .filter(Boolean)
                                  .join(" — ")
                              : ""
                          }
                          readOnly
                          placeholder={selectedClient ? "—" : "Selecione um cliente"}
                          style={{ background: "#f9fafb", color: "#4b5563" }}
                        />
                      </div>

                      <div><label className="sigx-label">CÓDIGO INTERNO *</label><input className="sigx-input" value={form.code} onChange={n("code")} required /></div>
                      <div><label className="sigx-label">DATA DE EMISSÃO</label><input type="date" className="sigx-input" value={form.contractDate} onChange={n("contractDate")} /></div>
                      <div style={{ gridColumn: "span 2" }}><label className="sigx-label">NOME OU OBJETO DO CONTRATO *</label><input className="sigx-input" value={form.contractName} onChange={n("contractName")} required /></div>
                      <div><label className="sigx-label">CREDOR DA DÍVIDA</label><input className="sigx-input" value={form.creditor} onChange={n("creditor")} /></div>
                      <div>
                        <label className="sigx-label">TIPO ESTRUTURAL *</label>
                        <select className="sigx-input" required value={form.contract_type_id} onChange={e => setForm(p => ({ ...p, contract_type_id: e.target.value }))}>
                          <option value="">Selecione...</option>
                          {contractTypes.map((type: any) => <option key={type.id} value={type.id}>{type.name}</option>)}
                        </select>
                      </div>
                      
                      <div style={{ gridColumn: "span 2" }}>
                        <label className="sigx-label">STATUS OPERACIONAL DO CONTRATO *</label>
                        <select className="sigx-input" value={form.status} onChange={n("status")} required>
                          <option value="Ativo">Ativo / Regular</option>
                          <option value="Inadimplente">Inadimplente / Jurídico</option>
                          <option value="Quitado">Quitado / Baixado</option>
                          <option value="Renegociado">Renegociado</option>
                          <option value="Cancelado">Cancelado</option>
                        </select>
                      </div>

                      <div style={{ gridColumn: "span 2" }}>
                        <label className="sigx-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Paperclip size={12} style={{ color: "#2563eb" }} /> ANEXAR DOCUMENTOS E ATIVOS (PDF)
                        </label>

                        <label
                          htmlFor="contract-pdf-input"
                          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                          onDragEnter={e => { e.preventDefault(); setIsDragging(true); }}
                          onDragLeave={() => setIsDragging(false)}
                          onDrop={handlePdfDrop}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 12,
                            padding: "18px 16px",
                            border: `2px dashed ${isDragging ? "#2563eb" : "#cbd5e1"}`,
                            borderRadius: 8,
                            background: isDragging ? "#eff6ff" : "#f8fafc",
                            color: "#475569",
                            cursor: "pointer",
                            transition: "all 0.15s",
                            textAlign: "center",
                          }}
                        >
                          <div style={{ width: 38, height: 38, borderRadius: 8, background: "white", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Upload size={16} style={{ color: "#2563eb" }} />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>
                              Clique para selecionar ou arraste seus PDFs aqui
                            </span>
                            <span style={{ fontSize: 10, color: "#64748b", fontWeight: 500 }}>
                              Aceita múltiplos arquivos · Máx. {MAX_PDF_MB} MB cada
                            </span>
                          </div>
                          <input
                            id="contract-pdf-input"
                            type="file"
                            accept=".pdf"
                            onChange={handlePdfFilesChange}
                            multiple
                            style={{ display: "none" }}
                          />
                        </label>

                        {(contractPdfFiles.length > 0 || existingPdfNames.length > 0) && (
                          <div style={{ marginTop: 12, padding: 10, background: "white", border: "1px solid #e2e8f0", borderRadius: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em" }}>
                              DOCUMENTOS DESTE INSTRUMENTO ({existingPdfNames.length + contractPdfFiles.length})
                            </span>

                            {existingPdfNames.map((name, idx) => (
                              <div
                                key={`exist-${idx}`}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "6px 10px",
                                  background: "#f0fdf4",
                                  border: "1px solid #bbf7d0",
                                  borderRadius: 6,
                                  fontSize: 11,
                                }}
                              >
                                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  <FileText size={12} style={{ color: "#059669", flexShrink: 0 }} />
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                                  <span style={{ fontSize: 9, color: "#065f46", background: "#d1fae5", padding: "1px 6px", borderRadius: 3, fontWeight: 700, flexShrink: 0 }}>Salvo</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeExistingPdf(idx)}
                                  title="Remover este documento"
                                  style={{
                                    background: "white",
                                    border: "1px solid #fecaca",
                                    color: "#dc2626",
                                    cursor: "pointer",
                                    width: 22, height: 22,
                                    borderRadius: 4,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            ))}

                            {contractPdfFiles.map((file, idx) => (
                              <div
                                key={`new-${idx}`}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "6px 10px",
                                  background: "#fff7ed",
                                  border: "1px solid #fed7aa",
                                  borderRadius: 6,
                                  fontSize: 11,
                                }}
                              >
                                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  <FileText size={12} style={{ color: "#ea580c", flexShrink: 0 }} />
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                                  <span style={{ fontSize: 9, color: "#9a3412", background: "#ffedd5", padding: "1px 6px", borderRadius: 3, fontWeight: 700, flexShrink: 0 }}>Pendente</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeNewPdf(idx)}
                                  title="Descartar este arquivo"
                                  style={{
                                    background: "white",
                                    border: "1px solid #fecaca",
                                    color: "#dc2626",
                                    cursor: "pointer",
                                    width: 22, height: 22,
                                    borderRadius: 4,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: FINANCEIRO */}
                  {activeTab === "financeiro" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
                        <div>
                          <label className="sigx-label">VALOR PRINCIPAL (R$) *</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="sigx-input mono"
                            placeholder="0,00"
                            value={maskMoneyDisplay(form.principalAmount)}
                            onChange={e => setForm(p => ({ ...p, principalAmount: maskMoneyParse(e.target.value) }))}
                            required
                          />
                        </div>
                        <div>
                          <label className="sigx-label">VALOR FINANCIADO (R$)</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="sigx-input mono"
                            placeholder="0,00"
                            value={maskMoneyDisplay(form.financedTotal)}
                            onChange={e => setForm(p => ({ ...p, financedTotal: maskMoneyParse(e.target.value) }))}
                          />
                        </div>
                        <div>
                          <label className="sigx-label">Nº DE PARCELAS *</label>
                          <input type="number" className="sigx-input" value={form.installmentCount} onChange={numI("installmentCount")} required />
                        </div>
                        <div>
                          <label className="sigx-label">VALOR DA PARCELA (R$) *</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="sigx-input mono"
                            placeholder="0,00"
                            value={maskMoneyDisplay(form.installmentAmount)}
                            onChange={e => setForm(p => ({ ...p, installmentAmount: maskMoneyParse(e.target.value) }))}
                            required
                          />
                        </div>
                      </div>

                      <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: 14 }}>
                        <label className="sigx-label" style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 700, color: "#1e293b" }}><CreditCard size={13} /> CONTA DE DESTINO PARA LIQUIDAÇÃO</label>
                        <span style={{ fontSize: 11, color: "#64748b", marginBottom: 10, display: "block" }}>Selecione abaixo uma das contas homologadas no cadastro do devedor e defina a esteira de cobrança:</span>
                        
                        {!form.clientId ? (
                          <div style={{ padding: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 11, color: "#94a3b8", textAlign: "center" }}>Selecione um cliente na aba "Dados Básicos" para ver as contas bancárias disponíveis.</div>
                        ) : !selectedClientMeta?.bankAccounts || selectedClientMeta.bankAccounts.length === 0 ? (
                          <div style={{ padding: 12, background: "#fff7ed", border: "1px solid #ffedd5", borderRadius: 6, fontSize: 11, color: "#c2410c" }}>Este cliente não possui nenhuma conta bancária cadastrada na sua ficha cadastral.</div>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            {selectedClientMeta.bankAccounts.map((acc: any, idx: number) => {
                              const uniqueBankKey = `${acc.banco}-${acc.agencia}-${acc.conta}`;
                              const isSelected = form.chosenBankAccount === uniqueBankKey;
                              return (
                                <div 
                                  key={idx} 
                                  onClick={() => setForm(p => ({ ...p, chosenBankAccount: uniqueBankKey }))}
                                  style={{
                                    padding: 10, borderRadius: 6, border: isSelected ? "2px solid #2563eb" : "1px solid #cbd5e1",
                                    background: isSelected ? "#eff6ff" : "white", cursor: "pointer", transition: "all 0.1s"
                                  }}
                                >
                                  <div style={{ fontWeight: 700, fontSize: 12, color: "#0f172a" }}>{acc.banco || "Banco não informado"}</div>
                                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>Ag: {acc.agencia} | Conta: {acc.conta} ({acc.tipo})</div>
                                  {acc.hasPix && acc.pixKey && (
                                    <div style={{ fontSize: 10, color: "#0d9488", display: "flex", alignItems: "center", gap: 4, marginTop: 4, background: "#f0fdf4", padding: "1px 4px", borderRadius: 3, width: "fit-content" }}>
                                      <QrCode size={10} /> PIX: {acc.pixKey}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {form.chosenBankAccount && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
                            <div>
                              <label className="sigx-label">ESTEIRA / MEIO DE PAGAMENTO</label>
                              <select className="sigx-input" value={form.paymentMethod} onChange={n("paymentMethod")}>
                                <option value="Boleto Bancário">Boleto Bancário Estruturado</option>
                                <option value="PIX QrCode">PIX Dinâmico (QrCode)</option>
                                <option value="TED / DOC">TED / Transferência Direta</option>
                                <option value="Cheque Operacional">Cartula / Cheque Operacional</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: TAXAS */}
                  {activeTab === "taxas" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                        <div>
                          <label className="sigx-label">INDEXADOR DE CORREÇÃO MONETÁRIA</label>
                          <select className="sigx-input" value={form.correctionIndex} onChange={n("correctionIndex")}>
                            <option value="PRE">Pré-fixado (Sem Correção)</option>
                            <option value="IPCA">IPCA (IBGE - Inflação Oficial)</option>
                            <option value="IGPM">IGP-M (FGV - Mercado)</option>
                          </select>
                        </div>
                        <div>
                          <label className="sigx-label">DATA DO 1º VENCIMENTO</label>
                          <input type="date" className="sigx-input" value={form.firstDueDate || ""} onChange={n("firstDueDate")} />
                        </div>
                        <div>
                          <label className="sigx-label" style={{ color: "#2563eb", fontWeight: 700 }}>TARIFA DE ESTRUTURAÇÃO (TAC R$)</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="sigx-input mono"
                            style={{ borderColor: "#2563eb" }}
                            placeholder="0,00"
                            value={maskMoneyDisplay(form.tacAmount)}
                            onChange={e => setForm(p => ({ ...p, tacAmount: maskMoneyParse(e.target.value) }))}
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
                            value={maskPercentDisplay(form.monthlyInterestRate)}
                            onChange={e => setForm(p => ({ ...p, monthlyInterestRate: maskPercentParse(e.target.value) }))}
                          />
                        </div>
                        <div>
                          <label className="sigx-label">MORA MENSAL (ATRASO) (%)</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="sigx-input mono"
                            placeholder="0,00"
                            value={maskPercentDisplay(form.moraRateMonthly)}
                            onChange={e => setForm(p => ({ ...p, moraRateMonthly: maskPercentParse(e.target.value) }))}
                          />
                        </div>
                        <div>
                          <label className="sigx-label">MULTA PENAL POR ATRASO (%)</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="sigx-input mono"
                            placeholder="0,00"
                            value={maskPercentDisplay(form.penaltyRate)}
                            onChange={e => setForm(p => ({ ...p, penaltyRate: maskPercentParse(e.target.value) }))}
                          />
                        </div>
                      </div>

                      {/* 🚀 Juros Total = ((p × n) / q) − 1 — card externo com 5 mini-cards */}
                      {(() => {
                        const ready = jurosTotal !== null;
                        const positive = ready && (jurosTotal as number) >= 0;
                        const accent = !ready ? "#94a3b8" : (positive ? "#0369a1" : "#dc2626");
                        const accentSoft = !ready ? "#f1f5f9" : (positive ? "#e0f2fe" : "#fee2e2");
                        const totalPagar = Number(form.financedTotal) || 0;
                        const hasTotal = totalPagar > 0;

                        const cards = [
                          {
                            letter: "p",
                            label: "Parcela",
                            value: fmt(form.installmentAmount || 0),
                            mono: true,
                            color: "#0369a1",
                            soft: "#e0f2fe",
                            valueColor: "#0c4a6e",
                            ready: (Number(form.installmentAmount) || 0) > 0,
                          },
                          {
                            letter: "n",
                            label: "Nº de Meses",
                            value: `${form.installmentCount || 0}×`,
                            mono: false,
                            color: "#7c3aed",
                            soft: "#ede9fe",
                            valueColor: "#5b21b6",
                            ready: (Number(form.installmentCount) || 0) > 0,
                          },
                          {
                            letter: "q",
                            label: "Financiado",
                            value: fmt(form.principalAmount || 0),
                            mono: true,
                            color: "#059669",
                            soft: "#d1fae5",
                            valueColor: "#065f46",
                            ready: (Number(form.principalAmount) || 0) > 0,
                          },
                          {
                            letter: "Σ",
                            label: "Total a Pagar",
                            value: hasTotal ? fmt(totalPagar) : "—",
                            mono: true,
                            color: "#ea580c",
                            soft: "#ffedd5",
                            valueColor: "#9a3412",
                            ready: hasTotal,
                          },
                          {
                            letter: "%",
                            label: "Juros Total",
                            value: ready ? `${((jurosTotal as number) * 100).toFixed(2)}%` : "—",
                            mono: true,
                            color: ready ? (positive ? "#0369a1" : "#dc2626") : "#94a3b8",
                            soft: ready ? (positive ? "#dbeafe" : "#fee2e2") : "#f1f5f9",
                            valueColor: ready ? (positive ? "#0c4a6e" : "#991b1b") : "#94a3b8",
                            ready,
                            highlight: true,
                          },
                        ];

                        return (
                          <div
                            style={{
                              marginTop: 4,
                              borderRadius: 12,
                              background: "white",
                              border: "1px solid #e2e8f0",
                              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                              overflow: "hidden",
                              position: "relative",
                            }}
                          >
                            {/* Faixa lateral colorida indicando estado do cálculo */}
                            <div
                              style={{
                                position: "absolute",
                                left: 0, top: 0, bottom: 0,
                                width: 4,
                                background: accent,
                              }}
                            />

                            {/* Cabeçalho do card externo */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                padding: "12px 16px 12px 20px",
                                borderBottom: "1px solid #f1f5f9",
                                background: "linear-gradient(180deg, #fafbfc 0%, white 100%)",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div
                                  style={{
                                    width: 32, height: 32,
                                    borderRadius: 8,
                                    background: accentSoft,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  <Percent size={15} style={{ color: accent }} />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", letterSpacing: "0.04em" }}>
                                    Juros Total do Contrato
                                  </span>
                                  <span style={{ fontSize: 10, color: "#64748b", fontWeight: 500, textTransform: "none" }}>
                                    Calculado automaticamente a partir dos valores informados
                                  </span>
                                </div>
                              </div>
                              <span
                                style={{
                                  fontSize: 9,
                                  color: accent,
                                  fontWeight: 700,
                                  letterSpacing: "0.06em",
                                  padding: "3px 8px",
                                  background: accentSoft,
                                  borderRadius: 4,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {ready ? (positive ? "TAXA EFETIVA TOTAL" : "RETORNO NEGATIVO") : "AGUARDANDO DADOS"}
                              </span>
                            </div>

                            {/* Conteúdo: 5 mini-cards + fórmula */}
                            <div style={{ padding: "14px 16px 14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                                gap: 8,
                              }}
                            >
                              {cards.map(c => (
                                <div
                                  key={c.letter}
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "flex-start",
                                    gap: 8,
                                    padding: "12px 12px",
                                    background: c.highlight ? c.soft : "white",
                                    border: `1px solid ${c.highlight ? c.color + "55" : "#e2e8f0"}`,
                                    borderRadius: 10,
                                    boxShadow: c.highlight ? `0 1px 4px ${c.color}22` : "0 1px 2px rgba(15,23,42,0.03)",
                                    minWidth: 0,
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
                                    <span
                                      style={{
                                        width: 22, height: 22,
                                        borderRadius: 6,
                                        background: c.highlight ? "white" : c.soft,
                                        color: c.color,
                                        border: `1px solid ${c.color}33`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontFamily: "'IBM Plex Mono', monospace",
                                        fontSize: 12, fontWeight: 700,
                                        flexShrink: 0,
                                        textTransform: "none",
                                      }}
                                    >
                                      {c.letter}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 9,
                                        color: c.highlight ? c.color : "#64748b",
                                        fontWeight: 700,
                                        letterSpacing: "0.06em",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {c.label.toUpperCase()}
                                    </span>
                                  </div>
                                  <span
                                    style={{
                                      fontFamily: c.mono ? "'IBM Plex Mono', monospace" : "inherit",
                                      fontSize: c.highlight ? 18 : 14,
                                      fontWeight: 700,
                                      color: c.ready ? c.valueColor : "#94a3b8",
                                      letterSpacing: "-0.01em",
                                      lineHeight: 1.1,
                                      width: "100%",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                    title={c.value}
                                  >
                                    {c.value}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Fórmula em chip claro */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "8px 12px",
                                background: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                borderRadius: 6,
                                fontFamily: "'IBM Plex Mono', monospace",
                                fontSize: 12,
                                color: "#0f172a",
                                letterSpacing: "0.02em",
                                textTransform: "none",
                                flexWrap: "wrap",
                              }}
                            >
                              <span style={{ color: "#64748b", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                Fórmula
                              </span>
                              <span style={{ color: "#cbd5e1" }}>│</span>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <span style={{ color: "#64748b" }}>(</span>
                                <span style={{ color: "#0369a1", fontWeight: 700 }}>p</span>
                                <span style={{ color: "#475569" }}>×</span>
                                <span style={{ color: "#7c3aed", fontWeight: 700 }}>n</span>
                                <span style={{ color: "#64748b" }}>)</span>
                                <span style={{ color: "#475569" }}>÷</span>
                                <span style={{ color: "#059669", fontWeight: 700 }}>q</span>
                                <span style={{ color: "#475569" }}>−</span>
                                <span style={{ color: "#b45309", fontWeight: 700 }}>1</span>
                                <span style={{ color: "#475569", margin: "0 6px" }}>=</span>
                                <span style={{ color: "#0f172a", fontWeight: 700 }}>Juros Total</span>
                              </span>
                            </div>

                            {!ready && (
                              <div
                                style={{
                                  fontSize: 10,
                                  color: "#92400e",
                                  background: "#fffbeb",
                                  border: "1px solid #fde68a",
                                  borderRadius: 6,
                                  padding: "6px 10px",
                                  fontWeight: 600,
                                }}
                              >
                                Informe Valor Principal, Valor da Parcela e Nº de Meses para calcular.
                              </div>
                            )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* TAB 4: FIADOR / CODEVEDOR — sub-abas controladas localmente.
                      Cada sub-aba reusa o mesmo componente VinculoPessoaList,
                      passando uma `data` diferente e `type` que controla as
                      labels. Toda a lógica (modal de busca/criação rápida,
                      remoção, persistência) vive no pai e é compartilhada. */}
                  {activeTab === "fiadores" && (() => {
                    const isFiador = vinculoTabActive === "FIADOR";
                    const list = isFiador ? selectedGuarantors : selectedCodebtors;
                    const setList = isFiador ? setSelectedGuarantors : setSelectedCodebtors;

                    const subTabBaseStyle: React.CSSProperties = {
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
                    const subTabActiveStyle: React.CSSProperties = {
                      background: "rgb(30, 58, 95)",
                      color: "white",
                      borderColor: "rgb(30, 58, 95)",
                    };

                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {/* Sub-abas FIADOR / CODEVEDOR */}
                        <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden" }}>
                          <button
                            type="button"
                            onClick={() => setVinculoTabActive("FIADOR")}
                            style={{
                              ...subTabBaseStyle,
                              borderTopLeftRadius: 6,
                              borderBottomLeftRadius: 6,
                              ...(isFiador ? subTabActiveStyle : {}),
                            }}
                          >
                            <UserCheck size={12} /> Fiadores
                            <span
                              style={{
                                marginLeft: 4,
                                fontSize: 10,
                                background: isFiador ? "rgba(255,255,255,0.22)" : "#e2e8f0",
                                padding: "1px 7px",
                                borderRadius: 10,
                              }}
                            >
                              {selectedGuarantors.length}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setVinculoTabActive("CODEVEDOR")}
                            style={{
                              ...subTabBaseStyle,
                              borderTopRightRadius: 6,
                              borderBottomRightRadius: 6,
                              borderLeft: "none",
                              ...(!isFiador ? subTabActiveStyle : {}),
                            }}
                          >
                            <Scale size={12} /> Codevedores
                            <span
                              style={{
                                marginLeft: 4,
                                fontSize: 10,
                                background: !isFiador ? "rgba(255,255,255,0.22)" : "#e2e8f0",
                                padding: "1px 7px",
                                borderRadius: 10,
                              }}
                            >
                              {selectedCodebtors.length}
                            </span>
                          </button>
                        </div>

                        <VinculoPessoaList
                          type={vinculoTabActive}
                          data={list as VinculoPessoaItem[]}
                          onRemove={(idx) => setList((prev) => prev.filter((_, i) => i !== idx))}
                          clientId={form.clientId || null}
                          suggested={suggestedGuarantors}
                          onAddSuggested={(g) => addPersonFromDb(g, vinculoTabActive)}
                          onOpenCreate={() =>
                            setQuickModalState({ open: true, mode: "create", target: vinculoTabActive })
                          }
                          onOpenSearch={() => setSearchModalOpen(true)}
                          onOpenEditNew={(idx, item) =>
                            setQuickModalState({
                              open: true,
                              mode: "edit-new",
                              editIndex: idx,
                              initialValue: item.formValues ?? EMPTY_GUARANTOR_FORM,
                              target: vinculoTabActive,
                            })
                          }
                          onOpenView={(id) => openGuarantorViewModal(id, vinculoTabActive)}
                          formatDocument={formatGuarantorDocument}
                        />
                      </div>
                    );
                  })()}

                  {/* TAB 5: GARANTIAS (bens em garantia + confissão de dívida) */}
                  {activeTab === "garantias" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {/* Botão de ação principal — mesmo padrão da aba Fiadores */}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() =>
                            setAssetModalState({
                              open: true,
                              mode: "create",
                              initialValue: { assetType: "vehicle" },
                            })
                          }
                          className="btn-primary"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "7px 14px",
                            fontSize: 11,
                          }}
                        >
                          <Shield size={12} /> Adicionar Garantia
                        </button>
                      </div>

                      {/* Tabela de bens vinculados — mesma estilização da tabela de fiadores */}
                      <div
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          overflow: "hidden",
                          background: "white",
                        }}
                      >
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
                                    Nenhum bem vinculado. Use os botões acima para adicionar.
                                  </span>
                                </td>
                              </tr>
                            ) : (
                              selectedAssets.map((a, idx) => {
                                const isVehicle = a.assetType === "vehicle";
                                const Icon = isVehicle ? Car : Home;
                                return (
                                  <tr key={a.localId} style={{ background: idx % 2 === 1 ? "#fafafa" : "white" }}>
                                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9" }}>
                                      <span
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 4,
                                          padding: "2px 8px",
                                          borderRadius: 4,
                                          fontSize: 9,
                                          fontWeight: 700,
                                          background: isVehicle ? "#ecfdf5" : "#eff6ff",
                                          color: isVehicle ? "#065f46" : "#1e40af",
                                        }}
                                      >
                                        <Icon size={10} />
                                        {isVehicle ? "Veículo" : "Imóvel"}
                                      </span>
                                    </td>
                                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", fontWeight: 600, color: "#0f172a" }}>
                                      {formatAssetTitle(a)}
                                    </td>
                                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", color: "#475569" }}>
                                      {formatAssetDetail(a)}
                                    </td>
                                    <td style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", textAlign: "center" }}>
                                      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                                        <button
                                          type="button"
                                          className="btn-icon"
                                          title="Visualizar dados"
                                          onClick={() =>
                                            setAssetModalState({
                                              open: true,
                                              mode: "view",
                                              editIndex: idx,
                                              initialValue: a,
                                            })
                                          }
                                        >
                                          <Eye size={11} style={{ color: "#2563eb" }} />
                                        </button>
                                        <button
                                          type="button"
                                          className="btn-icon"
                                          title="Editar bem"
                                          onClick={() =>
                                            setAssetModalState({
                                              open: true,
                                              mode: "edit",
                                              editIndex: idx,
                                              initialValue: a,
                                            })
                                          }
                                        >
                                          <Edit2 size={11} />
                                        </button>
                                        <button
                                          type="button"
                                          className="btn-icon text-danger"
                                          title="Remover do contrato"
                                          onClick={() => setSelectedAssets((prev) => prev.filter((_, i) => i !== idx))}
                                        >
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

                      <div className="keep-case" style={{ fontSize: 10.5, color: "#64748b", lineHeight: 1.5 }}>
                        Bens (veículos e imóveis) são gravados junto com o contrato em uma única transação.
                        Ao remover um bem desta lista, ele será excluído do contrato no próximo salvamento.
                      </div>

                      {/* 🚀 Confissão de Dívida */}
                      <label
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          padding: 12,
                          borderRadius: 8,
                          border: `1px solid ${form.confessionOfDebt ? "#bae6fd" : "#e2e8f0"}`,
                          background: form.confessionOfDebt ? "#f0f9ff" : "#f8fafc",
                          cursor: "pointer",
                          transition: "all 0.1s",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!form.confessionOfDebt}
                          onChange={e => setForm(p => ({ ...p, confessionOfDebt: e.target.checked }))}
                          style={{ marginTop: 2, width: 16, height: 16, accentColor: "#2563eb", cursor: "pointer" }}
                        />
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                            <Scale size={12} style={{ color: "#0369a1" }} /> CONFISSÃO DE DÍVIDA
                          </span>
                          <span style={{ fontSize: 10, color: "#64748b", lineHeight: 1.4 }}>
                            Marque para registrar que este instrumento é uma confissão de dívida formal,
                            firmada pelo devedor reconhecendo expressamente a obrigação de pagamento.
                          </span>
                        </div>
                      </label>
                    </div>
                  )}

                  {/* TAB 5: REGRAS CONTRATUAIS */}
                  {activeTab === "regras" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {/* ⚖️ FORO DE ELEIÇÃO JURÍDICA — reusa o campo `forumLocation` da develop */}
                      <div>
                        <label className="sigx-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Scale size={12} style={{ color: "#0d9488" }} /> FORO ELEITO DE ELEIÇÃO (COMARCA COBRANÇA)
                        </label>
                        <input
                          className="sigx-input"
                          value={form.forumLocation}
                          onChange={n("forumLocation")}
                          placeholder="Ex: Belo Horizonte / MG"
                        />
                        <span style={{ fontSize: 10, color: "#94a3b8" }}>
                          Define o município jurídico responsável pela resolução de litígios e execução judicial deste ativo.
                        </span>
                      </div>

                      <div>
                        <label className="sigx-label">OBSERVAÇÕES INTERNAS E HISTÓRICOS</label>
                        <textarea className="sigx-input" value={form.observations} onChange={n("observations")} rows={4} />
                      </div>
                    </div>
                  )}

                  {/* 🚀 TAB 6: DADOS BANCÁRIOS (somente leitura — vem do cliente vinculado) */}
                  {activeTab === "bancarios" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {!selectedClient && (
                        <div style={{ padding: 12, background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 6, fontSize: 11, color: "#92400e" }}>
                          Selecione um cliente na guia <strong>Dados Básicos</strong> para visualizar os dados bancários.
                        </div>
                      )}

                      {selectedClient && (
                        <>
                          <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic" }}>
                            Estes dados são <strong>somente leitura</strong> e refletem o que está cadastrado na guia
                            <em> Dados Financeiros</em> do cliente <strong>{selectedClient.name}</strong>.
                            Para editar, abra o CRUD de Clientes.
                          </div>

                          {(!selectedClientMeta?.bankAccounts || selectedClientMeta.bankAccounts.length === 0) && (
                            <div style={{ padding: 12, background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 11, color: "#6b7280" }}>
                              Este cliente ainda não possui contas bancárias cadastradas.
                            </div>
                          )}

                          {selectedClientMeta?.bankAccounts?.map((acc: any, idx: number) => {
                            const { code, name } = splitBank(acc.banco);
                            const tipoLabel = ACCOUNT_TYPE_LABELS[(acc.tipo || "").toLowerCase()] ?? acc.tipo ?? "—";
                            return (
                              <div key={idx} style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 6, background: "#fafafa" }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                                  Conta Bancária {idx + 1}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                                  <div>
                                    <label className="sigx-label">CÓDIGO BANCO</label>
                                    <input className="sigx-input mono" value={code} readOnly style={{ background: "white", color: "#4b5563" }} />
                                  </div>
                                  <div style={{ gridColumn: "span 2" }}>
                                    <label className="sigx-label">NOME BANCO</label>
                                    <input className="sigx-input" value={name} readOnly style={{ background: "white", color: "#4b5563" }} />
                                  </div>
                                  <div>
                                    <label className="sigx-label">AGÊNCIA</label>
                                    <input className="sigx-input mono" value={acc.agencia ?? ""} readOnly style={{ background: "white", color: "#4b5563" }} />
                                  </div>
                                  <div>
                                    <label className="sigx-label">Nº CONTA</label>
                                    <input className="sigx-input mono" value={acc.conta ?? ""} readOnly style={{ background: "white", color: "#4b5563" }} />
                                  </div>
                                  <div>
                                    <label className="sigx-label">TIPO CONTA</label>
                                    <input className="sigx-input" value={tipoLabel} readOnly style={{ background: "white", color: "#4b5563" }} />
                                  </div>
                                </div>

                                {/* PIX por conta — a develop guarda hasPix/pixType/pixKey dentro de cada bankAccount */}
                                <div style={{ marginTop: 10, padding: 10, background: "white", border: "1px dashed #cbd5e1", borderRadius: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                  <div>
                                    <label className="sigx-label">CHAVE PIX</label>
                                    <input
                                      className="sigx-input mono"
                                      value={acc.hasPix ? (acc.pixKey ?? "") : ""}
                                      readOnly
                                      placeholder={acc.hasPix ? "—" : "Sem PIX vinculado"}
                                      style={{ background: "#f9fafb", color: "#4b5563" }}
                                    />
                                  </div>
                                  <div>
                                    <label className="sigx-label">PIX</label>
                                    <input
                                      className="sigx-input"
                                      value={acc.hasPix && acc.pixKey ? "Cadastrado" : "Não cadastrado"}
                                      readOnly
                                      style={{
                                        background: "#f9fafb",
                                        color: acc.hasPix && acc.pixKey ? "#065f46" : "#9ca3af",
                                        fontWeight: 600,
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}

                </div>
                <div
                  style={{
                    padding: "12px 22px",
                    borderTop: "1px solid #e5e7eb",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    background: "#f8fafc",
                  }}
                >
                  <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>
                    {editingId ? "Edição registrada com auditoria automática" : "Novo registro será atribuído ao seu usuário"}
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn-secondary" onClick={() => { setOpen(false); resetModal(); }}>Cancelar</button>
                    <button type="submit" className="btn-primary" disabled={submitting} style={{ minWidth: 150, justifyContent: "center" }}>
                      {submitting ? "Gravando..." : (editingId ? "Atualizar Contrato" : "Salvar Contrato")}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* VISUALIZADOR MULTI-PDF SPLIT SCREEN */}
        {pdfPreview && (
          <div className="sigx-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setPdfPreview(null); }}>
            <div className="sigx-modal" style={{ width: "min(1250px, 96vw)", maxWidth: "96vw", height: "92vh", display: "flex", flexDirection: "column", padding: 0 }} onMouseDown={e => e.stopPropagation()}>
              <div className="sigx-modal-header" style={{ flexShrink: 0 }}>
                <span className="sigx-modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><FileText size={14} /> Documentos Digitais — Contrato {pdfPreview.code}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <a href={`/contracts/${pdfPreview.id}/pdf?index=${activePdfIndex}`} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: 11, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}><Upload size={11} style={{ transform: "rotate(180deg)" }} /> Ver Completo / Imprimir</a>
                <button type="button" onClick={() => setPdfPreview(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", display: "flex" }}><X size={18} /></button>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0, display: "flex", background: "#1f2937" }}>
                <div style={{ width: 250, background: "#111827", borderRight: "1px solid #374151", padding: 12, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.05em", marginBottom: 6 }}>ARQUIVOS COMPONENTES:</span>
                  {pdfPreview.names.map((name, index) => (
                    <button key={index} type="button" onClick={() => setActivePdfIndex(index)} style={{ width: "100%", padding: "10px 12px", borderRadius: 4, border: "none", textAlign: "left", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, background: activePdfIndex === index ? "#2563eb" : "#1f2937", color: activePdfIndex === index ? "white" : "#d1d5db", transition: "all 0.1s" }}>
                      <FileText size={12} style={{ flexShrink: 0, color: activePdfIndex === index ? "white" : "#9ca3af" }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={name}>{name}</span>
                    </button>
                  ))}
                </div>
                <div style={{ flex: 1, height: "100%", background: "#1f2937" }}>
                  <iframe key={`${pdfPreview.id}-${activePdfIndex}`} src={`/contracts/${pdfPreview.id}/pdf?index=${activePdfIndex}#toolbar=1&navpanes=0&view=FitH`} title={`Visualizador do PDF ${activePdfIndex}`} style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── DIÁLOGOS DE CONFIRMAÇÃO ─────────────────────────────────────── */}
      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title="Excluir Contrato"
        description="Esta ação remove o contrato em definitivo, junto com todos os arquivos digitais anexados. Não é possível desfazer."
        entityLabel="Contrato"
        entityName={confirmDelete?._client ? `${confirmDelete?.code} · ${confirmDelete?._client}` : confirmDelete?.code}
        entityDetail={confirmDelete?.contractName}
        consequences={[
          "Todos os PDFs e documentos vinculados serão apagados do storage.",
          "Lançamentos e parcelas associados também serão removidos em cascata.",
        ]}
        confirmLabel="Excluir Contrato"
        onConfirm={executeDelete}
        onClose={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        open={!!confirmCancel}
        tone="warning"
        icon={Ban}
        title="Cancelar Contrato"
        description="O contrato passará para o status &quot;Cancelado&quot;. Os dados ficam preservados e a operação pode ser revertida posteriormente."
        entityLabel="Contrato"
        entityName={confirmCancel?._client ? `${confirmCancel?.code} · ${confirmCancel?._client}` : confirmCancel?.code}
        entityDetail={confirmCancel?.contractName}
        consequences={[
          "O contrato deixará de aparecer como ativo nos relatórios operacionais.",
          "Você poderá reativá-lo a qualquer momento pelo botão de reativação.",
        ]}
        confirmLabel="Cancelar Contrato"
        onConfirm={executeCancel}
        onClose={() => setConfirmCancel(null)}
      />

      <ConfirmDialog
        open={!!confirmReactivate}
        tone="info"
        icon={RotateCcw}
        title="Reativar Contrato"
        description={'O contrato voltará ao status "Ativo" e passará a ser considerado novamente nos relatórios e cobranças.'}
        entityLabel="Contrato"
        entityName={confirmReactivate?._client ? `${confirmReactivate?.code} · ${confirmReactivate?._client}` : confirmReactivate?.code}
        entityDetail={confirmReactivate?.contractName}
        confirmLabel="Reativar Contrato"
        onConfirm={executeReactivate}
        onClose={() => setConfirmReactivate(null)}
      />

      {/* ── SUB-MODAIS DA ABA "FIADOR / CODEVEDOR" ──────────────────────────
          O mesmo modal de criação/edição é compartilhado entre os dois papéis;
          o estado `target` decide em qual lista (selectedGuarantors |
          selectedCodebtors) a pessoa será inserida/atualizada quando confirmar.
      */}
      <GuarantorQuickCreateModal
        open={quickModalState.open}
        mode={quickModalState.mode}
        initialValue={quickModalState.initialValue}
        onClose={() => setQuickModalState({ open: false, mode: "create", target: vinculoTabActive })}
        onConfirm={(values) => {
          const target = quickModalState.target;
          const setList = setterFor(target);

          if (quickModalState.mode === "edit-new" && typeof quickModalState.editIndex === "number") {
            const idx = quickModalState.editIndex;
            setList((prev) =>
              prev.map((it, i) =>
                i === idx
                  ? {
                      ...it,
                      name: values.name,
                      personType: values.personType,
                      document: values.personType === "PJ" ? onlyDigits(values.cnpj) : onlyDigits(values.cpf),
                      formValues: values,
                    }
                  : it
              )
            );
          } else {
            // Novo on-the-fly
            setList((prev) => [
              ...prev,
              {
                localId: newLocalId(),
                isFromDb: false,
                name: values.name,
                personType: values.personType,
                document: values.personType === "PJ" ? onlyDigits(values.cnpj) : onlyDigits(values.cpf),
                formValues: values,
              },
            ]);
          }
          setQuickModalState({ open: false, mode: "create", target: vinculoTabActive });
        }}
      />

      <GuarantorSearchModal
        open={searchModalOpen}
        excludeIds={selectedDbIdsByRole[vinculoTabActive]}
        onClose={() => setSearchModalOpen(false)}
        onPick={(picked) => {
          picked.forEach((g) => addPersonFromDb(g, vinculoTabActive));
          setSearchModalOpen(false);
        }}
      />

      {/* ── SUB-MODAL DA SEÇÃO "BENS EM GARANTIA" ───────────────────────── */}
      <AssetQuickCreateModal
        open={assetModalState.open}
        mode={assetModalState.mode}
        initialValue={assetModalState.initialValue}
        onClose={() => setAssetModalState({ open: false, mode: "create" })}
        onConfirm={(values) => {
          // Edição: substitui o item pelo índice preservando id e localId
          if (
            (assetModalState.mode === "edit" || assetModalState.mode === "view") &&
            typeof assetModalState.editIndex === "number"
          ) {
            const idx = assetModalState.editIndex;
            setSelectedAssets((prev) =>
              prev.map((it, i) =>
                i === idx
                  ? {
                      ...it,           // preserva localId e id (DB)
                      ...values,       // sobrescreve campos do formulário
                    }
                  : it
              )
            );
          } else {
            // Criação on-the-fly
            setSelectedAssets((prev) => [
              ...prev,
              {
                ...values,
                localId: newLocalId(),
              },
            ]);
          }
          setAssetModalState({ open: false, mode: "create" });
        }}
      />
    </UnyPayLayout>
  );
}