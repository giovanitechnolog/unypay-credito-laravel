import { useEffect, useMemo, useRef, useState } from "react";
import { Head, router } from "@inertiajs/react";
import { Upload, FileSpreadsheet, AlertTriangle, X, Loader2, ShieldAlert, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import UnyPayLayout from "../Components/UnyPayLayout";

// O bootstrap.js do projeto já registra window.axios globalmente.
declare global { interface Window { axios: any } }
const http = () => (window as any).axios;

type ImportRecord = {
  id: number;
  originalFilename: string;
  status: "queued" | "processing" | "done" | "failed" | "cancelled";
  totalContracts: number;
  totalInstallments: number;
  processedRows: number;
  successRows: number;
  errorRows: number;
  createdAt?: string;
  finishedAt?: string | null;
};

type Summary = {
  contractsCreated?: number;
  contractsUpdated?: number;
  clientsCreated?: number;
  installmentsCreated?: number;
  paymentsCreated?: number;
  skippedRows?: number;
  errorRows?: number;
  touchedContracts?: number;
};

type ImportError = { sheet: string; row: number; message: string; severity: string };

type Phase = "idle" | "validating" | "validated" | "uploading" | "processing" | "done" | "failed";

const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

const STATUS_BADGE: Record<ImportRecord["status"], { bg: string; color: string; label: string }> = {
  queued:     { bg: "#fef3c7", color: "#92400e", label: "Na fila" },
  processing: { bg: "#dbeafe", color: "#1e40af", label: "Processando" },
  done:       { bg: "#d1fae5", color: "#065f46", label: "Concluído" },
  failed:     { bg: "#fee2e2", color: "#991b1b", label: "Falhou" },
  cancelled:  { bg: "#e5e7eb", color: "#374151", label: "Cancelado" },
};

export default function ContractImporter({ recent }: { recent: ImportRecord[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [errorsOpen, setErrorsOpen] = useState(false);
  const [activeImportId, setActiveImportId] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ processed: number; success: number; errorRows: number }>({ processed: 0, success: 0, errorRows: 0 });

  // Polling do status quando há um import em processamento
  useEffect(() => {
    if (activeImportId === null) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const { data } = await http().get(`/sys/importar/contratos/status/${activeImportId}`);
        if (cancelled) return;
        setProgress({ processed: data.processedRows, success: data.successRows, errorRows: data.errorRows });
        setSummary(data.summary || null);
        if (Array.isArray(data.errors)) setErrors(data.errors);

        if (data.finished) {
          if (data.status === "done") {
            setPhase("done");
            toast.success("Importação concluída com sucesso!");
          } else {
            setPhase("failed");
            // Procura o erro fatal (mensagem amigável vinda do job) para
            // exibir no toast em vez da mensagem genérica.
            const fatal = Array.isArray(data.errors)
              ? data.errors.find((er: ImportError) => er.severity === "fatal")
              : null;
            toast.error(fatal?.message || "A importação terminou com falha.");
          }
          // Libera o arquivo selecionado automaticamente: o usuário não
          // precisa clicar em "Nova importação" só para subir outro arquivo.
          // O resumo e os erros continuam visíveis até o próximo upload.
          setFile(null);
          if (inputRef.current) inputRef.current.value = "";
          // Recarrega só a prop `recent` (Inertia partial reload) para o
          // novo registro aparecer na tabela sem reload completo da página.
          router.reload({ only: ["recent"] });
          return; // para o polling
        }
        setTimeout(tick, 2000);
      } catch (e) {
        if (!cancelled) setTimeout(tick, 4000); // backoff em falha de rede
      }
    };
    tick();

    return () => { cancelled = true; };
  }, [activeImportId]);

  const reset = () => {
    setFile(null);
    setPhase("idle");
    setSummary(null);
    setErrors([]);
    setErrorsOpen(false);
    setActiveImportId(null);
    setProgress({ processed: 0, success: 0, errorRows: 0 });
    if (inputRef.current) inputRef.current.value = "";
  };

  const pickFile = (f: File | null) => {
    if (!f) return;
    const ok = /\.(xlsx|xls|csv)$/i.test(f.name);
    if (!ok) { toast.error("Formato inválido. Use .xlsx, .xls ou .csv"); return; }
    setFile(f);
    setPhase("idle");
    setSummary(null);
    setErrors([]);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragOver(false);
    pickFile(e.dataTransfer.files?.[0] ?? null);
  };

  const buildFormData = (): FormData => {
    const fd = new FormData();
    fd.append("file", file as Blob);
    return fd;
  };

  const onValidate = async () => {
    if (!file) { toast.error("Selecione um arquivo primeiro."); return; }
    setPhase("validating");
    setSummary(null);
    setErrors([]);
    try {
      const { data } = await http().post("/sys/importar/contratos/validar", buildFormData(), {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSummary(data.summary || null);
      setErrors(Array.isArray(data.errors) ? data.errors : []);
      setPhase("validated");
      toast.success("Validação concluída — nada foi gravado.");
    } catch (e: any) {
      const data = e?.response?.data;
      setSummary(data?.summary || null);
      setErrors(Array.isArray(data?.errors) ? data.errors : []);
      setErrorsOpen(true);
      setPhase("validated");
      toast.error(data?.message || "Falha na validação.");
    }
  };

  const onImport = async () => {
    if (!file) { toast.error("Selecione um arquivo primeiro."); return; }
    setPhase("uploading");
    setSummary(null);
    setErrors([]);
    setProgress({ processed: 0, success: 0, errorRows: 0 });
    try {
      const { data } = await http().post("/sys/importar/contratos", buildFormData(), {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.info("Importação enfileirada — acompanhando progresso…");
      setActiveImportId(data.importId);
      setPhase("processing");
    } catch (e: any) {
      setPhase("failed");
      toast.error(e?.response?.data?.message || "Erro ao enviar a planilha.");
    }
  };

  const busy = phase === "validating" || phase === "uploading" || phase === "processing";

  return (
    <UnyPayLayout>
      <Head title="Importador de Planilha" />
      <div style={{ padding: "0 24px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <Banner />

        <Card>
          <CardHeader title="1. Selecione a planilha do cliente" subtitle="Formatos aceitos: .xlsx, .xls, .csv (até 50 MB)" />
          <DropZone
            dragOver={dragOver}
            file={file}
            onPick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClear={reset}
            disabled={busy}
          />
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv"
                 style={{ display: "none" }}
                 onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
        </Card>

        <Card>
          <CardHeader title="2. Validar ou Importar" subtitle="Recomendamos validar primeiro (dry-run) — nenhum dado é gravado no banco nessa etapa." />
          <div style={{ display: "flex", gap: 10, padding: "0 20px 18px" }}>
            <button onClick={onValidate} disabled={!file || busy}
              style={{ ...btnStyle("outline"), opacity: (!file || busy) ? 0.5 : 1 }}>
              {phase === "validating" ? <Loader2 size={14} className="spin"/> : <ShieldAlert size={14}/>}
              Validar antes de importar
            </button>
            <button onClick={onImport} disabled={!file || busy}
              style={{ ...btnStyle("primary"), opacity: (!file || busy) ? 0.5 : 1 }}>
              {phase === "uploading" || phase === "processing"
                ? <Loader2 size={14} className="spin"/>
                : <Upload size={14}/>}
              Importar agora
            </button>
          </div>
        </Card>

        {(phase === "processing" || phase === "uploading") && (
          <Card>
            <CardHeader title="Processando em background" subtitle="A página pode ser fechada — o job continuará rodando na fila." />
            <div style={{ padding: "0 20px 20px" }}>
              <ProgressBar processed={progress.processed} errors={progress.errorRows}/>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 14 }}>
                <Metric label="Linhas processadas" value={progress.processed}/>
                <Metric label="Sucessos" value={progress.success} tone="ok"/>
                <Metric label="Erros / ignoradas" value={progress.errorRows} tone={progress.errorRows ? "warn" : undefined}/>
              </div>
            </div>
          </Card>
        )}

        {summary && (phase === "validated" || phase === "done" || phase === "failed") && (
          <Card>
            <CardHeader title={phase === "validated" ? "Resultado da validação (nada foi gravado)" : "Resultado da importação"}
                        subtitle="Resumo dos registros que foram (ou seriam) criados." />
            <div style={{ padding: "0 20px 16px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              <Metric label="Contratos criados"   value={summary.contractsCreated ?? 0} tone="ok"/>
              <Metric label="Contratos atualizados" value={summary.contractsUpdated ?? 0}/>
              <Metric label="Clientes criados"    value={summary.clientsCreated ?? 0}/>
              <Metric label="Parcelas inseridas"  value={summary.installmentsCreated ?? 0}/>
              <Metric label="Pagamentos criados"  value={summary.paymentsCreated ?? 0}/>
              <Metric label="Linhas ignoradas"    value={summary.skippedRows ?? 0} tone={summary.skippedRows ? "warn" : undefined}/>
              <Metric label="Erros"               value={summary.errorRows ?? 0} tone={summary.errorRows ? "warn" : undefined}/>
              <Metric label="Contratos tocados"   value={summary.touchedContracts ?? 0}/>
            </div>
          </Card>
        )}

        {errors.length > 0 && (
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#991b1b" }}>
                  {errors.length} {errors.length === 1 ? "ocorrência" : "ocorrências"} no log
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                  Erros e linhas ignoradas durante o processamento.
                </div>
              </div>
              <button onClick={() => setErrorsOpen(o => !o)} style={btnStyle("ghost")}>
                {errorsOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                {errorsOpen ? "Recolher" : "Ver todas"}
              </button>
            </div>
            {errorsOpen && (
              <div style={{ maxHeight: 320, overflow: "auto", borderTop: "1px solid #e5e7eb" }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                      <th style={{ padding: "6px 10px", fontWeight: 600, color: "#374151" }}>Aba</th>
                      <th style={{ padding: "6px 10px", fontWeight: 600, color: "#374151" }}>Linha</th>
                      <th style={{ padding: "6px 10px", fontWeight: 600, color: "#374151" }}>Tipo</th>
                      <th style={{ padding: "6px 10px", fontWeight: 600, color: "#374151" }}>Mensagem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errors.map((er, i) => (
                      <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "6px 10px", fontFamily: "'IBM Plex Mono',monospace" }}>{er.sheet}</td>
                        <td style={{ padding: "6px 10px", fontFamily: "'IBM Plex Mono',monospace" }}>{er.row}</td>
                        <td style={{ padding: "6px 10px", color: er.severity === "error" ? "#991b1b" : "#92400e" }}>
                          {er.severity === "error" ? "erro" : er.severity === "skipped" ? "ignorada" : er.severity}
                        </td>
                        <td style={{ padding: "6px 10px" }}>{er.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        <Card>
          <CardHeader title="Importações recentes" subtitle="Histórico das últimas 10 execuções."/>
          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#1a2035", color: "rgba(255,255,255,0.85)", textAlign: "left" }}>
                  <th style={{ padding: "8px 10px", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>#</th>
                  <th style={{ padding: "8px 10px", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Arquivo</th>
                  <th style={{ padding: "8px 10px", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Status</th>
                  <th style={{ padding: "8px 10px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "right" }}>Linhas</th>
                  <th style={{ padding: "8px 10px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "right" }}>Sucessos</th>
                  <th style={{ padding: "8px 10px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "right" }}>Erros</th>
                  <th style={{ padding: "8px 10px", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Iniciado</th>
                  <th style={{ padding: "8px 10px", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Finalizado</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>Nenhuma importação registrada ainda.</td></tr>
                ) : recent.map((r, i) => {
                  const sc = STATUS_BADGE[r.status];
                  return (
                    <tr key={r.id} style={{ background: i % 2 ? "#f9fafb" : "white", borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "8px 10px", fontFamily: "'IBM Plex Mono',monospace", color: "#6b7280" }}>{r.id}</td>
                      <td style={{ padding: "8px 10px" }}>{r.originalFilename}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>{sc.label}</span>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace" }}>{r.processedRows}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", color: "#065f46" }}>{r.successRows}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "'IBM Plex Mono',monospace", color: r.errorRows ? "#991b1b" : "#6b7280" }}>{r.errorRows}</td>
                      <td style={{ padding: "8px 10px", fontSize: 11, color: "#6b7280" }}>{fmtDate(r.createdAt)}</td>
                      <td style={{ padding: "8px 10px", fontSize: 11, color: "#6b7280" }}>{fmtDate(r.finishedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg) } }
          .spin { animation: spin 1s linear infinite; }
        `}</style>
      </div>
    </UnyPayLayout>
  );
}

// ── Building blocks visuais (locais ao arquivo p/ não poluir Components/) ──────────────

function Banner() {
  return (
    <div style={{
      background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
      border: "1px solid #f59e0b",
      borderRadius: 8,
      padding: "12px 16px",
      margin: "16px 0",
      display: "flex",
      gap: 12,
      alignItems: "flex-start",
    }}>
      <AlertTriangle size={20} color="#92400e" style={{ flexShrink: 0, marginTop: 2 }}/>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>
          Ferramenta interna — área restrita
        </div>
        <div style={{ fontSize: 12, color: "#78350f", marginTop: 2, lineHeight: 1.5 }}>
          Esta página executa um import em massa que pode criar/atualizar clientes, contratos, parcelas e pagamentos em lote.
          A planilha precisa ter as abas <b>Regras_Contratuais</b> e <b>Base_Parcelas</b> no formato esperado.
          Demais abas são automaticamente ignoradas. Sempre <b>valide antes de importar</b>.
        </div>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 16, overflow: "hidden" }}>{children}</div>;
}

function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid #f1f5f9" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 3 }}>{subtitle}</div>}
    </div>
  );
}

function DropZone({ dragOver, file, onPick, onDragOver, onDragLeave, onDrop, onClear, disabled }: {
  dragOver: boolean; file: File | null; onPick: () => void; onDragOver: (e: any) => void;
  onDragLeave: () => void; onDrop: (e: any) => void; onClear: () => void; disabled?: boolean;
}) {
  if (file) {
    return (
      <div style={{ padding: 20, display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid #f1f5f9" }}>
        <div style={{
          width: 48, height: 48, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
          background: "#dbeafe", color: "#1e40af"
        }}>
          <FileSpreadsheet size={24}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{(file.size / 1024).toFixed(1)} KB</div>
        </div>
        <button onClick={onClear} disabled={disabled}
          style={{ background: "transparent", border: "1px solid #e5e7eb", padding: "5px 10px", borderRadius: 6, fontSize: 11, color: "#374151", cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          <X size={12}/> Remover
        </button>
      </div>
    );
  }
  return (
    <div
      onClick={onPick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        margin: 20,
        border: `2px dashed ${dragOver ? "#1a2035" : "#cbd5e1"}`,
        borderRadius: 10,
        background: dragOver ? "#f1f5f9" : "#fafbfc",
        padding: "32px 20px",
        textAlign: "center",
        cursor: "pointer",
        transition: "all .15s",
      }}>
      <Upload size={28} color={dragOver ? "#1a2035" : "#94a3b8"} style={{ margin: "0 auto 8px" }}/>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
        Arraste a planilha aqui ou clique para escolher
      </div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
        .xlsx, .xls ou .csv — até 50 MB
      </div>
    </div>
  );
}

function ProgressBar({ processed, errors }: { processed: number; errors: number }) {
  // Como não temos total exato, usamos uma barra "indeterminada visual" + contagem
  const pct = useMemo(() => Math.min(95, 10 + (processed * 0.3) % 90), [processed]);
  return (
    <div>
      <div style={{ height: 8, background: "#f1f5f9", borderRadius: 999, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%", borderRadius: 999,
          background: errors ? "linear-gradient(90deg, #f59e0b, #d97706)" : "linear-gradient(90deg, #3b82f6, #1d4ed8)",
          transition: "width .4s ease",
        }}/>
      </div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
        {processed} {processed === 1 ? "linha processada" : "linhas processadas"}…
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  const color = tone === "ok" ? "#065f46" : tone === "warn" ? "#991b1b" : "#111827";
  const bg    = tone === "ok" ? "#d1fae5" : tone === "warn" ? "#fee2e2" : "#f8fafc";
  return (
    <div style={{ background: bg, border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "'IBM Plex Mono',monospace", marginTop: 4 }}>{value.toLocaleString("pt-BR")}</div>
    </div>
  );
}

function btnStyle(variant: "primary" | "outline" | "ghost"): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
    border: "1px solid transparent",
  };
  if (variant === "primary") return { ...base, background: "#1a2035", color: "white" };
  if (variant === "outline") return { ...base, background: "white", color: "#1a2035", borderColor: "#1a2035" };
  return { ...base, background: "transparent", color: "#374151", borderColor: "#e5e7eb" };
}
