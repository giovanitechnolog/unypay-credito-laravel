import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Head } from "@inertiajs/react";
import {
  Plus, Search, RefreshCw, X, Edit2, Trash2,
  Handshake, IdCard, MapPin, Users as UsersIcon,
  ShieldAlert, CheckCircle2, UserPlus, User, Building2,
  Scale, Download, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import UnyPayLayout from "../Components/UnyPayLayout";
import ConfirmDialog from "../Components/ConfirmDialog";
import { api, extractFirstError } from "../lib/api";
import { downloadExcelWithState } from "../lib/exportHelper";
import {
  maskDocument,
  onlyDigits,
  validateCPF,
} from "../lib/documentValidation";
import { maskPhone } from "../lib/masks";

interface ClientLite {
  id: number;
  name: string;
  document?: string | null;
}

type PersonType = "PF" | "PJ";

interface Guarantor {
  id: number;
  name: string;
  personType: PersonType;
  nationality: string | null;
  maritalStatus: string | null;
  cpf: string | null;
  rg: string | null;
  cnpj: string | null;
  tradeName: string | null;
  stateRegistration: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  email: string | null;
  phone: string | null;
  clients?: ClientLite[];
  clients_count?: number;
  /** Vínculos como FIADOR em contratos (pivot contract_guarantor com role='FIADOR'). */
  fiadores_count?: number;
  /** Vínculos como CODEVEDOR em contratos (pivot contract_guarantor com role='CODEVEDOR'). */
  codevedores_count?: number;
  /** Vínculos como TESTEMUNHA em contratos (pivot contract_guarantor com role='TESTEMUNHA'). */
  testemunhas_count?: number;
}

interface PaginatedGuarantors {
  data: Guarantor[];
}

const MARITAL_STATUS_OPTIONS = [
  "Não Informado",
  "Solteiro(a)",
  "Casado(a)",
  "União Estável",
  "Divorciado(a)",
  "Viúvo(a)",
  "Separado(a)",
];

const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const maskCPF = (v: string) => {
  let d = v.replace(/\D/g, "");
  if (d.length > 11) d = d.substring(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const maskCNPJ = (v: string) => {
  let d = v.replace(/\D/g, "");
  if (d.length > 14) d = d.substring(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

const maskCEP = (v: string) => {
  let d = v.replace(/\D/g, "");
  if (d.length > 8) d = d.substring(0, 8);
  return d.replace(/(\d{5})(\d)/, "$1-$2");
};

interface FormState {
  personType: PersonType;
  name: string;
  email: string;
  phone: string;
  // PF
  nationality: string;
  maritalStatus: string;
  cpf: string;
  rg: string;
  // PJ
  cnpj: string;
  tradeName: string;
  stateRegistration: string;
  // Endereço
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  // NxN
  clientIds: number[];
}

const EMPTY_FORM: FormState = {
  personType: "PF",
  name: "",
  email: "",
  phone: "",
  nationality: "Brasileiro",
  maritalStatus: "",
  cpf: "",
  rg: "",
  cnpj: "",
  tradeName: "",
  stateRegistration: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  zipCode: "",
  clientIds: [],
};

export default function GuarantorsPage() {
  const [guarantors, setGuarantors] = useState<Guarantor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<"pessoal" | "endereco" | "clientes">("pessoal");
  const [selected, setSelected] = useState<Guarantor | null>(null);
  const [deleteModal, setDeleteModal] = useState<Guarantor | null>(null);

  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);

  // Catálogo de clientes p/ multi-select da 3ª aba
  const [clientsCatalog, setClientsCatalog] = useState<ClientLite[]>([]);
  const [clientSearch, setClientSearch] = useState("");

  // Feedback do CEP (auto-preenchimento via ViaCEP).
  const [cepFeedback, setCepFeedback] = useState<string>("");
  const [documentError, setDocumentError] = useState("");
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const lastFetchedCnpjRef = useRef("");

  const handleCepChange = async (raw: string) => {
    const masked = maskCEP(raw);
    setFormData(p => ({ ...p, zipCode: masked }));

    const digits = masked.replace(/\D/g, "");
    if (digits.length !== 8) {
      setCepFeedback("");
      return;
    }

    setCepFeedback("Buscando endereço...");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data?.erro) {
        setCepFeedback("CEP não encontrado.");
        return;
      }
      setFormData(p => ({
        ...p,
        zipCode: masked,
        street: data.logradouro ?? p.street,
        neighborhood: data.bairro ?? p.neighborhood,
        city: data.localidade ?? p.city,
        state: (data.uf ?? p.state).toUpperCase(),
      }));
      setCepFeedback("Endereço preenchido automaticamente.");
    } catch {
      setCepFeedback("Não foi possível consultar o CEP.");
    }
  };

  const fetchGuarantors = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const { data } = await api.get<PaginatedGuarantors>("/api/guarantors", {
        params: { search: q, per_page: 100 },
      });
      setGuarantors(data.data);
    } catch (err) {
      toast.error(extractFirstError(err, "Erro ao carregar pessoas."));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClientsCatalog = useCallback(async (q = "") => {
    try {
      const { data } = await api.get<ClientLite[]>("/api/guarantors-clients-lookup", {
        params: { search: q },
      });
      setClientsCatalog(data);
    } catch {
      // silencioso — o multi-select fica vazio
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchGuarantors(search), 350);
    return () => clearTimeout(t);
  }, [search, fetchGuarantors]);

  const handleExportExcel = useCallback(() => {
    downloadExcelWithState(
      "/pessoas/export",
      "pessoas.xlsx",
      setExporting,
      { params: { search: search.trim() || undefined } },
    );
  }, [search]);

  useEffect(() => {
    if (formOpen) fetchClientsCatalog(clientSearch);
  }, [formOpen, clientSearch, fetchClientsCatalog]);

  // Reaplica a máscara dinâmica ao abrir o modal — corrige telefones fixos salvos com formatação antiga.
  useEffect(() => {
    if (!formOpen) return;
    setFormData((prev) => {
      if (!prev.phone) return prev;
      const normalized = maskPhone(String(prev.phone));
      return normalized === prev.phone ? prev : { ...prev, phone: normalized };
    });
  }, [formOpen, selected?.id]);

  const counters = useMemo(() => ({
    total: guarantors.length,
    pf: guarantors.filter(g => g.personType === "PF").length,
    pj: guarantors.filter(g => g.personType === "PJ").length,
    // Contagem de PESSOAS que atuam em pelo menos 1 contrato como cada papel.
    // (Diferente de `clients_count`, que mede vínculo direto pessoa↔cliente.)
    fiadores: guarantors.filter(g => (g.fiadores_count ?? 0) > 0).length,
    codevedores: guarantors.filter(g => (g.codevedores_count ?? 0) > 0).length,
    testemunhas: guarantors.filter(g => (g.testemunhas_count ?? 0) > 0).length,
  }), [guarantors]);

  const openCreate = () => {
    setSelected(null);
    setFormData(EMPTY_FORM);
    setActiveFormTab("pessoal");
    setClientSearch("");
    setCepFeedback("");
    setDocumentError("");
    setCnpjLoading(false);
    lastFetchedCnpjRef.current = "";
    setFormOpen(true);
  };

  const openEdit = (g: Guarantor) => {
    setSelected(g);
    setFormData({
      personType: g.personType ?? "PF",
      name: g.name ?? "",
      email: g.email ?? "",
      phone: g.phone ? maskPhone(String(g.phone)) : "",
      nationality: g.nationality ?? "Brasileiro",
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
      clientIds: (g.clients ?? []).map(c => c.id),
    });
    setActiveFormTab("pessoal");
    setClientSearch("");
    setCepFeedback("");
    setDocumentError("");
    setCnpjLoading(false);
    lastFetchedCnpjRef.current = onlyDigits(g.cnpj ?? "");
    setFormOpen(true);
  };

  /**
   * Alterna entre PF e PJ limpando os campos exclusivos do tipo anterior.
   * Mantém endereço e nome (que servem aos dois).
   */
  const switchPersonType = (next: PersonType) => {
    setDocumentError("");
    lastFetchedCnpjRef.current = "";
    setFormData(prev => {
      if (prev.personType === next) return prev;
      if (next === "PJ") {
        return {
          ...prev,
          personType: "PJ",
          // Zera campos PF
          nationality: "",
          maritalStatus: "",
          cpf: "",
          rg: "",
        };
      }
      return {
        ...prev,
        personType: "PF",
        nationality: "Brasileiro",
        // Zera campos PJ
        cnpj: "",
        tradeName: "",
        stateRegistration: "",
      };
    });
  };

  const toggleClient = (id: number) => {
    setFormData(prev => ({
      ...prev,
      clientIds: prev.clientIds.includes(id)
        ? prev.clientIds.filter(cid => cid !== id)
        : [...prev.clientIds, id],
    }));
  };

  const validateDocumentField = (): string => {
    if (formData.personType === "PF") {
      const digits = onlyDigits(formData.cpf);
      if (!digits) return "";
      if (digits.length === 11 && !validateCPF(digits)) {
        return "CPF inválido. Verifique os dígitos informados.";
      }
      return "";
    }

    const digits = onlyDigits(formData.cnpj);
    if (!digits) return "";
    if (digits.length < 14) {
      return "CNPJ incompleto. Informe os 14 dígitos.";
    }
    return "";
  };

  const fetchCnpjData = async (digits: string) => {
    if (digits.length !== 14 || lastFetchedCnpjRef.current === digits) return;

    setCnpjLoading(true);
    try {
      const { data } = await api.get(`/api/cnpj/${digits}`);
      lastFetchedCnpjRef.current = digits;

      setFormData(prev => ({
        ...prev,
        name: data.nome || prev.name,
        zipCode: data.cep ? maskCEP(String(data.cep)) : prev.zipCode,
        street: data.logradouro || prev.street,
        number: data.numero ? String(data.numero) : prev.number,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.municipio || prev.city,
        state: data.uf ? String(data.uf).toUpperCase() : prev.state,
        email: data.email || prev.email,
        phone: data.telefone ? maskPhone(String(data.telefone)) : prev.phone,
      }));

      toast.success("Dados da Receita Federal preenchidos automaticamente.");
    } catch (err) {
      lastFetchedCnpjRef.current = "";
      toast.error(extractFirstError(err, "Não foi possível consultar o CNPJ."));
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleDocumentChange = (value: string) => {
    setDocumentError("");

    if (formData.personType === "PF") {
      const masked = maskDocument(onlyDigits(value).slice(0, 11));
      setFormData(prev => ({ ...prev, cpf: masked }));
      lastFetchedCnpjRef.current = "";
      return;
    }

    const masked = maskDocument(value);
    const digits = onlyDigits(masked);
    setFormData(prev => ({ ...prev, cnpj: masked }));

    if (digits.length !== 14) {
      lastFetchedCnpjRef.current = "";
    }
    if (digits.length === 14) {
      void fetchCnpjData(digits);
    }
  };

  const handleDocumentBlur = () => {
    const error = validateDocumentField();
    setDocumentError(error);

    if (formData.personType === "PJ") {
      const digits = onlyDigits(formData.cnpj);
      if (!error && digits.length === 14) {
        void fetchCnpjData(digits);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const docError = validateDocumentField();
    if (docError) {
      setDocumentError(docError);
      setActiveFormTab("pessoal");
      return;
    }

    if (cnpjLoading) return;

    const cpfDigits  = onlyDigits(formData.cpf);
    const cnpjDigits = onlyDigits(formData.cnpj);
    const zipDigits  = onlyDigits(formData.zipCode);

    // ── Validação cruzada (aba "Dados Pessoais") ──────────────────────────
    let personalIssue: string | null = null;

    if (!formData.name.trim()) {
      personalIssue = formData.personType === "PJ" ? "RAZÃO SOCIAL" : "NOME COMPLETO";
    } else if (formData.personType === "PF") {
      personalIssue =
        !formData.nationality.trim() ? "NACIONALIDADE" :
        !formData.maritalStatus      ? "ESTADO CIVIL" :
        cpfDigits.length !== 11      ? "CPF (11 dígitos)" :
        !validateCPF(cpfDigits)      ? "CPF inválido" : null;
    } else {
      personalIssue =
        cnpjDigits.length !== 14         ? "CNPJ (14 dígitos)" :
        !formData.tradeName.trim()       ? "NOME FANTASIA" : null;
      // Inscrição Estadual é opcional (PJs podem ser isentas).
    }

    if (personalIssue) {
      setActiveFormTab("pessoal");
      toast.error(`Preencha o campo: ${personalIssue}`);
      return;
    }

    // 🚀 Endereço passou a ser opcional. Validamos apenas o CEP quando o
    // usuário começa a digitar — ou ele preenche os 8 dígitos completos
    // ou deixa todo o campo em branco.
    if (zipDigits.length > 0 && zipDigits.length !== 8) {
      setActiveFormTab("endereco");
      toast.error("CEP inválido — informe 8 dígitos ou deixe em branco.");
      return;
    }

    // Monta payload limpo, enviando apenas campos do tipo selecionado
    const basePayload = {
      personType: formData.personType,
      name: formData.name,
      email: formData.email.trim() || null,
      phone: formData.phone || null,
      street: formData.street,
      number: formData.number,
      complement: formData.complement,
      neighborhood: formData.neighborhood,
      city: formData.city,
      state: formData.state.toUpperCase(),
      zipCode: zipDigits,
      clientIds: formData.clientIds,
    };

    const payload = formData.personType === "PF"
      ? {
          ...basePayload,
          nationality: formData.nationality,
          maritalStatus: formData.maritalStatus,
          cpf: cpfDigits,
          rg: formData.rg,
          // Limpa campos PJ no banco caso o registro tenha alternado
          cnpj: null,
          tradeName: null,
          stateRegistration: null,
        }
      : {
          ...basePayload,
          cnpj: cnpjDigits,
          tradeName: formData.tradeName,
          stateRegistration: formData.stateRegistration,
          // Limpa campos PF
          nationality: null,
          maritalStatus: null,
          cpf: null,
          rg: null,
        };

    try {
      if (selected) {
        await api.put(`/api/guarantors/${selected.id}`, payload);
        toast.success("Pessoa atualizada com sucesso!");
      } else {
        await api.post("/api/guarantors", payload);
        toast.success("Pessoa cadastrada com sucesso!");
      }
      setFormOpen(false);
      fetchGuarantors(search);
    } catch (err) {
      toast.error(extractFirstError(err, "Falha ao gravar os dados da pessoa."));
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await api.delete(`/api/guarantors/${deleteModal.id}`);
      toast.success("Pessoa removida.");
      setDeleteModal(null);
      fetchGuarantors(search);
    } catch (err) {
      toast.error(extractFirstError(err, "Não foi possível remover a pessoa."));
    }
  };

  const selectedClients = useMemo(() => {
    const map = new Map(clientsCatalog.map(c => [c.id, c]));
    // Para edição, garantimos exibir o nome mesmo que o cliente não esteja na busca atual
    if (selected?.clients) {
      for (const c of selected.clients) {
        if (!map.has(c.id)) map.set(c.id, c);
      }
    }
    return formData.clientIds
      .map(id => map.get(id))
      .filter((c): c is ClientLite => !!c);
  }, [formData.clientIds, clientsCatalog, selected]);

  return (
    <UnyPayLayout>
      <Head title="Gerenciamento de Pessoas" />

      <style>{`
        /* —— Caixa alta visual da tela inteira (incluindo modal) —— */
        .guarantors-page,
        .guarantors-page input,
        .guarantors-page select,
        .guarantors-page textarea,
        .guarantors-page button,
        .guarantors-page option,
        .guarantors-page label,
        .guarantors-page h1, .guarantors-page h2, .guarantors-page h3,
        .guarantors-page p, .guarantors-page span, .guarantors-page strong,
        .guarantors-page td, .guarantors-page th { text-transform: uppercase; }

        .guarantors-page input.mono,
        .guarantors-page input[type="email"],
        .guarantors-page input[type="password"],
        .guarantors-page input[type="date"],
        .guarantors-page input[type="number"] { text-transform: none; }
        .guarantors-page input::placeholder,
        .guarantors-page textarea::placeholder { text-transform: none; }
        .guarantors-page .keep-case,
        .guarantors-page .keep-case * { text-transform: none !important; }

        .guarantors-modal-body { scroll-behavior: smooth; }
        .guarantors-modal-body::-webkit-scrollbar { width: 8px; }
        .guarantors-modal-body::-webkit-scrollbar-track { background: #f1f5f9; }
        .guarantors-modal-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .guarantors-modal-body::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .guarantors-page .sigx-input { transition: border-color 0.15s, box-shadow 0.15s; }
        .guarantors-page .sigx-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }
        .guarantors-page .btn-icon { transition: all 0.12s; }
        .guarantors-page .btn-icon:hover { transform: translateY(-1px); }
        .guarantors-client-row { transition: background 0.1s; }
        .guarantors-client-row:hover { background: #f8fafc; }
      `}</style>

      <div className="guarantors-page" style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 4px 24px 4px" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0 }}>Cadastro de Pessoas</h2>
          <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>Cadastro mestre unificado das pessoas que atuam em contratos como Fiador, Codevedor ou Testemunha — incluindo seus vínculos com os clientes da carteira.</p>
        </div>

        {/* Cards de resumo */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <div style={{ background: "white", border: "1px solid #e2e8f0", padding: 14, borderRadius: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ padding: 8, background: "#f1f5f9", borderRadius: 6, color: "#475569" }}><Handshake size={18} /></div>
            <div><span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Total de Pessoas</span><strong style={{ fontSize: 18, color: "#0f172a" }}>{counters.total}</strong></div>
          </div>
          <div style={{ background: "white", border: "1px solid #e2e8f0", padding: 14, borderRadius: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ padding: 8, background: "#ecfdf5", borderRadius: 6, color: "#059669" }}><User size={18} /></div>
            <div><span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Pessoa Física</span><strong style={{ fontSize: 18, color: "#059669" }}>{counters.pf}</strong></div>
          </div>
          <div style={{ background: "white", border: "1px solid #e2e8f0", padding: 14, borderRadius: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ padding: 8, background: "#eff6ff", borderRadius: 6, color: "#2563eb" }}><Building2 size={18} /></div>
            <div><span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Pessoa Jurídica</span><strong style={{ fontSize: 18, color: "#2563eb" }}>{counters.pj}</strong></div>
          </div>
          <div style={{ background: "white", border: "1px solid #e2e8f0", padding: 14, borderRadius: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ padding: 8, background: "#fbf7ff", borderRadius: 6, color: "#6b21a8" }}><UsersIcon size={18} /></div>
            <div><span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Vínculos Fiadores</span><strong style={{ fontSize: 18, color: "#6b21a8" }}>{counters.fiadores}</strong></div>
          </div>
          <div style={{ background: "white", border: "1px solid #e2e8f0", padding: 14, borderRadius: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ padding: 8, background: "#fff7ed", borderRadius: 6, color: "#c2410c" }}><Scale size={18} /></div>
            <div><span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Vínculos Codevedores</span><strong style={{ fontSize: 18, color: "#c2410c" }}>{counters.codevedores}</strong></div>
          </div>
          <div style={{ background: "white", border: "1px solid #e2e8f0", padding: 14, borderRadius: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ padding: 8, background: "#ecfeff", borderRadius: 6, color: "#0e7490" }}><UsersIcon size={18} /></div>
            <div><span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Vínculos Testemunhas</span><strong style={{ fontSize: 18, color: "#0e7490" }}>{counters.testemunhas}</strong></div>
          </div>
        </div>

        {/* Tabela */}
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderBottom: "1px solid #e5e7eb", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 260 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 10px", flex: 1, maxWidth: 320, background: "#f8fafc" }}>
                <Search size={14} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Buscar por nome, razão social, CPF, CNPJ, RG ou cidade..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ flex: 1, border: "none", outline: "none", fontSize: 12, background: "transparent", color: "#334155" }}
                />
              </div>
              <button onClick={() => fetchGuarantors(search)} title="Atualizar Grade" style={{ background: "white", border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 8px", cursor: "pointer", color: "#64748b", display: "flex" }}><RefreshCw size={13} /></button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <button type="button" className="btn-primary" onClick={openCreate} style={{ padding: "6px 14px", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                <Plus size={12} /> Nova Pessoa
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleExportExcel}
                disabled={exporting}
                style={{ padding: "6px 14px", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}
              >
                <Download size={12} /> {exporting ? "Exportando..." : "Exportar Excel"}
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600 }}>PESSOA</th>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600, textAlign: "center" }}>TIPO</th>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600 }}>DOCUMENTOS</th>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600 }}>LOCALIZAÇÃO</th>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600, textAlign: "center" }}>VÍNCULO FIADOR</th>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600, textAlign: "center" }}>VÍNCULO CODEVEDOR</th>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600, textAlign: "center" }}>VÍNCULO TESTEMUNHA</th>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600, textAlign: "right" }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#64748b" }}>Carregando pessoas...</td></tr>
                ) : guarantors.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>Nenhuma pessoa localizada.</td></tr>
                ) : (
                  guarantors.map(g => {
                    const isPJ = g.personType === "PJ";
                    return (
                    <tr key={g.id} style={{ borderBottom: "1px solid #f1f5f9" }} onMouseOver={e => (e.currentTarget.style.background = "#f8fafc")} onMouseOut={e => (e.currentTarget.style.background = "transparent")}>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            background: isPJ ? "#eff6ff" : "#f0fdf4",
                            color: isPJ ? "#2563eb" : "#059669",
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                          }}>
                            {isPJ ? <Building2 size={14} /> : <User size={14} />}
                          </div>
                          <div>
                            {/* 🧹 Coluna "Fiador" exibe apenas o nome (PF) ou razão social (PJ).
                                Subtítulos removidos a pedido: nacionalidade + estado civil (PF)
                                e nome fantasia (PJ). */}
                            <strong style={{ color: "#0f172a", fontSize: 13, display: "block" }}>{g.name}</strong>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                          background: isPJ ? "#eff6ff" : "#ecfdf5",
                          color:      isPJ ? "#1e40af" : "#065f46",
                          border:     isPJ ? "1px solid #bfdbfe" : "1px solid #a7f3d0",
                        }}>
                          {isPJ ? <Building2 size={10} /> : <User size={10} />}
                          {isPJ ? "PJ" : "PF"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {isPJ ? (
                            <>
                              <span className="keep-case" style={{ fontSize: 12, color: "#334155", fontFamily: "'IBM Plex Mono', monospace" }}>
                                {g.cnpj ? `CNPJ ${maskCNPJ(g.cnpj)}` : <span style={{ color: "#94a3b8" }}>SEM CNPJ</span>}
                              </span>
                              <span style={{ fontSize: 11, color: "#64748b" }}>
                                {g.stateRegistration ? `IE: ${g.stateRegistration}` : "—"}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="keep-case" style={{ fontSize: 12, color: "#334155", fontFamily: "'IBM Plex Mono', monospace" }}>
                                {g.cpf ? `CPF ${maskCPF(g.cpf)}` : <span style={{ color: "#94a3b8" }}>SEM CPF</span>}
                              </span>
                              <span style={{ fontSize: 11, color: "#64748b" }}>
                                {g.rg ? `RG: ${g.rg}` : "—"}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontSize: 12, color: "#334155" }}>
                            {g.city ?? "—"}{g.state ? `/${g.state}` : ""}
                          </span>
                          <span style={{ fontSize: 11, color: "#64748b" }}>
                            {g.neighborhood ?? "—"}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: (g.fiadores_count ?? 0) > 0 ? "#fbf7ff" : "#f1f5f9", color: (g.fiadores_count ?? 0) > 0 ? "#6b21a8" : "#94a3b8" }}>
                          <Handshake size={11} /> {g.fiadores_count ?? 0}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: (g.codevedores_count ?? 0) > 0 ? "#fff7ed" : "#f1f5f9", color: (g.codevedores_count ?? 0) > 0 ? "#c2410c" : "#94a3b8" }}>
                          <Scale size={11} /> {g.codevedores_count ?? 0}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: (g.testemunhas_count ?? 0) > 0 ? "#ecfeff" : "#f1f5f9", color: (g.testemunhas_count ?? 0) > 0 ? "#0e7490" : "#94a3b8" }}>
                          <UsersIcon size={11} /> {g.testemunhas_count ?? 0}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 4 }}>
                          <button onClick={() => openEdit(g)} className="btn-icon" title="Editar Pessoa"><Edit2 size={13} /></button>
                          <button onClick={() => setDeleteModal(g)} className="btn-icon" title="Remover Pessoa" style={{ color: "#dc2626" }}><Trash2 size={13} /></button>
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

        {/* ── MODAL: CADASTRO E EDIÇÃO ─────────────────────────────────────── */}
        {formOpen && (
          <div className="sigx-modal-overlay" onMouseDown={() => setFormOpen(false)}>
            <div
              className="sigx-modal guarantors-modal"
              style={{
                width: "min(720px, 96vw)",
                maxWidth: "96vw",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                boxShadow: "0 24px 60px rgba(15, 23, 42, 0.25)",
                borderRadius: 10,
              }}
              onMouseDown={e => e.stopPropagation()}
            >
              {/* HEADER com gradiente */}
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
                    <Handshake size={16} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>
                      {selected ? "Editar Pessoa" : "Nova Pessoa"}
                    </span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                      {selected ? `Atualizando registro #${selected.id}` : "Preencha as guias abaixo para registrar uma nova pessoa"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
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

              {/* TABS estilo pílula */}
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
                {[
                  { key: "pessoal" as const,  label: "Dados Pessoais",      icon: IdCard },
                  { key: "endereco" as const, label: "Endereço",            icon: MapPin },
                  { key: "clientes" as const, label: "Clientes Vinculados", icon: UsersIcon },
                ].map(tab => {
                  const Icon = tab.icon;
                  const active = activeFormTab === tab.key;
                  return (
                    <button
                      type="button"
                      key={tab.key}
                      onClick={() => setActiveFormTab(tab.key)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 14px",
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
                      {tab.key === "clientes" && formData.clientIds.length > 0 && (
                        <span style={{
                          background: "#2563eb",
                          color: "white",
                          fontSize: 9,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 8,
                          marginLeft: 2,
                        }}>{formData.clientIds.length}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                <div
                  className="sigx-modal-body guarantors-modal-body"
                  style={{
                    padding: 22,
                    height: "clamp(380px, 52vh, 60vh)",
                    overflowY: "auto",
                    background: "white",
                  }}
                >
                  {activeFormTab === "pessoal" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {/* ── Toggle PF / PJ ─────────────────────────────── */}
                      <div>
                        <label className="sigx-label">TIPO DE PESSOA *</label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          {([
                            { key: "PF" as const, label: "Pessoa Física",   icon: User,      color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
                            { key: "PJ" as const, label: "Pessoa Jurídica", icon: Building2, color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
                          ]).map(opt => {
                            const Icon = opt.icon;
                            const active = formData.personType === opt.key;
                            return (
                              <button
                                type="button"
                                key={opt.key}
                                onClick={() => switchPersonType(opt.key)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                  padding: "10px 14px",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  background: active ? opt.bg : "white",
                                  border: `2px solid ${active ? opt.color : "#e5e7eb"}`,
                                  color: active ? opt.color : "#64748b",
                                  fontWeight: active ? 700 : 500,
                                  fontSize: 12,
                                  transition: "all 0.12s",
                                  boxShadow: active ? `0 2px 8px ${opt.color}22` : "none",
                                }}
                              >
                                <span style={{
                                  width: 28, height: 28, borderRadius: "50%",
                                  background: active ? opt.color : "#f1f5f9",
                                  color: active ? "white" : "#94a3b8",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  flexShrink: 0,
                                }}>
                                  <Icon size={14} />
                                </span>
                                <span style={{ flex: 1, textAlign: "left" }}>{opt.label}</span>
                                {active && <CheckCircle2 size={14} />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* ── Campos de Pessoa Física ────────────────────── */}
                      {formData.personType === "PF" && (
                        <>
                          <div>
                            <label className="sigx-label">NOME COMPLETO *</label>
                            <input
                              type="text"
                              className="sigx-input"
                              value={formData.name}
                              onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                              required
                            />
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                            <div>
                              <label className="sigx-label">NACIONALIDADE *</label>
                              <input
                                type="text"
                                className="sigx-input"
                                value={formData.nationality}
                                onChange={e => setFormData(p => ({ ...p, nationality: e.target.value }))}
                                required
                              />
                            </div>
                            <div>
                              <label className="sigx-label">ESTADO CIVIL *</label>
                              <select
                                className="sigx-input"
                                value={formData.maritalStatus}
                                onChange={e => setFormData(p => ({ ...p, maritalStatus: e.target.value }))}
                                required
                              >
                                <option value="">Selecione...</option>
                                {MARITAL_STATUS_OPTIONS.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                            <div>
                              <label className="sigx-label">CPF *</label>
                              <div style={{ position: "relative" }}>
                                <input
                                  type="text"
                                  className="sigx-input mono"
                                  placeholder="000.000.000-00"
                                  value={formData.cpf}
                                  onChange={e => handleDocumentChange(e.target.value)}
                                  onBlur={handleDocumentBlur}
                                  disabled={cnpjLoading}
                                  required
                                  style={documentError ? { borderColor: "#dc2626" } : undefined}
                                />
                              </div>
                              {documentError && (
                                <div style={{ color: "#dc2626", fontSize: 11, marginTop: 4, fontWeight: 500 }}>
                                  {documentError}
                                </div>
                              )}
                            </div>
                            <div>
                              <label className="sigx-label">RG</label>
                              <input
                                type="text"
                                className="sigx-input"
                                placeholder="MG-00.000.000"
                                value={formData.rg}
                                onChange={e => setFormData(p => ({ ...p, rg: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                            <div>
                              <label className="sigx-label">TELEFONE / WHATSAPP</label>
                              <input
                                type="text"
                                className="sigx-input"
                                value={formData.phone}
                                onChange={e => setFormData(p => ({ ...p, phone: maskPhone(e.target.value) }))}
                                disabled={cnpjLoading}
                                placeholder="(00) 00000-0000"
                              />
                            </div>
                            <div>
                              <label className="sigx-label">E-MAIL</label>
                              <input
                                type="email"
                                className="sigx-input"
                                value={formData.email}
                                onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                                disabled={cnpjLoading}
                                placeholder="email@exemplo.com"
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {/* ── Campos de Pessoa Jurídica ──────────────────── */}
                      {formData.personType === "PJ" && (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                            <div>
                              <label className="sigx-label">CNPJ *</label>
                              <div style={{ position: "relative" }}>
                                <input
                                  type="text"
                                  className="sigx-input mono"
                                  placeholder="00.000.000/0000-00"
                                  value={formData.cnpj}
                                  onChange={e => handleDocumentChange(e.target.value)}
                                  onBlur={handleDocumentBlur}
                                  disabled={cnpjLoading}
                                  required
                                  style={documentError ? { borderColor: "#dc2626" } : undefined}
                                />
                                {cnpjLoading && (
                                  <Loader2
                                    size={14}
                                    className="animate-spin"
                                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#2563eb" }}
                                  />
                                )}
                              </div>
                              {documentError && (
                                <div style={{ color: "#dc2626", fontSize: 11, marginTop: 4, fontWeight: 500 }}>
                                  {documentError}
                                </div>
                              )}
                              {cnpjLoading && !documentError && (
                                <div style={{ color: "#2563eb", fontSize: 11, marginTop: 4, fontWeight: 500 }}>
                                  Consultando dados na Receita Federal...
                                </div>
                              )}
                            </div>
                            <div>
                              <label className="sigx-label">INSCRIÇÃO ESTADUAL</label>
                              <input
                                type="text"
                                className="sigx-input"
                                placeholder='Número ou "ISENTO"'
                                value={formData.stateRegistration}
                                onChange={e => setFormData(p => ({ ...p, stateRegistration: e.target.value }))}
                                disabled={cnpjLoading}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="sigx-label">RAZÃO SOCIAL *</label>
                            <input
                              type="text"
                              className="sigx-input"
                              value={formData.name}
                              onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                              disabled={cnpjLoading}
                              required
                            />
                          </div>
                          <div>
                            <label className="sigx-label">NOME FANTASIA *</label>
                            <input
                              type="text"
                              className="sigx-input"
                              value={formData.tradeName}
                              onChange={e => setFormData(p => ({ ...p, tradeName: e.target.value }))}
                              disabled={cnpjLoading}
                              required
                            />
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                            <div>
                              <label className="sigx-label">TELEFONE / WHATSAPP</label>
                              <input
                                type="text"
                                className="sigx-input"
                                value={formData.phone}
                                onChange={e => setFormData(p => ({ ...p, phone: maskPhone(e.target.value) }))}
                                disabled={cnpjLoading}
                                placeholder="(00) 00000-0000"
                              />
                            </div>
                            <div>
                              <label className="sigx-label">E-MAIL</label>
                              <input
                                type="email"
                                className="sigx-input"
                                value={formData.email}
                                onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                                disabled={cnpjLoading}
                                placeholder="email@exemplo.com"
                              />
                            </div>
                          </div>
                        </>
                      )}

                      <div
                        className="keep-case"
                        style={{
                          marginTop: 4,
                          padding: "8px 12px",
                          background: "#fffbeb",
                          border: "1px solid #fde68a",
                          borderRadius: 6,
                          fontSize: 11,
                          color: "#92400e",
                          lineHeight: 1.5,
                        }}
                      >
                        Todos os campos marcados com (*) são obrigatórios. O vínculo com clientes é o único item opcional.
                      </div>
                    </div>
                  )}

                  {activeFormTab === "endereco" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
                        <div>
                          <label className="sigx-label">CEP</label>
                          <input
                            type="text"
                            className="sigx-input mono"
                            placeholder="00000-000"
                            value={formData.zipCode}
                            onChange={e => handleCepChange(e.target.value)}
                          />
                          {cepFeedback && (
                            <div style={{
                              color: cepFeedback.includes("não") || cepFeedback.includes("Não")
                                ? "var(--color-red, #b91c1c)"
                                : "var(--color-green, #15803d)",
                              fontSize: 11,
                              fontWeight: 600,
                              marginTop: 4,
                            }}>
                              {cepFeedback}
                            </div>
                          )}
                        </div>
                        <div style={{ gridColumn: "span 2" }}>
                          <label className="sigx-label">RUA / LOGRADOURO</label>
                          <input
                            type="text"
                            className="sigx-input"
                            value={formData.street}
                            onChange={e => setFormData(p => ({ ...p, street: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="sigx-label">NÚMERO</label>
                          <input
                            type="text"
                            className="sigx-input"
                            value={formData.number}
                            onChange={e => setFormData(p => ({ ...p, number: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="sigx-label">BAIRRO</label>
                          <input
                            type="text"
                            className="sigx-input"
                            value={formData.neighborhood}
                            onChange={e => setFormData(p => ({ ...p, neighborhood: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="sigx-label">COMPLEMENTO</label>
                          <input
                            type="text"
                            className="sigx-input"
                            value={formData.complement}
                            onChange={e => setFormData(p => ({ ...p, complement: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 0.6fr", gap: 14 }}>
                        <div>
                          <label className="sigx-label">CIDADE</label>
                          <input
                            type="text"
                            className="sigx-input"
                            value={formData.city}
                            onChange={e => setFormData(p => ({ ...p, city: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="sigx-label">UF</label>
                          <select
                            className="sigx-input"
                            value={formData.state}
                            onChange={e => setFormData(p => ({ ...p, state: e.target.value }))}
                          >
                            <option value="">—</option>
                            {UF_OPTIONS.map(uf => (
                              <option key={uf} value={uf}>{uf}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeFormTab === "clientes" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
                      <div
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
                          <UserPlus size={15} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ fontSize: 12, color: "#1e2139", display: "block" }}>Vincular a Clientes da Carteira</strong>
                          <span className="keep-case" style={{ fontSize: 10.5, color: "#64748b" }}>
                            Marque os clientes que terão esta pessoa como vínculo padrão (Fiador, Codevedor ou Testemunha).
                          </span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#2563eb" }}>
                          {formData.clientIds.length} SELECIONADO(S)
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 10px", background: "#f8fafc" }}>
                        <Search size={14} color="#94a3b8" />
                        <input
                          type="text"
                          placeholder="Buscar cliente por nome ou documento..."
                          value={clientSearch}
                          onChange={e => setClientSearch(e.target.value)}
                          style={{ flex: 1, border: "none", outline: "none", fontSize: 12, background: "transparent", color: "#334155" }}
                        />
                      </div>

                      <div
                        style={{
                          flex: 1,
                          minHeight: 0,
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          overflowY: "auto",
                          background: "white",
                        }}
                      >
                        {clientsCatalog.length === 0 ? (
                          <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                            Nenhum cliente disponível para o filtro atual.
                          </div>
                        ) : (
                          clientsCatalog.map(c => {
                            const checked = formData.clientIds.includes(c.id);
                            return (
                              <label
                                key={c.id}
                                className="guarantors-client-row"
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                  padding: "9px 12px",
                                  borderBottom: "1px solid #f1f5f9",
                                  cursor: "pointer",
                                  background: checked ? "#eff6ff" : "transparent",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleClient(c.id)}
                                  style={{ accentColor: "#2563eb", width: 14, height: 14, flexShrink: 0 }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <strong style={{ fontSize: 12, color: "#0f172a", display: "block" }}>{c.name}</strong>
                                  <span className="keep-case" style={{ fontSize: 10.5, color: "#64748b" }}>
                                    {c.document ?? "Sem documento cadastrado"}
                                  </span>
                                </div>
                                {checked && (
                                  <CheckCircle2 size={14} style={{ color: "#2563eb", flexShrink: 0 }} />
                                )}
                              </label>
                            );
                          })
                        )}
                      </div>

                      {selectedClients.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {selectedClients.map(c => (
                            <span
                              key={c.id}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "3px 8px",
                                background: "#eff6ff",
                                border: "1px solid #bfdbfe",
                                color: "#1e40af",
                                borderRadius: 12,
                                fontSize: 10.5,
                                fontWeight: 600,
                              }}
                            >
                              {c.name}
                              <button
                                type="button"
                                onClick={() => toggleClient(c.id)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#1e40af", padding: 0, display: "flex" }}
                              >
                                <X size={11} />
                              </button>
                            </span>
                          ))}
                        </div>
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
                    {selected ? "Edição registrada com auditoria automática" : "Nova pessoa será atribuída à esteira"}
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}>Cancelar</button>
                    <button type="submit" className="btn-primary" style={{ minWidth: 150, justifyContent: "center" }} disabled={cnpjLoading || !!documentError}>
                      {selected ? "Atualizar Pessoa" : "Salvar Pessoa"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={!!deleteModal}
          tone="danger"
          title="Remover Pessoa"
          description="Esta ação é permanente. Os dados da pessoa e todos os vínculos (Fiador, Codevedor e Testemunha) serão apagados do sistema."
          entityLabel={deleteModal?.personType === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}
          entityName={deleteModal?.name}
          entityDetail={
            deleteModal?.personType === "PJ"
              ? (deleteModal?.cnpj ? `CNPJ ${maskCNPJ(deleteModal.cnpj)}` : undefined)
              : (deleteModal?.cpf ? `CPF ${maskCPF(deleteModal.cpf)}` : undefined)
          }
          consequences={[
            "Vínculos com clientes serão desfeitos automaticamente.",
            "Vínculos com contratos (em qualquer papel) também serão removidos.",
          ]}
          confirmLabel="Confirmar Remoção"
          onConfirm={handleDelete}
          onClose={() => setDeleteModal(null)}
        />
      </div>
    </UnyPayLayout>
  );
}
