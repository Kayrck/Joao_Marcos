import { api } from "../../lib/api";
import type { MediaDto, UploadInit } from "../../../shared/types";

const MAX_DIM = 1920;

/** Reduz e converte imagens para WebP antes do envio (menos tráfego e carregamento mais rápido no celular). */
async function optimizeImage(file: File): Promise<{ blob: Blob; name: string; width: number; height: number }> {
  try {
    if (!file.type.startsWith("image/") || file.type === "image/avif") throw new Error("skip");
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.85));
    if (!blob || blob.type !== "image/webp") throw new Error("webp");
    // se a versão otimizada ficou maior que o original (já comprimido), mantém o original
    if (blob.size >= file.size && scale === 1) throw new Error("bigger");
    return { blob, name: file.name.replace(/\.[^.]+$/, "") + ".webp", width: w, height: h };
  } catch {
    let width = 0;
    let height = 0;
    if (file.type.startsWith("image/")) {
      try {
        const bmp = await createImageBitmap(file);
        width = bmp.width;
        height = bmp.height;
      } catch {
        /* sem dimensões */
      }
    }
    return { blob: file, name: file.name, width, height };
  }
}

function put(url: string, headers: Record<string, string>, body: Blob, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    // upload local usa o cookie da sessão; URL pré-assinada (S3) é cross-origin e não deve enviar credenciais
    xhr.withCredentials = url.startsWith("/");
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Falha ao enviar o arquivo ao armazenamento.")));
    xhr.onerror = () => reject(new Error("Falha de rede ao enviar o arquivo. Verifique a configuração (CORS) do armazenamento."));
    xhr.send(body);
  });
}

/** Fluxo completo: otimiza (imagens) → pede URL → envia direto ao armazenamento → confirma (validação no servidor). */
export async function uploadMedia(file: File, meta: { category?: string; title?: string; altText?: string }, onProgress?: (pct: number) => void): Promise<MediaDto> {
  const opt = await optimizeImage(file);
  const contentType = opt.blob.type || file.type;
  const init = await api.post<UploadInit>("/api/admin/media/upload-init", { filename: opt.name, contentType, size: opt.blob.size });
  await put(init.upload.url, init.upload.headers, opt.blob, onProgress);
  return api.post<MediaDto>("/api/admin/media/upload-confirm", {
    key: init.key,
    title: meta.title ?? opt.name.replace(/\.[^.]+$/, ""),
    altText: meta.altText ?? "",
    category: meta.category ?? "geral",
    width: opt.width || null,
    height: opt.height || null,
  });
}

export const formatBytes = (n: number | null) => (n === null ? "" : n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
