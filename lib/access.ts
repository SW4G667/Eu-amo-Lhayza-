import { NextResponse } from "next/server";
import { fail } from "./api";
import { verifySessionToken } from "./auth";
import { getLicenseForDiscord, listUsers } from "./cloud/repo";
import type { CloudUser, License } from "./cloud/types";
import { sessionFromRequest } from "./session";

export interface Access {
  kind: "admin" | "user";
  discordId: string | null;
  license: License | null;
  user: CloudUser | null;
  label: string;
}

function legacyAdmin(request: Request): boolean {
  const header = request.headers.get("cookie") || "";
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("atalaia_session="));
  if (!match) return false;
  return verifySessionToken(decodeURIComponent(match.slice("atalaia_session=".length)));
}

/**
 * Resolve quem está falando com a API.
 * Admin → senha legada, cookie de admin ou key mestra.
 * Cliente → cookie de usuário com licença válida e conta não banida.
 */
export async function resolveAccess(request: Request): Promise<Access | null> {
  if (
    sessionFromRequest(request, "admin") ||
    legacyAdmin(request)
  ) {
    return { kind: "admin", discordId: null, license: null, user: null, label: "admin" };
  }

  const session = sessionFromRequest(request, "user");
  if (!session) return null;

  const users = await listUsers();
  const user = users.find((entry) => entry.discordId === session.sub) ?? null;
  if (user?.banned) return null;

  const license = await getLicenseForDiscord(session.sub);
  if (!license || license.status !== "active") return null;

  return {
    kind: "user",
    discordId: session.sub,
    license,
    user,
    label: user?.username ?? session.sub,
  };
}

export async function requireAccess(request: Request): Promise<Access | NextResponse> {
  const access = await resolveAccess(request);
  if (!access) return fail("Sessão expirada. Entre novamente.", 401);
  return access;
}

export async function requireAdmin(request: Request): Promise<Access | NextResponse> {
  const access = await resolveAccess(request);
  if (!access) return fail("Sessão expirada. Entre novamente.", 401);
  if (access.kind !== "admin") return fail("Acesso restrito ao administrador.", 403);
  return access;
}

export function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof Response && typeof (value as NextResponse).status === "number";
}

/** Escopo de propriedade: admin vê tudo, cliente só o que é da sua licença. */
export function ownerOf(access: Access): string {
  return access.kind === "admin" ? "admin" : access.license?.id ?? "";
}
