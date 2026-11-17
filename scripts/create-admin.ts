import "../server/load-env.js";
import readline from "node:readline";
import { getDb } from "../server/db/index.js";
import { migrate } from "../server/db/migrate.js";
import { createAdmin } from "../server/services/auth.js";

/**
 * Cria o administrador (não existe cadastro público de administradores).
 * Uso interativo:   npm run admin:create
 * Uso automatizado: ADMIN_EMAIL=... ADMIN_NAME=... ADMIN_PASSWORD=... npm run admin:create
 */
function ask(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const anyRl = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
  const original = anyRl._writeToOutput.bind(rl);
  let started = false;
  if (hidden) {
    anyRl._writeToOutput = (s: string) => {
      if (!started) {
        started = true;
        original(s);
      } else if (s.includes("\n") || s.includes("\r")) original(s);
    };
  }
  return new Promise((resolve) =>
    rl.question(question, (a) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(a);
    }),
  );
}

const email = process.env.ADMIN_EMAIL ?? (await ask("E-mail do administrador: "));
const name = process.env.ADMIN_NAME ?? (await ask("Nome: "));
const password = process.env.ADMIN_PASSWORD ?? (await ask("Senha (mín. 10 caracteres, letras e números): ", true));

const db = await getDb();
await migrate(db);
try {
  const admin = await createAdmin(db, { email, name, password });
  console.log(`Administrador criado: ${admin.email}`);
  console.log("Acesse /admin/login para entrar.");
} catch (err: any) {
  console.error(`Não foi possível criar o administrador: ${err.message}`);
  if (err.fields) console.error(err.fields);
  process.exitCode = 1;
} finally {
  await db.close();
}
