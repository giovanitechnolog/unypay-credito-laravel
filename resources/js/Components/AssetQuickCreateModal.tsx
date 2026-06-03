import { useEffect, useState } from "react";
import { X, Plus, Save, Eye, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import AssetFormFields, {
  EMPTY_ASSET_FORM,
  AssetFormValues,
} from "./AssetFormFields";

/**
 * Sub-modal de Bem em Garantia usado pelo modal de Contratos.
 *
 * Espelha o padrão do `GuarantorQuickCreateModal`:
 *   - NÃO persiste no banco — apenas devolve os dados via `onConfirm` para
 *     que o `Contracts.tsx` armazene em memória.
 *   - A persistência real acontece no submit do contrato, dentro de uma
 *     única transação no backend (atende o requisito do briefing).
 *
 * Modos:
 *   - "create" → Cadastrar novo bem (form vazio com tipo Veículo por padrão)
 *   - "edit"   → Editar um bem já adicionado (tipo travado para evitar perder dados)
 *   - "view"   → Visualizar (read-only) — útil para conferência
 */
export type AssetModalMode = "create" | "edit" | "view";

interface Props {
  open: boolean;
  mode: AssetModalMode;
  initialValue?: Partial<AssetFormValues>;
  onClose: () => void;
  onConfirm: (values: AssetFormValues) => void;
}

const TITLES: Record<AssetModalMode, string> = {
  "create": "Nova Garantia",
  "edit":   "Editar Garantia",
  "view":   "Detalhes da Garantia",
};

const SUBTITLES: Record<AssetModalMode, string> = {
  "create": "Os dados serão gravados quando você salvar o contrato",
  "edit":   "Ajuste os dados desta garantia",
  "view":   "Garantia registrada — somente leitura",
};

const CONFIRM_LABELS: Record<AssetModalMode, string> = {
  "create": "Adicionar ao Contrato",
  "edit":   "Atualizar",
  "view":   "Fechar",
};

export default function AssetQuickCreateModal({
  open,
  mode,
  initialValue,
  onClose,
  onConfirm,
}: Props) {
  const [form, setForm] = useState<AssetFormValues>(EMPTY_ASSET_FORM);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_ASSET_FORM, ...initialValue });
    }
  }, [open, initialValue]);

  if (!open) return null;

  const isReadOnly = mode === "view";
  const lockTypeSwitch = mode === "edit"; // não permite trocar Veículo↔Imóvel em edição

  const handleConfirm = () => {
    if (isReadOnly) {
      onClose();
      return;
    }

    // ── Validação local (espelha as regras Rule::requiredIf do backend) ──
    if (form.assetType === "vehicle") {
      if (!form.brand.trim())   { toast.error("Informe a marca do veículo."); return; }
      if (!form.model.trim())   { toast.error("Informe o modelo do veículo."); return; }
      if (!form.plate.trim())   { toast.error("Informe a placa do veículo."); return; }
      if (form.chassis.length !== 17) {
        toast.error("O chassi (VIN) deve conter exatamente 17 caracteres.");
        return;
      }
    } else {
      if (!form.location.trim())       { toast.error("Informe a localização do imóvel."); return; }
      if (!form.registryNumber.trim()) { toast.error("Informe o número da matrícula."); return; }
      if (!form.totalArea.trim())      { toast.error("Informe a área total do imóvel."); return; }

      // Verifica se a área é numérica válida (aceita formato BR "1.000.000,00")
      const numeric = Number(
        form.totalArea.replace(/\./g, "").replace(",", ".")
      );
      if (!isFinite(numeric) || numeric <= 0) {
        toast.error("Área total inválida — informe um número maior que zero.");
        return;
      }
    }

    onConfirm(form);
  };

  // 🚀 z-index acima do modal-pai de Contratos. Mesmo padrão usado no
  // GuarantorQuickCreateModal — sigx-modal-overlay padrão é 100, aqui usamos
  // 200 para sobrepor sem desmontar o pai (estado preservado em memória).
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
              {isReadOnly ? <Eye size={16} /> : mode === "edit" ? <ShieldCheck size={16} /> : <Plus size={16} />}
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

        {/* Body — altura FIXA para manter o modal exatamente do mesmo tamanho ao
            alternar Veículo↔Imóvel. O conteúdo extra do imóvel (descrição,
            confrontações) entra em scroll interno sem fazer o modal "saltar".
            Em viewports pequenas, recua para o limite da viewport. */}
        <div
          style={{
            padding: 22,
            overflowY: "auto",
            height: "min(540px, calc(92vh - 132px))",
            background: "white",
          }}
        >
          <AssetFormFields
            value={form}
            onChange={setForm}
            readOnly={isReadOnly}
            lockTypeSwitch={lockTypeSwitch}
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
