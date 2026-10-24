import { fail, json, readBody } from "@/lib/api";
import { isNextResponse, requireAdmin } from "@/lib/access";
import { sameOrigin } from "@/lib/cloud/guard";
import { listUsers, setUserBanned } from "@/lib/cloud/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const access = await requireAdmin(request);
  if (isNextResponse(access)) return access;
  if (!sameOrigin(request)) return fail("Origem não permitida", 403);

  const { id } = await params;
  const body = await readBody<{ banned?: boolean }>(request);
  if (typeof body?.banned !== "boolean") return fail("Informe banned: true/false", 422);

  const users = await listUsers();
  const user = users.find((entry) => entry.id === id);
  if (!user) return fail("Usuário não encontrado", 404);

  await setUserBanned(id, body.banned, access.label);
  return json({ ok: true, banned: body.banned });
}
