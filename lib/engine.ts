import { decryptSecret } from "./crypto";
import { checkName, type CheckContext, type CheckOutcome } from "./adapters";
import { generateBatch, isValidName } from "./generator";
import { ProxyPool } from "./proxy-pool";
import { notifyDiscordHit, notifyTelegramHit } from "./alerts";
import { scoreName } from "./score";
import { readData, stateStatus, updateData } from "./store";
import type { DataShape, Hit, Job, LogEntry } from "./types";

export interface BatchResult {
  jobId: string;
  jobName: string;
  checked: number;
  available: number;
  taken: number;
  errors: number;
  rateLimited: number;
  durationMs: number;
  hits: { username: string; score: number }[];
  message?: string;
}

export interface EngineSnapshot {
  mode: "persistent" | "serverless";
  startedAt: number;
  lastTickAt: number | null;
  busy: boolean;
  scheduledJobs: number;
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}

async function runPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const size = Math.max(1, Math.min(limit, items.length));
  const runners = Array.from({ length: size }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

function levelFor(status: CheckOutcome["status"]): LogEntry["level"] {
  if (status === "available") return "available";
  if (status === "taken") return "taken";
  return "error";
}

function credentialProblem(job: Job, ctx: CheckContext): string | null {
  if (job.platform === "discord" && !ctx.discordToken) {
    return "Token do Discord ausente — configure em Ajustes para checar usernames.";
  }
  if (job.platform === "twitch" && (!ctx.twitchClientId || !ctx.twitchClientSecret)) {
    return "Credenciais da Twitch ausentes — configure em Ajustes.";
  }
  return null;
}

function engineMode(): "persistent" | "serverless" {
  const forced = (process.env.ATALAIA_ENGINE_MODE || "").toLowerCase();
  if (forced === "serverless" || forced === "persistent") return forced;
  return process.env.VERCEL === "1" ? "serverless" : "persistent";
}

class Engine {
  readonly mode: "persistent" | "serverless" = engineMode();
  readonly startedAt = Date.now();
  lastTickAt: number | null = null;

  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private busy = false;
  private started = false;
  private recent = new Map<string, Set<string>>();
  private cooldowns = new Map<string, number>();

  snapshot(): EngineSnapshot {
    return {
      mode: this.mode,
      startedAt: this.startedAt,
      lastTickAt: this.lastTickAt,
      busy: this.busy,
      scheduledJobs: this.timers.size,
    };
  }

  async ensureStarted(): Promise<void> {
    if (this.mode !== "persistent" || this.started) return;
    this.started = true;
    await this.sync();
  }

  async sync(): Promise<void> {
    if (this.mode !== "persistent") return;
    const data = await readData();
    const paused = data.settings.engine.paused;

    for (const [id, timer] of Array.from(this.timers.entries())) {
      const job = data.jobs.find((j) => j.id === id);
      if (!job || !job.enabled || paused) {
        clearTimeout(timer);
        this.timers.delete(id);
      }
    }

    if (paused) return;

    for (const job of data.jobs) {
      if (job.enabled && !this.timers.has(job.id)) {
        this.arm(job.id, 800);
      }
    }
  }

  private arm(jobId: string, delayMs: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(jobId);
      void this.scheduledRun(jobId);
    }, Math.max(150, delayMs));
    if (typeof timer.unref === "function") timer.unref();
    this.timers.set(jobId, timer);
  }

  private async scheduledRun(jobId: string): Promise<void> {
    const data = await readData();
    const job = data.jobs.find((j) => j.id === jobId);
    if (!job || !job.enabled || data.settings.engine.paused) return;

    const cooldownUntil = this.cooldowns.get(jobId) ?? 0;
    if (cooldownUntil > Date.now()) {
      this.arm(jobId, cooldownUntil - Date.now());
      return;
    }
    if (this.busy) {
      this.arm(jobId, 1200);
      return;
    }

    await this.execute(jobId);

    const after = await readData();
    const fresh = after.jobs.find((j) => j.id === jobId);
    if (fresh?.enabled && !after.settings.engine.paused) {
      const jitter = 1 + (Math.random() * 2 - 1) * (after.settings.engine.jitterPct / 100);
      this.arm(jobId, Math.max(500, fresh.intervalMs * jitter));
    }
  }

  async execute(jobId: string, options: { manual?: boolean } = {}): Promise<BatchResult | null> {
    if (this.busy) return null;
    this.busy = true;
    const startedAt = Date.now();

    try {
      const data = await readData();
      const job = data.jobs.find((j) => j.id === jobId);
      if (!job) return null;

      const ctxBase = this.buildContext(data);
      const problem = credentialProblem(job, ctxBase);
      if (problem) {
        this.cooldowns.set(jobId, Date.now() + 30_000);
        await updateData((d) => {
          const target = d.jobs.find((j) => j.id === jobId);
          if (target) target.lastError = problem;
          d.logs.unshift({
            id: uid("log"),
            ts: Date.now(),
            jobId,
            level: "error",
            platform: job.platform,
            username: null,
            message: problem,
            latencyMs: null,
            proxy: null,
          });
          d.logs = d.logs.slice(0, 150);
        });
        return {
          jobId,
          jobName: job.name,
          checked: 0,
          available: 0,
          taken: 0,
          errors: 0,
          rateLimited: 0,
          durationMs: Date.now() - startedAt,
          hits: [],
          message: problem,
        };
      }

      const amount = Math.min(
        job.batchSize,
        this.mode === "serverless" ? 8 : 200,
        options.manual ? 48 : 200
      );
      const batch = generateBatch(job, amount);

      if (!batch.names.length) {
        await updateData((d) => {
          const target = d.jobs.find((j) => j.id === jobId);
          if (target) {
            target.enabled = false;
            target.lastError = null;
          }
          d.logs.unshift({
            id: uid("log"),
            ts: Date.now(),
            jobId,
            level: "info",
            platform: job.platform,
            username: null,
            message: `Varredura de "${job.name}" concluída. Nenhum nome restante no intervalo configurado.`,
            latencyMs: null,
            proxy: null,
          });
          d.logs = d.logs.slice(0, 150);
        });
        return {
          jobId,
          jobName: job.name,
          checked: 0,
          available: 0,
          taken: 0,
          errors: 0,
          rateLimited: 0,
          durationMs: Date.now() - startedAt,
          hits: [],
          message: "Varredura concluída",
        };
      }

      const recent = this.recent.get(jobId) ?? new Set<string>();
      const names = batch.names.filter((name) => {
        if (recent.has(name)) return false;
        recent.add(name);
        return isValidName(job.platform, name);
      });
      if (recent.size > 6000) {
        const trimmed = Array.from(recent).slice(-4000);
        this.recent.set(jobId, new Set(trimmed));
      } else {
        this.recent.set(jobId, recent);
      }

      const passwords = new Map<string, string>();
      for (const proxy of data.proxies) {
        passwords.set(proxy.id, decryptSecret(proxy.password));
      }
      const pool = new ProxyPool(data.proxies, passwords);
      const concurrency = Math.max(
        1,
        Math.min(
          job.concurrency,
          data.settings.engine.maxConcurrency,
          job.platform === "discord" ? 2 : 8
        )
      );

      const results = await runPool(names, concurrency, async (name) => {
        const proxy = job.useProxies ? pool.pick() : null;
        const ctx: CheckContext = { ...ctxBase, proxy };
        const out = await checkName(job.platform, name, ctx);
        pool.report(proxy, out);
        return { name, out };
      });

      const available = results.filter((r) => r.out.status === "available");
      const taken = results.filter((r) => r.out.status === "taken").length;
      const errors = results.filter(
        (r) => r.out.status === "error" || r.out.status === "unconfigured" || r.out.status === "unsupported"
      ).length;
      const rateLimited = results.filter((r) => r.out.status === "rate_limited").length;

      const retryAfter = Math.max(
        0,
        ...results.map((r) => r.out.retryAfterMs ?? 0)
      );
      if (rateLimited > 0) {
        this.cooldowns.set(jobId, Date.now() + Math.max(15_000, retryAfter));
      }

      const lastError =
        rateLimited > 0
          ? results.find((r) => r.out.status === "rate_limited")?.out.detail ?? "Limite de requisições"
          : results.find((r) => r.out.status === "error")?.out.detail ?? null;

      const newHits: Hit[] = [];

      await updateData((d) => {
        const target = d.jobs.find((j) => j.id === jobId);
        if (!target) return;
        target.checked += results.length;
        target.lastRunAt = startedAt;
        target.cursor = batch.cursor;
        target.lastError = lastError;
        if (batch.exhausted) {
          target.enabled = false;
        }

        const now = Date.now();
        const logs: LogEntry[] = results.map((r) => ({
          id: uid("log"),
          ts: now,
          jobId,
          level: levelFor(r.out.status),
          platform: job.platform,
          username: r.name,
          message:
            r.out.status === "rate_limited"
              ? `Limite atingido — pausa automática (${r.out.detail})`
              : r.out.detail,
          latencyMs: r.out.latencyMs,
          proxy: r.out.proxyLabel,
        }));

        for (const r of available) {
          const exists = d.hits.some(
            (h) => h.platform === job.platform && h.username === r.name
          );
          if (exists) continue;
          const breakdown = scoreName(r.name);
          const hit: Hit = {
            id: uid("hit"),
            jobId: job.id,
            jobName: job.name,
            platform: job.platform,
            username: r.name,
            foundAt: now,
            latencyMs: r.out.latencyMs,
            score: breakdown.score,
            notified: false,
          };
          newHits.push(hit);
          target.found += 1;
        }

        if (newHits.length) {
          d.hits = [...newHits, ...d.hits].slice(0, 800);
        }
        d.logs = [...logs.reverse(), ...d.logs].slice(0, 150);

        const stats = d.stats;
        stats.checks += results.length;
        stats.available += available.length;
        stats.errors += errors;
        stats.rateLimited += rateLimited;
        const p = (stats.byPlatform[job.platform] ??= { checks: 0, available: 0 });
        p.checks += results.length;
        p.available += available.length;

        const minute = Math.floor(now / 60000) * 60000;
        let bucket = stats.buckets.find((b) => b.t === minute);
        if (!bucket) {
          bucket = { t: minute, checks: 0, available: 0, errors: 0 };
          stats.buckets.push(bucket);
          stats.buckets.sort((a, b) => a.t - b.t);
          if (stats.buckets.length > 90) stats.buckets = stats.buckets.slice(-90);
        }
        bucket.checks += results.length;
        bucket.available += available.length;
        bucket.errors += errors;

        for (const snapshot of pool.snapshot()) {
          const record = d.proxies.find((proxy) => proxy.id === snapshot.id);
          if (!record) continue;
          record.ok = snapshot.ok;
          record.latencyMs = snapshot.latencyMs;
          record.lastChecked = snapshot.lastChecked;
          record.failures = snapshot.failures;
          record.cooldownUntil = snapshot.cooldownUntil;
        }

        if (results.some((r) => r.out.credentialInvalid)) {
          if (job.platform === "discord" && d.credentials.discord) {
            d.credentials.discord.valid = false;
            d.credentials.discord.checkedAt = now;
          }
          if (job.platform === "github" && d.credentials.github) {
            d.credentials.github.valid = false;
            d.credentials.github.checkedAt = now;
          }
          if (job.platform === "twitch" && d.credentials.twitch) {
            d.credentials.twitch.valid = false;
            d.credentials.twitch.checkedAt = now;
          }
        }
      });

      // Alertas rodam fora do lock de escrita para não segurar o estado.
      if (newHits.length) {
        await this.dispatchAlerts(newHits, job);
      }

      return {
        jobId,
        jobName: job.name,
        checked: results.length,
        available: available.length,
        taken,
        errors,
        rateLimited,
        durationMs: Date.now() - startedAt,
        hits: newHits.map((h) => ({ username: h.username, score: h.score })),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro desconhecido";
      await updateData((d) => {
        const target = d.jobs.find((j) => j.id === jobId);
        if (target) target.lastError = message;
      }).catch(() => undefined);
      return {
        jobId,
        jobName: jobId,
        checked: 0,
        available: 0,
        taken: 0,
        errors: 1,
        rateLimited: 0,
        durationMs: Date.now() - startedAt,
        hits: [],
        message,
      };
    } finally {
      this.busy = false;
    }
  }

  private buildContext(data: DataShape): CheckContext {
    return {
      userAgent: data.settings.engine.userAgent,
      timeoutMs: data.settings.engine.timeoutMs,
      proxy: null,
      discordToken: decryptSecret(data.credentials.discord?.token),
      githubToken: decryptSecret(data.credentials.github?.token),
      twitchClientId: data.credentials.twitch?.clientId ?? "",
      twitchClientSecret: decryptSecret(data.credentials.twitch?.clientSecret),
    };
  }

  private async dispatchAlerts(hits: Hit[], job: Job): Promise<void> {
    const data = await readData();
    const alerts = data.settings.alerts;
    const telegramToken = decryptSecret(data.credentials.telegramBot?.token);
    const notifiedIds: string[] = [];

    for (const hit of hits) {
      if (job.minScore > 0 && hit.score < job.minScore) continue;
      let sent = false;
      if (alerts.discordEnabled) {
        sent = await notifyDiscordHit(hit, alerts, job);
      }
      if (alerts.telegramEnabled && telegramToken && alerts.telegramChatId) {
        const ok = await notifyTelegramHit(hit, telegramToken, alerts.telegramChatId);
        sent = sent || ok;
      }
      if (sent) notifiedIds.push(hit.id);
    }

    if (notifiedIds.length) {
      await updateData((d) => {
        for (const id of notifiedIds) {
          const hit = d.hits.find((h) => h.id === id);
          if (hit) hit.notified = true;
        }
      });
    }
  }

  async tick(): Promise<{
    ran: number;
    results: BatchResult[];
    paused: boolean;
    mode: "persistent" | "serverless";
    readOnly?: boolean;
  }> {
    this.lastTickAt = Date.now();
    if (this.mode === "persistent") {
      await this.ensureStarted();
      return { ran: 0, results: [], paused: false, mode: this.mode };
    }
    if (!stateStatus().writable) {
      return { ran: 0, results: [], paused: false, mode: this.mode, readOnly: true };
    }
    const data = await readData();
    if (data.settings.engine.paused) return { ran: 0, results: [], paused: true, mode: this.mode };

    const now = Date.now();
    const candidates = data.jobs
      .filter((job) => job.enabled && now - (job.lastRunAt ?? 0) >= job.intervalMs)
      .slice(0, 2);

    const results: BatchResult[] = [];
    for (const job of candidates) {
      const result = await this.execute(job.id);
      if (result) results.push(result);
    }
    return { ran: results.length, results, paused: false, mode: this.mode };
  }

  async runOnce(jobId: string): Promise<BatchResult | null> {
    return this.execute(jobId, { manual: true });
  }

  forget(jobId: string): void {
    this.recent.delete(jobId);
    this.cooldowns.delete(jobId);
    const timer = this.timers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(jobId);
    }
  }

  cooldownsSnapshot(): Record<string, number> {
    return Object.fromEntries(this.cooldowns);
  }
}

const globalRef = globalThis as typeof globalThis & { __atalaiaEngine?: Engine };
export const engine: Engine = globalRef.__atalaiaEngine ?? new Engine();
globalRef.__atalaiaEngine = engine;

export async function ensureEngineStarted(): Promise<void> {
  await engine.ensureStarted();
}
