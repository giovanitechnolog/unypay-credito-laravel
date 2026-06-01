import { useCallback, useEffect, useState, useMemo } from "react";
import { Head } from "@inertiajs/react";
import { Plus, Search, RefreshCw, FileText, Calendar, Edit2, Trash2, X, Layers, ShieldAlert, Key } from "lucide-react";
import { toast } from "sonner";
import UnyPayLayout from "../Components/UnyPayLayout";
import { api, extractFirstError } from "../lib/api";

interface ContractType {
  id: number;
  name: string;
  slug: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TypesResponse {
  data: ContractType[];
}

export default function ContractTypes() {
  const [types, setTypes] = useState<ContractType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ContractType | null>(null);
  const [deleteType, setDeleteType] = useState<ContractType | null>(null);

  const [formData, setFormData] = useState({ name: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchTypes = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const { data } = await api.get<TypesResponse>("/api/contract-types", {
        params: { search: q },
      });
      setTypes(data.data);
    } catch (err) {
      toast.error(extractFirstError(err, "Erro ao carregar tipos de contrato."));
    } finally {
      setLoading(false);
    }
  }, []);

  // 🚀 CORREÇÃO CRÍTICA: Unificado em um único efeito com debounce para evitar o duplo carregamento inicial
  useEffect(() => {
    const t = setTimeout(() => {
      fetchTypes(search);
    }, 350);
    return () => clearTimeout(t);
  }, [search, fetchTypes]);

  const openCreate = () => {
    setSelectedType(null);
    setFormData({ name: "" });
    setFormOpen(true);
  };

  const openEdit = (type: ContractType) => {
    setSelectedType(type);
    setFormData({ name: type.name });
    setFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error("O nome é obrigatório."); return; }
    setSubmitting(true);

    try {
      if (selectedType) {
        await api.put(`/api/contract-types/${selectedType.id}`, formData);
        toast.success("Tipo de contrato updatedAmount com sucesso!");
      } else {
        await api.post("/api/contract-types", formData);
        toast.success("Novo tipo de contrato registrado!");
      }
      setFormOpen(false);
      fetchTypes(search);
    } catch (err) {
      toast.error(extractFirstError(err, "Erro ao processar requisição."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteDelete = async () => {
    if (!deleteType) return;
    try {
      await api.delete(`/api/contract-types/${deleteType.id}`);
      toast.success("Tipo de contrato removido com sucesso.");
      setDeleteType(null);
      fetchTypes(search);
    } catch (err) {
      toast.error(extractFirstError(err, "Não foi possível remover este tipo."));
    }
  };

  return (
    <UnyPayLayout>
      <Head title="Tipos de Contrato" />

      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 4px 24px 4px" }}>
        
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0 }}>Modelos de Contratos</h2>
          <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>Configure os tipos estruturais aceitos na esteira de faturamento.</p>
        </div>

        <div style={{ maxWidth: 300 }}>
          <div style={{ background: "white", border: "1px solid #e2e8f0", padding: 14, borderRadius: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ padding: 8, background: "#f1f5f9", borderRadius: 6, color: "#475569" }}><Layers size={18} /></div>
            <div><span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Modelos Configurados</span><strong style={{ fontSize: 18, color: "#0f172a" }}>{types.length}</strong></div>
          </div>
        </div>

        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderBottom: "1px solid #e5e7eb", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 260 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 10px", flex: 1, maxWidth: 320, background: "#f8fafc" }}>
                <Search size={14} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Buscar por nome..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ flex: 1, border: "none", outline: "none", fontSize: 12, background: "transparent", color: "#334155" }}
                />
              </div>
              <button onClick={() => fetchTypes(search)} title="Atualizar Grade" style={{ background: "white", border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 8px", cursor: "pointer", color: "#64748b", display: "flex" }}><RefreshCw size={13} /></button>
            </div>
            <button onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2139", color: "white", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Plus size={14} /> Novo Tipo</button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600, width: "35%" }}>ESTRUTURA / NOME</th>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600, width: "30%" }}>SLUG DO SISTEMA</th>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600, width: "20%" }}>CRIADO EM</th>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600, textAlign: "right", width: "100px" }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} style={{ padding: 32, textAlign: "center", color: "#64748b" }}>Carregando modelos do banco...</td></tr>
                ) : types.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>Nenhum tipo de contrato cadastrado.</td></tr>
                ) : (
                  types.map(t => (
                    <tr key={t.id} style={{ borderBottom: "1px solid #f1f5f9" }} onMouseOver={e=>e.currentTarget.style.background="#f8fafc"} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <FileText size={14} style={{ color: "#64748b" }} />
                          <strong style={{ color: "#0f172a", fontSize: 13 }}>{t.name}</strong>
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {t.slug ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace", color: "#475569", fontSize: 11 }}>
                            <Key size={10} /> {t.slug}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8", fontStyle: "italic" }}>automático</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#64748b" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={11} /> {t.createdAt ? new Date(t.createdAt).toLocaleDateString("pt-BR") : "—"}</span>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 4 }}>
                          <button onClick={() => openEdit(t)} className="btn-icon" title="Editar Estrutura"><Edit2 size={13} /></button>
                          <button onClick={() => setDeleteType(t)} className="btn-icon text-danger" title="Excluir"><Trash2 size={13} /></button>
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

      {/* ── MODAL: CADASTRO / EDIÇÃO ────────────────────────────────────────── */}
      {formOpen && (
        <div className="sigx-modal-overlay" onMouseDown={() => setFormOpen(false)}>
          <div className="sigx-modal" style={{ maxWidth: 440, width: "100%" }} onMouseDown={e => e.stopPropagation()}>
            <div className="sigx-modal-header">
              <span className="sigx-modal-title">{selectedType ? "Editar Modelo de Contrato" : "Criar Novo Modelo estrutural"}</span>
              <button onClick={() => setFormOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={18} /></button>
            </div>
            <form onSubmit={handleFormSubmit}>
              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label className="sigx-label">NOME DO MODELO / TIPO *</label>
                  <input type="text" className="sigx-input" placeholder="Ex: Mútuo Financeiro, Confissão de Dívida" value={formData.name} onChange={e => setFormData({ name: e.target.value })} required maxLength={255} />
                </div>
              </div>
              <div className="sigx-modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)} disabled={submitting}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Gravando..." : "Salvar Modelo"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIRMAR EXCLUSÃO ───────────────────────────────────────── */}
      {deleteType && (
        <div className="modal-overlay" style={{ display: "flex" }}>
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#dc2626", display: "flex", alignItems: "center", gap: 6 }}><ShieldAlert size={16} /> Deletar Estrutura</h3>
              <button onClick={() => setDeleteType(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ fontSize: 12, color: "#475569", lineHeight: "1.5" }}>
              Tem certeza que deseja remover o modelo <strong style={{ color: "#0f172a" }}>{deleteType.name}</strong>?<br />
              O sistema só permitirá a remoção caso nenhum contrato esteja utilizando este tipo.
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDeleteType(null)}>Voltar</button>
              <button className="btn-danger" onClick={handleExecuteDelete}>Confirmar Exclusão</button>
            </div>
          </div>
        </div>
      )}

    </UnyPayLayout>
  );
}