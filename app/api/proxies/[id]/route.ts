import { fail, guard, json, readBody } from "@/lib/api";
import { updateData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const { id } = await params;
  const body = await readBody<{ enabled?: boolean }>(request);
  if (!body || typeof body.enabled !== "boolean") return fail("Informe enabled", 422);

  const found = await updateData((store) => {
    const proxy = store.proxies.find((entry) => entry.id === id);
    if (!proxy) return false;
    proxy.enabled = body.enabled!;
    proxy.cooldownUntil = 0;
    proxy.failures = 0;
    return true;
  });

  if (!found) return fail("Proxy não encontrada", 404);
  return json({ ok: true });
}

export async function DELETE(request: Request, { params }: Params) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const { id } = await params;
  await updateData((store) => {
    store.proxies = store.proxies.filter((entry) => entry.id !== id);
  });
  return json({ ok: true });
}
