import { fail, guard, json, readBody } from "@/lib/api";
import { checkName, type CheckContext } from "@/lib/adapters";
import { decryptSecret } from "@/lib/crypto";
import { isValidName } from "@/lib/generator";
import { isPlatformId, platformMeta } from "@/lib/platforms";
import { scoreName } from "@/lib/score";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface CheckBody {
  platform?: string;
  username?: string;
  useProxy?: boolean;
}

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const body = await readBody<CheckBody>(request);
  if (!body?.platform || !body.username) return fail("Informe plataforma e nome", 422);
  if (!isPlatformId(body.platform)) return fail("Plataforma inválida", 422);

  const username = body.username.trim().toLowerCase();
  if (!isValidName(body.platform, username)) {
    const meta = platformMeta(body.platform);
    return fail(
      `Nome inválido para ${meta.name}. Use de ${meta.minLength} a ${meta.maxLength} caracteres válidos.`,
      422
    );
  }

  const data = await readData();
  const proxyRecord = body.useProxy
    ? data.proxies.find((proxy) => proxy.enabled && proxy.cooldownUntil <= Date.now())
    : undefined;

  const base: CheckContext = {
    userAgent: data.settings.engine.userAgent,
    timeoutMs: data.settings.engine.timeoutMs,
    proxy: null,
    discordToken: decryptSecret(data.credentials.discord?.token),
    githubToken: decryptSecret(data.credentials.github?.token),
    twitchClientId: data.credentials.twitch?.clientId ?? "",
    twitchClientSecret: decryptSecret(data.credentials.twitch?.clientSecret),
  };

  const ctx: CheckContext = proxyRecord
    ? { ...base, proxy: { record: proxyRecord, password: decryptSecret(proxyRecord.password) } }
    : base;

  const result = await checkName(body.platform, username, ctx);
  const breakdown = scoreName(username);

  return json({
    username,
    platform: body.platform,
    status: result.status,
    detail: result.detail,
    latencyMs: result.latencyMs,
    proxy: result.proxyLabel,
    score: breakdown.score,
    tier: breakdown.tier,
    reasons: breakdown.reasons,
  });
}
