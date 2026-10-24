import { recentAttempts, recordAttempt } from "./repo";

/** Utilidades de borda: IP do cliente, mesma origem e limitação de tentativas. */

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0]?.trim();
  return (
    first ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "0.0.0.0"
  );
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const requestHost =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      new URL(request.url).host;
    return originHost === requestHost;
  } catch {
    return false;
  }
}

export function requestOrigin(request: Request): string {
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    new URL(request.url).host;
  const proto =
    request.headers.get("x-forwarded-proto") ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

export interface RateResult {
  allowed: boolean;
  hits: number;
  retryAfterSeconds: number;
}

/**
 * Limite simples e persistente: conta tentativas do mesmo balde na janela.
 * Usado no login por key, no login admin e na ativação de licença.
 */
export async function rateLimit(
  request: Request,
  options: { bucket: string; limit: number; windowMs: number }
): Promise<RateResult> {
  const ip = clientIp(request);
  const key = `${options.bucket}:${ip}`;
  const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
  try {
    const hits = await recentAttempts(key, options.windowMs);
    return { allowed: hits < options.limit, hits, retryAfterSeconds };
  } catch {
    // Banco fora do ar não pode impedir o login: segue sem bloquear.
    return { allowed: true, hits: 0, retryAfterSeconds };
  }
}

export async function trackAttempt(request: Request, bucket: string, kind: string, ok: boolean): Promise<void> {
  try {
    await recordAttempt(`${bucket}:${clientIp(request)}`, kind, ok, clientIp(request));
  } catch {
    /* telemetria nunca derruba o login */
  }
}

export function userAgent(request: Request): string {
  return request.headers.get("user-agent") || "desconhecido";
}
