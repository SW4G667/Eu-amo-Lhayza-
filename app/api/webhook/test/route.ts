import { fail, guard, json, readBody } from "@/lib/api";
import { isValidDiscordWebhook, sendDiscordTest } from "@/lib/alerts";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const body = await readBody<{ url?: string }>(request);
  const data = await readData();
  const url = (body?.url ?? data.settings.alerts.discordWebhook ?? "").trim();
  if (!url) return fail("Informe a URL do webhook", 422);
  if (!isValidDiscordWebhook(url)) return fail("A URL precisa ser um webhook do Discord", 422);

  const result = await sendDiscordTest(url);
  if (!result.ok) return fail(result.error ?? "Não foi possível enviar o teste", 502);
  return json({ ok: true });
}
