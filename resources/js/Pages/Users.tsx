import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { Head, usePage } from "@inertiajs/react";
import {
  Plus, Search, RefreshCw, UserCheck, ShieldAlert, Users, Calendar, Mail,
  Shield, ShieldCheck, Edit2, Trash2, X, KeyRound, IdCard, Camera, Upload, Trash,
} from "lucide-react";
import { toast } from "sonner";
import UnyPayLayout from "../Components/UnyPayLayout";
import { api, extractFirstError } from "../lib/api";

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

export default function UsersPage() {
  const { auth } = usePage<any>().props;
  const currentUserId = auth?.user?.id ?? null;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState("perfil");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteModalUser, setDeleteModalUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    name: "", email: "", password: "", role: "user", status: "Ativo",
    cpf: "", rg: "", phone: "", birthDate: "", gender: ""
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

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
      admins: users.filter(u => u.role === "admin").length,
      ativos: users.filter(u => u.status === "Ativo").length,
    };
  }, [users]);

  const openCreate = () => {
    setSelectedUser(null);
    setFormData({
      name: "", email: "", password: "", role: "user", status: "Ativo",
      cpf: "", rg: "", phone: "", birthDate: "", gender: ""
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setActiveFormTab("perfil");
    setFormOpen(true);
  };

  const openEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      status: user.status ?? "Ativo",
      cpf: user.cpf ? maskCPF(user.cpf) : "",
      rg: user.rg ?? "",
      phone: user.phone ? maskPhone(user.phone) : "",
      birthDate: user.birthDate ?? "",
      gender: user.gender ?? ""
    });
    setPhotoFile(null);
    setPhotoPreview(user.photo ? `/storage/${user.photo}` : null);
    setActiveFormTab("perfil");
    setFormOpen(true);
  };

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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      data.append(key, value);
    });
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
        .users-page input[type="number"] { text-transform: none; }
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
          <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>Gerencie os níveis de acessos, dados cadastrais e o status das chaves de segurança dos colaboradores.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div style={{ background: "white", border: "1px solid #e2e8f0", padding: 14, borderRadius: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ padding: 8, background: "#f1f5f9", borderRadius: 6, color: "#475569" }}><Users size={18} /></div>
            <div><span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Total de Operadores</span><strong style={{ fontSize: 18, color: "#0f172a" }}>{counters.total}</strong></div>
          </div>
          <div style={{ background: "white", border: "1px solid #e2e8f0", padding: 14, borderRadius: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ padding: 8, background: "#ecfdf5", borderRadius: 6, color: "#059669" }}><UserCheck size={18} /></div>
            <div><span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Status Ativos</span><strong style={{ fontSize: 18, color: "#059669" }}>{counters.ativos}</strong></div>
          </div>
          <div style={{ background: "white", border: "1px solid #e2e8f0", padding: 14, borderRadius: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ padding: 8, background: "#fbf7ff", borderRadius: 6, color: "#6b21a8" }}><ShieldCheck size={18} /></div>
            <div><span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Administradores</span><strong style={{ fontSize: 18, color: "#6b21a8" }}>{counters.admins}</strong></div>
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
            <button onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2139", color: "white", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Plus size={14} /> Novo Usuário</button>
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
                            {u.photo ? <img src={`/storage/${u.photo}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Users size={14} style={{ margin: "0 auto", color: "#94a3b8" }} />}
                          </div>
                          <div>
                            <strong style={{ color: "#0f172a", fontSize: 13, display: "block" }}>{u.name}</strong>
                            <span style={{ fontSize: 10, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}><Calendar size={10} /> Último Acesso: {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleDateString("pt-BR") : "—"}</span>
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
                          <Shield size={11} /> {u.role === "admin" ? "Diretor" : "Operador"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: u.status === "Ativo" ? "#d1fae5" : "#fee2e2", color: u.status === "Ativo" ? "#065f46" : "#991b1b" }}>{u.status ?? "Ativo"}</span>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 4 }}>
                          <button onClick={() => openEdit(u)} className="btn-icon" title="Editar Ficha"><Edit2 size={13} /></button>
                          <button onClick={() => setDeleteModalUser(u)} disabled={currentUserId === u.id} className="btn-icon text-danger" style={{ opacity: currentUserId === u.id ? 0.3 : 1 }} title="Excluir Colaborador"><Trash2 size={13} /></button>
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
                      {selectedUser ? "Editar Operador" : "Novo Operador"}
                    </span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                      {selectedUser ? `Atualizando registro #${selectedUser.id}` : "Preencha as guias abaixo para registrar a nova chave"}
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
                        <input type="text" className="sigx-input" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required />
                      </div>
                      <div>
                        <label className="sigx-label">E-MAIL INSTITUCIONAL *</label>
                        <input type="email" className="sigx-input" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} required />
                      </div>
                      <div>
                        <label className="sigx-label">
                          SENHA DE ACESSO {selectedUser && <span style={{ color: "#94a3b8", fontWeight: 500 }}>(deixe vazio para manter)</span>}
                        </label>
                        <input type="password" className="sigx-input" value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} required={!selectedUser} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <div>
                          <label className="sigx-label">NÍVEL DE PERMISSÃO</label>
                          <select className="sigx-input" value={formData.role} onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}>
                            <option value="user">Operador Padrão</option>
                            <option value="admin">Diretor Administrativo</option>
                          </select>
                        </div>
                        <div>
                          <label className="sigx-label">STATUS OPERACIONAL</label>
                          <select className="sigx-input" value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}>
                            <option value="Ativo">Chave Ativa</option>
                            <option value="Inativo">Bloqueado</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeFormTab === "pessoal" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <div>
                          <label className="sigx-label">CPF</label>
                          <input
                            type="text"
                            className="sigx-input mono"
                            placeholder="000.000.000-00"
                            value={formData.cpf}
                            onChange={e => setFormData(p => ({ ...p, cpf: maskCPF(e.target.value) }))}
                          />
                        </div>
                        <div>
                          <label className="sigx-label">IDENTIDADE (RG)</label>
                          <input
                            type="text"
                            className="sigx-input"
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
                            className="sigx-input mono"
                            placeholder="(00) 00000-0000"
                            value={formData.phone}
                            onChange={e => setFormData(p => ({ ...p, phone: maskPhone(e.target.value) }))}
                          />
                        </div>
                        <div>
                          <label className="sigx-label">DATA DE NASCIMENTO</label>
                          <input
                            type="date"
                            className="sigx-input"
                            value={formData.birthDate}
                            onChange={e => setFormData(p => ({ ...p, birthDate: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="sigx-label">GÊNERO</label>
                        <select className="sigx-input" value={formData.gender} onChange={e => setFormData(p => ({ ...p, gender: e.target.value }))}>
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

        {/* ── MODAL: EXCLUSÃO DE COLABORADOR ─────────────────────────────────── */}
        {deleteModalUser && (
          <div className="modal-overlay" style={{ display: "flex" }}>
            <div className="modal-content" style={{ maxWidth: 440 }}>
              <div className="modal-header">
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#dc2626", display: "flex", alignItems: "center", gap: 6 }}><ShieldAlert size={16} /> Revogar Credenciais</h3>
                <button onClick={() => setDeleteModalUser(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={16} /></button>
              </div>
              <div className="modal-body" style={{ fontSize: 12, color: "#475569", lineHeight: "1.5" }}>
                Tem certeza que deseja remover permanentemente o operador <strong style={{ color: "#0f172a" }}>{deleteModalUser.name}</strong>?<br />
                Esta ação revogará imediatamente todas as chaves digitais e chaves de auditoria ligadas a este perfil.
              </div>
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setDeleteModalUser(null)}>Voltar</button>
                <button className="btn-danger" onClick={handleExecuteDelete}>Confirmar Revogação</button>
              </div>
            </div>
          </div>
        )}
      </div>

    </UnyPayLayout>
  );
}