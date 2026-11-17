# Armazenamento de fotos e vídeos

## Como funciona

1. O painel pede ao backend uma **URL pré-assinada** (o backend valida tipo, tamanho e permissão).
2. O navegador envia o arquivo **direto ao bucket** (evita o limite de ~4,5 MB do corpo de requisições da Vercel — necessário para vídeos).
3. O painel confirma; o backend lê os **primeiros bytes do arquivo** para conferir que é realmente imagem/vídeo (não confia só na extensão) e só então registra a mídia. Arquivo inválido é apagado do bucket.

Limites: imagens até 8 MB (otimizadas para WebP ≤ 1920 px no navegador antes do envio) e vídeos até 200 MB. Tipos aceitos: JPG, PNG, WebP, AVIF, MP4, WebM, MOV. SVG **não** é aceito (pode conter scripts). Vídeos externos (YouTube/Vimeo) são aceitos por link e só carregam quando o visitante clica em reproduzir.

Enviar um arquivo **não o publica**: ele só fica visível no site quando é usado por uma publicação publicada ou por uma seção/configuração do site. As chaves dos arquivos contêm um UUID aleatório (não adivinháveis).

## Configuração (exemplos)

Variáveis: `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`, `S3_FORCE_PATH_STYLE`.

**Supabase Storage (S3 compatível)** — crie um bucket **público** (ex.: `midias`); em *Storage → S3 Connection* gere as chaves de acesso.
`S3_ENDPOINT=https://<ref>.storage.supabase.co/storage/v1/s3`, `S3_REGION=<região do projeto>`, `S3_FORCE_PATH_STYLE=true`, `S3_PUBLIC_BASE_URL=https://<ref>.supabase.co/storage/v1/object/public/midias`.

**Cloudflare R2** — bucket com *Public access* (domínio `r2.dev` ou domínio próprio) e token S3.
`S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, `S3_REGION=auto`, `S3_PUBLIC_BASE_URL=https://pub-xxxx.r2.dev`.

**AWS S3** — deixe `S3_ENDPOINT` vazio e informe a região.

## CORS do bucket (obrigatório para upload pelo navegador)

Permita `PUT` e `GET` a partir do seu domínio, com o cabeçalho `Content-Type`:

```json
[{
  "AllowedOrigins": ["https://seu-dominio.com"],
  "AllowedMethods": ["PUT", "GET", "HEAD"],
  "AllowedHeaders": ["Content-Type"],
  "MaxAgeSeconds": 3600
}]
```

## Observação

O driver `local` (disco) existe **apenas para desenvolvimento** e é recusado em produção. A integração S3 foi implementada com o SDK oficial da AWS, mas só foi exercitada localmente até a geração da URL pré-assinada — o envio real ao seu bucket deve ser validado no deploy (checklist em DEPLOY.md).
