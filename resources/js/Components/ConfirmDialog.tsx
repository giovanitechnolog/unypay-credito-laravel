import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, X, Trash2, ShieldAlert, Info, RotateCcw, Ban, type LucideIcon } from "lucide-react";

/**
 * Modal universal de confirmação para ações destrutivas / reversíveis.
 * Suporta três tons (danger / warning / info) com paleta e ícones distintos,
 * animação de entrada, blur no backdrop e estado de loading interno.
 *
 *   <ConfirmDialog
 *     open={!!toDelete}
 *     tone="danger"
 *     title="Excluir Fiador"
 *     description="Esta ação é permanente e desfaz todos os vínculos."
 *     entityLabel="Fiador"
 *     entityName={toDelete?.name}
 *     entityDetail={maskCPF(toDelete?.cpf)}
 *     onConfirm={handleDelete}
 *     onClose={() => setToDelete(null)}
 *   />
 */

export type ConfirmTone = "danger" | "warning" | "info";

export interface ConfirmDialogProps {
  open: boolean;
  tone?: ConfirmTone;
  /** Override do ícone padrão do tom */
  icon?: LucideIcon;
  title: string;
  description?: string | ReactNode;
  /** Rótulo da entidade (ex.: "Fiador", "Contrato") — exibido em pequeno acima do nome */
  entityLabel?: string;
  /** Nome principal da entidade (ex.: "João da Silva") — destacado em card */
  entityName?: string;
  /** Detalhe adicional (CPF, e-mail, código...) — exibido logo abaixo do nome */
  entityDetail?: string;
  /** Lista de consequências mostrada como bullets */
  consequences?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  /** Loading externo. Se omitido, o componente gerencia internamente. */
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

const TONES: Record<ConfirmTone, {
  iconColor: string;
  iconBg: string;
  ringColor: string;
  headerGradient: string;
  confirmBg: string;
  confirmBgHover: string;
  badge: string;
  defaultIcon: LucideIcon;
}> = {
  danger: {
    iconColor: "#ffffff",
    iconBg: "linear-gradient(135deg,#ef4444 0%,#b91c1c 100%)",
    ringColor: "rgba(239,68,68,0.18)",
    headerGradient: "linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%)",
    confirmBg: "linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)",
    confirmBgHover: "linear-gradient(135deg,#b91c1c 0%,#991b1b 100%)",
    badge: "#dc2626",
    defaultIcon: Trash2,
  },
  warning: {
    iconColor: "#ffffff",
    iconBg: "linear-gradient(135deg,#f59e0b 0%,#d97706 100%)",
    ringColor: "rgba(245,158,11,0.20)",
    headerGradient: "linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%)",
    confirmBg: "linear-gradient(135deg,#d97706 0%,#b45309 100%)",
    confirmBgHover: "linear-gradient(135deg,#b45309 0%,#92400e 100%)",
    badge: "#d97706",
    defaultIcon: AlertTriangle,
  },
  info: {
    iconColor: "#ffffff",
    iconBg: "linear-gradient(135deg,#3b82f6 0%,#2563eb 100%)",
    ringColor: "rgba(59,130,246,0.18)",
    headerGradient: "linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%)",
    confirmBg: "linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%)",
    confirmBgHover: "linear-gradient(135deg,#1d4ed8 0%,#1e40af 100%)",
    badge: "#2563eb",
    defaultIcon: Info,
  },
};

export default function ConfirmDialog({
  open,
  tone = "danger",
  icon,
  title,
  description,
  entityLabel,
  entityName,
  entityDetail,
  consequences,
  confirmLabel,
  cancelLabel = "Cancelar",
  loading: loadingExternal,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const palette = TONES[tone];
  const Icon = icon ?? palette.defaultIcon;
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = loadingExternal ?? internalLoading;

  // ESC fecha o modal
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, loading, onClose]);

  if (!open) return null;

  const handleConfirm = async () => {
    if (loading) return;
    try {
      setInternalLoading(true);
      await onConfirm();
    } finally {
      setInternalLoading(false);
    }
  };

  const finalConfirmLabel = confirmLabel ??
    (tone === "danger" ? "Confirmar Exclusão" : tone === "warning" ? "Confirmar" : "Confirmar");

