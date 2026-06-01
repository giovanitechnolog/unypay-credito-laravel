import { useCallback, useEffect, useState, useMemo } from "react";
import { Head, usePage } from "@inertiajs/react";
import { Plus, Search, RefreshCw, UserCheck, ShieldAlert, Users, Calendar, Mail, Phone, Shield, ShieldCheck, Edit2, Trash2, X } from "lucide-react";
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
    setActiveFormTab("perfil");
    setFormOpen(true);
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

      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 4px 24px 4px" }}>
        
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
      </div>

      {/* ── MODAL: CADASTRO E EDIÇÃO COORDENADO POR ABAS ──────────────────────── */}
      {formOpen && (
        <div className="sigx-modal-overlay" onMouseDown={() => setFormOpen(false)}>
          <div className="sigx-modal" style={{ maxWidth: 620, width: "100%" }} onMouseDown={e => e.stopPropagation()}>
            <div className="sigx-modal-header">
              <span className="sigx-modal-title">{selectedUser ? "Modificar Ficha do Operador" : "Registrar Novo Operador"}</span>
              <button onClick={() => setFormOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={18} /></button>
            </div>
            
            <div style={{ display: "flex", gap: 2, background: "#f1f5f9", padding: 4, borderBottom: "1px solid #e2e8f0" }}>
              <button type="button" onClick={() => setActiveFormTab("perfil")} style={{ flex: 1, padding: "6px", fontSize: 11, fontWeight: activeFormTab === "perfil" ? 700 : 400, background: activeFormTab === "perfil" ? "white" : "transparent", border: "none", borderRadius: 4, cursor: "pointer" }}>Dados de Acesso</button>
              <button type="button" onClick={() => setActiveFormTab("pessoal")} style={{ flex: 1, padding: "6px", fontSize: 11, fontWeight: activeFormTab === "pessoal" ? 700 : 400, background: activeFormTab === "pessoal" ? "white" : "transparent", border: "none", borderRadius: 4, cursor: "pointer" }}>Informações Pessoais</button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div style={{ padding: 20, maxHeight: "60vh", overflowY: "auto" }}>
                
                {activeFormTab === "perfil" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label className="sigx-label">NOME COMPLETO *</label>
                      <input type="text" className="sigx-input" value={formData.name} onChange={e => setFormData(p=>({...p, name: e.target.value}))} required />
                    </div>
                    <div>
                      <label className="sigx-label">E-MAIL INSTITUCIONAL *</label>
                      <input type="email" className="sigx-input" value={formData.email} onChange={e => setFormData(p=>({...p, email: e.target.value}))} required />
                    </div>
                    <div>
                      <label className="sigx-label">SENHA DE ACESSO {selectedUser && "(DEIXE VAZIO PARA MANTER)"}</label>
                      <input type="password" className="sigx-input" value={formData.password} onChange={e => setFormData(p=>({...p, password: e.target.value}))} required={!selectedUser} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label className="sigx-label">NÍVEL DE PERMISSÃO</label>
                        <select className="sigx-input" value={formData.role} onChange={e => setFormData(p=>({...p, role: e.target.value}))}>
                          <option value="user">Operador Padrão</option>
                          <option value="admin">Diretor Administrative</option>
                        </select>
                      </div>
                      <div>
                        <label className="sigx-label">STATUS OPERACIONAL</label>
                        <select className="sigx-input" value={formData.status} onChange={e => setFormData(p=>({...p, status: e.target.value}))}>
                          <option value="Ativo">Chave Ativa</option>
                          <option value="Inativo">Bloqueado</option>
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="sigx-label">FOTO DE PERFIL (AVATAR)</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 16, background: "#f8fafc", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                        
                        <div 
                          style={{ 
                            width: 52, 
                            height: 52, 
                            borderRadius: "50%", 
                            background: "#e2e8f0", 
                            overflow: "hidden", 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center",
                            border: "2px solid #cbd5e1",
                            flexShrink: 0
                          }}
                        >
                          {photoFile ? (
                            <img 
                              src={URL.createObjectURL(photoFile)} 
                              style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                              onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)}
                            />
                          ) : selectedUser && selectedUser.photo ? (
                            <img 
                              src={`/storage/${selectedUser.photo}`} 
                              style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                            />
                          ) : (
                            <Users size={20} style={{ color: "#94a3b8" }} />
                          )}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} 
                            style={{ fontSize: 12, color: "#475569", cursor: "pointer" }} 
                          />
                          <span style={{ fontSize: 10, color: "#94a3b8" }}>Formatos aceitos: JPG, PNG ou WEBP. Máx: 2MB.</span>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {activeFormTab === "pessoal" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label className="sigx-label">CPF</label>
                        <input
                          type="text"
                          className="sigx-input"
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
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label className="sigx-label">TELEFONE / WHATSAPP</label>
                        <input
                          type="text"
                          className="sigx-input"
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
              <div className="sigx-modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EXCLUSÃO DE COLABORADOR ───────────────────────────────────── */}
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

    </UnyPayLayout>
  );
}