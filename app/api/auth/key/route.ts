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
import { clearSession, sessionFromRequest, setSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface KeyBody {
  key?: string;
}

/**
 * Porta de entrada única: a mesma caixa aceita a key mestra (admin) ou uma
 * licença de cliente. Nunca devolve 500 por causa de banco/telemetria — o
 * login do administrador é resolvido antes de qualquer escrita.
 */
export async function POST(request: Request) {
  try {
    return await handle(request);
  } catch (error) {
    console.error("[auth/key]", error);
    return fail(
      "Não foi possível concluir o login agora. Tente novamente em alguns segundos.",
      500
    );
  }
}

async function handle(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return fail("Origem não permitida", 403);

  const body = await readBody<KeyBody>(request);
  const raw = (body?.key || "").trim();
  if (!raw) return fail("Cole sua key para continuar.", 422);

  const ip = clientIp(request);

  // 1) key mestra — caminho curto, sem depender do banco e sem esbarrar no
  // limite de tentativas (o admin nunca fica trancado fora do próprio painel).
  if (matchesAdminKey(raw)) {
    await clearSession("user");
    await setSession("admin", "admin");
    void trackAttempt(request, "auth-admin", "admin", true);
    void logEvent({
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
        ? "Você está usando a key padrão. Troque em Ajustes → Ajustes."
        : null,
    });
  }

  // 2) licença de cliente — aqui sim vale o limite de tentativas.
  const limit = await rateLimit(request, {
    bucket: "auth-key",
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return fail(
      `Muitas tentativas. Aguarde ${limit.retryAfterSeconds}s e tente de novo.`,
      429
    );
  }

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
    void trackAttempt(request, "auth-key", result.reason, false);
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

  void trackAttempt(request, "auth-key", "license", true);

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
    void logEvent({
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
    redirect: session?.sub ? "/painel" : "/",
  });
}
