import { httpRequest, parseRetryAfter } from "./http";
import type { CheckStatus, PlatformId, ProxyRecord } from "./types";

export interface CheckContext {
  userAgent: string;
  timeoutMs: number;
  proxy: { record: ProxyRecord; password: string } | null;
  discordToken: string;
  githubToken: string;
  twitchClientId: string;
  twitchClientSecret: string;
}

export interface CheckOutcome {
  status: CheckStatus;
  detail: string;
  latencyMs: number;
  proxyLabel: string | null;
  retryAfterMs?: number;
  credentialInvalid?: boolean;
}

function outcome(
  status: CheckStatus,
  detail: string,
  latencyMs = 0,
  proxyLabel: string | null = null,
  extra: Partial<CheckOutcome> = {}
): CheckOutcome {
  return { status, detail, latencyMs, proxyLabel, ...extra };
}

const SUPER_PROPERTIES = Buffer.from(
  JSON.stringify({
    os: "Windows",
    browser: "Chrome",
    device: "",
    system_locale: "pt-BR",
    browser_user_agent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    browser_version: "131.0.0.0",
    os_version: "10",
    referrer: "",
    referring_domain: "",
    search_engine: "",
    referrer_current: "",
    referring_domain_current: "",
    release_channel: "stable",
    client_build_number: 354000,
    client_event_source: null,
  })
).toString("base64");

async function checkDiscord(name: string, ctx: CheckContext): Promise<CheckOutcome> {
  if (!ctx.discordToken) {
    return outcome("unconfigured", "Nenhum token do Discord configurado");
  }
  const res = await httpRequest("https://discord.com/api/v9/unique-username/username-attempt", {
    method: "POST",
    headers: {
      Authorization: ctx.discordToken,
      "Content-Type": "application/json",
      "X-Discord-Locale": "pt-BR",
      "X-Super-Properties": SUPER_PROPERTIES,
      Origin: "https://discord.com",
      Referer: "https://discord.com/channels/@me",
      Accept: "*/*",
    },
    body: JSON.stringify({ username: name }),
    timeoutMs: ctx.timeoutMs,
    proxy: ctx.proxy,
    userAgent: ctx.userAgent,
  });

  if (res.networkError) {
    return outcome("error", `Falha de rede: ${res.networkError}`, res.latencyMs, res.proxyLabel);
  }
  if (res.status === 429) {
    return outcome("rate_limited", "Discord pediu pausa (429)", res.latencyMs, res.proxyLabel, {
      retryAfterMs: parseRetryAfter(res.headers, res.body),
    });
  }
  if (res.status === 401 || res.status === 403) {
    return outcome("unconfigured", "Token do Discord inválido ou expirado", res.latencyMs, res.proxyLabel, {
      credentialInvalid: true,
    });
  }
  if (res.status === 400) {
    let detail = "Nome recusado pelo Discord";
    try {
      const parsed = JSON.parse(res.body) as {
        username?: string[];
        errors?: { username?: { _errors?: { message?: string }[] } };
      };
      detail =
        parsed.errors?.username?._errors?.[0]?.message ??
        parsed.username?.[0] ??
        detail;
    } catch {
      /* mantém detalhe padrão */
    }
    return outcome("error", detail, res.latencyMs, res.proxyLabel);
  }
  if (res.status !== 200) {
    return outcome("error", `Resposta inesperada (${res.status})`, res.latencyMs, res.proxyLabel);
  }
  try {
    const parsed = JSON.parse(res.body) as { taken?: boolean };
    if (parsed.taken === false) {
      return outcome("available", "Livre no Discord", res.latencyMs, res.proxyLabel);
    }
    if (parsed.taken === true) {
      return outcome("taken", "Em uso", res.latencyMs, res.proxyLabel);
    }
  } catch {
    /* corpo inesperado */
  }
  return outcome("error", "Resposta sem campo 'taken'", res.latencyMs, res.proxyLabel);
}

