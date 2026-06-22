import type { CSSProperties } from "react";
import { onlyDigits } from "./documentValidation";

/** Indica se um valor de campo deve ser tratado como vazio/não preenchido. */
export function isEmptyFieldValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "number") return value === 0 || Number.isNaN(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return true;
    const normalized = trimmed.replace(/\./g, "").replace(",", ".");
    if (normalized === "0" || normalized === "0.00") return true;
    return false;
  }
  return false;
}

/** Indica se algum valor da lista está vazio/zerado. */
export function hasAnyEmptyField(values: unknown[]): boolean {
  return values.some(isEmptyFieldValue);
}

/** Estilo vermelho para campos vazios — usado na revisão de importação e modais. */
export function getEmptyFieldStyle(value: unknown): CSSProperties {
  if (!isEmptyFieldValue(value)) {
    return { borderColor: "#cbd5e1", backgroundColor: "white", transition: "all 0.1s" };
  }
  return {
    borderColor: "#ef4444",
    backgroundColor: "#fef2f2",
    transition: "all 0.1s",
  };
}

export interface AssetLike {
  assetType?: string;
  brand?: string;
  model?: string;
  manufactureYear?: string;
  modelYear?: string;
  plate?: string;
  renavam?: string;
  chassis?: string;
  description?: string;
  location?: string;
  registryNumber?: string;
  totalArea?: string;
  boundaries?: string;
}

/** Labels dos campos obrigatórios ausentes em um bem em garantia. */
export function getAssetMissingFieldLabels(a: AssetLike): string[] {
  if (a.assetType === "vehicle") {
    const missing: string[] = [];
    if (isEmptyFieldValue(a.brand)) missing.push("Marca");
    if (isEmptyFieldValue(a.model)) missing.push("Modelo");
    if (isEmptyFieldValue(a.plate)) missing.push("Placa");
    return missing;
  }
  const missing: string[] = [];
  if (isEmptyFieldValue(a.location)) missing.push("Localização");
  if (isEmptyFieldValue(a.registryNumber)) missing.push("Matrícula");
  if (isEmptyFieldValue(a.totalArea)) missing.push("Área");
  return missing;
}

/** Labels de todos os campos vazios/zerados de um bem (para destaque na revisão). */
export function getAssetEmptyFieldLabels(a: AssetLike): string[] {
  if (a.assetType === "vehicle") {
    const checks: [unknown, string][] = [
      [a.brand, "Marca"],
      [a.model, "Modelo"],
      [a.manufactureYear, "Ano fabricação"],
      [a.modelYear, "Ano modelo"],
      [a.plate, "Placa"],
      [a.renavam, "Renavam"],
      [a.chassis, "Chassi"],
    ];
    return checks.filter(([v]) => isEmptyFieldValue(v)).map(([, label]) => label);
  }
  const checks: [unknown, string][] = [
    [a.description, "Descrição"],
    [a.location, "Localização"],
    [a.registryNumber, "Matrícula"],
    [a.totalArea, "Área"],
    [a.boundaries, "Confrontações"],
  ];
  return checks.filter(([v]) => isEmptyFieldValue(v)).map(([, label]) => label);
}

export function isAssetItemInvalid(a: AssetLike): boolean {
  return getAssetMissingFieldLabels(a).length > 0;
}

/** Qualquer campo do bem ainda vazio/zerado (obrigatório ou não). */
export function isAssetItemIncomplete(a: AssetLike): boolean {
  return getAssetEmptyFieldLabels(a).length > 0;
}

export interface PersonLike {
  name?: string;
  isFromDb?: boolean;
  personType?: "PF" | "PJ" | string;
  document?: string | null;
  formValues?: Record<string, unknown>;
}

/** Valida pessoa on-the-fly (fiador/codevedor/testemunha) antes do submit. */
export function isPersonItemInvalid(g: PersonLike): boolean {
  if (!g.name?.trim()) return true;
  if (g.isFromDb) return false;
  const fromForm = g.personType === "PJ"
    ? onlyDigits(String(g.formValues?.cnpj ?? ""))
    : onlyDigits(String(g.formValues?.cpf ?? ""));
  const doc = fromForm || onlyDigits(String(g.document ?? ""));
  return doc.length !== (g.personType === "PJ" ? 14 : 11);
}

/** Qualquer campo da pessoa ainda vazio/zerado (para marcar aba na revisão). */
export function isPersonItemIncomplete(g: PersonLike): boolean {
  if (g.isFromDb) return false;
  if (isPersonItemInvalid(g)) return true;
  if (!g.formValues) {
    return isEmptyFieldValue(g.name) || isEmptyFieldValue(g.document);
  }
  const fv = g.formValues;
  const keys = g.personType === "PJ"
    ? ["name", "cnpj", "tradeName", "stateRegistration", "email", "phone", "street", "number", "complement", "neighborhood", "city", "state", "zipCode"]
    : ["name", "cpf", "rg", "email", "phone", "nationality", "maritalStatus", "street", "number", "complement", "neighborhood", "city", "state", "zipCode"];
  return hasAnyEmptyField(keys.map((k) => fv[k]));
}

/** Badge/chip vermelho para pendências em tabelas. */
export const missingFieldBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 7px",
  borderRadius: 4,
  fontSize: 9,
  fontWeight: 700,
  color: "#991b1b",
  background: "#fee2e2",
  border: "1px solid #fca5a5",
  marginRight: 4,
  marginTop: 2,
};
