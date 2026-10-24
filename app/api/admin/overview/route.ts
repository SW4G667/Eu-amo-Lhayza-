import { json } from "@/lib/api";
import { isNextResponse, requireAdmin } from "@/lib/access";
import { usingFallbackAdminKey } from "@/lib/cloud/admin-key";
import { driverLabel } from "@/lib/cloud/db";
import { getSettings, listEvents, listPlans, overview } from "@/lib/cloud/repo";
import { discordConfigured } from "@/lib/discord";
import { phanomStatus } from "@/lib/phanom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if (isNextResponse(access)) return access;

  const [summary, settings, plans, events, discord, phanom] = await Promise.all([
    overview(),
    getSettings(),
    listPlans(),
    listEvents(40),
    discordConfigured(),
    phanomStatus(),
  ]);

  return json({
    summary,
    settings,
    plans,
    events,
    discordConfigured: discord,
    phanom,
    adminKeyDefault: usingFallbackAdminKey(),
    driver: driverLabel(),
    version: "1.1.0",
    now: Date.now(),
  });
}