async function checkInstagram(name: string, ctx: CheckContext): Promise<CheckOutcome> {
  const res = await httpRequest(
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(name)}`,
    {
      headers: {
        "x-ig-app-id": "936619743392459",
        "x-requested-with": "XMLHttpRequest",
        accept: "*/*",
        referer: `https://www.instagram.com/${name}/`,
        "sec-fetch-site": "same-origin",
      },
      timeoutMs: ctx.timeoutMs,
      proxy: ctx.proxy,
      userAgent: ctx.userAgent,
    }
  );
  if (res.networkError) {
    return outcome("error", `Falha de rede: ${res.networkError}`, res.latencyMs, res.proxyLabel);
  }
  if (res.status === 404) {
    return outcome("available", "Perfil não encontrado", res.latencyMs, res.proxyLabel);
  }
  if (res.status === 429 || res.status === 401) {
    return outcome("rate_limited", "Instagram limitou as requisições", res.latencyMs, res.proxyLabel, {
      retryAfterMs: parseRetryAfter(res.headers, res.body),
    });
  }
  if (res.status !== 200) {
    return outcome("error", `Resposta inesperada (${res.status})`, res.latencyMs, res.proxyLabel);
  }
  try {
    const parsed = JSON.parse(res.body) as { data?: { user?: { username?: string } | null } };
    const user = parsed.data?.user ?? null;
    if (!user) return outcome("available", "Perfil não encontrado", res.latencyMs, res.proxyLabel);
    if (user.username && user.username.toLowerCase() === name) {
      return outcome("taken", "Perfil em uso", res.latencyMs, res.proxyLabel);
    }
    return outcome("taken", "Perfil em uso", res.latencyMs, res.proxyLabel);
  } catch {
    return outcome("error", "Instagram devolveu HTML em vez de JSON", res.latencyMs, res.proxyLabel);
  }
}

async function checkTikTok(name: string, ctx: CheckContext): Promise<CheckOutcome> {
  const res = await httpRequest(`https://www.tiktok.com/@${encodeURIComponent(name)}`, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
    },
    timeoutMs: ctx.timeoutMs,
    proxy: ctx.proxy,
    userAgent: ctx.userAgent,
  });
  if (res.networkError) {
    return outcome("error", `Falha de rede: ${res.networkError}`, res.latencyMs, res.proxyLabel);
  }
  if (res.status === 404) {
    return outcome("available", "Conta não encontrada", res.latencyMs, res.proxyLabel);
  }
  if (res.status === 403 || res.status === 429) {
    return outcome("rate_limited", "TikTok bloqueou a requisição", res.latencyMs, res.proxyLabel, {
      retryAfterMs: parseRetryAfter(res.headers, res.body),
    });
  }
  if (res.status !== 200) {
    return outcome("error", `Resposta inesperada (${res.status})`, res.latencyMs, res.proxyLabel);
  }
  const body = res.body;
  if (
    body.includes('"statusCode":10221') ||
    body.includes('"statusCode": 10221') ||
    body.includes("Couldn&#39;t find this account") ||
    body.includes("Couldn't find this account")
  ) {
    return outcome("available", "Conta não encontrada", res.latencyMs, res.proxyLabel);
  }
  if (body.includes("captcha") || body.includes("verify_")) {
    return outcome("rate_limited", "TikTok pediu verificação", res.latencyMs, res.proxyLabel);
  }
  if (new RegExp(`"uniqueId":"${name}"`, "i").test(body) || body.includes("userInfo")) {
    return outcome("taken", "Conta em uso", res.latencyMs, res.proxyLabel);
  }
  return outcome("taken", "Página de perfil respondeu", res.latencyMs, res.proxyLabel);
}

async function checkGithub(name: string, ctx: CheckContext): Promise<CheckOutcome> {
  const res = await httpRequest(`https://api.github.com/users/${encodeURIComponent(name)}`, {
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(ctx.githubToken ? { authorization: `Bearer ${ctx.githubToken}` } : {}),
    },
    timeoutMs: ctx.timeoutMs,
    proxy: ctx.proxy,
    userAgent: ctx.userAgent,
  });
  if (res.networkError) {
    return outcome("error", `Falha de rede: ${res.networkError}`, res.latencyMs, res.proxyLabel);
  }
  if (res.status === 200) return outcome("taken", "Perfil em uso", res.latencyMs, res.proxyLabel);
  if (res.status === 404) return outcome("available", "Username livre", res.latencyMs, res.proxyLabel);
  if (res.status === 401) {
    return outcome("error", "Token do GitHub inválido", res.latencyMs, res.proxyLabel, {
      credentialInvalid: true,
    });
  }
  if (res.status === 403 || res.status === 429) {
    return outcome("rate_limited", "Limite de requisições do GitHub", res.latencyMs, res.proxyLabel, {
      retryAfterMs: parseRetryAfter(res.headers, res.body),
    });
  }
  return outcome("error", `Resposta inesperada (${res.status})`, res.latencyMs, res.proxyLabel);
}

