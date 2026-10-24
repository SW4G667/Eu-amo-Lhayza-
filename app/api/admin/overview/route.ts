import { json } from "@/lib/api";
import { isNextResponse, requireAdmin } from "@/lib/access";
import { usingFallbackAdminKey } from "@/lib/cloud/admin-key";
import { driverLabel } from "@/lib/cloud/db";
import { getSettings, listEvents, listPlans, overview } from "@/lib/cloud/repo";
import { DEFAULT_SETTINGS } from "@/lib/cloud/types";
import { discordConfigured } from "@/lib/discord";
import { phanomStatus } from "@/lib/phanom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if (isNextResponse(access)) return access;

  const [summary, settings, plans, events, discord, phanom] = await Promise.all([
    overview().catch(() => null),
    getSettings().catch(() => DEFAULT_SETTINGS),
    listPlans().catch(() => []),
    listEvents(40).catch(() => []),
    discordConfigured().catch(() => false),
    phanomStatus().catch(() => null),
  ]);

  return json({
    summary:
      summary ?? {
        driver: driverLabel(),
        totalLicenses: 0,
        pending: 0,
        active: 0,
        expired: 0,
        revoked: 0,
        suspended: 0,
        users: 0,
        banned: 0,
        expiringSoon: 0,
        plans: plans.length,
        platformsEnabled: 0,
        platforms: [],
        proxies: 0,
        proxiesOk: 0,
        eventsToday: 0,
      },
    settings,
    plans,
    events,
    discordConfigured: discord,
    phanom:
      phanom ?? {
        configured: false,
        reachable: false,
        version: null,
        latencyMs: null,
        error: "sem resposta",
        bots: [],
        tokenKind: null,
      },
    adminKeyDefault: usingFallbackAdminKey(),
    driver: driverLabel(),
    version: "1.1.0",
    now: Date.now(),
  });
}
