import { toast } from "sonner";
import { api } from "./api";

const EXCEL_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export interface DownloadExcelOptions {
  /** Query params repassados ao endpoint (filtros da listagem). */
  params?: Record<string, string | number | undefined>;
  /** Mensagem de sucesso exibida via toast. */
  successMessage?: string;
  /** Mensagem de erro exibida via toast. */
  errorMessage?: string;
}

/**
 * Baixa um arquivo Excel (.xlsx) via Axios blob e dispara o download no browser.
 */
export async function downloadExcel(
  endpoint: string,
  filename: string,
  options: DownloadExcelOptions = {},
): Promise<void> {
  const {
    params,
    successMessage = "Planilha exportada com sucesso!",
    errorMessage = "Erro ao exportar planilha.",
  } = options;

  const response = await api.get(endpoint, {
    params,
    responseType: "blob",
    headers: { Accept: EXCEL_MIME },
  });

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);

  toast.success(successMessage);
}

/**
 * Wrapper com estado de loading e tratamento de erro para uso em handlers de botão.
 */
export async function downloadExcelWithState(
  endpoint: string,
  filename: string,
  setExporting: (value: boolean) => void,
  options: DownloadExcelOptions = {},
): Promise<void> {
  setExporting(true);
  try {
    await downloadExcel(endpoint, filename, options);
  } catch {
    toast.error(options.errorMessage ?? "Erro ao exportar planilha.");
  } finally {
    setExporting(false);
  }
}
