import { engine } from "./engine";
import { usingDefaultPassword } from "./auth";
import { lastStateError, readData, stateStatus, storageLabel } from "./store";
import type { CredentialInfo, Snapshot } from "./snapshot-types";

function credentialInfo(
  configured: boolean,
  valid: boolean | null,
  username: string | null,
  detail: string,
  checkedAt: number | null
): CredentialInfo {
  return { configured, valid, username, detail, checkedAt };
}

export async function buildSnapshot(): Promise<Snapshot> {
  const data = await readData();
  const snapshot = engine.snapshot();

  return {
    jobs: data.jobs,
    hits: data.hits.slice(0, 300),
    logs: data.logs.slice(0, 120),
    proxies: data.proxies.map(({ password, cooldownUntil, ...rest }) => ({
      ...rest,
      hasPassword: Boolean(password),
    })),
    stats: {
      ...data.stats,
      buckets: data.stats.buckets.slice(-45),
    },
    settings: data.settings,
    credentials: {
      discord: credentialInfo(
        Boolean(data.credentials.discord?.token),
        data.credentials.discord?.valid ?? null,
        data.credentials.discord?.username ?? null,
        "Token de conta para checar usernames do Discord",
        data.credentials.discord?.checkedAt ?? null
      ),
      github: credentialInfo(
        Boolean(data.credentials.github?.token),
        data.credentials.github?.valid ?? null,
        data.credentials.github?.login ?? null,
        "Token pessoal para elevar o limite da API do GitHub",
        data.credentials.github?.checkedAt ?? null
      ),
      twitch: credentialInfo(
        Boolean(data.credentials.twitch?.clientId && data.credentials.twitch?.clientSecret),
        data.credentials.twitch?.valid ?? null,
        data.credentials.twitch?.clientId ?? null,
        "Client ID e secret de um app na Twitch",
        data.credentials.twitch?.checkedAt ?? null
      ),
      telegramBot: credentialInfo(
        Boolean(data.credentials.telegramBot?.token),
        data.credentials.telegramBot?.valid ?? null,
        data.credentials.telegramBot?.username ?? null,
        "Bot do Telegram para alertas alternativos",
        data.credentials.telegramBot?.checkedAt ?? null
      ),
    },
    engine: {
      ...snapshot,
      cooldowns: engine.cooldownsSnapshot(),
    },
    runtime: {
      storage: storageLabel(),
      vercel: Boolean(process.env.VERCEL),
      defaultPassword: usingDefaultPassword(),
      version: "1.0.0",
      uptimeMs: Date.now() - snapshot.startedAt,
      state: { ...stateStatus(), error: lastStateError(), runner: data.runner ?? null },
    },
    now: Date.now(),
  };
}
