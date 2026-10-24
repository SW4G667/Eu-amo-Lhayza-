import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "atalaia_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const DEFAULT_PASSWORD = "atalaia";

export function appPassword(): string {
  return process.env.APP_PASSWORD || DEFAULT_PASSWORD;
}

export function usingDefaultPassword(): boolean {
  return !process.env.APP_PASSWORD;
}

function sessionSecret(): string {
  return process.env.APP_SECRET || `atalaia:${appPassword()}:session`;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(): string {
  const payload = `v1.${Date.now() + SESSION_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = sign(payload);
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;
  const expiry = Number(parts[1]);
  return Number.isFinite(expiry) && expiry > Date.now();
}

export function checkPassword(input: string): boolean {
  const hash = (value: string) => crypto.createHash("sha256").update(value).digest();
  const a = hash(input ?? "");
  const b = hash(appPassword());
  return crypto.timingSafeEqual(a, b);
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/**
 * @deprecated A v1.1 usa `pageAccess()` (Discord ou key). Mantido apenas
 * para integrações antigas que ainda chamam a senha legada.
 */
export async function requirePageAuth(): Promise<void> {
  if (!(await isAuthenticated())) redirect("/");
}

export function requestIsAuthed(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return verifySessionToken(match?.[1]);
}

export function sessionCookie(token: string): {
  name: string;
  value: string;
  options: {
    httpOnly: boolean;
    sameSite: "lax";
    secure: boolean;
    path: string;
    maxAge: number;
  };
} {
  return {
    name: SESSION_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    },
  };
}

const attempts = new Map<string, { count: number; resetAt: number }>();

export function loginAllowed(ip: string): boolean {
  const entry = attempts.get(ip);
  if (!entry) return true;
  if (Date.now() > entry.resetAt) {
    attempts.delete(ip);
    return true;
  }
  return entry.count < 10;
}

export function registerFailedLogin(ip: string): void {
  const entry = attempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: Date.now() + 10 * 60_000 });
    return;
  }
  entry.count += 1;
}

export function clearLoginAttempts(ip: string): void {
  attempts.delete(ip);
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "local";
}
