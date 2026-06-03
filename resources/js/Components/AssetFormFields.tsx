import { useState } from "react";
import { Car, Home, CheckCircle2 } from "lucide-react";

/**
 * Tipo do bem em garantia.
 * Mapeia 1:1 com o enum 'assetType' da migration `contract_assets`.
 */
export type AssetType = "vehicle" | "real_estate";

/**
 * Estado do formulário de UM bem em garantia.
 *
 * Os campos numéricos (manufactureYear, modelYear, totalArea) ficam aqui
 * como STRING para conviver com o input do React sem warnings — a conversão
 * para número/decimal acontece no momento do submit do contrato.
 *
 * As máscaras (placa uppercase, chassi sem espaços, área com vírgula) são
 * aplicadas no próprio componente, na entrada — exatamente o mesmo padrão
 * adotado em `GuarantorFormFields`.
 */
export interface AssetFormValues {
  assetType: AssetType;

  // ── Veículos ──────────────────────────────────────────────
  brand: string;
  model: string;
  manufactureYear: string;
  modelYear: string;
  plate: string;
  renavam: string;
  chassis: string;

  // ── Imóveis ──────────────────────────────────────────────
  description: string;
  location: string;
  registryNumber: string;
  totalArea: string;
  boundaries: string;
}

export const EMPTY_ASSET_FORM: AssetFormValues = {
  assetType: "vehicle",
  brand: "",
  model: "",
  manufactureYear: "",
  modelYear: "",
  plate: "",
  renavam: "",
  chassis: "",
  description: "",
  location: "",
  registryNumber: "",
  totalArea: "",
  boundaries: "",
};

// ── Helpers de máscara ──────────────────────────────────────────────
/**
 * Máscara de placa (suporta formato Mercosul AAA0A00 e antigo AAA0000).
 * Resultado visual: "ABC-1D23" (sempre com hífen após 3 letras).
 */
export const maskPlate = (v: string) => {
  const clean = v.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 7);
  if (clean.length <= 3) return clean;
  return `${clean.slice(0, 3)}-${clean.slice(3)}`;
};

export const maskRenavam = (v: string) =>
  v.replace(/\D/g, "").slice(0, 11);

/** Chassi VIN: 17 caracteres alfanuméricos uppercase (excluímos espaços/símbolos). */
export const maskChassis = (v: string) =>
  v.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 17);

export const maskYear = (v: string) =>
  v.replace(/\D/g, "").slice(0, 4);

/**
 * Máscara monetária estilo BR — formato 1.000.000,00.
 *
 * Funciona em "currency-style": qualquer caractere não-dígito é descartado,
 * os 2 últimos dígitos viram a parte decimal e o restante recebe ponto
 * a cada 3 dígitos (separador de milhar). Idempotente: aplicar no valor
 * já formatado retorna o mesmo valor.
 *
 * Exemplos:
 *   "5"           → "0,05"
 *   "521"         → "5,21"
 *   "52181"       → "521,81"
 *   "123456"      → "1.234,56"
 *   "100000000"   → "1.000.000,00"
 */
