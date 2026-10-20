import { fail, guard, json, readBody } from "@/lib/api";
import { notifyDiscordHit, notifyTelegramHit } from "@/lib/alerts";
import { decryptSecret } from "@/lib/crypto";
import { readData, updateData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  await updateData((data) => {
    if (id) {
      data.hits = data.hits.filter((hit) => hit.id !== id);
      return;
    }
    data.hits = [];
    for (const job of data.jobs) job.found = 0;
  });

  return json({ ok: true });
}

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const body = await readBody<{ id?: string }>(request);
  if (!body?.id) return fail("Informe o registro", 422);

  const data = await readData();
  const hit = data.hits.find((entry) => entry.id === body.id);
  if (!hit) return fail("Registro não encontrado", 404);
  const job = data.jobs.find((entry) => entry.id === hit.jobId);

  const alerts = data.settings.alerts;
  const telegramToken = decryptSecret(data.credentials.telegramBot?.token);
  let sent = false;
  if (alerts.discordEnabled) sent = await notifyDiscordHit(hit, alerts, job);
  if (alerts.telegramEnabled && telegramToken && alerts.telegramChatId) {
    const ok = await notifyTelegramHit(hit, telegramToken, alerts.telegramChatId);
    sent = sent || ok;
  }

  if (!sent) {
    return fail(
      "Nenhum canal conseguiu receber o alerta. Verifique o webhook e o bot do Telegram.",
      502
    );
  }

  await updateData((store) => {
    const entry = store.hits.find((item) => item.id === hit.id);
    if (entry) entry.notified = true;
  });

  return json({ ok: true });
}