async function checkTelegram(name: string, ctx: CheckContext): Promise<CheckOutcome> {
  const res = await httpRequest(`https://t.me/${encodeURIComponent(name)}`, {
    headers: { accept: "text/html" },
    timeoutMs: ctx.timeoutMs,
    proxy: ctx.proxy,
    userAgent: ctx.userAgent,
  });
  if (res.networkError) {
    return outcome("error", `Falha de rede: ${res.networkError}`, res.latencyMs, res.proxyLabel);
  }
  if (res.status === 404) return outcome("available", "Username livre", res.latencyMs, res.proxyLabel);
  if (res.status !== 200) {
    return outcome("error", `Resposta inesperada (${res.status})`, res.latencyMs, res.proxyLabel);
  }
  const ogTitle = /<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i.exec(res.body)?.[1] ?? "";
  const placeholder = new RegExp(`^Telegram:\\s*Contact\\s*@${name}$`, "i");
  if (ogTitle && placeholder.test(ogTitle.trim())) {
    return outcome("available", "Username livre", res.latencyMs, res.proxyLabel);
  }
  if (ogTitle && !/^Telegram:/i.test(ogTitle)) {
    return outcome("taken", "Perfil em uso", res.latencyMs, res.proxyLabel);
  }
  return outcome("error", "Página do Telegram em formato inesperado", res.latencyMs, res.proxyLabel);
}

let twitchToken: { token: string; expiresAt: number } | null = null;

async function twitchAppToken(ctx: CheckContext): Promise<string | null> {
  if (twitchToken && twitchToken.expiresAt > Date.now() + 60000) return twitchToken.token;
  const url =
    "https://id.twitch.tv/oauth2/token" +
    `?client_id=${encodeURIComponent(ctx.twitchClientId)}` +
    `&client_secret=${encodeURIComponent(ctx.twitchClientSecret)}` +
    "&grant_type=client_credentials";
  const res = await httpRequest(url, {
    method: "POST",
    timeoutMs: ctx.timeoutMs,
    proxy: ctx.proxy,
    userAgent: ctx.userAgent,
  });
  if (res.status !== 200) return null;
  try {
    const parsed = JSON.parse(res.body) as { access_token?: string; expires_in?: number };
    if (!parsed.access_token) return null;
    twitchToken = {
      token: parsed.access_token,
      expiresAt: Date.now() + (parsed.expires_in ?? 3600) * 1000,
    };
    return twitchToken.token;
  } catch {
    return null;
  }
}

async function checkTwitch(name: string, ctx: CheckContext): Promise<CheckOutcome> {
  if (!ctx.twitchClientId || !ctx.twitchClientSecret) {
    return outcome("unconfigured", "Configure client ID e secret da Twitch");
  }
  const token = await twitchAppToken(ctx);
  if (!token) return outcome("error", "Não foi possível autenticar na Twitch");
  const res = await httpRequest(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(name)}`,
    {
      headers: {
        "Client-Id": ctx.twitchClientId,
        Authorization: `Bearer ${token}`,
      },
      timeoutMs: ctx.timeoutMs,
      proxy: ctx.proxy,
      userAgent: ctx.userAgent,
    }
  );
  if (res.networkError) {
    return outcome("error", `Falha de rede: ${res.networkError}`, res.latencyMs, res.proxyLabel);
  }
  if (res.status === 401) {
    twitchToken = null;
    return outcome("error", "Credenciais da Twitch inválidas", res.latencyMs, res.proxyLabel, {
      credentialInvalid: true,
    });
  }
  if (res.status === 429) {
    return outcome("rate_limited", "Limite da API da Twitch", res.latencyMs, res.proxyLabel);
  }
  if (res.status !== 200) {
    return outcome("error", `Resposta inesperada (${res.status})`, res.latencyMs, res.proxyLabel);
  }
  try {
    const parsed = JSON.parse(res.body) as { data?: unknown[] };
    if ((parsed.data ?? []).length > 0) {
      return outcome("taken", "Canal em uso", res.latencyMs, res.proxyLabel);
    }
    return outcome("available", "Login livre", res.latencyMs, res.proxyLabel);
  } catch {
    return outcome("error", "Resposta inválida da Twitch", res.latencyMs, res.proxyLabel);
  }
}

async function checkSteam(name: string, ctx: CheckContext): Promise<CheckOutcome> {
  const res = await httpRequest(
    `https://steamcommunity.com/id/${encodeURIComponent(name)}/?xml=1`,
    { headers: { accept: "text/xml" }, timeoutMs: ctx.timeoutMs, proxy: ctx.proxy, userAgent: ctx.userAgent }
  );
  if (res.networkError) {
    return outcome("error", `Falha de rede: ${res.networkError}`, res.latencyMs, res.proxyLabel);
  }
  if (res.status === 404 || res.body.includes("<error>")) {
    return outcome("available", "Perfil não encontrado", res.latencyMs, res.proxyLabel);
  }
  if (res.status === 200 && res.body.includes("<steamID64>")) {
    return outcome("taken", "Perfil em uso", res.latencyMs, res.proxyLabel);
  }
  if (res.status === 429) {
    return outcome("rate_limited", "Steam limitou as requisições", res.latencyMs, res.proxyLabel);
  }
  return outcome("error", `Resposta inesperada (${res.status})`, res.latencyMs, res.proxyLabel);
}

