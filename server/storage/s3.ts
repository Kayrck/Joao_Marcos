import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env.js";
import type { StorageDriver } from "./index.js";

/**
 * Armazenamento compatível com S3 (Supabase Storage, Cloudflare R2, AWS S3, Backblaze B2, MinIO...).
 * O navegador envia o arquivo direto ao bucket por URL pré-assinada, o que evita o limite de ~4,5 MB
 * do corpo de requisições das funções da Vercel (necessário para vídeos).
 */
export async function createS3Storage(): Promise<StorageDriver> {
  const { bucket, accessKeyId, secretAccessKey, endpoint, region, publicBaseUrl, forcePathStyle } = env.s3;
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Configuração S3 incompleta: defina S3_BUCKET, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY.");
  }
  if (!publicBaseUrl) {
    throw new Error("Defina S3_PUBLIC_BASE_URL (URL pública base dos arquivos do bucket).");
  }
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
    // evita enviar checksums que alguns provedores S3-compatíveis ainda não aceitam em URLs pré-assinadas
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  return {
    name: "s3",
    async presignUpload(key, contentType) {
      const url = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), {
        expiresIn: 600,
      });
      return { url, method: "PUT", headers: { "Content-Type": contentType } };
    },
    async head(key) {
      try {
        const r = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return { size: Number(r.ContentLength ?? 0), contentType: r.ContentType };
      } catch (err: any) {
        if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound") return null;
        throw err;
      }
    },
    async readHead(key, bytes) {
      try {
        const r = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=0-${bytes - 1}` }));
        const arr = await r.Body?.transformToByteArray();
        return arr ? Buffer.from(arr) : null;
      } catch {
        return null;
      }
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    publicUrl: (key) => `${publicBaseUrl}/${key}`,
  };
}
