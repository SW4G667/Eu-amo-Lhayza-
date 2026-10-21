import { json } from "@/lib/api";
import { engine } from "@/lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const header = request.headers.get("x-cron-key");
  const bearer = request.headers.get("authorization");
  return key === secret || header === secret || bearer === `Bearer ${secret}`;
}

async function run(request: Request) {
  if (!authorized(request)) {
    return json({ error: "Chave de cron inválida" }, { status: 401 });
  }
  const result = await engine.tick();
  return json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
