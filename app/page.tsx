import { redirect } from "next/navigation";
import { Gate } from "@/components/gate";
import { getSettings, listUsers } from "@/lib/cloud/repo";
import { DEFAULT_SETTINGS } from "@/lib/cloud/types";
import { discordConfigured } from "@/lib/discord";
import { pageAccess } from "@/lib/page-access";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Entrar · Atalaia",
  description: "Name checker de usernames: Discord, TikTok e mais. Entre com Discord ou com sua key.",
};

export default async function Home() {
  // Qualquer falha de banco aqui não pode derrubar a tela de entrada.
  let access = null;
  try {
    access = await pageAccess();
  } catch {
    access = null;
  }
  if (access) redirect(access.kind === "admin" ? "/admin" : "/painel");

  const [settings, discord, session, users] = await Promise.all([
    getSettings().catch(() => DEFAULT_SETTINGS),
    discordConfigured().catch(() => false),
    readSession("user").catch(() => null),
    listUsers().catch(() => []),
  ]);

  const connected = session
    ? users.find((user) => user.discordId === session.sub) ?? null
    : null;

  return (
    <Gate
      branding={settings.branding}
      discordConfigured={discord}
      discordUser={
        connected
          ? {
              username: connected.globalName || connected.username || connected.discordId,
              banned: connected.banned,
            }
          : null
      }
      maintenance={settings.gate.maintenance}
      welcome={settings.gate.welcome}
      requireDiscord={settings.gate.requireDiscord}
    />
  );
}
