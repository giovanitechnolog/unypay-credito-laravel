import { useEffect, useMemo, useState } from "react";
import { X, Search, ShieldCheck, CheckCircle2, Building2, User } from "lucide-react";
import { toast } from "sonner";
import { api, extractFirstError } from "../lib/api";

/**
 * Representação compacta de um fiador no modal de busca.
 * O backend (/api/guarantors/search) já retorna nesse shape.
 */
export interface GuarantorLite {
  id: number;
  name: string;
  personType: "PF" | "PJ";
  document: string | null; // CPF (PF) ou CNPJ (PJ), só dígitos
}

interface Props {
  open: boolean;
  /** IDs já adicionados ao contrato (não aparecem na busca). */
  excludeIds: number[];
  onClose: () => void;
  /** Chamado com a lista escolhida. Pode ser 1 ou N. */
  onPick: (selected: GuarantorLite[]) => void;
}

const formatDoc = (g: GuarantorLite): string => {
  const d = g.document ?? "";
  if (!d) return "—";
  if (g.personType === "PJ" && d.length === 14) {
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (g.personType === "PF" && d.length === 11) {
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return d;
};

export default function GuarantorSearchModal({
  open,
  excludeIds,
  onClose,
  onPick,
}: Props) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<GuarantorLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 🔄 Reseta o estado a cada abertura do modal (evita "lixo" de uma busca anterior)
  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedIds(new Set());
    }
  }, [open]);

  // 🔍 Busca debounced — dispara 300ms após a última tecla
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get<GuarantorLite[]>("/api/guarantors/search", {
          params: { q: search, excludeIds },
        });
        setResults(data);
      } catch (err) {
        toast.error(extractFirstError(err, "Falha ao buscar fiadores."));
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [open, search, excludeIds]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedCount = selectedIds.size;

  const confirmSelection = () => {
    if (selectedCount === 0) {
      toast.info("Selecione ao menos um fiador para adicionar ao contrato.");
      return;
    }
    const picked = results.filter((g) => selectedIds.has(g.id));
    onPick(picked);
  };

  const headerStats = useMemo(() => {
    if (loading) return "Carregando…";
    if (results.length === 0) return search ? "Nenhum fiador encontrado para o filtro" : "Nenhum fiador disponível";
    return `${results.length} resultado(s) — ${selectedCount} selecionado(s)`;
  }, [loading, results, search, selectedCount]);

  if (!open) return null;

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(15, 23, 42, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(820px, 96vw)",
          maxHeight: "92vh",
          background: "white",
          borderRadius: 10,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.35)",
        }}
      >
        {/* Header */}
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
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "rgba(255,255,255,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldCheck size={16} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>Buscar Fiadores Cadastrados</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                Selecione um ou mais fiadores do banco para vincular ao contrato
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              cursor: "pointer",
              color: "white",
              width: 30,
              height: 30,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Search bar */}
        <div
          style={{
            padding: "12px 22px",
            borderBottom: "1px solid #e5e7eb",
            background: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              padding: "6px 10px",
              background: "white",
            }}
          >
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              autoFocus
              placeholder="Buscar por nome, razão social, CPF ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: 12,
                background: "transparent",
                color: "#334155",
              }}
            />
          </div>
          <span style={{ fontSize: 10.5, color: "#64748b", fontWeight: 500 }}>
            {headerStats}
          </span>
        </div>

        {/* Results table */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            background: "white",
          }}
        >
          {loading ? (
            <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "#94a3b8" }}>
              Buscando fiadores…
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>
              <ShieldCheck size={28} style={{ opacity: 0.3, margin: "0 auto 6px", display: "block" }} />
              <span style={{ fontSize: 12 }}>
                {search ? "Nenhum fiador localizado para este filtro." : "Digite acima para localizar um fiador, ou cadastre um novo."}
              </span>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 11 }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  <th style={{ padding: "6px 10px", textAlign: "left", width: 36 }}></th>
                  <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Tipo</th>
                  <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Nome / Razão Social</th>
                  <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>Documento</th>
                </tr>
              </thead>
              <tbody>
                {results.map((g, idx) => {
                  const checked = selectedIds.has(g.id);
                  const isPJ = g.personType === "PJ";
                  return (
                    <tr
                      key={g.id}
                      onClick={() => toggleSelect(g.id)}
                      style={{
                        cursor: "pointer",
                        background: checked ? "#eff6ff" : idx % 2 === 1 ? "#fafafa" : "white",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                      onMouseOver={(e) => {
                        if (!checked) (e.currentTarget as HTMLTableRowElement).style.background = "#f8fafc";
                      }}
                      onMouseOut={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = checked
                          ? "#eff6ff"
                          : idx % 2 === 1
                            ? "#fafafa"
                            : "white";
                      }}
                    >
                      <td style={{ padding: "8px 10px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(g.id)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ accentColor: "#2563eb", width: 14, height: 14 }}
                        />
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 9,
                            fontWeight: 700,
                            background: isPJ ? "#eff6ff" : "#ecfdf5",
                            color: isPJ ? "#1e40af" : "#065f46",
                          }}
                        >
                          {isPJ ? <Building2 size={10} /> : <User size={10} />}
                          {g.personType}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0f172a" }}>{g.name}</td>
                      <td style={{ padding: "8px 10px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: "#475569" }}>
                        {formatDoc(g)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 22px",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#f8fafc",
          }}
        >
          <span style={{ fontSize: 11, color: "#475569", display: "inline-flex", alignItems: "center", gap: 6 }}>
            {selectedCount > 0 ? (
              <>
                <CheckCircle2 size={12} color="#059669" />
                <strong>{selectedCount}</strong> fiador(es) selecionado(s)
              </>
            ) : (
              "Clique nas linhas para selecionar"
            )}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onClose} className="btn-secondary" style={{ padding: "7px 16px", fontSize: 12 }}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmSelection}
              disabled={selectedCount === 0}
              className="btn-primary"
              style={{ padding: "7px 16px", fontSize: 12, opacity: selectedCount === 0 ? 0.6 : 1 }}
            >
              Adicionar {selectedCount > 0 ? `(${selectedCount})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
