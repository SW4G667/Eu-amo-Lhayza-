/**
 * Atalaia — runner contínuo (GitHub Actions como VPS).
 *
 * Mantém o motor girando por até `ATALAIA_RUN_MINUTES` minutos, gravando o
 * estado cifrado no branch configurado do repositório. Um cron do GitHub
 * Actions enfileira a próxima execução, então a varredura nunca para.
 *
 * Uso local:
 *   ATALAIA_STATE_MODE=github ATALAIA_STATE_TOKEN=... \
 *   ATALAIA_ENGINE_MODE=serverless npx tsx scripts/runner.ts
 */

import os from "node:os";
import { engine } from "../lib/engine";
import { flushData, lastStateError, readData, stateStatus, updateData } from "../lib/store";

const tickMs = clamp(process.env.ATALAIA_TICK_MS, 2000, 500, 60000);
const runMinutes = clamp(process.env.ATALAIA_RUN_MINUTES, 330, 1, 350);
const heartbeatMs = clamp(process.env.ATALAIA_HEARTBEAT_MS, 20000, 5000, 300000);
const deadline = Date.now() + runMinutes * 60_000;

let stopping = false;
let startedAt = Date.now();
let tickCount = 0;
let lastHeartbeat = 0;
let lastChecks = 0;

function clamp(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clock(): string {
  return new Date().toISOString().slice(11, 19);
}

async function heartbeat(): Promise<void> {
  const host = process.env.GITHUB_ACTIONS ? "github-actions" : os.hostname();
  await updateData((data) => {
    data.runner = { lastSeenAt: Date.now(), host, version: "1.0.0" };
  });
  await flushData();
  const failure = lastStateError();
  if (failure) console.error(`[atalaia] falha ao gravar estado: ${failure}`);
  lastHeartbeat = Date.now();
}

async function loop(): Promise<void> {
  const status = stateStatus();
  console.log(
    `[atalaia] runner iniciado · ${clock()} · estado=${status.label}` +
      (status.repo ? ` (${status.repo}@${status.branch})` : "") +
      ` · gravável=${status.writable} · por ${runMinutes} min`
  );

  if (!status.writable) {
    console.error("[atalaia] estado sem escrita — defina ATALAIA_STATE_TOKEN para persistir.");
    process.exitCode = 1;
    return;
  }

  const initial = await readData();
  const active = initial.jobs.filter((job) => job.enabled).length;
  console.log(`[atalaia] ${initial.jobs.length} monitores no estado, ${active} ligados.`);

  await heartbeat();

  while (!stopping && Date.now() < deadline) {
    const started = Date.now();
    try {
      const result = await engine.tick();
      tickCount += 1;
      for (const batch of result.results) {
        if (batch.checked > 0) {
          lastChecks = batch.checked;
          console.log(
            `[atalaia] ${clock()} ${batch.jobName}: ${batch.checked} checagens, ` +
              `${batch.available} livres, ${batch.errors} erros, ${batch.rateLimited} limitados ` +
              `(${batch.durationMs} ms)` +
              (batch.hits.length ? ` → ${batch.hits.map((hit) => hit.username).join(", ")}` : "")
          );
        }
      }
      if (result.paused) {
        if (Date.now() - lastHeartbeat > heartbeatMs) {
          console.log(`[atalaia] ${clock()} motor pausado no painel, aguardando…`);
          await heartbeat();
        }
      } else if (Date.now() - lastHeartbeat > heartbeatMs) {
        console.log(
          `[atalaia] ${clock()} heartbeat · ${tickCount} ciclos · ${lastChecks} checagens no último lote`
        );
        await heartbeat();
      }
    } catch (error) {
      console.error(`[atalaia] ${clock()} erro no ciclo:`, error instanceof Error ? error.message : error);
    }

    const elapsed = Date.now() - started;
    await sleep(Math.max(250, tickMs - elapsed));
  }

  await heartbeat();
  await flushData();
  console.log(
    `[atalaia] runner encerrando · ${clock()} · ${tickCount} ciclos em ` +
      `${Math.round((Date.now() - startedAt) / 60000)} min`
  );
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    console.log(`\n[atalaia] ${signal} recebido — finalizando com estado salvo…`);
  });
}

loop()
  .catch(async (error) => {
    console.error("[atalaia] falha fatal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await flushData();
    } catch {
      /* ignora no encerramento */
    }
  });
