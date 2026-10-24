import { fail, json, readBody } from "@/lib/api";
import { isNextResponse, ownerOf, requireAccess } from "@/lib/access";
import { notifyDiscordHit, notifyTelegramHit } from "@/lib/alerts";
import { decryptSecret } from "@/lib/crypto";
import { readData, updateData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ownedJobIds(data: Awaited<ReturnType<typeof readData>>, owner: string, admin: boolean): Set<string> {
  if (admin) return new Set(data.jobs.map((job) => job.id));
  return new Set(data.jobs.filter((job) => job.owner === owner).map((job) => job.id));
}

export async function DELETE(request: Request) {
  const access = await requireAccess(request);
  if (isNextResponse(access)) return access;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const owner = ownerOf(access);
  const admin = access.kind === "admin";

  await updateData((data) => {
    const mine = ownedJobIds(data, owner, admin);
    if (id) {
      const hit = data.hits.find((entry) => entry.id === id);
      if (!hit || !mine.has(hit.jobId)) return;
      data.hits = data.hits.filter((entry) => entry.id !== id);
      const job = data.jobs.find((entry) => entry.id === hit.jobId);
      if (job) job.found = Math.max(0, job.found - 1);
      return;
    }
    data.hits = data.hits.filter((entry) => !mine.has(entry.jobId));
    for (const job of data.jobs) {
      if (mine.has(job.id)) job.found = 0;
    }
  });

  return json({ ok: true });
}

export async function POST(request: Request) {
  const access = await requireAccess(request);
  if (isNextResponse(access)) return access;

  const body = await readBody<{ id?: string }>(request);
  if (!body?.id) return fail("Informe o registro", 422);

  const data = await readData();
  const hit = data.hits.find((entry) => entry.id === body.id);
  if (!hit) return fail("Registro não encontrado", 404);
  if (access.kind === "user" && !ownedJobIds(data, ownerOf(access), false).has(hit.jobId)) {
    return fail("Esse registro não é seu.", 403);
  }

  const job = data.jobs.find((entry) => entry.id === hit.jobId);
  const alerts = data.settings.alerts;
  const telegramToken = decryptSecret(data.credentials.telegramBot?.token);
  let sent = false;

  sent = (await notifyDiscordHit(hit, alerts, job)) || sent;
  if (telegramToken) {
    sent = (await notifyTelegramHit(hit, telegramToken, alerts.telegramChatId ?? "")) || sent;
  }

  if (!sent) return fail("Nenhum canal de alerta aceitou o envio. Confira webhook e Telegram.", 502);

  await updateData((store) => {
    const target = store.hits.find((entry) => entry.id === hit.id);
    if (target) target.notified = true;
  });

  return json({ ok: true });
}
