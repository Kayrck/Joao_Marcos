import "../server/load-env.js";
import { ensureDefaults } from "../server/db/defaults.js";
import { getDb } from "../server/db/index.js";
import { migrate } from "../server/db/migrate.js";

/** Aplica as migrations pendentes e cria o conteúdo inicial (apenas na primeira execução). */
const db = await getDb();
const ran = await migrate(db, (m) => console.log(m));
console.log(ran.length ? `${ran.length} migration(s) aplicada(s).` : "Banco já está atualizado.");
if (await ensureDefaults(db)) console.log("Conteúdo inicial (planos, promoção 2026, textos do site) criado.");
await db.close();
