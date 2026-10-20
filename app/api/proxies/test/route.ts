import { guard, json, readBody } from "@/lib/api";
import { decryptSecret } from "@/lib/crypto";
import { httpRequest } from "@/lib/http";
import { readData, updateData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const body = await readBody<{ id?: string; all?: boolean }>(request);
  const data = await readData();

  const targets = body?.id
    ? data.proxies.filter((proxy) => proxy.id === body.id)
    : data.proxies.filter((proxy) => proxy.enabled).slice(0, 10);

  const results: {
    id: string;
    ok: boolean;
    latencyMs: number | null;
    ip: string | null;
    error: string | null;
  }[] = [];

  for (const proxy of targets) {
    const password = decryptSecret(proxy.password);
    const res = await httpRequest("https://api.ipify.org?format=json", {
      timeoutMs: 12000,
      proxy: { record: proxy, password },
      maxRedirects: 2,
    });

    let ip: string | null = null;
    if (res.status === 200) {
      try {
        const parsed = JSON.parse(res.body) as { ip?: string };
        ip = parsed.ip ?? null;
      } catch {
        ip = null;
      }
    }

    const ok = res.status === 200 && !res.networkError;
    results.push({
      id: proxy.id,
      ok,
      latencyMs: ok ? res.latencyMs : null,
      ip,
      error: ok ? null : res.networkError ?? `HTTP ${res.status}`,
    });

    await updateData((store) => {
      const record = store.proxies.find((entry) => entry.id === proxy.id);
      if (!record) return;
      record.ok = ok;
      record.latencyMs = ok ? res.latencyMs : null;
      record.lastChecked = Date.now();
      record.failures = ok ? 0 : record.failures + 1;
      record.cooldownUntil = ok ? 0 : Date.now() + 60_000;
    });
  }

  return json({ results });
}
