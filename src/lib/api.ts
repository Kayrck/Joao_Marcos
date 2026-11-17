import type { ApiError } from "../../shared/types";

/** Erro de API com mensagem em português e erros por campo (para formulários). */
export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
    public details?: any,
  ) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...init,
    });
  } catch {
    throw new ApiRequestError(0, "network", "Sem conexão com o servidor. Verifique sua internet e tente novamente.");
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* resposta não-JSON */
  }
  if (!res.ok) {
    const err = (data as ApiError | null)?.error;
    if (res.status === 401 && url.startsWith("/api/admin") && !url.endsWith("/auth/login")) {
      window.dispatchEvent(new CustomEvent("jm:unauthorized"));
    }
    throw new ApiRequestError(res.status, err?.code ?? "error", err?.message ?? "Não foi possível concluir a operação.", err?.fields, err?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body: unknown = {}) => request<T>("POST", url, body),
  put: <T>(url: string, body: unknown = {}) => request<T>("PUT", url, body),
  del: <T = { ok: true }>(url: string) => request<T>("DELETE", url),
};

export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Ocorreu um erro inesperado.";
}
