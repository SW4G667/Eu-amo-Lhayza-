import type { ProxyRecord } from "./types";

export interface ProxyTestResult {
  ok: boolean;
  latencyMs: number | null;
  ip: string | null;
  error: string | null;
}

export function proxyDisplay(proxy: ProxyRecord): string {
  return `${proxy.host}:${proxy.port}`;
}

export function proxyUrlForDisplay(proxy: ProxyRecord): string {
  return `${proxy.protocol}://${proxyDisplay(proxy)}`;
}

export interface ParsedProxy {
  protocol: "http" | "https" | "socks5";
  host: string;
  port: number;
  username: string | null;
  password: string | null;
}

/**
 * Aceita: host:port | host:port:user:pass | user:pass@host:port |
 * http(s)://user:pass@host:port | socks5://host:port
 */
export function parseProxyLine(line: string): ParsedProxy | null {
  let raw = line.trim();
  if (!raw || raw.startsWith("#")) return null;

  let protocol: ParsedProxy["protocol"] = "http";
  const protoMatch = raw.match(/^(https?|socks5h?):\/\//i);
  if (protoMatch) {
    const scheme = protoMatch[1].toLowerCase();
    protocol = scheme.startsWith("socks") ? "socks5" : scheme === "https" ? "https" : "http";
    raw = raw.slice(protoMatch[0].length);
  }

  let username: string | null = null;
  let password: string | null = null;

  if (raw.includes("@")) {
    const atIndex = raw.lastIndexOf("@");
    const authPart = raw.slice(0, atIndex);
    raw = raw.slice(atIndex + 1);
    const colon = authPart.indexOf(":");
    if (colon >= 0) {
      username = decodeURIComponent(authPart.slice(0, colon));
      password = decodeURIComponent(authPart.slice(colon + 1));
    } else {
      username = decodeURIComponent(authPart);
    }
  }

  const parts = raw.split(":").map((p) => p.trim());
  if (parts.length === 2) {
    const port = Number(parts[1]);
    if (!parts[0] || !Number.isInteger(port) || port <= 0 || port > 65535) return null;
    return { protocol, host: parts[0], port, username, password };
  }
  if (parts.length === 4) {
    const port = Number(parts[1]);
    if (!parts[0] || !Number.isInteger(port) || port <= 0 || port > 65535) return null;
    return { protocol, host: parts[0], port, username: parts[2] || null, password: parts[3] || null };
  }
  if (parts.length === 3) {
    const port = Number(parts[1]);
    if (!parts[0] || !Number.isInteger(port) || port <= 0 || port > 65535) return null;
    return { protocol, host: parts[0], port, username: parts[2] || null, password: null };
  }
  return null;
}
