import { json } from "@/lib/api";
import { clearSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await clearSession();
  return json({ ok: true });
}

export async function GET() {
  await clearSession();
  return json({ ok: true });
}
