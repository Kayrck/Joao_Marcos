import { env } from "../env.js";

export interface UploadTarget {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
}

export interface StorageDriver {
  readonly name: "local" | "s3";
  /** URL (ou rota) para onde o navegador envia o arquivo diretamente. */
  presignUpload(key: string, contentType: string, size: number): Promise<UploadTarget>;
  head(key: string): Promise<{ size: number; contentType?: string } | null>;
  /** Primeiros bytes do arquivo (para verificação de assinatura/magic bytes). */
  readHead(key: string, bytes: number): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
  publicUrl(key: string): string;
}

let driver: StorageDriver | null = null;

export async function getStorage(): Promise<StorageDriver> {
  if (driver) return driver;
  if (env.storageDriver === "s3") {
    driver = await (await import("./s3.js")).createS3Storage();
  } else {
    if (env.isProd) {
      throw new Error(
        "Armazenamento persistente não configurado. Defina S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (e S3_ENDPOINT quando aplicável).",
      );
    }
    driver = await (await import("./local.js")).createLocalStorage();
  }
  return driver;
}

export function setStorageForTests(d: StorageDriver | null) {
  driver = d;
}

/** Extensão permitida para cada tipo MIME aceito. */
export const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

/** Confere a assinatura real do arquivo (não confia apenas na extensão ou no Content-Type enviado). */
export function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return "video/webm";
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (brand === "qt  ") return "video/quicktime";
    return "video/mp4";
  }
  return null;
}
