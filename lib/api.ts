import { NextResponse } from "next/server";
import { requestIsAuthed } from "./auth";
import { sessionFromRequest } from "./session";
import { setRuntimeStateToken } from "./github-state";

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

export function fail(message: string, status = 400): NextResponse {
  return json({ error: message }, { status });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const requestHost =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      new URL(request.url).host;
    return originHost === requestHost;
  } catch {
    return false;
  }
}

export const STATE_TOKEN_HEADER = "x-atalaia-state-token";

function isAdminRequest(request: Request): boolean {
  if (sessionFromRequest(request, "admin")) return true;
  return requestIsAuthed(request);
}

/**
 * Porta de entrada das rotas administrativas do console.
 * Somente o operador (key mestra, senha legada ou cookie de admin).
 */
export async function guard(request: Request): Promise<NextResponse | null> {
  setRuntimeStateToken(request.headers.get(STATE_TOKEN_HEADER));
  if (!isAdminRequest(request)) {
    return fail("Acesso restrito ao administrador.", 401);
  }
  if (request.method !== "GET" && !sameOrigin(request)) {
    return fail("Origem não permitida", 403);
  }
  return null;
}

export async function readBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function badId(): NextResponse {
  return fail("Identificador inválido", 422);
}
