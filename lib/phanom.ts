/**
 * Cliente mínimo da PhanomCloud (hospedagem de bots).
 *
 * A API aceita dois modos de autenticação:
 *  - `Authorization: Bearer sess_...`   (token de sessão do dashboard)
 *  - `X-Automation-Token: auto_...`     (token de automação)
 *
 * O Atalaia usa a PhanomCloud como host 24/7 do motor de varredura.
 */

const DEFAULT_BASE = "https://api.phanomcloud.online";

export interface PhanomBot {
  id: string;
  name: string;
  language: string;
  status: "offline" | "starting" | "online" | "stopping" | "error" | string;
  memory: number;
  vcpu?: number;
  startup_command?: string;
  subdomain?: string | null;
  created_at?: string;
}

export interface PhanomStatus {
  configured: boolean;
  reachable: boolean;
  version: string | null;
  latencyMs: number | null;
  error: string | null;
  bots: PhanomBot[];
  tokenKind: "session" | "automation" | null;
}

export function phanomToken(): string {
  return (process.env.PHANOM_TOKEN || process.env.PHANOM_API_TOKEN || "").trim();
}

export function phanomBase(): string {
  return (process.env.PHANOM_API_URL || DEFAULT_BASE).replace(/\/+$/, "");
}

function authHeaders(): Record<string, string> {
  const token = phanomToken();
  if (!token) return {};
  if (token.startsWith("auto_")) {
    return { "X-Automation-Token": token };
  }
  if (token.startsWith("sess_")) {
    return { Authorization: `Bearer ${token}` };
  }
  // token fora do padrão documentado: tenta os dois modos
  return { "X-Automation-Token": token, Authorization: `Bearer ${token}` };
}

async function call<T>(path: string, timeoutMs = 12000): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${phanomBase()}${path}`, {
      headers: { accept: "application/json", ...authHeaders() },
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    let data: T | null = null;
    try {
      data = text ? (JSON.parse(text) as T) : null;
    } catch {
      data = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      data,
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, status: 0, data: null, error: message };
  } finally {
    clearTimeout(timer);
  }
}

export async function phanomHealth(): Promise<{
  reachable: boolean;
  version: string | null;
  latencyMs: number;
  error: string | null;
}> {
  const started = Date.now();
  const result = await call<{ success?: boolean; data?: { status?: string; version?: string } }>("/health", 9000);
  const latencyMs = Date.now() - started;
  if (!result.ok) {
    return { reachable: false, version: null, latencyMs, error: result.error };
  }
  return { reachable: true, version: result.data?.data?.version ?? null, latencyMs, error: null };
}

export async function phanomBots(): Promise<PhanomBot[]> {
  if (!phanomToken()) return [];
  const result = await call<{ success?: boolean; data?: PhanomBot[] }>("/bots");
  if (!result.ok) return [];
  return Array.isArray(result.data?.data) ? result.data!.data! : [];
}

export async function phanomStatus(): Promise<PhanomStatus> {
  const token = phanomToken();
  const health = await phanomHealth();
  if (!token) {
    return {
      configured: false,
      reachable: health.reachable,
      version: health.version,
      latencyMs: health.latencyMs,
      error: health.error,
      bots: [],
      tokenKind: null,
    };
  }
  const bots = await phanomBots();
  return {
    configured: true,
    reachable: health.reachable,
    version: health.version,
    latencyMs: health.latencyMs,
    error: health.error,
    bots,
    tokenKind: token.startsWith("auto_") ? "automation" : token.startsWith("sess_") ? "session" : null,
  };
}

/** Comando de start sugerido para o bot que roda o motor. */
export const RUNNER_START_COMMAND = "npx tsx scripts/runner.ts";
