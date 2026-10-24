import { fail, json, readBody } from "@/lib/api";
import { isNextResponse, requireAdmin } from "@/lib/access";
import { sameOrigin } from "@/lib/cloud/guard";
import { listProxies, logEvent, updateProxyStatus } from "@/lib/cloud/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  id?: string;
  limit?: number;
}

/**
 * Teste real de proxy: abre uma conexão TCP com host:porta e mede a latência.
 * Não usa a rede do navegador — roda no servidor, com timeout curto.
 */
async function probe(host: string, port: number, timeoutMs = 6000): Promise<number | null> {
  const net = await import("net");
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = new net.Socket();
    const done = (value: number | null) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(Date.now() - started));
    socket.once("timeout", () => done(null));
    socket.once("error", () => done(null));
    socket.connect(port, host);
  });
}

export async function POST(request: Request) {
  const access = await requireAdmin(request);
  if (isNextResponse(access)) return access;
  if (!sameOrigin(request)) return fail("Origem não permitida", 403);

  const body = (await readBody<Body>(request)) ?? {};
  const all = await listProxies(1000);
  const targets = body.id ? all.filter((proxy) => proxy.id === body.id) : all.slice(0, Math.min(body.limit ?? 12, 40));

  if (!targets.length) return fail("Nenhum proxy para testar. Importe da ProxyScrape primeiro.", 422);

  const results = await Promise.all(
    targets.map(async (proxy) => {
      const latency = await probe(proxy.host, Number(proxy.port));
      const ok = latency !== null;
      await updateProxyStatus(proxy.id, ok ? "ok" : "dead", latency);
      return { id: proxy.id, host: proxy.host, port: proxy.port, ok, latencyMs: latency };
    })
  );

  const okCount = results.filter((item) => item.ok).length;
  await logEvent({
    kind: "proxy.test",
    severity: okCount ? "info" : "warn",
    actor: access.label,
    message: `Teste de proxy: ${okCount}/${results.length} responderam.`,
  });

  return json({ results, ok: okCount, total: results.length });
}
