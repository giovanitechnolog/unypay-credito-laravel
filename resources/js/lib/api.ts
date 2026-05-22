import axios, { AxiosError, AxiosInstance } from "axios";

/**
 * Instância axios usada pelas páginas SPA (modais de CRUD).
 *
 * - withCredentials = true: garante envio do cookie de sessão do Laravel.
 * - withXSRFToken   = true: o axios lê o cookie XSRF-TOKEN setado pelo Laravel
 *   e o injeta automaticamente no header X-XSRF-TOKEN, satisfazendo o
 *   middleware VerifyCsrfToken sem precisarmos de chamadas extras.
 */
export const api: AxiosInstance = axios.create({
  baseURL: "/",
  withCredentials: true,
  withXSRFToken: true,
  headers: {
    "X-Requested-With": "XMLHttpRequest",
    Accept: "application/json",
  },
});

/** Estrutura padrão de erros 422 do Laravel. */
export interface LaravelValidationError {
  message: string;
  errors: Record<string, string[]>;
}

/** Extrai a primeira mensagem de erro de uma resposta 422 do Laravel. */
export function extractFirstError(err: unknown, fallback = "Erro inesperado."): string {
  const ax = err as AxiosError<LaravelValidationError>;
  if (ax?.response?.data?.errors) {
    const firstKey = Object.keys(ax.response.data.errors)[0];
    if (firstKey) return ax.response.data.errors[firstKey][0];
  }
  if (ax?.response?.data?.message) return ax.response.data.message;
  if (ax?.message) return ax.message;
  return fallback;
}

/** Reescreve a sessão se o servidor responder 401/419 (expirada). */
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 419 || error.response?.status === 401) {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
