import crypto from "crypto";
import { getSettings } from "./cloud/repo";

/** Integração OAuth2 com o Discord (login de clientes). */

const API = "https://discord.com/api/v10";

export interface DiscordProfile {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  email?: string | null;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
}

export async function discordCredentials(): Promise<{ clientId: string; clientSecret: string }> {
  const settings = await getSettings();
  return {
    clientId: (process.env.DISCORD_CLIENT_ID || settings.discord.clientId || "").trim(),
    clientSecret: (process.env.DISCORD_CLIENT_SECRET || "").trim(),
  };
}

export async function discordConfigured(): Promise<boolean> {
  const { clientId, clientSecret } = await discordCredentials();
  return Boolean(clientId && clientSecret);
}

function signState(): string {
  const payload = `${Date.now() + 10 * 60 * 1000}.${crypto.randomBytes(12).toString("base64url")}`;
  const secret = process.env.APP_SECRET || process.env.APP_PASSWORD || "atalaia-dev-secret-change-me";
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyState(state: string | null): boolean {
  if (!state) return false;
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [expiry, nonce, signature] = parts;
  const secret = process.env.APP_SECRET || process.env.APP_PASSWORD || "atalaia-dev-secret-change-me";
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${expiry}.${nonce}`)
    .digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Number(expiry) > Date.now();
}

export async function redirectUriFor(origin: string): Promise<string> {
  const fixed = (process.env.DISCORD_REDIRECT_URI || "").trim();
  if (fixed) return fixed;
  return `${origin.replace(/\/+$/, "")}/api/auth/discord/callback`;
}

export async function authorizeUrl(origin: string): Promise<string | null> {
  const { clientId } = await discordCredentials();
  if (!clientId) return null;
  const redirectUri = await redirectUriFor(origin);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify guilds",
    state: signState(),
    prompt: "consent",
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCode(
  code: string,
  origin: string
): Promise<{ accessToken: string; scope: string } | null> {
  const { clientId, clientSecret } = await discordCredentials();
  if (!clientId || !clientSecret) return null;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: await redirectUriFor(origin),
  });
  const response = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { access_token?: string; scope?: string };
  if (!payload.access_token) return null;
  return { accessToken: payload.access_token, scope: payload.scope ?? "" };
}

export async function fetchProfile(accessToken: string): Promise<DiscordProfile | null> {
  const response = await fetch(`${API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as DiscordProfile;
  if (!payload?.id) return null;
  return payload;
}

export async function fetchGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const response = await fetch(`${API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return [];
  return (await response.json()) as DiscordGuild[];
}

export function avatarUrl(profile: { id: string; avatar: string | null }, size = 128): string {
  if (!profile.avatar) {
    const index = Number((BigInt(profile.id) >> BigInt(22)) % BigInt(6));
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  const extension = profile.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${extension}?size=${size}`;
}

export async function isMemberOfGuild(
  accessToken: string,
  guildId: string
): Promise<boolean> {
  if (!guildId) return true;
  const guilds = await fetchGuilds(accessToken);
  return guilds.some((guild) => guild.id === guildId);
}
