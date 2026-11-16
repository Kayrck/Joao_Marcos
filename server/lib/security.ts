import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { env } from "../env.js";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: object) => Promise<Buffer>;

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 64;

/** Hash de senha com scrypt (nativo do Node). Formato: scrypt$N$r$p$salt$hash (base64). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const dk = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 128 * N * R * 2 });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${dk.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const dk = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 128 * Number(n) * Number(r) * 2,
  });
  return dk.length === expected.length && timingSafeEqual(dk, expected);
}

export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

/** Hash de IP com segredo: permite detectar abuso sem armazenar o IP em texto puro (LGPD). */
export function hashIp(ip: string): string {
  return createHash("sha256")
    .update(`${env.sessionSecret ?? ""}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

/** Política de senha do administrador. Retorna mensagem de erro ou null. */
export function passwordPolicyError(password: string): string | null {
  if (password.length < 10) return "A senha deve ter pelo menos 10 caracteres.";
  if (password.length > 200) return "A senha é longa demais.";
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return "Use letras e números na senha.";
  if (/^(.)\1+$/.test(password)) return "Escolha uma senha menos previsível.";
  return null;
}
