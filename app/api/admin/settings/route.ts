import { fail, json, readBody } from "@/lib/api";
import { isNextResponse, requireAdmin } from "@/lib/access";
import { sameOrigin } from "@/lib/cloud/guard";
import { getSettings, logEvent, setSetting } from "@/lib/cloud/repo";
import { DEFAULT_SETTINGS, type SettingsKey } from "@/lib/cloud/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if (isNextResponse(access)) return access;
  return json({ settings: await getSettings() });
}

interface SettingsBody {
  key?: SettingsKey;
  value?: Record<string, unknown>;
}

export async function PATCH(request: Request) {
  const access = await requireAdmin(request);
  if (isNextResponse(access)) return access;
  if (!sameOrigin(request)) return fail("Origem não permitida", 403);

  const body = await readBody<SettingsBody>(request);
  if (!body?.key || !(body.key in DEFAULT_SETTINGS)) return fail("Configuração inválida", 422);
  if (!body.value || typeof body.value !== "object") return fail("Valores inválidos", 422);

  const settings = await setSetting(body.key, body.value);
  await logEvent({
    kind: "settings.update",
    severity: "info",
    actor: access.label,
    message: `Configuração ${body.key} atualizada.`,
    meta: { key: body.key },
  });
  return json({ ok: true, settings });
}