async function checkRoblox(name: string, ctx: CheckContext): Promise<CheckOutcome> {
  const res = await httpRequest("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ usernames: [name], excludeBannedUsers: false }),
    timeoutMs: ctx.timeoutMs,
    proxy: ctx.proxy,
    userAgent: ctx.userAgent,
  });
  if (res.networkError) {
    return outcome("error", `Falha de rede: ${res.networkError}`, res.latencyMs, res.proxyLabel);
  }
  if (res.status === 429) {
    return outcome("rate_limited", "Roblox limitou as requisições", res.latencyMs, res.proxyLabel);
  }
  if (res.status !== 200) {
    return outcome("error", `Resposta inesperada (${res.status})`, res.latencyMs, res.proxyLabel);
  }
  try {
    const parsed = JSON.parse(res.body) as { data?: unknown[] };
    if ((parsed.data ?? []).length > 0) {
      return outcome("taken", "Username em uso", res.latencyMs, res.proxyLabel);
    }
    return outcome("available", "Username livre", res.latencyMs, res.proxyLabel);
  } catch {
    return outcome("error", "Resposta inválida da Roblox", res.latencyMs, res.proxyLabel);
  }
}

async function checkYoutube(name: string, ctx: CheckContext): Promise<CheckOutcome> {
  const res = await httpRequest(`https://www.youtube.com/@${encodeURIComponent(name)}`, {
    headers: { accept: "text/html", "accept-language": "en-US,en;q=0.9" },
    timeoutMs: ctx.timeoutMs,
    proxy: ctx.proxy,
    userAgent: ctx.userAgent,
  });
  if (res.networkError) {
    return outcome("error", `Falha de rede: ${res.networkError}`, res.latencyMs, res.proxyLabel);
  }
  if (res.status === 404) return outcome("available", "Handle livre", res.latencyMs, res.proxyLabel);
  if (res.status === 429 || res.status === 403) {
    return outcome("rate_limited", "YouTube bloqueou a requisição", res.latencyMs, res.proxyLabel);
  }
  if (res.status === 200) return outcome("taken", "Handle em uso", res.latencyMs, res.proxyLabel);
  return outcome("error", `Resposta inesperada (${res.status})`, res.latencyMs, res.proxyLabel);
}

async function checkReddit(name: string, ctx: CheckContext): Promise<CheckOutcome> {
  const res = await httpRequest(
    `https://www.reddit.com/user/${encodeURIComponent(name)}/about.json`,
    { headers: { accept: "application/json" }, timeoutMs: ctx.timeoutMs, proxy: ctx.proxy, userAgent: ctx.userAgent }
  );
  if (res.networkError) {
    return outcome("error", `Falha de rede: ${res.networkError}`, res.latencyMs, res.proxyLabel);
  }
  if (res.status === 404) return outcome("available", "Username livre", res.latencyMs, res.proxyLabel);
  if (res.status === 403 || res.status === 429) {
    return outcome("rate_limited", "Reddit bloqueou a requisição", res.latencyMs, res.proxyLabel);
  }
  if (res.status === 200) {
    try {
      const parsed = JSON.parse(res.body) as { kind?: string };
      if (parsed.kind === "t2") return outcome("taken", "Usuário em uso", res.latencyMs, res.proxyLabel);
    } catch {
      /* corpo inesperado */
    }
    return outcome("taken", "Usuário em uso", res.latencyMs, res.proxyLabel);
  }
  return outcome("error", `Resposta inesperada (${res.status})`, res.latencyMs, res.proxyLabel);
}

