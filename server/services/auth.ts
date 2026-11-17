import { z } from "zod";
import type { Queryable } from "../db/index.js";
import { audit } from "../lib/audit.js";
import { now } from "../lib/clock.js";
import { AppError, badRequest, conflict, tooMany } from "../lib/errors.js";
import { hashPassword, newToken, passwordPolicyError, sha256, verifyPassword } from "../lib/security.js";
import { parse } from "../lib/validate.js";
import type { AdminMe, AdminSessionInfo } from "../../shared/types.js";

export const SESSION_DAYS = 7;
export const SESSION_COOKIE = "jm_session";

const MAX_FAILS_PER_EMAIL = 5;
const MAX_FAILS_PER_IP = 20;
const LOCK_WINDOW_MIN = 15;

let dummyHash: Promise<string> | null = null;

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) });

/** Login administrativo com proteção contra força bruta (por e-mail e por IP). */
export async function login(
  q: Queryable,
  input: unknown,
  ip: string,
  userAgent: string | null,
): Promise<{ token: string; admin: AdminMe; expiresAt: Date }> {
  const d = parse(loginSchema, input);
  const since = new Date(now().getTime() - LOCK_WINDOW_MIN * 60_000).toISOString();
  const fails = await q.query<{ by_email: number; by_ip: number }>(
    `select count(*) filter (where email = $1)::int as by_email, count(*) filter (where ip = $2)::int as by_ip
       from login_attempts where success = false and created_at > $3 and (email = $1 or ip = $2)`,
    [d.email, ip, since],
  );
  if (fails.rows[0].by_email >= MAX_FAILS_PER_EMAIL || fails.rows[0].by_ip >= MAX_FAILS_PER_IP) {
    throw tooMany(`Muitas tentativas de acesso. Tente novamente em ${LOCK_WINDOW_MIN} minutos.`);
  }

  const admin = (await q.query("select * from administrators where lower(email) = $1", [d.email])).rows[0];
  // compara sempre com um hash, mesmo sem usuário, para não revelar quais e-mails existem
  dummyHash ??= hashPassword("senha-inexistente-0000");
  const ok = await verifyPassword(d.password, admin?.password_hash ?? (await dummyHash));
  const success = !!admin && admin.is_active && ok;
  await q.query("insert into login_attempts (email, ip, success) values ($1,$2,$3)", [d.email, ip, success]);
  if (!success) throw new AppError(401, "invalid_credentials", "E-mail ou senha incorretos.");

  const token = newToken();
  const expiresAt = new Date(now().getTime() + SESSION_DAYS * 86_400_000);
  await q.query(
    "insert into admin_sessions (admin_id, token_hash, ip, user_agent, expires_at) values ($1,$2,$3,$4,$5)",
    [admin.id, sha256(token), ip, userAgent?.slice(0, 300) ?? null, expiresAt.toISOString()],
  );
  await q.query("update administrators set last_login_at = now() where id = $1", [admin.id]);
  await q.query("delete from login_attempts where created_at < now() - interval '30 days'");
  await audit(q, { adminId: admin.id, action: "auth.login", entity: "admin", entityId: admin.id, summary: "Login realizado" });
  return { token, admin: { id: admin.id, email: admin.email, name: admin.name }, expiresAt };
}

export interface SessionContext {
  admin: AdminMe;
  sessionId: string;
}

/** Valida o token do cookie. Retorna null se inexistente, revogado, expirado ou admin inativo. */
export async function getSession(q: Queryable, token: string | undefined): Promise<SessionContext | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const r = await q.query(
    `select s.id as session_id, s.last_seen_at, a.id, a.email, a.name
       from admin_sessions s join administrators a on a.id = s.admin_id
      where s.token_hash = $1 and s.revoked_at is null and s.expires_at > $2 and a.is_active`,
    [sha256(token), now().toISOString()],
  );
  const row = r.rows[0];
  if (!row) return null;
  if (now().getTime() - new Date(row.last_seen_at).getTime() > 5 * 60_000) {
    await q.query("update admin_sessions set last_seen_at = now() where id = $1", [row.session_id]);
  }
  return { admin: { id: row.id, email: row.email, name: row.name }, sessionId: row.session_id };
}

export async function logout(q: Queryable, sessionId: string): Promise<void> {
  await q.query("update admin_sessions set revoked_at = now() where id = $1", [sessionId]);
}

const passwordSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(1).max(200) });

export async function changePassword(q: Queryable, adminId: string, sessionId: string, input: unknown): Promise<void> {
  const d = parse(passwordSchema, input);
  const admin = (await q.query("select password_hash from administrators where id = $1", [adminId])).rows[0];
  if (!admin || !(await verifyPassword(d.currentPassword, admin.password_hash))) {
    throw badRequest("A senha atual está incorreta.", { currentPassword: "Senha incorreta." });
  }
  const problem = passwordPolicyError(d.newPassword);
  if (problem) throw badRequest(problem, { newPassword: problem });
  if (d.newPassword === d.currentPassword) throw badRequest("A nova senha deve ser diferente da atual.", { newPassword: "Igual à atual." });
  await q.query("update administrators set password_hash = $2 where id = $1", [adminId, await hashPassword(d.newPassword)]);
  // por segurança, encerra todas as outras sessões
  await q.query("update admin_sessions set revoked_at = now() where admin_id = $1 and id <> $2 and revoked_at is null", [adminId, sessionId]);
  await audit(q, { adminId, action: "auth.password_change", entity: "admin", entityId: adminId, summary: "Senha alterada" });
}

export async function listSessions(q: Queryable, adminId: string, currentId: string): Promise<AdminSessionInfo[]> {
  const r = await q.query(
    `select id, created_at, last_seen_at, ip, user_agent from admin_sessions
      where admin_id = $1 and revoked_at is null and expires_at > $2 order by last_seen_at desc`,
    [adminId, now().toISOString()],
  );
  return r.rows.map((s) => ({
    id: s.id,
    createdAt: new Date(s.created_at).toISOString(),
    lastSeenAt: new Date(s.last_seen_at).toISOString(),
    ip: s.ip,
    userAgent: s.user_agent,
    current: s.id === currentId,
  }));
}

export async function revokeOtherSessions(q: Queryable, adminId: string, currentId: string): Promise<number> {
  const r = await q.query("update admin_sessions set revoked_at = now() where admin_id = $1 and id <> $2 and revoked_at is null", [adminId, currentId]);
  await audit(q, { adminId, action: "auth.revoke_sessions", entity: "admin", entityId: adminId, summary: `${r.rowCount} sessão(ões) encerrada(s)` });
  return r.rowCount;
}

const createAdminSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().min(2).max(120),
  password: z.string().max(200),
});

/** Cria um administrador (uso: script de configuração inicial e testes). Não há cadastro público. */
export async function createAdmin(q: Queryable, input: unknown): Promise<AdminMe> {
  const d = parse(createAdminSchema, input);
  const problem = passwordPolicyError(d.password);
  if (problem) throw badRequest(problem, { password: problem });
  if ((await q.query("select 1 from administrators where lower(email) = $1", [d.email])).rowCount) {
    throw conflict("Já existe um administrador com este e-mail.");
  }
  const r = await q.query<{ id: string }>(
    "insert into administrators (email, name, password_hash) values ($1,$2,$3) returning id",
    [d.email, d.name, await hashPassword(d.password)],
  );
  await audit(q, { adminId: r.rows[0].id, action: "admin.create", entity: "admin", entityId: r.rows[0].id, summary: d.email });
  return { id: r.rows[0].id, email: d.email, name: d.name };
}


