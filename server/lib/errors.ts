export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  new AppError(400, "validation_error", message, fields);
export const unauthorized = (message = "Faça login para continuar.") => new AppError(401, "unauthorized", message);
export const forbidden = (message = "Você não tem permissão para esta ação.") =>
  new AppError(403, "forbidden", message);
export const notFound = (what = "Registro") => new AppError(404, "not_found", `${what} não encontrado.`);
export const conflict = (message: string, details?: unknown) =>
  new AppError(409, "conflict", message, undefined, details);
export const tooMany = (message = "Muitas tentativas. Aguarde alguns minutos e tente novamente.") =>
  new AppError(429, "rate_limited", message);
