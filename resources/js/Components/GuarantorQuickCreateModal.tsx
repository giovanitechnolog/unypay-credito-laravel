import { useEffect, useState } from "react";
import { X, UserPlus, Save, Eye } from "lucide-react";
import { toast } from "sonner";
import GuarantorFormFields, {
  EMPTY_GUARANTOR_FORM,
  GuarantorFormValues,
  onlyDigits,
} from "./GuarantorFormFields";

/**
 * Sub-modal de fiador usado pelo modal de Contratos.
 *
 * Ele NÃO persiste no banco — apenas devolve os dados via onConfirm para
 * que o Contracts.tsx armazene em memória. A persistência real acontece
 * no submit do contrato, garantindo atomicidade da operação.
 *
 * Modos:
 *   - "create"   → Cadastrar novo fiador on-the-fly (form vazio, editável)
 *   - "edit-new" → Editar um fiador já adicionado mas ainda não persistido
 *   - "view"     → Visualizar (read-only) um fiador vindo do banco
 */
export type QuickCreateMode = "create" | "edit-new" | "view";

interface Props {
  open: boolean;
  mode: QuickCreateMode;
  initialValue?: Partial<GuarantorFormValues>;
  onClose: () => void;
  /** Chamado quando o usuário clica em "Adicionar ao Contrato" / "Salvar". */
  onConfirm: (values: GuarantorFormValues) => void;
}

const TITLES: Record<QuickCreateMode, string> = {
  "create": "Nova Pessoa",
  "edit-new": "Editar Pessoa",
  "view": "Detalhes da Pessoa",
};

const SUBTITLES: Record<QuickCreateMode, string> = {
  "create": "Os dados serão gravados quando você salvar o contrato",
  "edit-new": "Ajuste os dados desta pessoa ainda não persistida",
  "view": "Pessoa já cadastrada — somente leitura",
};

const CONFIRM_LABELS: Record<QuickCreateMode, string> = {
  "create": "Adicionar ao Contrato",
  "edit-new": "Atualizar",
  "view": "Fechar",
};

export default function GuarantorQuickCreateModal({
  open,
  mode,
  initialValue,
  onClose,
  onConfirm,
}: Props) {
  const [form, setForm] = useState<GuarantorFormValues>(EMPTY_GUARANTOR_FORM);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_GUARANTOR_FORM, ...initialValue });
    }
  }, [open, initialValue]);

  if (!open) return null;

  const isReadOnly = mode === "view";

  const handleConfirm = () => {
    if (isReadOnly) {
      onClose();
      return;
    }

    // ── Validação local antes de devolver ao pai ───────────────
    if (!form.name.trim()) {
      toast.error(form.personType === "PJ" ? "Informe a razão social." : "Informe o nome completo.");
      return;
    }

    if (form.personType === "PF") {
      if (onlyDigits(form.cpf).length !== 11) { toast.error("CPF inválido."); return; }
      if (!form.nationality.trim()) { toast.error("Informe a nacionalidade."); return; }
      if (!form.maritalStatus) { toast.error("Selecione o estado civil."); return; }
    } else {
      if (onlyDigits(form.cnpj).length !== 14) { toast.error("CNPJ inválido."); return; }
      if (!form.tradeName.trim()) { toast.error("Informe o nome fantasia."); return; }
      // Inscrição Estadual deixou de ser obrigatória — algumas PJs são isentas
      // ou o dado pode não estar à mão no momento da criação on-the-fly.
    }

    // 🚀 Endereço deixou de ser obrigatório — o backend aceita campos nulos.
    // Quando preenchido parcialmente, validamos só o CEP por consistência:
    // ou está vazio, ou tem 8 dígitos.
    const cepDigits = onlyDigits(form.zipCode);
    if (cepDigits.length > 0 && cepDigits.length !== 8) {
      toast.error("CEP inválido — informe 8 dígitos ou deixe em branco.");
      return;
    }

    onConfirm(form);
  };

  // 🚀 z-index acima do modal-pai de Contratos. A sigx-modal-overlay padrão
  // do projeto está em 100; usamos 200 aqui para sobrepor sem desmontar o
  // pai (estado preservado em memória).
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
          width: "min(720px, 96vw)",
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
              {isReadOnly ? <Eye size={16} /> : <UserPlus size={16} />}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>{TITLES[mode]}</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                {SUBTITLES[mode]}
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

        {/* Body */}
        <div
          style={{
            padding: 22,
            overflowY: "auto",
            maxHeight: "calc(92vh - 132px)",
            background: "white",
          }}
        >
          <GuarantorFormFields
            value={form}
            onChange={setForm}
            readOnly={isReadOnly}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 22px",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            background: "#f8fafc",
          }}
        >
          {!isReadOnly && (
            <button type="button" onClick={onClose} className="btn-secondary" style={{ padding: "7px 16px", fontSize: 12 }}>
              Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            className="btn-primary"
            style={{ padding: "7px 16px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {!isReadOnly && <Save size={12} />}
            {CONFIRM_LABELS[mode]}
          </button>
        </div>
      </div>
    </div>
  );
}
