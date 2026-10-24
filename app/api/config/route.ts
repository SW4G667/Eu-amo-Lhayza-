import { json } from "@/lib/api";
import { usingFallbackAdminKey } from "@/lib/cloud/admin-key";
import { getSettings, listPlatforms, listPlans } from "@/lib/cloud/repo";
import { discordConfigured } from "@/lib/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Configuração pública usada pela tela de entrada (sem sessão). */
export async function GET() {
  const [settings, platforms, plans, discord] = await Promise.all([
    getSettings(),
    listPlatforms(),
    listPlans(),
    discordConfigured(),
  ]);

  return json({
    branding: settings.branding,
    gate: settings.gate,
    platforms,
    plans: plans
      .filter((plan) => plan.active)
      .map((plan) => ({
        id: plan.id,
        name: plan.name,
        days: plan.days,
        maxMonitors: plan.maxMonitors,
        priceCents: plan.priceCents,
      })),
    discordConfigured: discord,
    adminKeyDefault: usingFallbackAdminKey(),
  });
}
