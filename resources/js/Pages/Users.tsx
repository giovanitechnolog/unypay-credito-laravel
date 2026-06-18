import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { Head, usePage } from "@inertiajs/react";
import {
  Plus, Search, RefreshCw, UserCheck, ShieldAlert, Users, Calendar, Mail,
  Shield, ShieldCheck, Edit2, Trash2, X, KeyRound, IdCard, Camera, Upload, Trash, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import UnyPayLayout from "../Components/UnyPayLayout";
import ConfirmDialog from "../Components/ConfirmDialog";
import PasswordInput from "../Components/PasswordInput";
import { api, extractFirstError } from "../lib/api";
import { fetchSigxByCpf, getRedHighlight, notifySigxFailure } from "../lib/sigx";

interface User {
  id: number;
  name: string;
  email: string;
  cpf: string | null;
  rg: string | null;
  phone: string | null;
  birthDate: string | null;
  gender: string | null;
  role: "admin" | "user";
  status: "Ativo" | "Inativo";
  photo: string | null;
  photoUrl?: string;
  lastSignedIn?: string;
}

interface PaginatedUsers {
  data: User[];
}

const maskCPF = (v: string) => {
  v = v.replace(/\D/g, "");
  if (v.length > 11) v = v.substring(0, 11);
  return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const maskPhone = (v: string) => {
  v = v.replace(/\D/g, "");
  if (v.length > 11) v = v.substring(0, 11);
  if (v.length === 11) {
    return v.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  return v.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
};

/**
 * Limites de tamanho dos inputs, espelhando exatamente o schema da tabela
 * `users` no banco. Compartilhado entre todos os <input maxLength={...} />
 * da tela. Mudou no banco? Ajuste aqui (uma única fonte de verdade).
 */
const FIELD_MAX_LENGTH = {
  name: 255,
  email: 320,
  password: 255,
  cpf: 14,        // 000.000.000-00
  rg: 20,
  phone: 15,      // (00) 00000-0000
  gender: 20,
} as const;

/** Shell compartilhado dos cards de estatística — flex proporcional, visual original. */
const STAT_CARD: React.CSSProperties = {
  flex: "1 1 0",
  minWidth: 150,
  background: "white",
  border: "1px solid #e2e8f0",
  padding: "10px 12px",
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const uppercaseText = (value: string) => value.toUpperCase();

const formatLastAccess = (lastSignedIn?: string | null) => {
  if (!lastSignedIn) return "Nunca acessou";
  return new Date(lastSignedIn).toLocaleDateString("pt-BR");
};

function UserAvatar({ photoUrl, size = 32 }: { photoUrl?: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);

  if (!photoUrl || broken) {
    return <Users size={Math.round(size * 0.44)} style={{ margin: "0 auto", color: "#94a3b8" }} />;
  }

  return (
    <img
      src={photoUrl}
      alt=""
      onError={() => setBroken(true)}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}

/**
 * Validação de CPF — algoritmo oficial dos dois dígitos verificadores
 * (Receita Federal). Aceita máscara ou só dígitos. Retorna true para CPF
 * válido. CPFs com dígitos repetidos (ex.: 11111111111) são rejeitados.
 *
 * Mantemos esta validação no frontend ESPELHANDO `App\Rules\Cpf` no PHP,
 * para feedback imediato ao operador. O backend também valida.
 */
const isValidCpf = (raw: string): boolean => {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  for (let t = 9; t < 11; t++) {
    let sum = 0;
    for (let i = 0; i < t; i++) {
      sum += parseInt(digits[i], 10) * (t + 1 - i);
    }
    let rest = (sum * 10) % 11;
    if (rest === 10) rest = 0;
    if (rest !== parseInt(digits[t], 10)) return false;
  }
  return true;
};

/**
 * Handlers que bloqueiam copiar/colar/cortar/arrastar nos campos
 * sensíveis (confirmação de e-mail e senha). Garantem que o operador
 * digite o valor de novo, manualmente, evitando colar um e-mail/senha
 * errado(a) já presente no clipboard.
 */
const NO_PASTE_PROPS: React.InputHTMLAttributes<HTMLInputElement> = {
  onPaste: (e) => e.preventDefault(),
  onCopy:  (e) => e.preventDefault(),
  onCut:   (e) => e.preventDefault(),
  onDrop:  (e) => e.preventDefault(),
  onDragOver: (e) => e.preventDefault(),
  autoComplete: "off",
  spellCheck: false,
};

export default function UsersPage() {
  const { auth } = usePage<any>().props;
  const currentUserId = auth?.user?.id ?? null;
  const isAdmin = auth?.user?.role === "admin";

  const canEditUser = (user: User) => isAdmin || user.id === currentUserId;
  const canDeleteUser = (user: User) => isAdmin && user.id !== currentUserId;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState("perfil");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteModalUser, setDeleteModalUser] = useState<User | null>(null);

  // 🚀 Estado do formulário expandido com os campos de SEGURANÇA:
  //   • emailConfirmation: digitar o e-mail uma 2ª vez (paste/copy/cut bloqueados).
  //   • currentPassword:    senha atual (necessária para alterar a senha em edição).
  //   • password:           nova senha (opcional na edição).
  //   • passwordConfirmation: confirma a nova senha (paste/copy/cut bloqueados).
  // No payload são serializados como `email_confirmation`, `current_password` e
  // `password_confirmation` (snake_case esperado pelo Laravel `confirmed`).
  const [formData, setFormData] = useState({
    name: "", email: "", emailConfirmation: "",
    currentPassword: "", password: "", passwordConfirmation: "",
    role: "user", status: "Ativo",
    cpf: "", rg: "", phone: "", birthDate: "", gender: ""
  });
  const [cpfError, setCpfError] = useState<string | null>(null);
  // 🚀 Sincronização SIGx — quando o operador clica "Sincronizar com SIGx",
  // os campos preenchidos automaticamente ficam normais e os NÃO preenchidos
  // são destacados em vermelho (orientação visual, não bloqueia o submit).
  const [cpfLoading, setCpfLoading] = useState(false);
  const [cpfSynced, setCpfSynced] = useState(false);
  // E-mail original do usuário em edição. Usado para detectar quando o
  // operador alterou o e-mail e ativar/desativar a redigitação.
  const [originalEmail, setOriginalEmail] = useState<string>("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // 🚀 Computeds — controlam visibilidade/obrigatoriedade dos campos
  // sensíveis. Em edição, só exigimos redigitar o e-mail SE ele mudou,
  // e só exigimos senha atual SE o operador começou a digitar uma nova.
  const isEditing = !!selectedUser;
  const editingSelfOnly = isEditing && selectedUser?.id === currentUserId && !isAdmin;
  const emailChanged = isEditing && formData.email.trim().toLowerCase() !== originalEmail.toLowerCase();
  const requireEmailConfirm = !isEditing || emailChanged;
  const isChangingPassword =
    !!formData.password || !!formData.passwordConfirmation || !!formData.currentPassword;

  const fetchUsers = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const { data } = await api.get<PaginatedUsers>("/api/users", {
        params: { search: q, per_page: 100 },
      });
      setUsers(data.data);
    } catch (err) {
      toast.error(extractFirstError(err, "Erro ao carregar usuários administrativo."));
    } finally {
      setLoading(false);
    }
  }, []);

  // 🚀 CORREÇÃO CRÍTICA: Unificado em um único efeito com debounce para evitar o duplo carregamento inicial
  useEffect(() => {
    const t = setTimeout(() => {
      fetchUsers(search);
    }, 350);
    return () => clearTimeout(t);
  }, [search, fetchUsers]);

  const counters = useMemo(() => {
    return {
      total: users.length,
      padrao: users.filter(u => u.role === "user").length,
      admins: users.filter(u => u.role === "admin").length,
      ativos: users.filter(u => u.status === "Ativo").length,
    };
  }, [users]);

  const openCreate = () => {
    if (!isAdmin) return;
    setSelectedUser(null);
    setOriginalEmail("");
    setCpfError(null);
    setCpfSynced(false);
    setFormData({
      name: "", email: "", emailConfirmation: "",
      currentPassword: "", password: "", passwordConfirmation: "",
      role: "user", status: "Ativo",
      cpf: "", rg: "", phone: "", birthDate: "", gender: ""
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setActiveFormTab("perfil");
    setFormOpen(true);
  };

  const openEdit = (user: User) => {
    if (!canEditUser(user)) {
      toast.error("Você só pode editar os seus próprios dados.");
      return;
    }
    setSelectedUser(user);
    setOriginalEmail(user.email ?? "");
    setCpfError(null);
    setCpfSynced(false);
    setFormData({
      name: uppercaseText(user.name ?? ""),
      email: user.email,
      // Em edição: pré-preenchemos a confirmação com o e-mail atual; o
      // input fica desabilitado enquanto o e-mail não muda. Assim que o
      // operador altera o e-mail, o efeito abaixo limpa esse campo e
      // habilita a redigitação manual (sem paste).
      emailConfirmation: user.email ?? "",
      currentPassword: "",
      password: "",
      passwordConfirmation: "",
      role: user.role,
      status: user.status ?? "Ativo",
      cpf: user.cpf ? maskCPF(user.cpf) : "",
      rg: user.rg ? uppercaseText(user.rg) : "",
      phone: user.phone ? maskPhone(user.phone) : "",
      birthDate: user.birthDate ?? "",
      gender: user.gender ?? ""
    });
    setPhotoFile(null);
    setPhotoPreview(user.photoUrl ?? null);
    setActiveFormTab("perfil");
    setFormOpen(true);
  };

  // Quando o e-mail principal muda (em edição), limpamos a confirmação
  // para forçar a redigitação manual. Em criação, deixa intocado.
  useEffect(() => {
    if (!isEditing) return;
    if (emailChanged && formData.emailConfirmation === originalEmail) {
      setFormData((p) => ({ ...p, emailConfirmation: "" }));
    }
  }, [isEditing, emailChanged, originalEmail, formData.emailConfirmation]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem (JPG, PNG ou WEBP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem ultrapassa o limite de 2 MB.");
      return;
    }
    if (photoPreview && photoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const handlePhotoRemove = () => {
    if (photoPreview && photoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  /**
   * 🚀 Aciona a integração SIGx (Rodopar) para preencher os campos do
   * operador a partir do CPF. Usa a integração ATIVA com finalidade
   * `cpf_lookup` cadastrada no menu Sistema → Integrações.
   *
   * Pós-sucesso, sinalizamos `cpfSynced=true`: os campos não retornados
   * pela API ganham destaque vermelho (estilo Ingestão IA) — orientando
   * o operador a completar manualmente, SEM marcar como obrigatório.
   */
  const handleSyncCpf = async () => {
    const digits = (formData.cpf ?? "").replace(/\D/g, "");
    if (digits.length !== 11) {
      toast.error("Digite um CPF completo (11 dígitos) antes de sincronizar.");
      return;
    }
    if (!isValidCpf(digits)) {
      toast.error("CPF inválido — corrija antes de consultar o SIGx.");
      return;
    }

    setCpfLoading(true);
    try {
      const result = await fetchSigxByCpf(digits);
      if (!result.ok || !result.data) {
        notifySigxFailure(result);
        // Quando o CPF não foi localizado (404), limpamos os campos que
        // poderiam ter sido preenchidos por um sync anterior — caso
        // contrário, dados antigos ficariam "pendurados" no formulário e
        // confundiriam o operador no preenchimento manual. Em outros
        // erros (timeout, integração desativada), preservamos o que já
        // está digitado: o sync falhou por motivo técnico, não porque
        // os dados existentes estão errados.
        if (result.status === 404) {
          setFormData(p => ({
            ...p,
            name:      "",
            email:     "",
            rg:        "",
            phone:     "",
            birthDate: "",
            gender:    "",
          }));
          setCpfSynced(false);
        }
        return;
      }

      const d = result.data;
      setFormData(p => ({
        ...p,
        name:      d.name      ? uppercaseText(d.name)      : p.name,
        email:     d.email     || p.email,
        rg:        d.rg        ? uppercaseText(String(d.rg)) : p.rg,
        phone:     d.phone     ? maskPhone(String(d.phone)) : p.phone,
        birthDate: d.birthDate || p.birthDate,
        gender:    d.gender    || p.gender,
      }));
      setCpfSynced(true);
      toast.success("Dados do SIGx aplicados ao formulário.");
    } catch (err) {
      toast.error(extractFirstError(err, "Falha ao consultar o SIGx."));
    } finally {
      setCpfLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 🛡️ Validações cliente-side (espelham o backend) — feedback imediato
    // ao operador, sem dispender uma round-trip ao servidor.
    if (requireEmailConfirm && formData.email.trim().toLowerCase() !== formData.emailConfirmation.trim().toLowerCase()) {
      toast.error("O e-mail e a confirmação de e-mail não conferem.");
      return;
    }
    if (isChangingPassword || !isEditing) {
      if (!isEditing && !formData.password) {
        toast.error("Informe a nova senha.");
        return;
      }
      if (formData.password !== formData.passwordConfirmation) {
        toast.error("A nova senha e a confirmação não conferem.");
        return;
      }
      if (isEditing && isChangingPassword && !formData.currentPassword) {
        toast.error("Informe a senha atual para alterar a senha.");
        return;
      }
    }
    if (formData.cpf && !isValidCpf(formData.cpf)) {
      setCpfError("O CPF informado é inválido.");
      setActiveFormTab("pessoal");
      toast.error("O CPF informado é inválido.");
      return;
    } else {
      setCpfError(null);
    }

    // 🚀 Mapeamento camelCase → snake_case esperado pelas regras do Laravel
    // (`confirmed`, `current_password`). Campos vazios não são enviados na
    // edição quando não está alterando senha (mantém a senha atual no banco).
    const data = new FormData();
    data.append("name",  uppercaseText(formData.name.trim()));
    data.append("email", formData.email);
    if (requireEmailConfirm) data.append("email_confirmation", formData.emailConfirmation);
    if (isAdmin) {
      data.append("role",   formData.role);
      data.append("status", formData.status);
    }
    data.append("cpf",    formData.cpf);
    data.append("rg",     formData.rg ? uppercaseText(formData.rg.trim()) : formData.rg);
    data.append("phone",  formData.phone);
    data.append("birthDate", formData.birthDate);
    data.append("gender", formData.gender);

    if (!isEditing) {
      data.append("password", formData.password);
      data.append("password_confirmation", formData.passwordConfirmation);
    } else if (isChangingPassword) {
      data.append("current_password",       formData.currentPassword);
      data.append("password",               formData.password);
      data.append("password_confirmation",  formData.passwordConfirmation);
    }

    if (photoFile) data.append("photo", photoFile);

    try {
      if (selectedUser) {
        data.append("_method", "PUT");
        await api.post(`/api/users/${selectedUser.id}`, data);
        toast.success("Usuário atualizado com sucesso!");
      } else {
        await api.post("/api/users", data);
        toast.success("Usuário cadastrado com sucesso!");
      }
      setFormOpen(false);
      fetchUsers(search);
    } catch (err) {
      toast.error(extractFirstError(err, "Falha ao gravar os dados."));
    }
  };

  const handleExecuteDelete = async () => {
    if (!deleteModalUser) return;
    try {
      await api.delete(`/api/users/${deleteModalUser.id}`);
      toast.success("Operador removido da esteira administrativa.");
      setDeleteModalUser(null);
      fetchUsers(search);
    } catch (err) {
      toast.error(extractFirstError(err, "Não foi possível remover o operador."));
    }
  };

  return (
    <UnyPayLayout>
      <Head title="Gerenciamento de Usuários" />

      <style>{`
        /* —— Caixa alta visual da tela inteira (incluindo modal) —— */
        .users-page,
        .users-page input,
        .users-page select,
        .users-page textarea,
        .users-page button,
        .users-page option,
        .users-page label,
        .users-page h1, .users-page h2, .users-page h3,
        .users-page p, .users-page span, .users-page strong,
        .users-page td, .users-page th { text-transform: uppercase; }

        /* Mantém legibilidade onde caixa alta atrapalha */
        .users-page input.mono,
        .users-page input[type="email"],
        .users-page input[type="password"],
        .users-page input[type="date"],
        .users-page input[type="number"],
        .users-page input.password-input { text-transform: none !important; }
        .users-page input::placeholder,
        .users-page textarea::placeholder { text-transform: none; }
        .users-page .keep-case,
        .users-page .keep-case * { text-transform: none !important; }

        /* Refinamentos do modal */
        .users-modal-body { scroll-behavior: smooth; }
        .users-modal-body::-webkit-scrollbar { width: 8px; }
        .users-modal-body::-webkit-scrollbar-track { background: #f1f5f9; }
        .users-modal-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .users-modal-body::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .users-page .sigx-input { transition: border-color 0.15s, box-shadow 0.15s; }
        .users-page .sigx-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }
        .users-page .btn-icon { transition: all 0.12s; }
        .users-page .btn-icon:hover { transform: translateY(-1px); }
      `}</style>

      <div className="users-page" style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 4px 24px 4px" }}>
        
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0 }}>Controle de Operadores</h2>
          <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>Gerencie os níveis de acessos e os dados cadastrais dos colaboradores.</p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <div style={STAT_CARD}>
            <div style={{ padding: 7, background: "#f1f5f9", borderRadius: 6, color: "#475569", flexShrink: 0 }}><Users size={17} /></div>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 10, color: "#64748b", display: "block", lineHeight: 1.3 }}>Total de Operadores</span>
              <strong style={{ fontSize: 16, color: "#0f172a" }}>{counters.total}</strong>
            </div>
          </div>
          <div style={STAT_CARD}>
            <div style={{ padding: 7, background: "#ecfdf5", borderRadius: 6, color: "#059669", flexShrink: 0 }}><UserCheck size={17} /></div>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 10, color: "#64748b", display: "block", lineHeight: 1.3 }}>Status Ativos</span>
              <strong style={{ fontSize: 16, color: "#059669" }}>{counters.ativos}</strong>
            </div>
          </div>
          <div style={STAT_CARD}>
            <div style={{ padding: 7, background: "#eff6ff", borderRadius: 6, color: "#2563eb", flexShrink: 0 }}><Shield size={17} /></div>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 10, color: "#64748b", display: "block", lineHeight: 1.3 }}>Usuários Padrão</span>
              <strong style={{ fontSize: 16, color: "#2563eb" }}>{counters.padrao}</strong>
            </div>
          </div>
          <div style={STAT_CARD}>
            <div style={{ padding: 7, background: "#fbf7ff", borderRadius: 6, color: "#6b21a8", flexShrink: 0 }}><ShieldCheck size={17} /></div>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 10, color: "#64748b", display: "block", lineHeight: 1.3 }}>Administradores</span>
              <strong style={{ fontSize: 16, color: "#6b21a8" }}>{counters.admins}</strong>
            </div>
          </div>
        </div>

        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderBottom: "1px solid #e5e7eb", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 260 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 10px", flex: 1, maxWidth: 320, background: "#f8fafc" }}>
                <Search size={14} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Buscar por nome, e-mail ou CPF..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ flex: 1, border: "none", outline: "none", fontSize: 12, background: "transparent", color: "#334155" }}
                />
              </div>
              <button onClick={() => fetchUsers(search)} title="Atualizar Grade" style={{ background: "white", border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 8px", cursor: "pointer", color: "#64748b", display: "flex" }}><RefreshCw size={13} /></button>
            </div>
            {isAdmin && (
              <button onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2139", color: "white", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Plus size={14} /> Novo Usuário</button>
            )}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600 }}>OPERADOR</th>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600 }}>CONTATOS E DOCUMENTOS</th>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600, textAlign: "center" }}>NÍVEL</th>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600, textAlign: "center" }}>STATUS</th>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600, textAlign: "right" }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#64748b" }}>Carregando operadores na esteira...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>Nenhum operador administrativo foi localizado.</td></tr>
                ) : (
                  users.map(u => (
                    <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }} onMouseOver={e=>e.currentTarget.style.background="#f8fafc"} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e2e8f0", overflow: "hidden", display: "flex", alignItems: "center", justifyItems: "center" }}>
                            <UserAvatar photoUrl={u.photoUrl} />
                          </div>
                          <div>
                            <strong style={{ color: "#0f172a", fontSize: 13, display: "block" }}>{u.name}</strong>
                            <span style={{ fontSize: 10, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}><Calendar size={10} /> Último Acesso: {formatLastAccess(u.lastSignedIn)}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#334155" }}><Mail size={11} color="#94a3b8" /> {u.email}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "#64748b" }}>
                            {u.cpf && <span>CPF: {maskCPF(u.cpf)}</span>}
                            {u.phone && <span>Tel: {maskPhone(u.phone)}</span>}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: u.role === "admin" ? "#fbf7ff" : "#f1f5f9", color: u.role === "admin" ? "#6b21a8" : "#475569" }}>
                          <Shield size={11} /> {u.role === "admin" ? "ADMINISTRADOR" : "PADRÃO"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: u.status === "Ativo" ? "#d1fae5" : "#fee2e2", color: u.status === "Ativo" ? "#065f46" : "#991b1b" }}>{u.status ?? "Ativo"}</span>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 4 }}>
                          {canEditUser(u) && (
                            <button onClick={() => openEdit(u)} className="btn-icon" title={u.id === currentUserId && !isAdmin ? "Editar Meus Dados" : "Editar Ficha"}><Edit2 size={13} /></button>
                          )}
                          {canDeleteUser(u) && (
                            <button onClick={() => setDeleteModalUser(u)} className="btn-icon" style={{ color: "#dc2626" }} title="Excluir Colaborador"><Trash2 size={13} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── MODAL: CADASTRO E EDIÇÃO COORDENADO POR ABAS ──────────────────── */}
        {formOpen && (
          <div className="sigx-modal-overlay" onMouseDown={() => setFormOpen(false)}>
            <div
              className="sigx-modal users-modal"
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
              {/* HEADER com gradiente — apenas título e botão fechar */}
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
                    <UserCheck size={16} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>
                      {selectedUser
                        ? (editingSelfOnly ? "Meus Dados" : "Editar Operador")
                        : "Novo Operador"}
                    </span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                      {selectedUser
                        ? (editingSelfOnly
                          ? "Atualize suas informações de acesso e cadastro"
                          : `Atualizando registro #${selectedUser.id}`)
                        : "Preencha as guias abaixo para registrar a nova chave"}
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
                  { key: "perfil",  label: "Dados de Acesso",       icon: KeyRound },
                  { key: "pessoal", label: "Informações Pessoais",  icon: IdCard },
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
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleFormSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                <div
                  className="sigx-modal-body users-modal-body"
                  style={{
                    padding: 22,
                    height: "clamp(380px, 52vh, 60vh)",
                    overflowY: "auto",
                    background: "white",
                  }}
                >
                  {activeFormTab === "perfil" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {/* ── Bloco de FOTO de perfil ───────────────────────── */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          padding: 14,
                          background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)",
                          border: "1px solid #e0e7ff",
                          borderRadius: 10,
                        }}
                      >
                        {/* Avatar circular com botão de câmera */}
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <div
                            style={{
                              width: 72, height: 72,
                              borderRadius: "50%",
                              background: "white",
                              border: "3px solid #2563eb",
                              overflow: "hidden",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.25)",
                            }}
                          >
                            {photoPreview ? (
                              <img src={photoPreview} alt="Foto do operador" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <Users size={26} style={{ color: "#cbd5e1" }} />
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => photoInputRef.current?.click()}
                            title={photoPreview ? "Trocar foto" : "Adicionar foto"}
                            style={{
                              position: "absolute",
                              bottom: -2, right: -2,
                              width: 26, height: 26,
                              borderRadius: "50%",
                              background: "#2563eb",
                              border: "2px solid white",
                              color: "white",
                              cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
                            }}
                          >
                            <Camera size={12} />
                          </button>
                          <input
                            ref={photoInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoChange}
                            style={{ display: "none" }}
                          />
                        </div>

                        {/* Texto + botões de ação */}
                        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#1e2139", letterSpacing: "0.02em" }}>
                              Foto do Operador
                            </span>
                            <span className="keep-case" style={{ fontSize: 10.5, color: "#64748b" }}>
                              JPG, PNG ou WEBP — recomendamos imagem quadrada de até 2 MB.
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => photoInputRef.current?.click()}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "6px 14px",
                                fontSize: 11,
                                fontWeight: 600,
                                background: "#2563eb",
                                color: "white",
                                border: "1px solid #1d4ed8",
                                borderRadius: 6,
                                cursor: "pointer",
                                boxShadow: "0 1px 2px rgba(37, 99, 235, 0.25)",
                              }}
                            >
                              <Upload size={12} /> {photoPreview ? "Trocar Foto" : "Adicionar Foto"}
                            </button>
                            {photoPreview && (
                              <button
                                type="button"
                                onClick={handlePhotoRemove}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  padding: "6px 14px",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background: "white",
                                  color: "#dc2626",
                                  border: "1px solid #fecaca",
                                  borderRadius: 6,
                                  cursor: "pointer",
                                }}
                              >
                                <Trash size={12} /> Remover
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="sigx-label">NOME COMPLETO *</label>
                        <input
                          type="text"
                          className="sigx-input"
                          value={formData.name}
                          onChange={e => setFormData(p => ({ ...p, name: uppercaseText(e.target.value) }))}
                          maxLength={FIELD_MAX_LENGTH.name}
                          required
                          style={getRedHighlight(formData.name, cpfSynced)}
                        />
                      </div>

                      {/* 🚀 E-MAIL + CONFIRMAÇÃO DE E-MAIL ─────────────────
                          A confirmação BLOQUEIA copy/paste/cut/drop para
                          forçar redigitação manual (evita colar um e-mail
                          errado já presente no clipboard). Em edição, o
                          campo de confirmação fica DESABILITADO enquanto
                          o e-mail não é alterado em relação ao original. */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <div>
                          <label className="sigx-label">E-MAIL *</label>
                          <input
                            type="email"
                            className="sigx-input"
                            value={formData.email}
                            onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                            maxLength={FIELD_MAX_LENGTH.email}
                            required
                            style={getRedHighlight(formData.email, cpfSynced)}
                          />
                        </div>
                        <div>
                          <label className="sigx-label">
                            CONFIRMAÇÃO DE E-MAIL {requireEmailConfirm && <span>*</span>}
                          </label>
                          <input
                            type="email"
                            className="sigx-input"
                            value={formData.emailConfirmation}
                            onChange={e => setFormData(p => ({ ...p, emailConfirmation: e.target.value }))}
                            maxLength={FIELD_MAX_LENGTH.email}
                            disabled={!requireEmailConfirm}
                            required={requireEmailConfirm}
                            placeholder={requireEmailConfirm ? "Digite o e-mail novamente" : ""}
                            {...NO_PASTE_PROPS}
                          />
                          {requireEmailConfirm
                            && formData.emailConfirmation
                            && formData.emailConfirmation.trim().toLowerCase() !== formData.email.trim().toLowerCase() && (
                            <span className="keep-case" style={{ display: "block", marginTop: 4, fontSize: 10.5, color: "#dc2626", fontWeight: 600 }}>
                              Os e-mails não conferem.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 🚀 BLOCO DE SENHA — paste/copy/cut bloqueados em
                          TODOS os 3 campos de senha. Lógica:
                            • CRIAÇÃO   → exibe Nova Senha + Confirmação (sem senha atual).
                            • EDIÇÃO    → exibe os 3 campos sempre opcionais; só obrigam
                              entre si quando o operador começa a digitar (isChangingPassword).
                              Deixar TODOS vazios → mantém a senha existente. */}
                      {selectedUser && (
                        <div className="keep-case">
                          <label className="sigx-label">
                            SENHA ATUAL {isChangingPassword && <span>*</span>}
                            <span className="keep-case" style={{ color: "#94a3b8", fontWeight: 500, fontSize: 10, marginLeft: 6 }}>
                              (necessária apenas para alterar a senha)
                            </span>
                          </label>
                          <PasswordInput
                            className="sigx-input"
                            value={formData.currentPassword}
                            onChange={e => setFormData(p => ({ ...p, currentPassword: e.target.value }))}
                            maxLength={FIELD_MAX_LENGTH.password}
                            required={isChangingPassword}
                            autoComplete="current-password"
                            spellCheck={false}
                          />
                        </div>
                      )}
                      <div className="keep-case" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <div>
                          <label className="sigx-label">
                            {selectedUser ? "NOVA SENHA" : "SENHA DE ACESSO *"}
                            {selectedUser && (
                              <span className="keep-case" style={{ color: "#94a3b8", fontWeight: 500, fontSize: 10, marginLeft: 6 }}>
                                (deixe vazio para manter)
                              </span>
                            )}
                          </label>
                          <PasswordInput
                            className="sigx-input"
                            value={formData.password}
                            onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                            maxLength={FIELD_MAX_LENGTH.password}
                            minLength={6}
                            required={!selectedUser || isChangingPassword}
                            autoComplete="new-password"
                            spellCheck={false}
                          />
                        </div>
                        <div>
                          <label className="sigx-label">
                            {selectedUser ? "CONFIRMAÇÃO DA NOVA SENHA" : "CONFIRMAÇÃO DE SENHA"} {(!selectedUser || isChangingPassword) && <span>*</span>}
                          </label>
                          <PasswordInput
                            className="sigx-input"
                            value={formData.passwordConfirmation}
                            onChange={e => setFormData(p => ({ ...p, passwordConfirmation: e.target.value }))}
                            maxLength={FIELD_MAX_LENGTH.password}
                            minLength={6}
                            required={!selectedUser || isChangingPassword}
                            placeholder="Digite a senha novamente"
                            {...NO_PASTE_PROPS}
                          />
                          {(formData.passwordConfirmation || formData.password)
                            && formData.password !== formData.passwordConfirmation && (
                            <span className="keep-case" style={{ display: "block", marginTop: 4, fontSize: 10.5, color: "#dc2626", fontWeight: 600 }}>
                              As senhas não conferem.
                            </span>
                          )}
                        </div>
                      </div>

                      {!editingSelfOnly && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                          <div>
                            <label className="sigx-label">NÍVEL DE PERMISSÃO</label>
                            <select className="sigx-input" value={formData.role} onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}>
                              <option value="user">PADRÃO</option>
                              <option value="admin">ADMINISTRADOR</option>
                            </select>
                          </div>
                          <div>
                            <label className="sigx-label">STATUS OPERACIONAL</label>
                            <select className="sigx-input" value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}>
                              <option value="Ativo">ATIVO</option>
                              <option value="Inativo">INATIVO</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeFormTab === "pessoal" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <div>
                          <label className="sigx-label">CPF</label>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input
                              type="text"
                              className="sigx-input mono"
                              placeholder="000.000.000-00"
                              value={formData.cpf}
                              maxLength={FIELD_MAX_LENGTH.cpf}
                              onChange={e => {
                                const next = maskCPF(e.target.value);
                                setFormData(p => ({ ...p, cpf: next }));
                                setCpfError(null);
                                if (cpfSynced) setCpfSynced(false);
                              }}
                              onBlur={e => {
                                const v = e.target.value;
                                if (v && !isValidCpf(v)) {
                                  setCpfError("O CPF informado é inválido.");
                                } else {
                                  setCpfError(null);
                                }
                              }}
                              readOnly={cpfLoading}
                              style={cpfError ? { borderColor: "#dc2626", boxShadow: "0 0 0 3px rgba(220,38,38,0.12)" } : undefined}
                            />
                            <button
                              type="button"
                              onClick={handleSyncCpf}
                              disabled={cpfLoading || formData.cpf.replace(/\D/g, "").length !== 11}
                              title="Consulta o CPF na integração SIGx ativa e preenche os campos automaticamente"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "0 12px",
                                borderRadius: 8,
                                border: "1px solid #2563eb",
                                background: cpfLoading ? "#dbeafe" : "#eff6ff",
                                color: "#1d4ed8",
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: cpfLoading || formData.cpf.replace(/\D/g, "").length !== 11 ? "not-allowed" : "pointer",
                                opacity: cpfLoading || formData.cpf.replace(/\D/g, "").length !== 11 ? 0.55 : 1,
                                whiteSpace: "nowrap",
                                transition: "all 0.12s",
                              }}
                            >
                              {cpfLoading ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <RefreshCw size={13} />
                              )}
                              <span className="keep-case">
                                {cpfLoading ? "Consultando..." : "Sincronizar com SIGx"}
                              </span>
                            </button>
                          </div>
                          {cpfError && (
                            <span className="keep-case" style={{ display: "block", marginTop: 4, fontSize: 10.5, color: "#dc2626", fontWeight: 600 }}>
                              {cpfError}
                            </span>
                          )}
                          {cpfSynced && !cpfError && (
                            <span className="keep-case" style={{ display: "block", marginTop: 4, fontSize: 10.5, color: "#dc2626", fontWeight: 600 }}>
                              Campos em vermelho não foram retornados pelo SIGx — preencha manualmente.
                            </span>
                          )}
                        </div>
                        <div>
                          <label className="sigx-label">IDENTIDADE (RG)</label>
                          <input
                            type="text"
                            className="sigx-input"
                            value={formData.rg}
                            maxLength={FIELD_MAX_LENGTH.rg}
                            onChange={e => setFormData(p => ({ ...p, rg: uppercaseText(e.target.value) }))}
                            style={getRedHighlight(formData.rg, cpfSynced)}
                          />
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <div>
                          <label className="sigx-label">TELEFONE / WHATSAPP</label>
                          <input
                            type="text"
                            className="sigx-input mono"
                            placeholder="(00) 00000-0000"
                            value={formData.phone}
                            maxLength={FIELD_MAX_LENGTH.phone}
                            onChange={e => setFormData(p => ({ ...p, phone: maskPhone(e.target.value) }))}
                            style={getRedHighlight(formData.phone, cpfSynced)}
                          />
                        </div>
                        <div>
                          <label className="sigx-label">DATA DE NASCIMENTO</label>
                          <input
                            type="date"
                            className="sigx-input"
                            value={formData.birthDate}
                            onChange={e => setFormData(p => ({ ...p, birthDate: e.target.value }))}
                            style={getRedHighlight(formData.birthDate, cpfSynced)}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="sigx-label">GÊNERO</label>
                        <select
                          className="sigx-input"
                          value={formData.gender}
                          onChange={e => setFormData(p => ({ ...p, gender: e.target.value }))}
                          style={getRedHighlight(formData.gender, cpfSynced)}
                        >
                          <option value="">Não Informar</option>
                          <option value="Masculino">Masculino</option>
                          <option value="Feminino">Feminino</option>
                          <option value="Outro">Outro</option>
                        </select>
                      </div>
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
                    {selectedUser ? "Edição registrada com auditoria automática" : "Novo operador será atribuído ao seu usuário"}
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}>Cancelar</button>
                    <button type="submit" className="btn-primary" style={{ minWidth: 150, justifyContent: "center" }}>
                      {selectedUser ? "Atualizar Operador" : "Salvar Operador"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={!!deleteModalUser}
          tone="danger"
          icon={ShieldAlert}
          title="Revogar Credenciais"
          description={
            <>
              Esta ação <strong>revoga imediatamente</strong> todas as chaves
              digitais e de auditoria deste operador. Não é possível desfazer.
            </>
          }
          entityLabel="Operador"
          entityName={deleteModalUser?.name}
          entityDetail={deleteModalUser?.email}
          consequences={[
            "O acesso à plataforma será encerrado em todas as sessões ativas.",
            "Histórico de auditoria do usuário será preservado para fins legais.",
          ]}
          confirmLabel="Confirmar Revogação"
          onConfirm={handleExecuteDelete}
          onClose={() => setDeleteModalUser(null)}
        />
      </div>

    </UnyPayLayout>
  );
}