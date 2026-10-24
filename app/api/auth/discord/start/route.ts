import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { requestOrigin } from "@/lib/cloud/guard";
import { authorizeUrl, discordConfigured } from "@/lib/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await discordConfigured())) {
    return fail("Login com Discord ainda não configurado. Avise o administrador.", 503);
  }
  const url = await authorizeUrl(requestOrigin(request));
  if (!url) return fail("Não foi possível iniciar o login com Discord.", 500);
  return NextResponse.redirect(url, { status: 302 });
}
