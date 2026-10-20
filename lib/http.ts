import https from "node:https";
import zlib from "node:zlib";
import { ProxyAgent } from "undici";
import { SocksProxyAgent } from "socks-proxy-agent";
import type { ProxyRecord } from "./types";

export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  proxy?: { record: ProxyRecord; password: string } | null;
  userAgent?: string;
  maxRedirects?: number;
}

export interface HttpResult {
  status: number;
  body: string;
  headers: Record<string, string>;
  latencyMs: number;
  proxyLabel: string | null;
  networkError: string | null;
}

const agentCache = new Map<string, ProxyAgent>();
const socksCache = new Map<string, SocksProxyAgent>();

function proxyLabel(p: ProxyRecord): string {
  return `${p.host}:${p.port}`;
}

function proxyUri(p: ProxyRecord): string {
  return `${p.protocol}://${p.host}:${p.port}`;
}

function basicToken(p: ProxyRecord, password: string): string | null {
  if (!p.username) return null;
  return `Basic ${Buffer.from(`${p.username}:${password}`).toString("base64")}`;
}

function getProxyAgent(p: ProxyRecord, password: string): ProxyAgent {
  const key = `${p.id}:${password ? password.length : 0}:${p.username ?? ""}`;
  const existing = agentCache.get(key);
  if (existing) return existing;
  const token = basicToken(p, password);
  const agent = new ProxyAgent({
    uri: proxyUri(p),
    ...(token ? { token } : {}),
    requestTls: { rejectUnauthorized: false },
    proxyTls: { rejectUnauthorized: false },
  });
  agentCache.set(key, agent);
  return agent;
}

function getSocksAgent(p: ProxyRecord, password: string): SocksProxyAgent {
  const key = `${p.id}:${p.username ?? ""}:${password ? password.length : 0}`;
  const existing = socksCache.get(key);
  if (existing) return existing;
  const auth = p.username
    ? `${encodeURIComponent(p.username)}:${encodeURIComponent(password)}@`
    : "";
  const agent = new SocksProxyAgent(`socks5://${auth}${p.host}:${p.port}`);
  socksCache.set(key, agent);
  return agent;
}

function decodeBody(buffer: Buffer, encoding: string): string {
  try {
    if (encoding.includes("br")) return zlib.brotliDecompressSync(buffer).toString("utf8");
    if (encoding.includes("gzip")) return zlib.gunzipSync(buffer).toString("utf8");
    if (encoding.includes("deflate")) return zlib.inflateSync(buffer).toString("utf8");
  } catch {
    /* corpo não comprimido na prática */
  }
  return buffer.toString("utf8");
}

function requestViaSocks(
  url: string,
  opts: HttpRequestOptions,
  agent: SocksProxyAgent,
  redirectsLeft: number
): Promise<Omit<HttpResult, "latencyMs" | "proxyLabel">> {
  return new Promise((resolve) => {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      resolve({ status: 0, body: "", headers: {}, networkError: "URL inválida" });
      return;
    }
    const timeout = opts.timeoutMs ?? 12000;
    const req = https.request(
      {
        host: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: opts.method ?? "GET",
        agent,
        headers: {
          "accept-encoding": "identity",
          ...(opts.headers ?? {}),
        },
        timeout,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location && redirectsLeft > 0) {
          res.resume();
          const next = new URL(location, target).toString();
          requestViaSocks(next, opts, agent, redirectsLeft - 1).then(resolve);
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === "string") headers[k.toLowerCase()] = v;
            else if (Array.isArray(v)) headers[k.toLowerCase()] = v.join(", ");
          }
          resolve({
            status,
            body: decodeBody(buffer, headers["content-encoding"] ?? ""),
            headers,
            networkError: null,
          });
        });
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", (err: Error) => {
      resolve({
        status: 0,
        body: "",
        headers: {},
        networkError: err.message || "falha de rede",
      });
    });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

export async function httpRequest(
  url: string,
  options: HttpRequestOptions = {}
): Promise<HttpResult> {
  const started = Date.now();
  const timeoutMs = options.timeoutMs ?? 12000;
  const headers: Record<string, string> = {
    "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
    ...(options.userAgent ? { "user-agent": options.userAgent } : {}),
    ...(options.headers ?? {}),
  };

  const proxy = options.proxy ?? null;
  const label = proxy ? proxyLabel(proxy.record) : null;

  if (proxy && proxy.record.protocol === "socks5") {
    const agent = getSocksAgent(proxy.record, proxy.password);
    const res = await requestViaSocks(url, { ...options, headers }, agent, options.maxRedirects ?? 4);
    return { ...res, latencyMs: Date.now() - started, proxyLabel: label };
  }

  try {
    const dispatcher =
      proxy && proxy.record.protocol !== "socks5"
        ? getProxyAgent(proxy.record, proxy.password)
        : undefined;

    const res = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body,
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
      dispatcher,
    } as RequestInit & { dispatcher?: ProxyAgent });

    const body = await res.text();
    const plainHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      plainHeaders[key.toLowerCase()] = value;
    });
    return {
      status: res.status,
      body,
      headers: plainHeaders,
      latencyMs: Date.now() - started,
      proxyLabel: label,
      networkError: null,
    };
  } catch (error) {
    const err = error as Error & { cause?: { code?: string; message?: string } };
    const code = err.cause?.code;
    const friendly: Record<string, string> = {
      ECONNREFUSED: "conexão recusada",
      ENOTFOUND: "host não encontrado",
      ECONNRESET: "conexão encerrada",
      ETIMEDOUT: "tempo esgotado",
      EHOSTUNREACH: "host inacessível",
      CERT_HAS_EXPIRED: "certificado expirado",
      DEPTH_ZERO_SELF_SIGNED_CERT: "certificado inválido",
      UNABLE_TO_VERIFY_LEAF_SIGNATURE: "certificado não verificado",
      SELF_SIGNED_CERT_IN_CHAIN: "certificado autoassinado",
    };
    const raw = err.message ?? "falha de rede";
    const message =
      (code && friendly[code]) ||
      (raw === "fetch failed" ? "não foi possível conectar" : raw.includes("timed out") ? "tempo esgotado" : raw);
    return {
      status: 0,
      body: "",
      headers: {},
      latencyMs: Date.now() - started,
      proxyLabel: label,
      networkError: message,
    };
  }
}

export function parseRetryAfter(headers: Record<string, string>, body: string): number {
  const headerValue = Number(headers["retry-after"]);
  if (!Number.isNaN(headerValue) && headerValue > 0) {
    return Math.min(120000, headerValue * 1000);
  }
  try {
    const parsed = JSON.parse(body) as { retry_after?: number };
    if (typeof parsed.retry_after === "number") {
      return Math.min(120000, parsed.retry_after * 1000);
    }
  } catch {
    /* corpo não é JSON */
  }
  return 15000;
}
