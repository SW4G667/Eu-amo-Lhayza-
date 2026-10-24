import { fail, json, readBody } from "@/lib/api";
import { isNextResponse, requireAdmin } from "@/lib/access";
import { sameOrigin } from "@/lib/cloud/guard";
import { listPlans, logEvent, savePlan } from "@/lib/cloud/repo";
import type { Plan } from "@/lib/cloud/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if (isNextResponse(access)) return access;
  return json({ plans: await listPlans() });
}

export async function POST(request: Request) {
  const access = await requireAdmin(request);
  if (isNextResponse(access)) return access;
  if (!sameOrigin(request)) return fail("Origem não permitida", 403);

  const body = await readBody<Partial<Plan>>(request);
  if (!body?.name) return fail("Informe o nome do plano.", 422);

  const plan = await savePlan({ ...body, name: body.name });
  await logEvent({
    kind: "plan.save",
    severity: "info",
    actor: access.label,
    message: `Plano ${plan.name} salvo (${plan.days} dias, ${plan.maxMonitors} monitores).`,
  });
  return json({ ok: true, plan });
}