  return (
    <>
      <style>{ConfirmDialog.css}</style>
      <div
        className="confirm-dialog-backdrop"
        onClick={() => { if (!loading) onClose(); }}
      >
        <div
          className="confirm-dialog-card"
          onClick={(e) => e.stopPropagation()}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          {/* ── HEADER com ícone circular ───────────────────────────── */}
          <div
            className="confirm-dialog-header"
            style={{ background: palette.headerGradient }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="confirm-dialog-close"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>

            <div
              className="confirm-dialog-icon-ring"
              style={{ boxShadow: `0 0 0 8px ${palette.ringColor}` }}
            >
              <div
                className="confirm-dialog-icon-bg"
                style={{ background: palette.iconBg }}
              >
                <Icon size={26} color={palette.iconColor} strokeWidth={2.4} />
              </div>
            </div>

            <h2 id="confirm-dialog-title" className="confirm-dialog-title">
              {title}
            </h2>
          </div>

          {/* ── BODY ────────────────────────────────────────────────── */}
          <div className="confirm-dialog-body">
            {description && (
              <p className="confirm-dialog-description">{description}</p>
            )}

            {(entityName || entityDetail) && (
              <div
                className="confirm-dialog-entity"
                style={{ borderLeftColor: palette.badge }}
              >
                {entityLabel && (
                  <span className="confirm-dialog-entity-label">{entityLabel}</span>
                )}
                {entityName && (
                  <strong className="confirm-dialog-entity-name">{entityName}</strong>
                )}
                {entityDetail && (
                  <span className="confirm-dialog-entity-detail">{entityDetail}</span>
                )}
              </div>
            )}

            {consequences && consequences.length > 0 && (
              <ul className="confirm-dialog-consequences">
                {consequences.map((c, i) => (
                  <li key={i}>
                    <ShieldAlert size={13} color={palette.badge} />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── FOOTER ──────────────────────────────────────────────── */}
          <div className="confirm-dialog-footer">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="confirm-dialog-btn confirm-dialog-btn-secondary"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="confirm-dialog-btn confirm-dialog-btn-primary"
              style={{
                background: loading ? palette.confirmBgHover : palette.confirmBg,
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? (
                <span className="confirm-dialog-spinner" aria-hidden="true" />
              ) : null}
              {loading ? "Processando..." : finalConfirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/** Atalhos auxiliares — alguns ícones úteis pra reuso direto pelas páginas */
ConfirmDialog.icons = { Trash2, AlertTriangle, ShieldAlert, RotateCcw, Ban, Info };

/** CSS injetado uma única vez. Tudo escopado em .confirm-dialog-* */
ConfirmDialog.css = `
@keyframes confirmDialogFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes confirmDialogScaleIn {
  from { opacity: 0; transform: translateY(8px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}
@keyframes confirmDialogSpin {
  to { transform: rotate(360deg); }
}

.confirm-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: confirmDialogFadeIn 0.16s ease-out;
}

.confirm-dialog-card {
  width: 100%;
  max-width: 460px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28),
              0 4px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  animation: confirmDialogScaleIn 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

.confirm-dialog-header {
  position: relative;
  padding: 28px 24px 18px;
  text-align: center;
}

.confirm-dialog-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 8px;
  color: #475569;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.confirm-dialog-close:hover:not(:disabled) {
  background: white;
  color: #0f172a;
}
.confirm-dialog-close:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.confirm-dialog-icon-ring {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}
.confirm-dialog-icon-bg {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.confirm-dialog-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.confirm-dialog-body {
  padding: 22px 24px 6px;
}

.confirm-dialog-description {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.55;
  color: #475569;
  text-align: center;
}

.confirm-dialog-entity {
  margin-top: 16px;
  padding: 12px 14px;
  background: #f8fafc;
  border-radius: 10px;
  border-left: 3px solid #94a3b8;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.confirm-dialog-entity-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
  letter-spacing: 0.05em;
}
.confirm-dialog-entity-name {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}
.confirm-dialog-entity-detail {
  font-size: 12px;
  color: #64748b;
  font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
}

.confirm-dialog-consequences {
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.confirm-dialog-consequences li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  color: #475569;
  line-height: 1.45;
}
.confirm-dialog-consequences li svg {
  flex-shrink: 0;
  margin-top: 2px;
}

.confirm-dialog-footer {
  padding: 18px 24px 22px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.confirm-dialog-btn {
  padding: 9px 18px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: transform 0.08s, box-shadow 0.15s, background 0.15s;
}
.confirm-dialog-btn:disabled {
  opacity: 0.6;
}
.confirm-dialog-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.confirm-dialog-btn-secondary {
  background: white;
  color: #334155;
  border: 1px solid #e2e8f0;
}
.confirm-dialog-btn-secondary:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.confirm-dialog-btn-primary {
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.10);
}
.confirm-dialog-btn-primary:hover:not(:disabled) {
  filter: brightness(1.05);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
}

.confirm-dialog-spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: white;
  animation: confirmDialogSpin 0.8s linear infinite;
}
`;
