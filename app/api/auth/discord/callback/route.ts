import { NextResponse } from "next/server";
import { clientIp, requestOrigin, userAgent } from "@/lib/cloud/guard";
import { getSettings, logEvent, upsertDiscordUser } from "@/lib/cloud/repo";
import { exchangeCode, fetchProfile, isMemberOfGuild, verifyState } from "@/lib/discord";
import { setSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function back(origin: string, params: Record<string, string>): NextResponse {
  const url = new URL("/", origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url, { status: 302 });
}

export async function GET(request: Request) {
  const origin = requestOrigin(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");

  if (denied) return back(origin, { erro: "Autorização cancelada no Discord." });
  if (!code) return back(origin, { erro: "Código de autorização ausente." });
  if (!verifyState(state)) return back(origin, { erro: "Estado inválido ou expirado. Tente de novo." });

  const tokens = await exchangeCode(code, origin);
  if (!tokens) return back(origin, { erro: "O Discord recusou a troca de token." });

  const profile = await fetchProfile(tokens.accessToken);
  if (!profile) return back(origin, { erro: "Não foi possível ler seu perfil do Discord." });

  const settings = await getSettings();
  const guildId = settings.discord.requireGuild ? settings.discord.guildId || settings.gate.guildId : "";
  if (settings.discord.requireGuild && !guildId) {
    return back(origin, { erro: "O servidor obrigatório ainda não foi configurado." });
  }
  if (guildId) {
    const member = await isMemberOfGuild(tokens.accessToken, guildId);
    if (!member) {
      return back(origin, { erro: "Entre no servidor do Discord antes de acessar o console." });
    }
  }

  const user = await upsertDiscordUser({
    discordId: profile.id,
    username: profile.username,
    globalName: profile.global_name ?? null,
    avatar: profile.avatar ?? null,
  });

  if (user.banned) {
    return back(origin, { erro: "Sua conta está bloqueada. Fale com o suporte." });
  }

  await setSession("user", profile.id);
  await logEvent({
    kind: "user.login",
    severity: "info",
    actor: profile.username,
    discordId: profile.id,
    ip: clientIp(request),
    userAgent: userAgent(request),
    message: "Login com Discord.",
  });

  return back(origin, { ok: "discord" });
}
