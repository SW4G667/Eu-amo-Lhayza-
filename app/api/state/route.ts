import { guard, json } from "@/lib/api";
import { ensureEngineStarted } from "@/lib/engine";
import { buildSnapshot } from "@/lib/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  await ensureEngineStarted();
  const snapshot = await buildSnapshot();
  return json(snapshot);
}
