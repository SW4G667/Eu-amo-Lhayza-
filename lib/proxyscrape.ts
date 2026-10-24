import type { CloudProxy } from "./cloud/types";

/**
 * Importação de proxies do ProxyScrape.
 *
 * Usa a API pública v4 (lista renovada a cada minuto). A resposta vem em
 * formatos diferentes conforme o parâmetro `proxy_format`, então o parser
 * aceita JSON com `proxies[]`, lista de strings ou o formato texto.
 */

const DEFAULT_API =
  "https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies";

export type ProxyProtocol = "http" | "socks4" | "socks5";

export interface ImportOptions {
  protocol: ProxyProtocol | "all";
  country?: string;
  limit?: number;
  timeoutMs?: number;
}

export interface ParsedProxy {
  protocol: string;
  host: string;
  port: number;
  country: string | null;
  latencyMs: number | null;
}

export function buildUrl(options: ImportOptions): string {
  const base = (process.env.PROXYSCRAPE_API_URL || DEFAULT_API).trim();
  const url = new URL(base);
  if (!url.searchParams.has("request")) url.searchParams.set("request", "display_proxies");
  url.searchParams.set("protocol", options.protocol === "all" ? "http,socks4,socks5" : options.protocol);
  url.searchParams.set("proxy_format", "protocolipport");
  url.searchParams.set("format", "json");
  url.searchParams.set("timeout", String(options.timeoutMs ?? 2000));
  if (options.country) url.searchParams.set("country", options.country);
  return url.toString();
}

function normalizeProtocol(value: string): string {
  const clean = (value || "").toLowerCase().replace("://", "");
  if (clean.startsWith("socks5")) return "socks5";
  if (clean.startsWith("socks4")) return "socks4";
  if (clean === "socks") return "socks5";
  return "http";
}

function parseEntry(entry: unknown): ParsedProxy | null {
  if (typeof entry === "string") {
    const match = entry.trim().match(/^(?:(socks5|socks4|http|https):\/\/)?([\d.]+|\[[0-9a-f:]+\]):(\d{2,5})$/i);
    if (!match) return null;
    return {
      protocol: normalizeProtocol(match[1] ?? "http"),
      host: match[2].replace(/[[\]]/g, ""),
      port: Number(match[3]),
      country: null,
      latencyMs: null,
    };
  }

  if (entry && typeof entry === "object") {
    const row = entry as Record<string, unknown>;
    const combined = typeof row.proxy === "string" ? row.proxy : "";
    if (combined) {
      const parsed = parseEntry(combined);
      if (parsed) {
        const ipData = row.ip_data as Record<string, unknown> | undefined;
        return {
          ...parsed,
          protocol: normalizeProtocol(String(row.protocol ?? parsed.protocol)),
          country: (ipData?.countryCode as string) ?? (row.country as string) ?? null,
          latencyMs: numberOrNull(row.timeout ?? row.latency),
        };
      }
    }
    const host = String(row.ip ?? row.host ?? "");
    const port = Number(row.port ?? 0);
    if (host && port > 0 && port < 65536) {
      const ipData = row.ip_data as Record<string, unknown> | undefined;
      return {
        protocol: normalizeProtocol(String(row.protocol ?? "http")),
        host,
        port,
        country: (ipData?.country_code as string) ?? (ipData?.countryCode as string) ?? (row.country as string) ?? null,
        latencyMs: numberOrNull(row.timeout ?? row.latency),
      };
    }
  }
  return null;
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseProxiesPayload(payload: unknown): ParsedProxy[] {
  const out: ParsedProxy[] = [];
  const push = (entry: unknown) => {
    if (Array.isArray(entry)) {
      entry.forEach(push);
      return;
    }
    const parsed = parseEntry(entry);
    if (parsed) out.push(parsed);
  };

  if (typeof payload === "string") {
    payload
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach(push);
    return dedupe(out);
  }

  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;
    if (Array.isArray(data.proxies)) data.proxies.forEach(push);
    else if (Array.isArray(data.data)) data.data.forEach(push);
    else if (Array.isArray(data.results)) data.results.forEach(push);
  }
  return dedupe(out);
}

function dedupe(rows: ParsedProxy[]): ParsedProxy[] {
  const seen = new Set<string>();
  const out: ParsedProxy[] = [];
  for (const row of rows) {
    const key = `${row.protocol}:${row.host}:${row.port}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export async function fetchProxies(options: ImportOptions): Promise<ParsedProxy[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(buildUrl(options), {
      headers: {
        accept: "application/json, text/plain;q=0.8",
        "user-agent": "atalaia/1.0 (+console)",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`ProxyScrape respondeu ${response.status}`);
    }
    const text = await response.text();
    let payload: unknown = text;
    try {
      payload = JSON.parse(text);
    } catch {
      /* formato texto */
    }
    const limit = Math.min(options.limit ?? 80, 300);
    return parseProxiesPayload(payload).slice(0, limit);
  } finally {
    clearTimeout(timer);
  }
}

export function toCloudProxy(proxy: ParsedProxy): Omit<CloudProxy, "id" | "createdAt"> {
  return {
    protocol: proxy.protocol,
    host: proxy.host,
    port: proxy.port,
    username: null,
    password: null,
    country: proxy.country,
    latencyMs: proxy.latencyMs,
    source: "proxyscrape",
    status: "unknown",
    lastCheckedAt: null,
  };
}

export function proxyLabel(proxy: { protocol: string; host: string; port: number }): string {
  return `${proxy.protocol}://${proxy.host}:${proxy.port}`;
}
