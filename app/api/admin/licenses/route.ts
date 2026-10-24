import { fail, json, readBody } from "@/lib/api";
import { isNextResponse, requireAdmin } from "@/lib/access";
import { sameOrigin } from "@/lib/cloud/guard";
import { createLicenses, expireDueLicenses, listLicenses, logEvent } from "@/lib/cloud/repo";
import { adminLicense } from "@/lib/cloud/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if (isNextResponse(access)) return access;
  await expireDueLicenses();
  const licenses = await listLicenses();
  return json({
    licenses: licenses
      .map(adminLicense)
      .sort((a, b) => b.createdAt - a.createdAt),
    counters: {
      total: licenses.length,
      pending: licenses.filter((item) => item.status === "pending").length,
      active: licenses.filter((item) => item.status === "active").length,
      expired: licenses.filter((item) => item.status === "expired").length,
      revoked: licenses.filter((item) => item.status === "revoked").length,
      suspended: licenses.filter((item) => item.status === "suspended").length,
    },
  });
}

interface CreateBody {
  quantity?: number;
  planId?: string;
  days?: number;
  note?: string;
  maxActivations?: number;
}

export async function POST(request: Request) {
  const access = await requireAdmin(request);
  if (isNextResponse(access)) return access;
  if (!sameOrigin(request)) return fail("Origem não permitida", 403);

  const body = await readBody<CreateBody>(request);
  if (!body?.planId) return fail("Escolha um plano.", 422);

  const { licenses, codes } = await createLicenses({
    quantity: Number(body.quantity ?? 1),
    planId: body.planId,
    days: body.days,
    note: body.note,
    maxActivations: body.maxActivations,
    createdBy: access.label,
  });

  await logEvent({
    kind: "license.create",
    severity: "success",
    actor: access.label,
    message: `${licenses.length} key(s) geradas no plano ${body.planId}.`,
    meta: { planId: body.planId, quantity: licenses.length },
  });

  return json({
    ok: true,
    codes,
    licenses: licenses.map(adminLicense),
  });
}
