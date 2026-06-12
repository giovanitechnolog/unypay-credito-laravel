import { useCallback, useEffect, useMemo, useState } from "react";
import { Head } from "@inertiajs/react";
import {
  Plus, Search, RefreshCw, Edit2, Trash2, X, Globe,
  CheckCircle2, XCircle, Activity, ShieldAlert, Plug,
  PlayCircle, Eye, EyeOff, AlertCircle, Loader2, KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import UnyPayLayout from "../Components/UnyPayLayout";
import ConfirmDialog from "../Components/ConfirmDialog";
import { api, extractFirstError } from "../lib/api";

interface Integration {
  id: number;
  name: string;
  type: "cpf_lookup" | "cnpj_lookup" | "other";
  environment: "producao" | "desenvolvimento";
  baseUrl: string;
  testEndpoint: string | null;
  authType: "none" | "apikey" | "bearer" | "basic";
  apiKeyMasked: string | null;
  username: string | null;
  extraHeaders: Record<string, string> | null;
  description: string | null;
  isActive: boolean;
  lastTestedAt: string | null;
  lastTestStatus: "success" | "failure" | null;
  lastTestMessage: string | null;
  lastTestHttpCode: number | null;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  total: number;
  active: number;
  production: number;
  development: number;
}

interface ListResponse {
  data: Integration[];
  stats: Stats;
}

interface PageProps {
  typeOptions: string[];
  environmentOptions: string[];
  authTypeOptions: string[];
}

const TYPE_LABELS: Record<string, string> = {
  cpf_lookup:  "Consulta de CPF (SIGx)",
  cnpj_lookup: "Consulta de CNPJ",
  other:       "Outra",
};

const ENV_LABELS: Record<string, { label: string; bg: string; color: string; border: string }> = {
  producao:        { label: "Produção",        bg: "#ecfdf5", color: "#065f46", border: "#a7f3d0" },
  desenvolvimento: { label: "Desenvolvimento", bg: "#fef3c7", color: "#92400e", border: "#fde68a" },
};

const AUTH_LABELS: Record<string, string> = {
  none:   "Nenhuma",
  apikey: "API Key (header)",
  bearer: "Bearer Token",
  basic:  "Basic Auth",
};

interface FormState {
  name: string;
  type: string;
  environment: string;
  baseUrl: string;
  testEndpoint: string;
  authType: string;
  apiKey: string;
  apiSecret: string;
  username: string;
  password: string;
  description: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  type: "cpf_lookup",
  environment: "producao",
  baseUrl: "",
  testEndpoint: "",
  authType: "apikey",
  apiKey: "",
  apiSecret: "",
  username: "",
  password: "",
  description: "",
  isActive: true,
};

export default function Integracoes({ typeOptions, environmentOptions, authTypeOptions }: PageProps) {
  const [items, setItems] = useState<Integration[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, production: 0, development: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Integration | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Integration | null>(null);

  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{
    integration: Integration;
    success: boolean;
    message: string;
    httpCode: number | null;
    url: string;
  } | null>(null);

  const fetchList = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const { data } = await api.get<ListResponse>("/api/integrations", { params: { search: q } });
      setItems(data.data);
      setStats(data.stats);
    } catch (err) {
      toast.error(extractFirstError(err, "Erro ao carregar integrações."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchList(search), 300);
    return () => clearTimeout(t);
  }, [search, fetchList]);

  const openCreate = () => {
    setSelected(null);
    setFormData(EMPTY_FORM);
    setShowSecret(false);
    setFormOpen(true);
  };

  const openEdit = (it: Integration) => {
    setSelected(it);
    setFormData({
      name: it.name,
      type: it.type,
      environment: it.environment,
      baseUrl: it.baseUrl,
      testEndpoint: it.testEndpoint ?? "",
      authType: it.authType,
      apiKey: "",
      apiSecret: "",
      username: it.username ?? "",
      password: "",
      description: it.description ?? "",
      isActive: it.isActive,
    });
    setShowSecret(false);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error("Informe o nome da integração."); return; }
    if (!formData.baseUrl.trim()) { toast.error("Informe a URL base."); return; }

    setSubmitting(true);
    try {
      const payload: any = { ...formData };
      payload.testEndpoint = formData.testEndpoint.trim() || null;
      payload.username = formData.username.trim() || null;
      payload.description = formData.description.trim() || null;

      // Em edição, só envia segredos se foram explicitamente preenchidos —
      // assim o backend mantém o valor antigo quando o operador não quis trocar.
      if (selected) {
        if (!formData.apiKey)    delete payload.apiKey;
        if (!formData.apiSecret) delete payload.apiSecret;
        if (!formData.password)  delete payload.password;
      }

      if (selected) {
        await api.put(`/api/integrations/${selected.id}`, payload);
        toast.success("Integração atualizada com sucesso!");
      } else {
        await api.post("/api/integrations", payload);
        toast.success("Integração registrada com sucesso!");
      }
      setFormOpen(false);
      fetchList(search);
    } catch (err) {
      toast.error(extractFirstError(err, "Erro ao salvar integração."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/integrations/${deleteTarget.id}`);
      toast.success("Integração removida.");
      setDeleteTarget(null);
      fetchList(search);
    } catch (err) {
      toast.error(extractFirstError(err, "Falha ao remover integração."));
    }
  };

  const handleTest = async (it: Integration) => {
    setTestingId(it.id);
    setTestResult(null);
    try {
      const { data } = await api.post(`/api/integrations/${it.id}/test`);
      // Atualiza o registro localmente com os campos de "lastTested*".
      setItems(prev => prev.map(p => (p.id === it.id ? data.data : p)));
      setTestResult({
        integration: data.data,
        success: !!data.success,
        message: data.message ?? "",
        httpCode: data.httpCode ?? null,
        url: data.url ?? "",
      });
      if (data.success) {
        toast.success("Conexão estabelecida com sucesso.");
      } else {
        toast.error("Falha ao testar integração — veja detalhes na janela.");
      }
    } catch (err) {
      toast.error(extractFirstError(err, "Falha ao testar integração."));
    } finally {
      setTestingId(null);
    }
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  };

  const cards = useMemo(() => ([
    { key: "total",       label: "Total de Integrações", value: stats.total,       icon: Plug,         color: "#475569", bg: "#f1f5f9" },
    { key: "active",      label: "Ativas",               value: stats.active,      icon: Activity,     color: "#16a34a", bg: "#ecfdf5" },
    { key: "production",  label: "Produção",             value: stats.production,  icon: ShieldAlert,  color: "#0ea5e9", bg: "#e0f2fe" },
    { key: "development", label: "Desenvolvimento",      value: stats.development, icon: Globe,        color: "#d97706", bg: "#fef3c7" },
  ]), [stats]);

  return (
    <UnyPayLayout>
      <Head title="Integrações" />

      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 4px 24px 4px" }}>

        {/* Cabeçalho */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0 }}>
              Integrações de Sistemas Externos
            </h2>
            <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>
              Gerencie URLs, credenciais e o status de cada integração consumida pelo sistema.
            </p>
          </div>
          <button
            onClick={openCreate}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "#1e2139", color: "white", border: "none",
              borderRadius: 6, padding: "8px 14px", fontSize: 12,
              fontWeight: 600, cursor: "pointer",
            }}
          >
            <Plus size={14} /> Nova Integração
          </button>
        </div>

        {/* Cards de estatísticas */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {cards.map(c => {
            const Icon = c.icon;
            return (
              <div key={c.key} style={{
                background: "white", border: "1px solid #e2e8f0",
                padding: 14, borderRadius: 8, display: "flex",
                alignItems: "center", gap: 12,
                boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
              }}>
                <div style={{ padding: 10, background: c.bg, borderRadius: 8, color: c.color, display: "flex" }}>
                  <Icon size={20} />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
                    {c.label}
                  </span>
                  <strong style={{ fontSize: 22, color: "#0f172a", lineHeight: 1.1 }}>{c.value}</strong>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabela */}
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: 12, borderBottom: "1px solid #e5e7eb", gap: 12, flexWrap: "wrap",
          }}>
            <strong style={{ fontSize: 12, color: "#0f172a", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Integrações Configuradas
            </strong>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 10px", background: "#f8fafc", minWidth: 280 }}>
                <Search size={14} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Buscar por nome, tipo, URL ou descrição..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ flex: 1, border: "none", outline: "none", fontSize: 12, background: "transparent", color: "#334155" }}
                />
              </div>
              <button
                onClick={() => fetchList(search)}
                title="Atualizar"
                style={{ background: "white", border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 8px", cursor: "pointer", color: "#64748b", display: "flex" }}
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600 }}>INTEGRAÇÃO</th>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600 }}>FINALIDADE</th>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600 }}>AMBIENTE</th>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600 }}>API KEY</th>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600 }}>STATUS</th>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600 }}>ÚLTIMO TESTE</th>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600 }}>ATUALIZADO</th>
                  <th style={{ padding: "10px 14px", color: "#475569", fontWeight: 600, textAlign: "right" }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#64748b" }}>Carregando integrações...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>Nenhuma integração cadastrada.</td></tr>
                ) : items.map(it => {
                  const envMeta = ENV_LABELS[it.environment] ?? { label: it.environment, bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" };
                  const testing = testingId === it.id;
                  return (
                    <tr key={it.id} style={{ borderBottom: "1px solid #f1f5f9" }} onMouseOver={e => e.currentTarget.style.background = "#f8fafc"} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <strong style={{ color: "#0f172a", fontSize: 13 }}>{it.name}</strong>
                          <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", marginTop: 2 }}>
                            {it.baseUrl}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#475569" }}>
                        {TYPE_LABELS[it.type] ?? it.type}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                          background: envMeta.bg, color: envMeta.color,
                          border: `1px solid ${envMeta.border}`,
                        }}>
                          {envMeta.label}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#475569", fontFamily: "monospace", fontSize: 11 }}>
                        {it.apiKeyMasked || (it.authType === "none" ? "—" : <span style={{ color: "#94a3b8" }}>(não informada)</span>)}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                          background: it.isActive ? "#ecfdf5" : "#fef2f2",
                          color: it.isActive ? "#065f46" : "#991b1b",
                          border: `1px solid ${it.isActive ? "#a7f3d0" : "#fecaca"}`,
                        }}>
                          {it.isActive ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#475569" }}>
                        {it.lastTestedAt ? (
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: it.lastTestStatus === "success" ? "#16a34a" : "#dc2626" }}>
                              {it.lastTestStatus === "success" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                              {it.lastTestStatus === "success" ? "Sucesso" : "Falha"}
                              {it.lastTestHttpCode ? ` · HTTP ${it.lastTestHttpCode}` : ""}
                            </span>
                            <span style={{ fontSize: 10, color: "#94a3b8" }}>
                              {formatDateTime(it.lastTestedAt)}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8", fontStyle: "italic", fontSize: 11 }}>Nunca testada</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px", color: "#64748b" }}>
                        {formatDateTime(it.updatedAt)}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 4 }}>
                          <button
                            onClick={() => handleTest(it)}
                            disabled={testing}
                            className="btn-icon"
                            title="Testar conexão"
                            style={{ color: "#0d9488" }}
                          >
                            {testing ? <Loader2 size={13} className="animate-spin" /> : <PlayCircle size={13} />}
                          </button>
                          <button onClick={() => openEdit(it)} className="btn-icon" title="Editar">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => setDeleteTarget(it)} className="btn-icon" title="Excluir" style={{ color: "#dc2626" }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL — formulário de cadastro/edição */}
      {formOpen && (
        <div className="sigx-modal-overlay" onMouseDown={() => setFormOpen(false)}>
          <div
            className="sigx-modal"
            style={{ width: "min(720px, 96vw)", maxWidth: "96vw", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 60px rgba(15,23,42,0.25)" }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 22px", background: "linear-gradient(135deg, #1e2139 0%, #2d3154 100%)", color: "white", borderBottom: "1px solid #2d3154" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Plug size={16} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>
                    {selected ? "Editar Integração" : "Nova Integração"}
                  </span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                    {selected ? `Atualizando registro #${selected.id}` : "Cadastre URL, ambiente e credenciais"}
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setFormOpen(false)} style={{ background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer", color: "white", width: 30, height: 30, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="sigx-modal-body" style={{ padding: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, background: "white", maxHeight: "70vh", overflowY: "auto" }}>
                <div style={{ gridColumn: "span 2" }}>
                  <label className="sigx-label">NOME *</label>
                  <input
                    className="sigx-input"
                    value={formData.name}
                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ex.: Rodopar SIGx Produção"
                    maxLength={255}
                    required
                  />
                </div>

                <div style={{ gridColumn: "span 2" }}>
                  <label className="sigx-label">FINALIDADE *</label>
                  <select
                    className="sigx-input"
                    value={formData.type}
                    onChange={e => setFormData(p => ({ ...p, type: e.target.value }))}
                  >
                    {typeOptions.map(t => (
                      <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
                    ))}
                  </select>
                  <span className="keep-case" style={{ fontSize: 10, color: "#94a3b8" }}>
                    Define em quais features do sistema esta integração será usada (ex.: o botão "Sincronizar com SIGx" só aciona integrações com finalidade "Consulta de CPF").
                  </span>
                </div>

                <div>
                  <label className="sigx-label">AMBIENTE *</label>
                  <select
                    className="sigx-input"
                    value={formData.environment}
                    onChange={e => setFormData(p => ({ ...p, environment: e.target.value }))}
                  >
                    {environmentOptions.map(env => (
                      <option key={env} value={env}>{ENV_LABELS[env]?.label ?? env}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="sigx-label">STATUS</label>
                  <select
                    className="sigx-input"
                    value={formData.isActive ? "1" : "0"}
                    onChange={e => setFormData(p => ({ ...p, isActive: e.target.value === "1" }))}
                  >
                    <option value="1">Ativo</option>
                    <option value="0">Inativo</option>
                  </select>
                </div>

                <div style={{ gridColumn: "span 2" }}>
                  <label className="sigx-label">URL BASE *</label>
                  <input
                    className="sigx-input mono"
                    value={formData.baseUrl}
                    onChange={e => setFormData(p => ({ ...p, baseUrl: e.target.value }))}
                    placeholder="https://api.exemplo.com.br/v1"
                    maxLength={500}
                    required
                  />
                </div>

                <div style={{ gridColumn: "span 2" }}>
                  <label className="sigx-label">ENDPOINT</label>
                  <input
                    className="sigx-input mono"
                    value={formData.testEndpoint}
                    onChange={e => setFormData(p => ({ ...p, testEndpoint: e.target.value }))}
                    placeholder="/health ou /ping (opcional)"
                    maxLength={500}
                  />
                  <span className="keep-case" style={{ fontSize: 10, color: "#94a3b8" }}>
                    Caminho concatenado à URL base no botão "Testar". Deixe em branco para testar a URL base diretamente.
                  </span>
                </div>

                <div style={{ gridColumn: "span 2", borderTop: "1px dashed #e2e8f0", paddingTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <KeyRound size={14} style={{ color: "#0d9488" }} />
                  <strong style={{ fontSize: 11, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Autenticação
                  </strong>
                </div>

                <div style={{ gridColumn: "span 2" }}>
                  <label className="sigx-label">TIPO DE AUTENTICAÇÃO *</label>
                  <select
                    className="sigx-input"
                    value={formData.authType}
                    onChange={e => setFormData(p => ({ ...p, authType: e.target.value }))}
                  >
                    {authTypeOptions.map(a => (
                      <option key={a} value={a}>{AUTH_LABELS[a] ?? a}</option>
                    ))}
                  </select>
                </div>

                {(formData.authType === "apikey" || formData.authType === "bearer") && (
                  <div style={{ gridColumn: "span 2" }}>
                    <label className="sigx-label">
                      {formData.authType === "bearer" ? "BEARER TOKEN" : "API KEY"}
                      {selected ? <span style={{ marginLeft: 6, color: "#94a3b8", fontWeight: 400 }}>(deixe em branco para manter a atual)</span> : " *"}
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showSecret ? "text" : "password"}
                        className="sigx-input mono"
                        value={formData.apiKey}
                        onChange={e => setFormData(p => ({ ...p, apiKey: e.target.value }))}
                        placeholder={selected ? "••••••••" : "Cole a chave fornecida pelo provedor"}
                        maxLength={5000}
                        style={{ paddingRight: 36 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(s => !s)}
                        title={showSecret ? "Ocultar" : "Mostrar"}
                        style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", padding: 4 }}
                      >
                        {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                )}

                {formData.authType === "basic" && (
                  <>
                    <div>
                      <label className="sigx-label">USUÁRIO *</label>
                      <input
                        className="sigx-input"
                        value={formData.username}
                        onChange={e => setFormData(p => ({ ...p, username: e.target.value }))}
                        maxLength={255}
                      />
                    </div>
                    <div>
                      <label className="sigx-label">
                        SENHA
                        {selected ? <span style={{ marginLeft: 6, color: "#94a3b8", fontWeight: 400 }}>(em branco mantém atual)</span> : " *"}
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          type={showSecret ? "text" : "password"}
                          className="sigx-input"
                          value={formData.password}
                          onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                          placeholder={selected ? "••••••••" : ""}
                          maxLength={1000}
                          style={{ paddingRight: 36 }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecret(s => !s)}
                          title={showSecret ? "Ocultar" : "Mostrar"}
                          style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", padding: 4 }}
                        >
                          {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <div style={{ gridColumn: "span 2" }}>
                  <label className="sigx-label">DESCRIÇÃO / NOTAS INTERNAS</label>
                  <textarea
                    className="sigx-input"
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                    placeholder="Informações para outros operadores (ex.: contato técnico, tabelas suportadas, limites de quota)..."
                    maxLength={2000}
                  />
                </div>
              </div>

              <div className="sigx-modal-footer" style={{ padding: "12px 22px", borderTop: "1px solid #e5e7eb", background: "#f8fafc", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)} disabled={submitting}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Gravando..." : (selected ? "Atualizar Integração" : "Salvar Integração")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL — resultado do teste */}
      {testResult && (
        <div className="sigx-modal-overlay" onMouseDown={() => setTestResult(null)}>
          <div
            className="sigx-modal"
            style={{ width: "min(560px, 96vw)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 60px rgba(15,23,42,0.25)" }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 22px",
              background: testResult.success
                ? "linear-gradient(135deg, #047857 0%, #16a34a 100%)"
                : "linear-gradient(135deg, #991b1b 0%, #dc2626 100%)",
              color: "white",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {testResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>
                    {testResult.success ? "Conexão estabelecida" : "Falha na integração"}
                  </span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>
                    {testResult.integration.name}
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setTestResult(null)} style={{ background: "rgba(255,255,255,0.18)", border: "none", cursor: "pointer", color: "white", width: 30, height: 30, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12, background: "white" }}>
              <div>
                <span className="sigx-label">URL TESTADA</span>
                <div style={{ fontFamily: "monospace", fontSize: 12, color: "#0f172a", background: "#f1f5f9", padding: "6px 8px", borderRadius: 4, wordBreak: "break-all" }}>
                  {testResult.url || "—"}
                </div>
              </div>
              {testResult.httpCode != null && (
                <div>
                  <span className="sigx-label">CÓDIGO HTTP</span>
                  <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: testResult.success ? "#16a34a" : "#dc2626" }}>
                    {testResult.httpCode}
                  </div>
                </div>
              )}
              <div>
                <span className="sigx-label">{testResult.success ? "RESPOSTA" : "MOTIVO DA FALHA"}</span>
                <div style={{ fontSize: 12, color: "#1e293b", background: testResult.success ? "#ecfdf5" : "#fef2f2", padding: "8px 10px", borderRadius: 6, border: `1px solid ${testResult.success ? "#a7f3d0" : "#fecaca"}`, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {testResult.message || "—"}
                </div>
              </div>
              {!testResult.success && (
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: "8px 10px", borderRadius: 6, fontSize: 11, color: "#92400e", lineHeight: 1.5 }}>
                  <strong>O que verificar?</strong>
                  <ul style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
                    <li>A URL base está correta e acessível desde o servidor.</li>
                    <li>O tipo de autenticação está alinhado com o que o provedor exige.</li>
                    <li>A API Key/Token/credenciais estão atualizados (sem expiração).</li>
                    <li>O endpoint de teste retorna 2xx (alguns provedores exigem 200 explícito).</li>
                  </ul>
                </div>
              )}
            </div>
            <div style={{ padding: "12px 22px", borderTop: "1px solid #e5e7eb", background: "#f8fafc", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn-secondary" onClick={() => setTestResult(null)}>Fechar</button>
              <button type="button" className="btn-primary" onClick={() => { const it = testResult.integration; setTestResult(null); handleTest(it); }}>
                <RefreshCw size={12} /> Testar novamente
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        tone="danger"
        icon={ShieldAlert}
        title="Remover Integração"
        description="Esta ação remove permanentemente a configuração desta integração. Funcionalidades do sistema que dependem dela deixarão de operar até que outra seja cadastrada."
        entityLabel="Integração"
        entityName={deleteTarget?.name}
        entityDetail={deleteTarget ? `${TYPE_LABELS[deleteTarget.type] ?? deleteTarget.type} · ${ENV_LABELS[deleteTarget.environment]?.label ?? deleteTarget.environment}` : undefined}
        consequences={[
          "Chamadas existentes que usam esta integração começarão a falhar imediatamente.",
          "Credenciais cadastradas (criptografadas) serão descartadas.",
        ]}
        confirmLabel="Remover"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </UnyPayLayout>
  );
}
