import { json } from "@/lib/api";
import { usingFallbackAdminKey } from "@/lib/cloud/admin-key";
import { driverLabel, supabaseConfig } from "@/lib/cloud/db";
import { getSettings, listPlans, listPlatforms } from "@/lib/cloud/repo";
import { discordConfigured } from "@/lib/discord";
import { phanomToken } from "@/lib/phanom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnóstico público e sem segredos: serve para conferir, em uma olhada,
 * se banco, Discord e PhanomCloud estão no lugar. Nunca devolve chaves.
 */
export async function GET() {
  const started = Date.now();
  const checks: Record<string, unknown> = {
    app: "atalaia",
    version: "1.1.1",
    vercel: Boolean(process.env.VERCEL),
  };

  checks.supabase = { configured: Boolean(supabaseConfig()), driver: driverLabel() };

  try {
    const [plans, platforms, settings] = await Promise.all([
      listPlans(),
      listPlatforms(),
      getSettings(),
    ]);
    checks.database = {
      ok: true,
      plans: plans.length,
      platforms: platforms.length,
      platformsEnabled: platforms.filter((platform) => platform.enabled).length,
      requiresDiscord: settings.gate.requireDiscord,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    checks.database = {
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 160) : "falha desconhecida",
      latencyMs: Date.now() - started,
    };
  }

  try {
    checks.discord = {
      configured: await discordConfigured(),
      hasClientIdEnv: Boolean(process.env.DISCORD_CLIENT_ID),
      hasSecretEnv: Boolean(process.env.DISCORD_CLIENT_SECRET),
    };
  } catch {
    checks.discord = { configured: false };
  }

  checks.admin = {
    customKey: !usingFallbackAdminKey(),
    sessionSecret: Boolean(process.env.APP_SECRET),
  };

  checks.phanom = {
    configured: Boolean(phanomToken()),
    tokenKind: phanomToken()
      ? phanomToken().startsWith("auto_")
        ? "automation"
        : phanomToken().startsWith("sess_")
          ? "session"
          : phanomToken().startsWith("pc_")
            ? "api-key"
            : "unknown"
      : null,
  };

  return json(checks);
}
