import { httpRequest } from "./http";
import { platformMeta } from "./platforms";
import { scoreName, type ScoreBreakdown } from "./score";
import type { AlertSettings, Hit, Job } from "./types";
import { sendTelegramMessage } from "./adapters";

const WEBHOOK_RE = /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/(?:v\d+\/)?webhooks\/\d+\/[\w-]+$/;

export function isValidDiscordWebhook(url: string): boolean {
  return WEBHOOK_RE.test(url.trim());
}

function mentionContent(mention: string): string {
  const clean = mention.trim();
  if (!clean) return "";
  if (clean === "@here" || clean === "@everyone") return clean;
  if (/^\d{16,22}$/.test(clean)) return `<@&${clean}>`;
  return clean;
}

function colorFor(platform: string): number {
  const hex = platformMeta(platform as never).accent?.replace("#", "") ?? "B8E44A";
  return parseInt(hex, 16);
}

async function postWebhook(url: string, payload: unknown): Promise<{ ok: boolean; error?: string }> {
  if (!isValidDiscordWebhook(url)) return { ok: false, error: "URL de webhook inválida" };
  const body = JSON.stringify(payload);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = await httpRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      timeoutMs: 10000,
    });
    if (res.status >= 200 && res.status < 300) return { ok: true };
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1800));
      continue;
    }
    return { ok: false, error: `Discord respondeu ${res.status}` };
  }
  return { ok: false, error: "Muitas requisições ao webhook" };
}

export function buildHitEmbed(hit: Hit, job?: Job) {
  const meta = platformMeta(hit.platform);
  const breakdown: ScoreBreakdown = scoreName(hit.username);
  return {
    author: { name: "Atalaia · nome disponível" },
    title: `${hit.username} está livre no ${meta.name}`,
    url: meta.claimUrl(hit.username),
    description: `\`${hit.username}\` · ${hit.username.length} caracteres · pontuação **${hit.score}/99**`,
    color: colorFor(hit.platform),
    fields: [
      { name: "Plataforma", value: meta.name, inline: true },
      { name: "Monitor", value: job?.name ?? hit.jobName, inline: true },
      { name: "Latência", value: `${hit.latencyMs} ms`, inline: true },
      {
        name: "Capturar",
        value: `[Abrir ${meta.name}](${meta.claimUrl(hit.username)})`,
        inline: false,
      },
    ],
    footer: { text: `Atalaia · ${breakdown.tier}` },
    timestamp: new Date(hit.foundAt).toISOString(),
  };
}

export async function notifyDiscordHit(
  hit: Hit,
  settings: AlertSettings,
  job?: Job
): Promise<boolean> {
  if (!settings.discordEnabled || !isValidDiscordWebhook(settings.discordWebhook)) return false;
  const mention = mentionContent(settings.mention);
  const result = await postWebhook(settings.discordWebhook, {
    content: mention || undefined,
    username: "Atalaia",
    allowed_mentions: { parse: ["roles", "everyone"] },
    embeds: [buildHitEmbed(hit, job)],
  });
  return result.ok;
}

export async function notifyTelegramHit(
  hit: Hit,
  botToken: string,
  chatId: string
): Promise<boolean> {
  if (!botToken || !chatId) return false;
  const meta = platformMeta(hit.platform);
  const text = [
    `<b>${hit.username}</b> está livre no ${meta.name}`,
    `${hit.username.length} caracteres · pontuação ${hit.score}/99`,
    `Monitor: ${hit.jobName}`,
    `<a href="${meta.claimUrl(hit.username)}">Capturar agora</a>`,
  ].join("\n");
  return sendTelegramMessage(botToken, chatId, text);
}

export async function sendDiscordTest(webhook: string): Promise<{ ok: boolean; error?: string }> {
  if (!isValidDiscordWebhook(webhook)) {
    return { ok: false, error: "A URL precisa ser um webhook do Discord" };
  }
  return postWebhook(webhook, {
    username: "Atalaia",
    embeds: [
      {
        author: { name: "Atalaia" },
        title: "Canal conectado com sucesso",
        description:
          "Este é um alerta de teste. Quando um nome raro ficar livre, o aviso chega aqui com o link de captura.",
        color: 0xb8e44a,
        fields: [
          { name: "Status", value: "Operacional", inline: true },
          { name: "Formato", value: "Embed", inline: true },
        ],
        footer: { text: "Atalaia · monitor de usernames" },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
