import { fail, json, readBody } from "@/lib/api";
import { isNextResponse, requireAdmin } from "@/lib/access";
import { sameOrigin } from "@/lib/cloud/guard";
import { listPlatforms, setPlatform } from "@/lib/cloud/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if (isNextResponse(access)) return access;
  return json({ platforms: await listPlatforms() });
}

interface PlatformBody {
  id?: string;
  enabled?: boolean;
  note?: string;
}

export async function PATCH(request: Request) {
  const access = await requireAdmin(request);
  if (isNextResponse(access)) return access;
  if (!sameOrigin(request)) return fail("Origem não permitida", 403);

  const body = await readBody<PlatformBody>(request);
  if (!body?.id) return fail("Informe a plataforma.", 422);

  await setPlatform(
    body.id,
    { enabled: body.enabled, note: body.note },
    access.label
  );
  return json({ ok: true, platforms: await listPlatforms() });
}
