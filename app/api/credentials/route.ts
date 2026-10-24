import { fail, guard, json, readBody } from "@/lib/api";
import {
  validateDiscordToken,
  validateGithubToken,
  validateTelegramBot,
  validateTwitchCredential,
} from "@/lib/adapters";
import { encryptSecret } from "@/lib/crypto";
import { updateData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface CredentialBody {
  platform?: "discord" | "github" | "twitch" | "telegramBot";
  token?: string;
  clientId?: string;
  clientSecret?: string;
}

export async function DELETE(request: Request) {
  const blocked = await guard(request);
  if (blocked) return blocked;
  const platform = new URL(request.url).searchParams.get("platform");
  if (!platform) return fail("Informe a plataforma", 422);
  await updateData((store) => {
    if (platform === "discord") delete store.credentials.discord;
    if (platform === "github") delete store.credentials.github;
    if (platform === "twitch") delete store.credentials.twitch;
    if (platform === "telegramBot") delete store.credentials.telegramBot;
  });
  return json({ ok: true });
}

export async function POST(request: Request) {
  const blocked = await guard(request);
  if (blocked) return blocked;
  const body = await readBody<CredentialBody>(request);
  if (!body?.platform) return fail("Informe a plataforma", 422);

  if (body.platform === "discord") {
    const token = (body.token ?? "").trim();
    if (!token) return fail("Informe o token", 422);
    const check = await validateDiscordToken(token);
    if (!check.valid) return fail(check.error ?? "Token recusado pelo Discord", 422);
    await updateData((store) => {
      store.credentials.discord = {
        token: encryptSecret(token),
        username: check.username ?? null,
        userId: check.userId ?? null,
        valid: true,
        checkedAt: Date.now(),
      };
    });
    return json({ ok: true, username: check.username ?? null });
  }

  if (body.platform === "github") {
    const token = (body.token ?? "").trim();
    if (!token) return fail("Informe o token", 422);
    const check = await validateGithubToken(token);
    if (!check.valid) return fail(check.error ?? "Token recusado pelo GitHub", 422);
    await updateData((store) => {
      store.credentials.github = {
        token: encryptSecret(token),
        login: check.username ?? null,
        valid: true,
        checkedAt: Date.now(),
      };
    });
    return json({ ok: true, username: check.username ?? null });
  }

  if (body.platform === "twitch") {
    const clientId = (body.clientId ?? "").trim();
    const clientSecret = (body.clientSecret ?? "").trim();
    if (!clientId || !clientSecret) return fail("Preencha client ID e secret", 422);
    const check = await validateTwitchCredential(clientId, clientSecret);
    if (!check.valid) return fail(check.error ?? "Twitch recusou as credenciais", 422);
    await updateData((store) => {
      store.credentials.twitch = {
        clientId,
        clientSecret: encryptSecret(clientSecret),
        valid: true,
        checkedAt: Date.now(),
      };
    });
    return json({ ok: true, username: clientId });
  }

  if (body.platform === "telegramBot") {
    const token = (body.token ?? "").trim();
    if (!token) return fail("Informe o token do bot", 422);
    const check = await validateTelegramBot(token);
    if (!check.valid) return fail(check.error ?? "Telegram recusou o token", 422);
    await updateData((store) => {
      store.credentials.telegramBot = {
        token: encryptSecret(token),
        username: check.username ?? null,
        valid: true,
        checkedAt: Date.now(),
      };
    });
    return json({ ok: true, username: check.username ?? null });
  }

  return fail("Plataforma não suportada", 422);
}
