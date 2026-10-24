import crypto from "crypto";
import { cookies } from "next/headers";

/**
 * Sessões assinadas (HMAC-SHA256) em cookies HttpOnly.
 *
 * - `atl_adm`  painel administrativo (12 h)
 * - `atl_usr`  cliente com Discord conectado (30 dias)
 *
 * O token não carrega segredo nenhum: apenas tipo, identificador e expiração.
 */

export const ADMIN_COOKIE = "atl_adm";
export const USER_COOKIE = "atl_usr";

const ADMIN_TTL = 1000 * 60 * 60 * 12;
const USER_TTL = 1000 * 60 * 60 * 24 * 30;

export interface SessionPayload {
  v: 1;
  kind: "admin" | "user";
  sub: string;
  iat: number;
  exp: number;
}

function secret(): string {
  return (
    process.env.APP_SECRET ||
    process.env.APP_PASSWORD ||
    "atalaia-dev-secret-change-me"
  );
}

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSession(kind: SessionPayload["kind"], sub: string, ttlMs?: number): string {
  const ttl = ttlMs ?? (kind === "admin" ? ADMIN_TTL : USER_TTL);
  const payload: SessionPayload = { v: 1, kind, sub, iat: Date.now(), exp: Date.now() + ttl };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySession(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (payload.v !== 1) return null;
    if (!Number.isFinite(payload.exp) || payload.exp < Date.now()) return null;
    if (payload.kind !== "admin" && payload.kind !== "user") return null;
    return payload;
  } catch {
    return null;
  }
}

export function ttlFor(kind: SessionPayload["kind"]): number {
  return kind === "admin" ? ADMIN_TTL : USER_TTL;
}

function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

export async function setSession(kind: SessionPayload["kind"], sub: string): Promise<void> {
  const ttl = ttlFor(kind);
  const store = await cookies();
  store.set(kind === "admin" ? ADMIN_COOKIE : USER_COOKIE, createSession(kind, sub, ttl), cookieOptions(ttl));
}

export async function clearSession(kind?: SessionPayload["kind"]): Promise<void> {
  const store = await cookies();
  if (!kind || kind === "admin") store.delete(ADMIN_COOKIE);
  if (!kind || kind === "user") store.delete(USER_COOKIE);
}

export async function readSession(kind: SessionPayload["kind"]): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(kind === "admin" ? ADMIN_COOKIE : USER_COOKIE)?.value;
  const payload = verifySession(token);
  if (!payload || payload.kind !== kind) return null;
  return payload;
}

/** Lê a sessão a partir do header Cookie (route handlers sem `cookies()`). */
export function sessionFromRequest(
  request: Request,
  kind: SessionPayload["kind"]
): SessionPayload | null {
  const header = request.headers.get("cookie") || "";
  const name = kind === "admin" ? ADMIN_COOKIE : USER_COOKIE;
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!match) return null;
  const payload = verifySession(decodeURIComponent(match.slice(name.length + 1)));
  if (!payload || payload.kind !== kind) return null;
  return payload;
}
