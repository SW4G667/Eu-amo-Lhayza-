import { fail, json, readBody } from "@/lib/api";
import { clientIp, rateLimit, sameOrigin, trackAttempt, userAgent } from "@/lib/cloud/guard";
import { matchesAdminKey, usingFallbackAdminKey } from "@/lib/cloud/admin-key";
import {
  activateLicense,
  deviceHashOf,
  getSettings,
  listUsers,
  logEvent,
  upsertDiscordUser,
} from "@/lib/cloud/repo";
import { publicLicense } from "@/lib/cloud/serialize";
import { clearSession, setSession, sessionFromRequest } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface KeyBody {
  key?: string;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("Origem não permitida", 403);

  const limit = await rateLimit(request, {
    bucket: "auth-key",
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return fail(`Muitas tentativas. Aguarde ${limit.retryAfterSeconds}s e tente de novo.`, 429);
  }

  const body = await readBody<KeyBody>(request);
  const raw = (body?.key || "").trim();
  if (!raw) return fail("Cole sua key para continuar.", 422);

  const ip = clientIp(request);

  // 1) key mestra do painel
  if (matchesAdminKey(raw)) {
    await clearSession("user");
    await setSession("admin", "admin");
    await trackAttempt(request, "auth-key", "admin", true);
    await logEvent({
      kind: "admin.login",
      severity: "warn",
      actor: "admin",
      ip,
      userAgent: userAgent(request),
      message: "Acesso administrativo liberado por key.",
    });
    return json({
      ok: true,
      kind: "admin",
      redirect: "/admin",
      warning: usingFallbackAdminKey()
        ? "Você está usando a key padrão. Troque em Ajustes → Segurança."
        : null,
    });
  }

  // 2) licença
  const session = sessionFromRequest(request, "user");
  const settings = await getSettings();

  const result = await activateLicense({
    code: raw,
    discordId: session?.sub ?? null,
    discordUsername: null,
    deviceHash: deviceHashOf(userAgent(request), ip),
    ip,
    allowAnonymous: !settings.gate.requireDiscord,
  });

  if (!result.ok) {
    await trackAttempt(request, "auth-key", result.reason, false);
    if (result.reason === "discord_required") {
      return json(
        {
          ok: false,
          kind: "license",
          reason: "discord_required",
          error: "Conecte sua conta do Discord para ativar esta key.",
          prefix: result.license?.codePrefix ?? null,
          discordConfigured: Boolean(settings.discord.clientId || process.env.DISCORD_CLIENT_ID),
        },
        { status: 428 }
      );
    }
    return json(
      { ok: false, kind: "license", reason: result.reason, error: result.message },
      { status: result.reason === "invalid" ? 404 : 403 }
    );
  }

  await trackAttempt(request, "auth-key", "license", true);

  if (session?.sub) {
    const users = await listUsers();
    const existing = users.find((user) => user.discordId === session.sub);
    if (existing && result.license) {
      await upsertDiscordUser({
        discordId: existing.discordId,
        username: existing.username,
        globalName: existing.globalName,
        avatar: existing.avatar,
      });
    }
    await logEvent({
      kind: "license.use",
      severity: "success",
      actor: session.sub,
      discordId: session.sub,
      licenseId: result.license?.id ?? null,
      ip,
      userAgent: userAgent(request),
      message: result.message,
    });
  }

  return json({
    ok: true,
    kind: "license",
    message: result.message,
    license: publicLicense(result.license ?? null),
    redirect: "/painel",
  });
}
