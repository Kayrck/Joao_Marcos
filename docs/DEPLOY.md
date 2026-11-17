# Deploy na Vercel

O projeto continua sendo um app Vite na Vercel; a novidade é a função `api/index.ts` (backend) e o banco/armazenamento externos.

> **Status de verificação:** o build, os testes e o fluxo completo foram validados localmente (PGlite + disco local). Ainda **não** foram exercitados contra uma Vercel real, um PostgreSQL gerenciado e um bucket S3 real — esses três passos dependem das suas contas. Siga o checklist de validação no fim.

## 1. Banco de dados (PostgreSQL)

Escolha um (todos têm plano gratuito):

- **Supabase** — crie um projeto → *Project Settings → Database → Connection string → Transaction pooler* (porta 6543). Use essa URL em `DATABASE_URL`.
- **Neon** — crie um projeto e copie a *pooled connection string*.

Aplique o esquema e o conteúdo inicial **uma vez**, do seu computador, apontando para o banco de produção:

```bash
# PowerShell
$env:DATABASE_URL = "postgres://..."
npm run db:migrate
```

Isso cria as tabelas (com RLS), os 3 planos, a **Promoção 2026 (até 31/12/2026)**, as categorias de despesa e os textos iniciais do site. Rodar de novo é seguro (só aplica o que falta; o conteúdo inicial nunca sobrescreve o que você editou).

## 2. Armazenamento de arquivos

Veja [STORAGE.md](STORAGE.md). Sem isso o painel funciona, mas **não aceita upload de fotos/vídeos** em produção (o disco da Vercel é efêmero, então o modo local é bloqueado de propósito).

## 3. Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | Obrigatória | Observação |
| --- | --- | --- |
| `DATABASE_URL` | sim | URL do pooler do PostgreSQL |
| `SESSION_SECRET` | sim | ≥ 32 caracteres aleatórios |
| `SITE_URL` | recomendada | `https://seu-dominio` (Open Graph e sitemap) |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL` | para uploads | `S3_ENDPOINT`/`S3_REGION`/`S3_FORCE_PATH_STYLE` conforme o provedor |

Detalhes e valores de exemplo em [.env.example](../.env.example). Nunca coloque segredos em variáveis `VITE_*` (elas vão para o navegador).

## 4. Publicar

Conecte o repositório na Vercel (preset *Vite* é detectado; `vercel.json` já define build, rewrites e cabeçalhos de segurança) e faça o deploy. `/api/*`, `robots.txt` e `sitemap.xml` são atendidos pela função; o restante é o app estático com fallback para `index.html`.

## 5. Primeiro administrador

Não há cadastro público. Do seu computador, com a mesma `DATABASE_URL`:

```bash
npm run admin:create
```

O script pergunta e-mail, nome e senha (mínimo 10 caracteres, com letras e números) — a senha é guardada apenas como hash scrypt. Depois entre em `https://seu-dominio/admin/login`.

## 6. Checklist de validação pós-deploy

1. `GET /api/health` responde `{"ok":true}`.
2. A home mostra os 3 planos com “Valores promocionais válidos até 31/12/2026”.
3. Login no `/admin/login` funciona e o cookie vem com `HttpOnly; Secure; SameSite=Lax`.
4. Envie uma foto em *Galeria de mídias* — se falhar no envio ao bucket, revise o **CORS** do bucket (ver STORAGE.md).
5. Envie uma avaliação de teste pelo site e aprove em *Avaliações*.
6. Em *Planos*, **defina o preço regular** de cada plano (senão, após 31/12/2026 o site mostra “Consulte valores”).
7. Em *Configurações*, confira o número de WhatsApp (o valor inicial, herdado do site anterior, tem apenas 8 dígitos locais — confirme se está completo).

## Docker (opcional, desenvolvimento)

`docker compose up` sobe o frontend e a API de desenvolvimento (`npm run dev:docker`) com PGlite. Não é um modo de produção.
