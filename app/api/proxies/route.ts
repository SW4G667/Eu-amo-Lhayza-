import { fail, guard, json, readBody } from "@/lib/api";
import { encryptSecret } from "@/lib/crypto";
import { parseProxyLine, type ParsedProxy } from "@/lib/proxy";
import { readData, updateData } from "@/lib/store";
import type { ProxyRecord } from "@/lib/types";
import { uid } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProxyBody {
  list?: string;
  protocol?: "http" | "https" | "socks5";
  host?: string;
  port?: number | string;
  username?: string;
  password?: string;
}

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const data = await readData();
  return json({
    proxies: data.proxies.map(({ password, cooldownUntil, ...rest }) => ({
      ...rest,
      hasPassword: Boolean(password),
    })),
  });
}

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const body = await readBody<ProxyBody>(request);
  if (!body) return fail("Corpo inválido");

  const lines: string[] = [];
  if (body.list) lines.push(...body.list.split(/\r?\n/));

  if (body.host) {
    const auth = body.username
      ? `${body.username}:${body.password ?? ""}@`
      : "";
    lines.push(`${auth}${body.host}:${body.port ?? ""}`);
  }

  const parsed = lines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const result = parseProxyLine(line);
      if (!result) return { line, error: "formato inválido" } as const;
      return { line, parsed: result } as const;
    });

  const valid = parsed.filter(
    (entry): entry is { line: string; parsed: ParsedProxy } => "parsed" in entry
  );
  if (!valid.length) {
    return fail("Nenhuma proxy válida. Use host:porta ou host:porta:usuário:senha.", 422);
  }

  const data = await readData();
  if (data.proxies.length + valid.length > 500) {
    return fail("Limite de 500 proxies", 409);
  }

  const existing = new Set(
    data.proxies.map((p) => `${p.host}:${p.port}:${p.username ?? ""}`)
  );
  const added: ProxyRecord[] = [];
  let skipped = 0;

  for (const entry of valid) {
    const p = entry.parsed;
    if (body.protocol && !entry.line.includes("://")) {
      p.protocol = body.protocol;
    }
    const key = `${p.host}:${p.port}:${p.username ?? ""}`;
    if (existing.has(key)) {
      skipped += 1;
      continue;
    }
    existing.add(key);
    added.push({
      id: uid("px"),
      host: p.host,
      port: p.port,
      protocol: p.protocol,
      username: p.username,
      password: p.password ? encryptSecret(p.password) : null,
      enabled: true,
      ok: null,
      latencyMs: null,
      lastChecked: null,
      failures: 0,
      cooldownUntil: 0,
    });
  }

  if (added.length) {
    await updateData((store) => {
      store.proxies.push(...added);
      store.logs.unshift({
        id: uid("log"),
        ts: Date.now(),
        level: "info",
        platform: null,
        username: null,
        message: `${added.length} proxy(s) adicionada(s) ao pool.`,
        latencyMs: null,
        proxy: null,
      });
      store.logs = store.logs.slice(0, 150);
    });
  }

  return json({
    added: added.length,
    skipped,
    invalid: parsed.filter((entry) => "error" in entry).length,
  });
}
