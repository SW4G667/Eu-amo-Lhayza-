import { json } from "@/lib/api";
import { usingFallbackAdminKey } from "@/lib/cloud/admin-key";
import { discordConfigured } from "@/lib/discord";
import { getLicenseForDiscord, getSettings, listPlatforms, listUsers } from "@/lib/cloud/repo";
import { publicLicense } from "@/lib/cloud/serialize";
import { resolveAccess } from "@/lib/access";
import { avatarUrl } from "@/lib/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [settings, platforms, discord] = await Promise.all([
    getSettings(),
    listPlatforms(),
    discordConfigured(),
  ]);

  const base = {
    platforms,
    gate: settings.gate,
    branding: settings.branding,
    discordConfigured: discord,
    adminKeyDefault: usingFallbackAdminKey(),
  };

  const access = await resolveAccess(request);
  if (!access) {
    return json({ ...base, kind: null });
  }

  if (access.kind === "admin") {
    return json({
      ...base,
      kind: "admin",
      user: null,
      license: null,
    });
  }

  const users = await listUsers();
  const user = users.find((entry) => entry.discordId === access.discordId) ?? null;
  const license = await getLicenseForDiscord(access.discordId ?? "");

  return json({
    ...base,
    kind: "user",
    user: user
      ? {
          discordId: user.discordId,
          username: user.username,
          globalName: user.globalName,
          avatar: avatarUrl({ id: user.discordId, avatar: user.avatar }),
          banned: user.banned,
        }
      : null,
    license: publicLicense(license),
  });
}
