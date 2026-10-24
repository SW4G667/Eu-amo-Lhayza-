import { promises as fs } from "fs";
import path from "path";
import { githubStateConfig, readGithubState, writeGithubState } from "./github-state";
import type { DataShape, Job } from "./types";

const REDIS_KEY = "atalaia:state:v1";
const FILE_PATH = path.join(process.cwd(), ".data", "state.json");

type Driver = "file" | "redis" | "github" | "memory";

function redisConfig(): { url: string; token: string } | null {
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

export function storageDriver(): Driver {
  const forced = (process.env.ATALAIA_STATE_MODE || "").toLowerCase();
  if (forced === "file") return "file";
  if (forced === "memory") return "memory";
  if (forced === "redis") return "redis";
  if (forced === "github") return "github";
  // token do ambiente ou enviado pelo navegador em Ajustes → Conexão GitHub
  if (githubStateConfig()) return "github";
  if (redisConfig()) return "redis";
  if (process.env.VERCEL === "1") return "memory";
  return "file";
}

export function storageLabel(): string {
  const driver = storageDriver();
  if (driver === "github") return "GitHub Actions";
  if (driver === "redis") return "Redis";
  if (driver === "file") return "Arquivo local";
  return "Memória";
}

export interface StateStatus {
  driver: Driver;
  label: string;
  writable: boolean;
  repo: string | null;
  branch: string | null;
  syncedAt: number | null;
}

export function stateStatus(): StateStatus {
  const driver = storageDriver();
  const cfg = githubStateConfig();
  if (driver === "github" && cfg) {
    return {
      driver,
      label: "GitHub Actions",
      writable: cfg.writable,
      repo: cfg.repo,
      branch: cfg.branch,
      syncedAt: githubCache?.at ?? null,
    };
  }
  return {
    driver,
    label: storageLabel(),
    writable: driver !== "memory" || Boolean(process.env.VERCEL),
    repo: null,
    branch: null,
    syncedAt: null,
  };
}

function now() {
  return Date.now();
}

function seedJob(
  id: string,
  name: string,
  platform: Job["platform"],
  lengths: number[],
  overrides: Partial<Job> = {}
): Job {
  return {
    id,
    name,
    platform,
    enabled: false,
    mode: "sequential",
    lengths,
    charset: "abcdefghijklmnopqrstuvwxyz",
    pattern: "",
    words: [],
    batchSize: 5,
    intervalMs: 7000,
    concurrency: 1,
    useProxies: true,
    minScore: 0,
    cursor: null,
    checked: 0,
    found: 0,
    createdAt: now(),
    lastRunAt: null,
    lastError: null,
    ...overrides,
  };
}

export function createEmptyData(): DataShape {
  return {
    version: 1,
    settings: {
      alerts: {
        discordWebhook: "",
        discordEnabled: false,
        mention: "",
        telegramEnabled: false,
        telegramChatId: "",
      },
      engine: {
        paused: false,
        jitterPct: 18,
        timeoutMs: 12000,
        maxConcurrency: 2,
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    },
    jobs: [
      seedJob("job_seed_discord", "3 e 4 letras · Discord", "discord", [3, 4], {
        batchSize: 5,
        intervalMs: 7000,
        concurrency: 1,
      }),
      seedJob("job_seed_tiktok", "3 letras · TikTok", "tiktok", [3], {
        batchSize: 5,
        intervalMs: 7000,
        concurrency: 1,
      }),
      seedJob("job_seed_instagram", "3 letras · Instagram", "instagram", [3], {
        batchSize: 5,
        intervalMs: 7000,
        concurrency: 1,
      }),
      seedJob("job_seed_github", "4 letras · GitHub", "github", [4], {
        batchSize: 5,
        intervalMs: 7000,
        concurrency: 1,
      }),
      seedJob("job_seed_steam", "3 e 4 letras · Steam", "steam", [3, 4], {
        batchSize: 5,
        intervalMs: 7000,
        concurrency: 1,
        enabled: true,
      }),
    ],
    hits: [],
    proxies: [],
    logs: [
      {
        id: "log_boot",
        ts: now(),
        level: "info",
        platform: null,
        username: null,
        message: "Console iniciado. Pronto para receber monitores.",
        latencyMs: null,
        proxy: null,
      },
    ],
    stats: {
      checks: 0,
      available: 0,
      errors: 0,
      rateLimited: 0,
      byPlatform: {},
      buckets: [],
      startedAt: now(),
    },
    credentials: {},
  };
}

function globalStore(): { memory?: DataShape } {
  const g = globalThis as typeof globalThis & { __atalaiaStore?: { memory?: DataShape } };
  if (!g.__atalaiaStore) g.__atalaiaStore = {};
  return g.__atalaiaStore;
}

function normalize(data: Partial<DataShape> | null): DataShape {
  const base = createEmptyData();
  if (!data || typeof data !== "object") return base;
  return {
    version: 1,
    settings: {
      alerts: { ...base.settings.alerts, ...(data.settings?.alerts ?? {}) },
      engine: { ...base.settings.engine, ...(data.settings?.engine ?? {}) },
    },
    jobs: Array.isArray(data.jobs) ? data.jobs : base.jobs,
    hits: Array.isArray(data.hits) ? data.hits : [],
    proxies: Array.isArray(data.proxies) ? data.proxies : [],
    logs: Array.isArray(data.logs) ? data.logs : [],
    stats: {
      checks: data.stats?.checks ?? 0,
      available: data.stats?.available ?? 0,
      errors: data.stats?.errors ?? 0,
      rateLimited: data.stats?.rateLimited ?? 0,
      byPlatform: data.stats?.byPlatform ?? {},
      buckets: Array.isArray(data.stats?.buckets) ? data.stats!.buckets : [],
      startedAt: data.stats?.startedAt ?? base.stats.startedAt,
    },
    credentials: data.credentials ?? {},
    runner: data.runner ?? null,
  };
}

async function readRedis(): Promise<DataShape | null> {
  const cfg = redisConfig();
  if (!cfg) return null;
  try {
    const res = await fetch(`${cfg.url}/get/${encodeURIComponent(REDIS_KEY)}`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: string | null };
    if (!body.result) return null;
    return normalize(JSON.parse(body.result));
  } catch {
    return null;
  }
}

async function writeRedis(data: DataShape) {
  const cfg = redisConfig();
  if (!cfg) return;
  await fetch(`${cfg.url}/set/${encodeURIComponent(REDIS_KEY)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

async function readFile(): Promise<DataShape | null> {
  try {
    const raw = await fs.readFile(FILE_PATH, "utf8");
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeFile(data: DataShape) {
  await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
  const tmp = `${FILE_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data), "utf8");
  await fs.rename(tmp, FILE_PATH);
}

let cache: DataShape | null = null;

interface GithubCache {
  data: DataShape;
  at: number;
}

let githubCache: GithubCache | null = null;
let githubPending: DataShape | null = null;
let githubTimer: ReturnType<typeof setTimeout> | null = null;
let githubLastError: string | null = null;
let githubFlush: Promise<void> | null = null;

function stateTtlMs(): number {
  const raw = Number.parseInt(process.env.ATALAIA_STATE_TTL_MS ?? "", 10);
  if (Number.isFinite(raw) && raw >= 0) return raw;
  return process.env.VERCEL === "1" ? 7000 : 4000;
}

function flushIntervalMs(): number {
  const raw = Number.parseInt(process.env.ATALAIA_STATE_FLUSH_MS ?? "", 10);
  return Number.isFinite(raw) && raw >= 5000 ? raw : 25000;
}

function deferWrites(): boolean {
  return Boolean(process.env.ATALAIA_STATE_DEFER);
}

async function readGithub(): Promise<DataShape> {
  const cfg = githubStateConfig();
  if (!cfg) return createEmptyData();
  const fresh = githubCache && Date.now() - githubCache.at < stateTtlMs();
  if (fresh) return structuredClone(githubCache!.data);
  try {
    const remote = await readGithubState(cfg);
    const data = remote ? normalize(remote as Partial<DataShape>) : githubCache?.data ?? createEmptyData();
    githubCache = { data, at: Date.now() };
    githubLastError = null;
    return structuredClone(data);
  } catch (error) {
    githubLastError = error instanceof Error ? error.message : String(error);
    if (githubCache) return structuredClone(githubCache.data);
    return createEmptyData();
  }
}

export function lastStateError(): string | null {
  return githubLastError;
}

async function pushGithub(data: DataShape): Promise<void> {
  const cfg = githubStateConfig();
  if (!cfg) return;
  await writeGithubState(cfg, data);
  githubCache = { data: structuredClone(data), at: Date.now() };
  githubLastError = null;
}

/** Envia agora qualquer alteração pendente (modo diferido do runner). */
export async function flushData(): Promise<void> {
  if (githubFlush) await githubFlush;
  if (!githubPending) return;
  const pending = githubPending;
  githubPending = null;
  if (githubTimer) {
    clearTimeout(githubTimer);
    githubTimer = null;
  }
  const run = pushGithub(pending)
    .catch((error) => {
      githubLastError = error instanceof Error ? error.message : String(error);
      githubPending = pending;
    })
    .finally(() => {
      githubFlush = null;
    });
  githubFlush = run;
  await run;
}

function scheduleFlush(data: DataShape): void {
  githubPending = structuredClone(data);
  githubCache = { data: structuredClone(data), at: Date.now() };
  if (githubTimer) return;
  githubTimer = setTimeout(() => {
    githubTimer = null;
    void flushData();
  }, flushIntervalMs());
  // não segura o processo do runner vivo só por causa do timer
  if (typeof githubTimer === "object" && githubTimer && "unref" in githubTimer) {
    (githubTimer as { unref: () => void }).unref();
  }
}

export async function readData(): Promise<DataShape> {
  const driver = storageDriver();
  if (driver === "memory") {
    const g = globalStore();
    if (!g.memory) g.memory = createEmptyData();
    return structuredClone(g.memory);
  }
  if (driver === "github") {
    return readGithub();
  }
  if (driver === "redis") {
    const data = await readRedis();
    if (data) return data;
    const fresh = cache ?? createEmptyData();
    await writeRedis(fresh);
    cache = fresh;
    return structuredClone(fresh);
  }
  const data = await readFile();
  if (data) return data;
  const fresh = createEmptyData();
  await writeFile(fresh);
  return fresh;
}

export async function writeData(data: DataShape): Promise<void> {
  data.version = 1;
  const driver = storageDriver();
  if (driver === "memory") {
    globalStore().memory = structuredClone(data);
    return;
  }
  if (driver === "github") {
    if (deferWrites()) {
      scheduleFlush(data);
      return;
    }
    await pushGithub(data);
    return;
  }
  if (driver === "redis") {
    cache = structuredClone(data);
    await writeRedis(data);
    return;
  }
  await writeFile(data);
}

let chain: Promise<unknown> = Promise.resolve();

export async function updateData<T>(
  mutator: (data: DataShape) => T | Promise<T>
): Promise<T> {
  const run = chain.then(async () => {
    const data = await readData();
    const result = await mutator(data);
    await writeData(data);
    return result;
  });
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run as Promise<T>;
}

export const paths = { FILE_PATH };
