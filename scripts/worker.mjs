#!/usr/bin/env node
/**
 * Atalaia — pinger do motor.
 *
 * Mantém o motor girando mesmo com o painel fechado, chamando /api/cron
 * no intervalo configurado. Serve tanto para um servidor local quanto para
 * uma implantação na Vercel (onde as funções não permanecem vivas).
 *
 * Uso:
 *   WORKER_URL=https://atalaia-one.vercel.app CRON_SECRET=... npm run worker
 *
 * Variáveis:
 *   WORKER_URL          base da aplicação (padrão: http://localhost:3000)
 *   CRON_SECRET         chave esperada por /api/cron (obrigatória)
 *   WORKER_INTERVAL_MS  intervalo entre gatilhos em ms (padrão: 2500)
 *   WORKER_TIMEOUT_MS   timeout de cada requisição em ms (padrão: 25000)
 *   WORKER_ONCE         se "1", dispara uma vez e encerra
 */

const base = (process.env.WORKER_URL || "http://localhost:3000").replace(/\/+$/, "");
const secret = process.env.CRON_SECRET || "";
const interval = clampInt(process.env.WORKER_INTERVAL_MS, 2500, 500, 600000);
const timeout = clampInt(process.env.WORKER_TIMEOUT_MS, 25000, 2000, 120000);
const once = process.env.WORKER_ONCE === "1";

if (!secret) {
  console.error("[atalaia] CRON_SECRET não definido. O worker precisa da chave para chamar /api/cron.");
  process.exit(1);
}

const endpoint = `${base}/api/cron?key=${encodeURIComponent(secret)}`;
let stopping = false;
let failures = 0;
let ticks = 0;

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function stamp() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function summarize(payload) {
  if (!payload || typeof payload !== "object") return "sem resposta";
  if (!payload.ran) return payload.paused ? "motor pausado" : "nenhum monitor vencido";
  const parts = Array.isArray(payload.results)
    ? payload.results.map(
        (r) =>
          `${r.jobName ?? r.jobId}: ${r.checked} checagens` +
          (r.available ? `, ${r.available} livre(s)` : "") +
          (r.errors ? `, ${r.errors} erro(s)` : "") +
          (r.rateLimited ? `, ${r.rateLimited} limitado(s)` : "")
      )
    : [];
  return parts.join(" | ") || `${payload.ran} lote(s)`;
}

async function fire() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const startedAt = Date.now();
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "user-agent": "atalaia-worker/1.0", accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}${payload?.error ? ` — ${payload.error}` : ""}`);
    }

    ticks += 1;
    failures = 0;
    const took = Date.now() - startedAt;
    console.log(`[atalaia] ${stamp()} tick #${ticks} em ${took} ms · ${summarize(payload)}`);
    return true;
  } catch (error) {
    failures += 1;
    const message = error?.name === "AbortError" ? `timeout de ${timeout} ms` : error?.message || String(error);
    console.error(`[atalaia] ${stamp()} falha (${failures}): ${message}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function loop() {
  console.log(`[atalaia] worker ativo em ${base} · intervalo ${interval} ms`);
  while (!stopping) {
    const ok = await fire();
    if (once) break;
    const wait = ok ? interval : Math.min(interval * Math.min(failures + 1, 8), 30000);
    await sleep(wait);
  }
  console.log("[atalaia] worker encerrado.");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (stopping) process.exit(0);
    stopping = true;
    console.log(`\n[atalaia] ${signal} recebido, encerrando após o ciclo atual…`);
  });
}

loop().catch((error) => {
  console.error("[atalaia] falha fatal:", error);
  process.exit(1);
});
