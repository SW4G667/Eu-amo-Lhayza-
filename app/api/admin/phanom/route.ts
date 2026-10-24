import { fail, json, readBody } from "@/lib/api";
import { isNextResponse, requireAdmin } from "@/lib/access";
import { sameOrigin } from "@/lib/cloud/guard";
import { logEvent } from "@/lib/cloud/repo";
import { phanomBase, phanomStatus, phanomToken } from "@/lib/phanom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if (isNextResponse(access)) return access;
  const status = await phanomStatus();
  return json({ status, base: phanomBase(), hasToken: Boolean(phanomToken()) });
}

interface ActionBody {
  botId?: string;
  action?: "start" | "stop" | "restart" | "logs";
}

export async function POST(request: Request) {
  const access = await requireAdmin(request);
  if (isNextResponse(access)) return access;
  if (!sameOrigin(request)) return fail("Origem não permitida", 403);

  const body = await readBody<ActionBody>(request);
  if (!body?.botId || !body.action) return fail("Informe bot e ação.", 422);

  const token = phanomToken();
  if (!token) return fail("Defina PHANOM_TOKEN na Vercel para controlar bots.", 503);

  const headers: Record<string, string> = { accept: "application/json" };
  if (token.startsWith("auto_")) headers["X-Automation-Token"] = token;
  else headers.Authorization = `Bearer ${token}`;

  const path =
    body.action === "logs"
      ? `/bots/${encodeURIComponent(body.botId)}/logs`
      : `/bots/${body.action}`;

  const isPost = body.action !== "logs";
  const response = await fetch(`${phanomBase()}${path}`, {
    method: isPost ? "POST" : "GET",
    headers: { ...headers, ...(isPost ? { "Content-Type": "application/json" } : {}) },
    body: isPost ? JSON.stringify({ bot_id: body.botId, id: body.botId }) : undefined,
    cache: "no-store",
  });

  const text = await response.text();
  await logEvent({
    kind: "phanom.action",
    severity: response.ok ? "info" : "warn",
    actor: access.label,
    message: `PhanomCloud ${body.action} em ${body.botId}: HTTP ${response.status}.`,
  });

  if (!response.ok) {
    return fail(`PhanomCloud respondeu ${response.status}: ${text.slice(0, 180)}`, 502);
  }

  try {
    return json(JSON.parse(text));
  } catch {
    return json({ ok: true, raw: text.slice(0, 4000) });
  }
}
