import { json } from "@/lib/api";
import { isNextResponse, requireAccess } from "@/lib/access";
import { ensureEngineStarted } from "@/lib/engine";
import { buildSnapshot } from "@/lib/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireAccess(request);
  if (isNextResponse(access)) return access;
  await ensureEngineStarted();
  const snapshot = await buildSnapshot(access);
  return json(snapshot);
}