export const maskArea = (v: string) => {
  const digits = v.replace(/\D/g, "").slice(0, 14); // até 999.999.999.999,99
  if (!digits) return "";
  const padded  = digits.padStart(3, "0");
  const intPart = padded.slice(0, padded.length - 2).replace(/^0+/, "") || "0";
  const decPart = padded.slice(-2);
  const intWithThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${intWithThousands},${decPart}`;
};

/** Máscara de CEP brasileiro: 00000-000. */
export const maskCEP = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

interface Props {
  value: AssetFormValues;
  onChange: (next: AssetFormValues) => void;
  /** Em modo "view" o formulário fica todo somente-leitura. */
  readOnly?: boolean;
  /**
   * Em modo "edit" travamos a troca de tipo (Veículo ↔ Imóvel) porque
   * mudar o tipo invalidaria todos os campos já preenchidos.
   */
  lockTypeSwitch?: boolean;
}

/**
 * Renderiza os campos de UM bem em garantia, com toggle Veículo/Imóvel.
 * Não inclui modal/header/botões — quem usa monta a moldura ao redor.
 *
 * @example
 *   const [asset, setAsset] = useState(EMPTY_ASSET_FORM);
 *   <AssetFormFields value={asset} onChange={setAsset} />
 */
export default function AssetFormFields({ value, onChange, readOnly = false, lockTypeSwitch = false }: Props) {
  const set = <K extends keyof AssetFormValues>(key: K, v: AssetFormValues[K]) => {
    onChange({ ...value, [key]: v });
  };

  // 🚀 CEP é apenas auxiliar de UX (não persiste em contract_assets) —
  // mantemos em estado local. O resultado do ViaCEP popula o campo
  // `location` (que é o que de fato vai pro banco).
  const [zipCode, setZipCode] = useState<string>("");
  const [cepFeedback, setCepFeedback] = useState<string>("");

  const handleCepLookup = async (raw: string) => {
    const masked = maskCEP(raw);
    setZipCode(masked);

    const digits = masked.replace(/\D/g, "");
    if (digits.length !== 8) {
      setCepFeedback("");
      return;
    }

    setCepFeedback("Buscando...");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await response.json();
      if (data.erro) {
        setCepFeedback("CEP não encontrado.");
        return;
      }
      const fullLocation = `${data.logradouro || ""}, ${data.bairro || ""} — ${data.localidade || ""}/${data.uf || ""}`
        .replace(/^,\s*/, "")    // remove vírgula sobrando se logradouro vazio
        .replace(/—\s*$/, "")    // remove travessão sobrando se cidade/UF vazios
        .trim();
      onChange({ ...value, location: fullLocation });
      setCepFeedback(`${data.localidade || ""}/${data.uf || ""}`);
    } catch {
      setCepFeedback("Falha ao consultar o CEP.");
    }
  };

  /**
   * Alterna o tipo do bem limpando os campos exclusivos do tipo anterior.
   * Igualzinho ao switchPersonType de GuarantorFormFields.
   */
  const switchAssetType = (next: AssetType) => {
    if (value.assetType === next) return;
    if (next === "vehicle") {
      onChange({
        ...value,
        assetType: "vehicle",
        // Zera campos de imóvel
        description: "",
        location: "",
        registryNumber: "",
        totalArea: "",
        boundaries: "",
      });
    } else {
      onChange({
        ...value,
        assetType: "real_estate",
        // Zera campos de veículo
        brand: "",
        model: "",
        manufactureYear: "",
        modelYear: "",
        plate: "",
        renavam: "",
        chassis: "",
      });
    }
  };

  const typeDisabled = readOnly || lockTypeSwitch;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ── Toggle Veículo / Imóvel ──────────────────────────── */}
      <div>
        <label className="sigx-label">TIPO DA GARANTIA *</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { key: "vehicle"     as const, label: "Veículo", icon: Car,  color: "#059669", bg: "#ecfdf5" },
            { key: "real_estate" as const, label: "Imóvel",  icon: Home, color: "#2563eb", bg: "#eff6ff" },
          ].map((opt) => {
            const Icon = opt.icon;
            const active = value.assetType === opt.key;
            const disabled = typeDisabled && !active;
            return (
              <button
                type="button"
                key={opt.key}
                onClick={() => !typeDisabled && switchAssetType(opt.key)}
                disabled={typeDisabled}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 8,
                  cursor: typeDisabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.5 : 1,
                  background: active ? opt.bg : "white",
                  border: `2px solid ${active ? opt.color : "#e5e7eb"}`,
                  color: active ? opt.color : "#64748b",
                  fontWeight: active ? 700 : 500,
                  fontSize: 12,
                  transition: "all 0.12s",
                  boxShadow: active ? `0 2px 8px ${opt.color}22` : "none",
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: active ? opt.color : "#f1f5f9",
                    color: active ? "white" : "#94a3b8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={14} />
                </span>
                <span style={{ flex: 1, textAlign: "left" }}>{opt.label}</span>
                {active && <CheckCircle2 size={14} />}
              </button>
            );
          })}
        </div>
        {lockTypeSwitch && !readOnly && (
          <span style={{ fontSize: 10, color: "#94a3b8" }}>
            Para alterar o tipo, remova este bem e adicione um novo.
          </span>
        )}
      </div>

      {/* ── VEÍCULO ─────────────────────────────────────────── */}
      {value.assetType === "vehicle" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
            <div>
              <label className="sigx-label">MARCA *</label>
              <input
                type="text"
                className="sigx-input"
                placeholder="Marca do veículo"
                value={value.brand}
                onChange={(e) => set("brand", e.target.value)}
                required
                readOnly={readOnly}
                style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
              />
            </div>
            <div>
              <label className="sigx-label">MODELO *</label>
              <input
                type="text"
                className="sigx-input"
                placeholder="Modelo / versão / motorização"
                value={value.model}
                onChange={(e) => set("model", e.target.value)}
                required
                readOnly={readOnly}
                style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
            <div>
              <label className="sigx-label">ANO FABRICAÇÃO</label>
              <input
                type="text"
                className="sigx-input mono"
                placeholder="AAAA"
                value={value.manufactureYear}
                onChange={(e) => set("manufactureYear", maskYear(e.target.value))}
                readOnly={readOnly}
                style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
              />
            </div>
            <div>
              <label className="sigx-label">ANO MODELO</label>
              <input
                type="text"
                className="sigx-input mono"
                placeholder="AAAA"
                value={value.modelYear}
                onChange={(e) => set("modelYear", maskYear(e.target.value))}
                readOnly={readOnly}
                style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
              />
            </div>
            <div>
              <label className="sigx-label">PLACA *</label>
              <input
                type="text"
                className="sigx-input mono"
                placeholder="AAA-0A00"
                value={value.plate}
                onChange={(e) => set("plate", maskPlate(e.target.value))}
                required
                readOnly={readOnly}
                style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
              />
            </div>
            <div>
              <label className="sigx-label">RENAVAM</label>
              <input
                type="text"
                className="sigx-input mono"
                placeholder="11 dígitos"
                value={value.renavam}
                onChange={(e) => set("renavam", maskRenavam(e.target.value))}
                readOnly={readOnly}
                style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
              />
            </div>
          </div>

          <div>
            <label className="sigx-label">CHASSI (VIN) * {value.chassis.length > 0 && (
              <span style={{ fontSize: 10, color: value.chassis.length === 17 ? "#16a34a" : "#dc2626" }}>
                — {value.chassis.length}/17 caracteres
              </span>
            )}</label>
            <input
              type="text"
              className="sigx-input mono"
              placeholder="17 caracteres alfanuméricos"
              value={value.chassis}
              onChange={(e) => set("chassis", maskChassis(e.target.value))}
              required
              readOnly={readOnly}
              style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
            />
          </div>
        </>
      )}

      {/* ── IMÓVEL ──────────────────────────────────────────── */}
      {value.assetType === "real_estate" && (
        <>
          {/* 🚀 CEP no topo — busca automática no ViaCEP ao completar 8 dígitos.
              O resultado preenche o campo "Localização Completa" abaixo.
              Não persiste em coluna própria (estado local apenas). */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
            <div>
              <label className="sigx-label">CEP</label>
              <input
                type="text"
                className="sigx-input mono"
                placeholder="00000-000"
                value={zipCode}
                onChange={(e) => handleCepLookup(e.target.value)}
                readOnly={readOnly}
                style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
              />
              {cepFeedback && (
                <span className="keep-case" style={{ fontSize: 10, color: "#16a34a", fontWeight: 600 }}>
                  {cepFeedback}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="sigx-label">DESCRIÇÃO DO LOTE / IMÓVEL</label>
            <textarea
              className="sigx-input"
              placeholder="Descrição geral do lote ou imóvel"
              rows={2}
              value={value.description}
              onChange={(e) => set("description", e.target.value)}
              readOnly={readOnly}
              style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
            />
          </div>

          <div>
            <label className="sigx-label">LOCALIZAÇÃO COMPLETA *</label>
            <input
              type="text"
              className="sigx-input"
              placeholder="Endereço completo do imóvel (logradouro, bairro, cidade, UF)"
              value={value.location}
              onChange={(e) => set("location", e.target.value)}
              required
              readOnly={readOnly}
              style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label className="sigx-label">MATRÍCULA NO CARTÓRIO *</label>
              <input
                type="text"
                className="sigx-input"
                placeholder="Número da matrícula"
                value={value.registryNumber}
                onChange={(e) => set("registryNumber", e.target.value)}
                required
                readOnly={readOnly}
                style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
              />
            </div>
            <div>
              <label className="sigx-label">ÁREA TOTAL (m²) *</label>
              <input
                type="text"
                className="sigx-input mono"
                placeholder="1.000.000,00"
                value={value.totalArea}
                onChange={(e) => set("totalArea", maskArea(e.target.value))}
                required
                readOnly={readOnly}
                style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
              />
            </div>
          </div>

          <div>
            <label className="sigx-label">CONFRONTAÇÕES / LIMITES</label>
            <textarea
              className="sigx-input"
              placeholder="Descreva as confrontações e medidas (frente, fundos, laterais)"
              rows={3}
              value={value.boundaries}
              onChange={(e) => set("boundaries", e.target.value)}
              readOnly={readOnly}
              style={readOnly ? { background: "#f9fafb", color: "#4b5563" } : undefined}
            />
          </div>
        </>
      )}
    </div>
  );
}
