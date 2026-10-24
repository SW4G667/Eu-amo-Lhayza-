import { redirect } from "next/navigation";
import { Gate } from "@/components/gate";
import { getSettings, listPlans, listPlatforms, listUsers } from "@/lib/cloud/repo";
import { discordConfigured } from "@/lib/discord";
import { pageAccess } from "@/lib/page-access";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Entrar · Atalaia",
  description: "Name checker de usernames: Discord, TikTok e mais. Entre com Discord ou com sua key.",
};

export default async function Home() {
  const access = await pageAccess();
  if (access) redirect(access.kind === "admin" ? "/admin" : "/painel");

  const [settings, platforms, plans, discord, session, users] = await Promise.all([
    getSettings(),
    listPlatforms(),
    listPlans(),
    discordConfigured(),
    readSession("user"),
    listUsers(),
  ]);

  const connected = session
    ? users.find((user) => user.discordId === session.sub) ?? null
    : null;

  return (
    <Gate
      branding={settings.branding}
      platforms={platforms}
      plans={plans
        .filter((plan) => plan.active)
        .map((plan) => ({
          id: plan.id,
          name: plan.name,
          days: plan.days,
          maxMonitors: plan.maxMonitors,
          priceCents: plan.priceCents,
        }))}
      discordConfigured={discord}
      maintenance={settings.gate.maintenance}
      requireDiscord={settings.gate.requireDiscord}
      welcome={settings.gate.welcome}
      discordUser={
        connected
          ? {
              username: connected.globalName || connected.username || connected.discordId,
              banned: connected.banned,
            }
          : null
      }
    />
  );
}
