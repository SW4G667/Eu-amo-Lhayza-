import { fail, guard, json, readBody } from "@/lib/api";
import { sendTelegramMessage } from "@/lib/adapters";
import { decryptSecret } from "@/lib/crypto";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const blocked = await guard(request);
  if (blocked) return blocked;
  const body = await readBody<{ token?: string; chatId?: string }>(request);
  const data = await readData();
  const token = (body?.token ?? "").trim() || decryptSecret(data.credentials.telegramBot?.token);
  const chatId = (body?.chatId ?? data.settings.alerts.telegramChatId ?? "").trim();

  if (!token) return fail("Informe o token do bot", 422);
  if (!chatId) return fail("Informe o chat ID", 422);

  const ok = await sendTelegramMessage(
    token,
    chatId,
    "<b>Atalaia</b>\nCanal conectado. Os alertas de usernames livres chegam aqui."
  );
  if (!ok) return fail("O Telegram recusou a mensagem. Confira o token e o chat ID.", 502);
  return json({ ok: true });
}
