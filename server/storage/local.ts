import { mkdir, open, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../env.js";
import type { StorageDriver } from "./index.js";

/**
 * Armazenamento em disco — SOMENTE para desenvolvimento local.
 * Em produção (Vercel) o disco é efêmero; use o driver S3 (ver README).
 */
export async function createLocalStorage(): Promise<StorageDriver & { write(key: string, data: Buffer): Promise<void> }> {
  const root = path.resolve(env.localUploadDir);
  await mkdir(root, { recursive: true });
  const abs = (key: string) => {
    const p = path.resolve(root, key);
    if (!p.startsWith(root + path.sep)) throw new Error("Chave de arquivo inválida.");
    return p;
  };

  return {
    name: "local",
    async presignUpload(key, contentType) {
      return {
        url: `/api/admin/media/local-upload?key=${encodeURIComponent(key)}`,
        method: "PUT",
        headers: { "Content-Type": contentType },
      };
    },
    async write(key, data) {
      await mkdir(path.dirname(abs(key)), { recursive: true });
      await writeFile(abs(key), data);
    },
    async head(key) {
      try {
        const s = await stat(abs(key));
        return { size: s.size };
      } catch {
        return null;
      }
    },
    async readHead(key, bytes) {
      try {
        const fh = await open(abs(key), "r");
        try {
          const buf = Buffer.alloc(bytes);
          const { bytesRead } = await fh.read(buf, 0, bytes, 0);
          return buf.subarray(0, bytesRead);
        } finally {
          await fh.close();
        }
      } catch {
        return null;
      }
    },
    async remove(key) {
      await rm(abs(key), { force: true });
    },
    publicUrl: (key) => `/uploads/${key}`,
  };
}
