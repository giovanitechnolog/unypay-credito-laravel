import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import { api, extractFirstError } from "../../lib/api";
import type { ContractType, ContractTypeFormValues } from "../../types/contractType";

interface ContractTypeFormModalProps {
  open: boolean;
  contractType?: ContractType | null;
  onClose: () => void;
  onSaved: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

const EMPTY: ContractTypeFormValues = {
  name: "",
  slug: "",
  is_active: true,
};

export default function ContractTypeFormModal({
  open,
  contractType,
  onClose,
  onSaved,
  onSuccess,
  onError,
}: ContractTypeFormModalProps) {
  const isEdit = !!contractType;
  const activeContracts = contractType?.active_contracts_count ?? 0;
  // Só faz sentido bloquear o switch quando o tipo está ATIVO e tem
  // contratos ativos vinculados (a operação proibida é inativar — reativar
  // continua liberada).
  const blockDeactivate = isEdit && !!contractType?.is_active && activeContracts > 0;

  const [values, setValues] = useState<ContractTypeFormValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (contractType) {
        setValues({
          name: contractType.name ?? "",
          slug: contractType.slug ?? "",
          is_active: contractType.is_active,
        });
      } else {
        setValues(EMPTY);
      }
      setErrors({});
    }
  }, [open, contractType]);

  if (!open) return null;

  function setField<K extends keyof ContractTypeFormValues>(key: K, value: ContractTypeFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();

    setSubmitting(true);
    setErrors({});

    try {
      const payload = {
        name: values.name.trim(),
        slug: values.slug.trim() || null,
        is_active: values.is_active,
      };

      if (isEdit && contractType) {
        await api.put(`/api/contract-types/${contractType.id}`, payload);
        onSuccess("Tipo de contrato atualizado com sucesso.");
      } else {
        await api.post(`/api/contract-types`, payload);
        onSuccess("Tipo de contrato criado com sucesso.");
      }

      onSaved();
      onClose();
    } catch (err: any) {
      const fieldErrors = err?.response?.data?.errors as Record<string, string[]> | undefined;
      if (fieldErrors) {
        const flat: Record<string, string> = {};
        for (const k of Object.keys(fieldErrors)) flat[k] = fieldErrors[k][0];
        setErrors(flat);
      }
      onError(extractFirstError(err, "Não foi possível salvar o tipo de contrato."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Backdrop onClose={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 12,
          width: "100%",
          maxWidth: 460,
          boxShadow: "0 10px 40px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>
            {isEdit ? "Editar tipo de contrato" : "Novo tipo de contrato"}
          </h2>
          <button onClick={onClose} style={closeBtn} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={submit} style={{ padding: 20 }}>
          <Field label="Nome *" error={errors.name}>
            <input
              type="text"
              value={values.name}
              onChange={(e) => setField("name", e.target.value)}
              required
              autoFocus
              maxLength={255}
              placeholder="Ex.: Mútuo, Confissão de Dívida, Cessão de Crédito"
              style={inputStyle}
            />
          </Field>

          <Field
            label="Identificador (slug)"
            error={errors.slug}
            style={{ marginTop: 14 }}
            hint="Opcional. Deixe em branco para gerar automaticamente a partir do nome."
          >
            <input
              type="text"
              value={values.slug}
              onChange={(e) => setField("slug", e.target.value.replace(/\s+/g, "-").toLowerCase())}
              maxLength={255}
              placeholder="ex: mutuo-confissao"
              style={inputStyle}
            />
          </Field>

          <div
            style={{
              marginTop: 16,
              padding: "12px 14px",
              border: `1px solid ${errors.is_active ? "#fecaca" : "#e5e7eb"}`,
              borderRadius: 8,
              background: errors.is_active ? "#fef2f2" : "#fafafa",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Tipo ativo</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                {blockDeactivate
                  ? `Não é possível inativar: ${activeContracts} contrato(s) ativo(s) usando este tipo.`
                  : "Tipos inativos não aparecem no cadastro de novos contratos."}
              </div>
            </div>
            <Switch
              checked={values.is_active}
              disabled={blockDeactivate}
              title={
                blockDeactivate
                  ? "Há contratos ativos vinculados — reatribua-os antes de desativar."
                  : undefined
              }
              onChange={(checked) => setField("is_active", checked)}
            />
          </div>
          {errors.is_active && (
            <p style={{ marginTop: 6, fontSize: 12, color: "#b91c1c" }}>{errors.is_active}</p>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 24 }}>
            <button type="button" onClick={onClose} style={secondaryBtn}>
              Cancelar
            </button>
            <button type="submit" disabled={submitting} style={primaryBtn(submitting)}>
              {submitting ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar tipo"}
            </button>
          </div>
        </form>
      </div>
    </Backdrop>
  );
}

function Switch({
  checked,
  disabled = false,
  title,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  title?: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      title={title}
      style={{
        position: "relative",
        width: 42,
        height: 22,
        background: disabled ? "#e5e7eb" : checked ? "#10b981" : "#d1d5db",
        border: "none",
        borderRadius: 999,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.15s ease",
        padding: 0,
        flexShrink: 0,
        opacity: disabled ? 0.7 : 1,
      }}
      aria-pressed={checked}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 22 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: disabled ? "#f3f4f6" : "white",
          transition: "left 0.15s ease",
          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}

export function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 14,
  background: "white",
  outline: "none",
};

const closeBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#6b7280",
  padding: 4,
  borderRadius: 6,
  display: "flex",
};

const secondaryBtn: React.CSSProperties = {
  padding: "9px 14px",
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  color: "#374151",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};

const primaryBtn = (loading: boolean): React.CSSProperties => ({
  padding: "9px 14px",
  background: loading ? "#4b4f78" : "#1e2139",
  border: "none",
  borderRadius: 8,
  color: "white",
  fontSize: 13,
  fontWeight: 600,
  cursor: loading ? "not-allowed" : "pointer",
});

function Field({
  label,
  children,
  error,
  style,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  style?: React.CSSProperties;
  hint?: string;
}) {
  return (
    <div style={style}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <p style={{ marginTop: 4, fontSize: 11, color: "#9ca3af" }}>{hint}</p>
      )}
      {error && <p style={{ marginTop: 4, fontSize: 12, color: "#b91c1c" }}>{error}</p>}
    </div>
  );
}
