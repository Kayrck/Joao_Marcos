/**
 * Leitura centralizada das variáveis de ambiente.
 * Lê `process.env` a cada acesso para que os testes possam alterar valores.
 */
const e = (k: string) => process.env[k]?.trim() || undefined;

export const env = {
  get nodeEnv() {
    return e("NODE_ENV") ?? "development";
  },
  get isProd() {
    return this.nodeEnv === "production";
  },
  get isTest() {
    return this.nodeEnv === "test";
  },
  get databaseUrl() {
    return e("DATABASE_URL");
  },
  get databaseSsl() {
    return e("DATABASE_SSL") !== "false";
  },
  /** Diretório do PGlite (somente desenvolvimento/testes). "memory" = em memória. */
  get pgliteDir() {
    return e("PGLITE_DIR") ?? ".data/pglite";
  },
  get sessionSecret() {
    return e("SESSION_SECRET") ?? (this.isProd ? undefined : "dev-only-secret-change-me-0123456789abcdef");
  },
  get siteUrl() {
    return (e("SITE_URL") ?? "https://jo-o-marcos.vercel.app").replace(/\/+$/, "");
  },
  get storageDriver(): "local" | "s3" {
    const v = e("STORAGE_DRIVER");
    if (v === "s3" || v === "local") return v;
    return e("S3_BUCKET") ? "s3" : "local";
  },
  get localUploadDir() {
    return e("LOCAL_UPLOAD_DIR") ?? ".data/uploads";
  },
  s3: {
    get endpoint() {
      return e("S3_ENDPOINT");
    },
    get region() {
      return e("S3_REGION") ?? "auto";
    },
    get bucket() {
      return e("S3_BUCKET");
    },
    get accessKeyId() {
      return e("S3_ACCESS_KEY_ID");
    },
    get secretAccessKey() {
      return e("S3_SECRET_ACCESS_KEY");
    },
    get publicBaseUrl() {
      return e("S3_PUBLIC_BASE_URL")?.replace(/\/+$/, "");
    },
    get forcePathStyle() {
      return e("S3_FORCE_PATH_STYLE") === "true";
    },
  },
};

export function assertProductionEnv() {
  if (!env.isProd) return;
  const missing: string[] = [];
  if (!env.databaseUrl) missing.push("DATABASE_URL");
  if (!env.sessionSecret || env.sessionSecret.length < 32) missing.push("SESSION_SECRET (mín. 32 caracteres)");
  if (missing.length) throw new Error(`Variáveis de ambiente ausentes/inválidas: ${missing.join(", ")}`);
}
