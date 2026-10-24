import { json } from "@/lib/api";
import { isNextResponse, requireAdmin } from "@/lib/access";
import { listLicenses, listUsers } from "@/lib/cloud/repo";
import { adminLicense } from "@/lib/cloud/serialize";
import { avatarUrl } from "@/lib/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if (isNextResponse(access)) return access;

  const [users, licenses] = await Promise.all([listUsers(), listLicenses()]);
  const byId = new Map(licenses.map((license) => [license.id, license]));

  return json({
    users: users.map((user) => {
      const license = user.licenseId ? byId.get(user.licenseId) ?? null : null;
      return {
        ...user,
        avatarUrl: avatarUrl({ id: user.discordId, avatar: user.avatar }, 64),
        license: license ? adminLicense(license) : null,
      };
    }),
  });
}
