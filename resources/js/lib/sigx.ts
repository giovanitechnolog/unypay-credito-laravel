import type { CSSProperties } from "react";
import { isEmptyFieldValue } from "./formValidation";
import { toast } from "sonner";
import { api, extractFirstError } from "./api";

/**
 * Shape padronizado de uma pessoa física devolvida pelo SIGx (depois da
 * normalização feita em `IntegrationController::normalizeSigxPerson`).
 *
 * Todos os campos são opcionais — campos não retornados pela API ficam
 * `null` ou `undefined` e o front os usa para destacar em vermelho o
 * que ainda precisa ser preenchido manualmente.
 */
export interface SigxPersonData {
  name?: string | null;
  shortName?: string | null;
  cpf?: string | null;
  rg?: string | null;
  email?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  nationality?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}

/**
 * Resultado de uma sincronização com o SIGx.
 *
 * Campo `data` traz os dados normalizados quando há sucesso. Quando há
 * falha, `error` contém a mensagem amigável devolvida pelo backend
 * (ex.: "CPF não encontrado no SIGx", "Nenhuma integração SIGx ativa…").
 */
export interface SigxLookupResult {
  ok: boolean;
  data?: SigxPersonData;
  error?: string;
  /** HTTP status devolvido pela API (útil para diferenciar 404 de 503). */
  status?: number;
}

/**
 * Dispara `/api/cpf/{cpf}` e devolve o resultado normalizado pronto
 * para alimentar formulários de Pessoa Física em qualquer CRUD do
 * sistema (Users, Pessoas, Clientes, GuarantorFormFields...).
 *
 * Este helper centraliza o tratamento de erros para que todas as
 * páginas tenham a MESMA experiência de UX (toast amigável, mesma
 * mensagem para CPF inexistente, mesma mensagem para integração
 * desativada/não cadastrada). Adicionar um novo CRUD que precise da
 * sincronização vira basicamente:
 *
 *   const result = await fetchSigxByCpf(cpf);
 *   if (result.ok && result.data) preencheFormulario(result.data);
 *   else toast.error(result.error);
 */
export async function fetchSigxByCpf(cpf: string): Promise<SigxLookupResult> {
  const digits = (cpf ?? "").replace(/\D/g, "");
  if (digits.length !== 11) {
    return { ok: false, error: "CPF inválido — informe os 11 dígitos antes de sincronizar." };
  }

  try {
    const { data } = await api.get<{ data: SigxPersonData; source?: any }>(`/api/cpf/${digits}`);
    return { ok: true, data: data?.data ?? {} };
  } catch (err: any) {
    return {
      ok: false,
      status: err?.response?.status,
      error: extractFirstError(err, "Falha ao consultar o SIGx."),
    };
  }
}

/**
 * Padroniza o feedback ao operador quando o `fetchSigxByCpf` falha.
 *
 * Diferencia "CPF não localizado no SIGx" (status 404 — caminho NORMAL,
 * o operador pode estar cadastrando uma pessoa nova) de erros técnicos
 * (timeout, integração desativada, falha do provedor, host inacessível):
 *
 *   • 404 → `toast.warning` (amarelo) com a orientação de preenchimento
 *           manual já vinda do backend. Não é um erro: o sistema
 *           continua funcionando, só não há fonte automática para
 *           esse CPF.
 *   • Outros → `toast.error` (vermelho) com a mensagem técnica para
 *              que o operador saiba que algo precisa de atenção
 *              (ex.: integração desativada, credencial inválida).
 *
 * Use sempre que `fetchSigxByCpf` devolver `result.ok === false` ou
 * `result.data` vazio. Centralizar aqui mantém todas as telas
 * (Users / Clients / Guarantors / GuarantorFormFields) com a mesma
 * UX, e qualquer ajuste de mensagem futura passa a ser feito num
 * único lugar.
 */
export function notifySigxFailure(result: SigxLookupResult): void {
  const message = result.error ?? "Não foi possível consultar o SIGx.";

  if (result.status === 404) {
    toast.warning(message, {
      description:
        "O cadastro pode prosseguir normalmente: preencha os campos manualmente e salve.",
    });
    return;
  }

  toast.error(message);
}

/**
 * Helper de máscara para destacar campos em vermelho quando um
 * `cpfSynced` indicador estiver ativo e o valor permanecer vazio,
 * espelhando o estilo da Ingestão com IA. Use em `style={getRedHighlight(...)}`.
 */
export function getRedHighlight(value: any, active: boolean): CSSProperties {
  if (!active) return {};
  if (!isEmptyFieldValue(value)) return {};
  return {
    borderColor: "#ef4444",
    backgroundColor: "#fef2f2",
    transition: "all 0.15s",
  };
}
