import { fail, json, readBody } from "@/lib/api";
import { isNextResponse, requireAdmin } from "@/lib/access";
import { sameOrigin } from "@/lib/cloud/guard";
import { addProxies, deleteProxy, listProxies, logEvent } from "@/lib/cloud/repo";
import { fetchProxies, toCloudProxy } from "@/lib/proxyscrape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if (isNextResponse(access)) return access;
  const proxies = await listProxies();
  return json({
    proxies,
    counters: {
      total: proxies.length,
      ok: proxies.filter((proxy) => proxy.status === "ok").length,
      dead: proxies.filter((proxy) => proxy.status === "dead").length,
      unknown: proxies.filter((proxy) => proxy.status === "unknown").length,
    },
  });
}

interface ProxyBody {
  action?: "import" | "prune";
  protocol?: "http" | "socks4" | "socks5" | "all";
  country?: string;
  limit?: number;
}

export async function POST(request: Request) {
  const access = await requireAdmin(request);
  if (isNextResponse(access)) return access;
  if (!sameOrigin(request)) return fail("Origem não permitida", 403);

  const body = (await readBody<ProxyBody>(request)) ?? {};

  if (body.action === "prune") {
    const proxies = await listProxies();
    const dead = proxies.filter((proxy) => proxy.status === "dead");
    for (const proxy of dead) await deleteProxy(proxy.id);
    await logEvent({
      kind: "proxy.prune",
      severity: "warn",
      actor: access.label,
      message: `${dead.length} proxy(s) morta(s) removida(s).`,
    });
    return json({ ok: true, removed: dead.length });
  }

  try {
    const parsed = await fetchProxies({
      protocol: body.protocol ?? "all",
      country: body.country?.trim() || undefined,
      limit: body.limit ?? 80,
    });
    if (!parsed.length) return fail("A ProxyScrape não devolveu proxies agora. Tente em instantes.", 502);
    const added = await addProxies(parsed.map(toCloudProxy));
    await logEvent({
      kind: "proxy.import",
      severity: "success",
      actor: access.label,
      message: `${added} proxy(s) importada(s) do ProxyScrape (${body.protocol ?? "all"}).`,
    });
    return json({ ok: true, imported: added, sample: parsed.slice(0, 5) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "falha desconhecida";
    return fail(`Não foi possível importar: ${message}`, 502);
  }
}
