import { json } from "@/lib/api";
import { isNextResponse, requireAdmin } from "@/lib/access";
import { listEvents } from "@/lib/cloud/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if (isNextResponse(access)) return access;
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 120), 10), 300);
  return json({ events: await listEvents(limit) });
}
