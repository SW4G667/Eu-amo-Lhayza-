import { fail, json, readBody } from "@/lib/api";
import { isNextResponse, requireAdmin } from "@/lib/access";
import { sameOrigin } from "@/lib/cloud/guard";
import {
  deleteLicense,
  extendLicense,
  getLicenseById,
  revealLicenseCode,
  revokeLicense,
  suspendLicense,
  updateLicense,
} from "@/lib/cloud/repo";
import { adminLicense } from "@/lib/cloud/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

interface ActionBody {
  action?: "revoke" | "suspend" | "resume" | "extend" | "reveal" | "update";
  days?: number;
  reason?: string;
  note?: string;
  status?: string;
}

export async function PATCH(request: Request, { params }: Params) {
  const access = await requireAdmin(request);
  if (isNextResponse(access)) return access;
  if (!sameOrigin(request)) return fail("Origem não permitida", 403);

  const { id } = await params;
  const license = await getLicenseById(id);
  if (!license) return fail("Licença não encontrada", 404);

  const body = (await readBody<ActionBody>(request)) ?? {};

  switch (body.action) {
    case "revoke":
      return json({ ok: true, license: adminLicense((await revokeLicense(id, body.reason || "", access.label))!) });
    case "suspend":
      return json({ ok: true, license: adminLicense((await suspendLicense(id, access.label, true))!) });
    case "resume":
      return json({ ok: true, license: adminLicense((await suspendLicense(id, access.label, false))!) });
    case "extend":
      return json({ ok: true, license: adminLicense((await extendLicense(id, Number(body.days ?? 30), access.label))!) });
    case "reveal": {
      const code = await revealLicenseCode(id, access.label);
      if (!code) return fail("Não foi possível decifrar o código desta licença.", 422);
      return json({ ok: true, code });
    }
    case "update": {
      const updated = await updateLicense(id, {
        note: body.note ?? license.note,
      });
      if (!updated) return fail("Licença não encontrada", 404);
      return json({ ok: true, license: adminLicense(updated) });
    }
    default:
      return fail("Ação desconhecida", 422);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const access = await requireAdmin(request);
  if (isNextResponse(access)) return access;
  if (!sameOrigin(request)) return fail("Origem não permitida", 403);
  const { id } = await params;
  const license = await getLicenseById(id);
  if (!license) return fail("Licença não encontrada", 404);
  await deleteLicense(id, access.label);
  return json({ ok: true });
}
