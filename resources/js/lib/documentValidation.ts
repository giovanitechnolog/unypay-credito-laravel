import { api } from "./api";

/** Remove tudo que não for dígito. */
export const onlyDigits = (value: string | null | undefined): string =>
  (value ?? "").replace(/\D/g, "");

/**
 * Shape devolvido pelo endpoint /api/guarantors/find-by-document.
 * Espelha o `GuarantorLite` usado pelo modal de busca, garantindo que o
 * resultado da deduplicação possa ser plugado direto nos fluxos de
 * "adicionar pessoa do banco" das telas de Contratos e Ingestão IA.
 */
export interface GuarantorMatch {
  id: number;
  name: string;
  personType: "PF" | "PJ";
  document: string | null;
}

/**
 * Procura uma pessoa já cadastrada pelo documento exato (CPF ou CNPJ).
 *
 * - Retorna a pessoa quando há match.
 * - Retorna `null` quando o documento é válido mas não existe ainda.
 * - Retorna `null` (silencioso) em caso de erro de rede / 4xx — assim a
 *   chamada nunca quebra o fluxo do operador (cai pra "criar como novo"
 *   sem causar feedback negativo). Erros reais são logados no console.
 */
export async function findGuarantorByDocument(
  document: string | null | undefined
): Promise<GuarantorMatch | null> {
  const digits = onlyDigits(document);
  if (digits.length !== 11 && digits.length !== 14) return null;

  try {
    const { data } = await api.get<{ guarantor: GuarantorMatch | null }>(
      "/api/guarantors/find-by-document",
      { params: { document: digits } }
    );
    return data?.guarantor ?? null;
  } catch (err) {
    console.warn("[findGuarantorByDocument] lookup falhou", err);
    return null;
  }
}

/** Valida CPF pelo cálculo dos dígitos verificadores. */
export function validateCPF(cpf: string): boolean {
  const digits = onlyDigits(cpf);

  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcCheckDigit = (base: string, factor: number): number => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += parseInt(base[i], 10) * (factor - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const first = calcCheckDigit(digits.slice(0, 9), 10);
  if (first !== parseInt(digits[9], 10)) return false;

  const second = calcCheckDigit(digits.slice(0, 10), 11);
  return second === parseInt(digits[10], 10);
}

/** Máscara dinâmica: CPF até 11 dígitos, CNPJ a partir do 12º. */
export function maskDocument(value: string): string {
  const digits = onlyDigits(value);

  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      .slice(0, 14);
  }

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .slice(0, 18);
}

/** PF enquanto ≤11 dígitos; PJ quando passa de 11. */
export function personTypeFromDocument(value: string): "PF" | "PJ" {
  return onlyDigits(value).length > 11 ? "PJ" : "PF";
}
