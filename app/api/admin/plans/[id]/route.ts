import { fail, json } from "@/lib/api";
import { isNextResponse, requireAdmin } from "@/lib/access";
import { sameOrigin } from "@/lib/cloud/guard";
import { deletePlan, listLicenses, logEvent } from "@/lib/cloud/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Params) {
  const access = await requireAdmin(request);
  if (isNextResponse(access)) return access;
  if (!sameOrigin(request)) return fail("Origem não permitida", 403);

  const { id } = await params;
  const licenses = await listLicenses();
  const inUse = licenses.filter((license) => license.planId === id && license.status !== "expired").length;
  if (inUse > 0) {
    return fail(`Existem ${inUse} licenças ativas nesse plano. Desative-o em vez de apagar.`, 409);
  }
  await deletePlan(id);
  await logEvent({ kind: "plan.delete", severity: "warn", actor: access.label, message: `Plano ${id} apagado.` });
  return json({ ok: true });
}
