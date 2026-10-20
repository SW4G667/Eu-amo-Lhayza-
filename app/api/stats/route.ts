import { guard, json } from "@/lib/api";
import { updateData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  await updateData((store) => {
    store.stats = {
      checks: 0,
      available: 0,
      errors: 0,
      rateLimited: 0,
      byPlatform: {},
      buckets: [],
      startedAt: Date.now(),
    };
    store.logs = [];
  });
  return json({ ok: true });
}