async function checkPinterest(name: string, ctx: CheckContext): Promise<CheckOutcome> {
  const res = await httpRequest(`https://www.pinterest.com/${encodeURIComponent(name)}/`, {
    headers: { accept: "text/html" },
    timeoutMs: ctx.timeoutMs,
    proxy: ctx.proxy,
    userAgent: ctx.userAgent,
  });
  if (res.networkError) {
    return outcome("error", `Falha de rede: ${res.networkError}`, res.latencyMs, res.proxyLabel);
  }
  if (res.status === 404) return outcome("available", "Perfil não encontrado", res.latencyMs, res.proxyLabel);
  if (res.status === 429 || res.status === 403) {
    return outcome("rate_limited", "Pinterest bloqueou a requisição", res.latencyMs, res.proxyLabel);
  }
  if (res.status === 200) return outcome("taken", "Perfil em uso", res.latencyMs, res.proxyLabel);
  return outcome("error", `Resposta inesperada (${res.status})`, res.latencyMs, res.proxyLabel);
}

export async function checkName(
  platform: PlatformId,
  name: string,
  ctx: CheckContext
): Promise<CheckOutcome> {
  try {
    switch (platform) {
      case "discord":
        return await checkDiscord(name, ctx);
      case "instagram":
        return await checkInstagram(name, ctx);
      case "tiktok":
        return await checkTikTok(name, ctx);
      case "github":
        return await checkGithub(name, ctx);
      case "telegram":
        return await checkTelegram(name, ctx);
      case "twitch":
        return await checkTwitch(name, ctx);
      case "steam":
        return await checkSteam(name, ctx);
      case "roblox":
        return await checkRoblox(name, ctx);
      case "youtube":
        return await checkYoutube(name, ctx);
      case "reddit":
        return await checkReddit(name, ctx);
      case "pinterest":
        return await checkPinterest(name, ctx);
      default:
        return outcome("unsupported", "Plataforma não suportada");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro inesperado";
    return outcome("error", message);
  }
}

export interface CredentialCheck {
  valid: boolean;
  username?: string | null;
  userId?: string | null;
  error?: string;
}

export async function validateDiscordToken(token: string): Promise<CredentialCheck> {
  if (!token) return { valid: false, error: "Informe um token" };
  const res = await httpRequest("https://discord.com/api/v9/users/@me", {
    headers: { Authorization: token, "X-Super-Properties": SUPER_PROPERTIES },
    timeoutMs: 12000,
  });
  if (res.networkError) return { valid: false, error: res.networkError };
  if (res.status === 200) {
    try {
      const user = JSON.parse(res.body) as { username?: string; id?: string };
      return { valid: true, username: user.username ?? null, userId: user.id ?? null };
    } catch {
      return { valid: true };
    }
  }
  if (res.status === 401) return { valid: false, error: "Token inválido" };
  if (res.status === 429) return { valid: false, error: "Muitas tentativas — aguarde um pouco" };
  return { valid: false, error: `Discord respondeu ${res.status}` };
}

export async function validateGithubToken(token: string): Promise<CredentialCheck> {
  if (!token) return { valid: false, error: "Informe um token" };
  const res = await httpRequest("https://api.github.com/user", {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
    },
    timeoutMs: 12000,
  });
  if (res.networkError) return { valid: false, error: res.networkError };
  if (res.status === 200) {
    try {
      const user = JSON.parse(res.body) as { login?: string; id?: number };
      return { valid: true, username: user.login ?? null, userId: user.id ? String(user.id) : null };
    } catch {
      return { valid: true };
    }
  }
  if (res.status === 401) return { valid: false, error: "Token inválido" };
  return { valid: false, error: `GitHub respondeu ${res.status}` };
}

export async function validateTwitchCredential(
  clientId: string,
  clientSecret: string
): Promise<CredentialCheck> {
  if (!clientId || !clientSecret) return { valid: false, error: "Preencha client ID e secret" };
  const res = await httpRequest(
    "https://id.twitch.tv/oauth2/token" +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&client_secret=${encodeURIComponent(clientSecret)}` +
      "&grant_type=client_credentials",
    { method: "POST", timeoutMs: 12000 }
  );
  if (res.status === 200) return { valid: true };
  return { valid: false, error: res.status === 400 ? "Credenciais recusadas" : `Twitch respondeu ${res.status}` };
}

export async function validateTelegramBot(token: string): Promise<CredentialCheck> {
  if (!token) return { valid: false, error: "Informe o token do bot" };
  const res = await httpRequest(`https://api.telegram.org/bot${token}/getMe`, {
    timeoutMs: 12000,
  });
  if (res.status === 200) {
    try {
      const parsed = JSON.parse(res.body) as { result?: { username?: string; id?: number } };
      return { valid: true, username: parsed.result?.username ?? null };
    } catch {
      return { valid: true };
    }
  }
  return { valid: false, error: "Token recusado pelo Telegram" };
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<boolean> {
  if (!botToken || !chatId) return false;
  const res = await httpRequest(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
    timeoutMs: 12000,
  });
  return res.status === 200;
}
