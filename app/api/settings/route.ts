import { fail, guard, json, readBody } from "@/lib/api";
import { isValidDiscordWebhook } from "@/lib/alerts";
import { engine } from "@/lib/engine";
import { readData, updateData } from "@/lib/store";
import type { AlertSettings, EngineSettings } from "@/lib/types";
import { clamp } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SettingsBody {
  alerts?: Partial<AlertSettings>;
  engine?: Partial<EngineSettings>;
}

export async function GET(request: Request) {
  const blocked = await guard(request);
  if (blocked) return blocked;
  const data = await readData();
  return json({ settings: data.settings });
}

export async function PATCH(request: Request) {
  const blocked = await guard(request);
  if (blocked) return blocked;
  const body = await readBody<SettingsBody>(request);
  if (!body) return fail("Corpo inválido");

  const data = await readData();
  const alerts = { ...data.settings.alerts, ...(body.alerts ?? {}) };
  const engineSettings = { ...data.settings.engine, ...(body.engine ?? {}) };

  if (alerts.discordWebhook && !isValidDiscordWebhook(alerts.discordWebhook)) {
    return fail("URL de webhook do Discord inválida", 422);
  }
  if (typeof alerts.discordEnabled !== "boolean") return fail("discordEnabled inválido", 422);

  engineSettings.jitterPct = clamp(Number(engineSettings.jitterPct) || 0, 0, 80);
  engineSettings.timeoutMs = clamp(Number(engineSettings.timeoutMs) || 12000, 3000, 60000);
  engineSettings.maxConcurrency = clamp(Number(engineSettings.maxConcurrency) || 4, 1, 12);
  const userAgent = String(engineSettings.userAgent ?? "").trim();
  engineSettings.userAgent =
    userAgent.length >= 10 ? userAgent.slice(0, 400) : data.settings.engine.userAgent;
  engineSettings.paused = Boolean(engineSettings.paused);
  alerts.mention = String(alerts.mention ?? "").slice(0, 80);
  alerts.telegramChatId = String(alerts.telegramChatId ?? "").slice(0, 80).trim();
  alerts.telegramEnabled = Boolean(alerts.telegramEnabled);

  await updateData((store) => {
    store.settings.alerts = alerts;
    store.settings.engine = engineSettings;
  });

  await engine.sync();
  return json({ settings: { alerts, engine: engineSettings } });
}
