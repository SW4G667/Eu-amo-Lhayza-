import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_SETTINGS } from "./types";

/**
 * Camada de persistência do Atalaia Cloud.
 *
 * Dois drivers com semântica idêntica:
 *  - `supabase`: PostgREST no schema `public`, tabelas `atl_*`, com a service_role
 *  - `local`: arquivo `.data/cloud.json` (desenvolvimento e testes offline)
 *
 * A API é deliberadamente simples (tabela + filtros em memória) porque o volume
 * é pequeno — licenças, usuários, planos — e assim os dois drivers se comportam
 * exatamente igual.
 */

export type Row = Record<string, unknown>;
export type TableName =
  | "plans"
  | "licenses"
  | "users"
  | "events"
  | "attempts"
  | "settings"
  | "platforms"
  | "proxies";

export type Driver = "supabase" | "local";

const SCHEMA = "public";
const PREFIX = "atl_";
const LOCAL_PATH = path.join(process.cwd(), ".data", "cloud.json");

const TS_KEYS = new Set([
  "createdAt",
  "updatedAt",
  "activatedAt",
  "expiresAt",
  "revokedAt",
  "lastSeenAt",
  "lastLoginAt",
  "lastCheckedAt",
]);

export function supabaseConfig(): { url: string; key: string } | null {
  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const ref = (process.env.SUPABASE_REF || "").trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ""
  ).trim();
  const base = url || (ref ? `https://${ref}.supabase.co` : "");
  if (!base || !key) return null;
  return { url: base, key };
}

export function driver(): Driver {
  const forced = (process.env.ATALAIA_DB_MODE || "").toLowerCase();
  if (forced === "local") return "local";
  return supabaseConfig() ? "supabase" : "local";
}

export function driverLabel(): string {
  return driver() === "supabase" ? "Supabase" : "Arquivo local";
}

/* ------------------------------------------------------------------ */
/* conversão camelCase <-> snake_case                                  */
/* ------------------------------------------------------------------ */

function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
}

function encodeRow(row: Row): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    const column = toSnake(key);
    if (value === undefined) continue;
    out[column] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}

function decodeRow(row: Row): Row {
  const out: Row = {};
  for (const [column, value] of Object.entries(row)) {
    const key = toCamel(column);
    if (TS_KEYS.has(key) && typeof value === "string") {
      const parsed = Date.parse(value);
      out[key] = Number.isFinite(parsed) ? parsed : null;
    } else {
      out[key] = value;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* driver Supabase                                                     */
/* ------------------------------------------------------------------ */

/** Nome físico da tabela no PostgREST (`atl_licenses`, `atl_plans`, ...). */
function tableName(table: TableName): string {
  return `${PREFIX}${table}`;
}

function supabaseHeaders(): Record<string, string> {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error("Supabase não configurado");
  const headers: Record<string, string> = {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  // `public` é o schema exposto por padrão; qualquer outro precisa de profile.
  if (SCHEMA !== "public") {
    headers["Accept-Profile"] = SCHEMA;
    headers["Content-Profile"] = SCHEMA;
  }
  return headers;
}

async function sb(url: string, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error("Supabase não configurado");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${cfg.url}/rest/v1${url}`, {
      ...init,
      headers: { ...supabaseHeaders(), ...(init.headers as Record<string, string> | undefined) },
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

async function sbRequest(url: string, init: RequestInit = {}): Promise<Row[]> {
  const response = await sb(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${text.slice(0, 220)}`);
  }
  if (!text) return [];
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? (parsed as Row[]) : [];
}

const supabaseAdapter = {
  async all(table: TableName, opts: { limit?: number; order?: string } = {}): Promise<Row[]> {
    const limit = opts.limit ?? 500;
    const order = opts.order ?? "created_at.desc";
    const rows = await sbRequest(`/${tableName(table)}?select=*&limit=${limit}&order=${order}`);
    return rows.map(decodeRow);
  },
  async insert(table: TableName, row: Row): Promise<void> {
    await sbRequest(`/${tableName(table)}`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(encodeRow(row)),
    });
  },
  async update(table: TableName, idValue: string, patch: Row, idColumn = "id"): Promise<void> {
    await sbRequest(`/${tableName(table)}?${idColumn}=eq.${encodeURIComponent(idValue)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(encodeRow(patch)),
    });
  },
  async remove(table: TableName, idValue: string, idColumn = "id"): Promise<void> {
    await sbRequest(`/${tableName(table)}?${idColumn}=eq.${encodeURIComponent(idValue)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
  },
  async upsert(table: TableName, rows: Row[], onConflict: string): Promise<void> {
    if (!rows.length) return;
    await sbRequest(`/${tableName(table)}?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.map(encodeRow)),
    });
  },
  async clear(table: TableName): Promise<void> {
    await sbRequest(`/${tableName(table)}?created_at=not.is.null`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
  },
};

/* ------------------------------------------------------------------ */
/* driver local (arquivo)                                              */
/* ------------------------------------------------------------------ */

interface LocalShape {
  plans: Row[];
  licenses: Row[];
  users: Row[];
  events: Row[];
  attempts: Row[];
  settings: Row[];
  platforms: Row[];
  proxies: Row[];
}

const PLATFORM_SEED = [
  ["discord", true, ""],
  ["tiktok", false, "Em breve"],
  ["instagram", false, "Em breve"],
  ["github", false, "Em breve"],
  ["telegram", false, "Em breve"],
  ["twitch", false, "Em breve"],
  ["steam", false, "Em breve"],
  ["roblox", false, "Em breve"],
  ["youtube", false, "Em breve"],
  ["reddit", false, "Em breve"],
  ["pinterest", false, "Em breve"],
] as const;

function seed(): LocalShape {
  const now = Date.now();
  return {
    plans: [
      { id: "starter", name: "Start", days: 7, maxMonitors: 1, maxChecksDay: 1500, priceCents: 1990, active: true, sort: 1, createdAt: now },
      { id: "pro", name: "Pro", days: 30, maxMonitors: 3, maxChecksDay: 8000, priceCents: 4990, active: true, sort: 2, createdAt: now },
      { id: "elite", name: "Elite", days: 90, maxMonitors: 6, maxChecksDay: 25000, priceCents: 9990, active: true, sort: 3, createdAt: now },
      { id: "lifetime", name: "Vitalício", days: 3650, maxMonitors: 10, maxChecksDay: 40000, priceCents: 24990, active: true, sort: 4, createdAt: now },
    ],
    licenses: [],
    users: [],
    events: [],
    attempts: [],
    settings: Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({
      key,
      value,
      updatedAt: now,
    })),
    platforms: PLATFORM_SEED.map(([id, enabled, note]) => ({
      id,
      enabled,
      note,
      updatedAt: now,
    })),
    proxies: [],
  };
}

let localData: LocalShape | null = null;
let localChain: Promise<unknown> = Promise.resolve();

async function loadLocal(): Promise<LocalShape> {
  if (localData) return localData;
  try {
    const raw = await fs.readFile(LOCAL_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalShape>;
    localData = { ...seed(), ...parsed } as LocalShape;
  } catch {
    localData = seed();
    await saveLocal();
  }
  return localData;
}

async function saveLocal(): Promise<void> {
  if (!localData) return;
  await fs.mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  const tmp = `${LOCAL_PATH}.${process.pid}.${Date.now().toString(36)}.${Math.floor(Math.random() * 1e6).toString(36)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(localData), "utf8");
  await fs.rename(tmp, LOCAL_PATH);
}

function mutateLocal<T>(fn: (data: LocalShape) => T): Promise<T> {
  const run = localChain.then(async () => {
    const data = await loadLocal();
    const result = fn(data);
    await saveLocal();
    return result;
  });
  localChain = run.then(
    () => undefined,
    () => undefined
  );
  return run as Promise<T>;
}

const localAdapter = {
  async all(table: TableName, opts: { limit?: number; order?: string } = {}): Promise<Row[]> {
    const data = await loadLocal();
    const rows = [...(data[table] as Row[])];
    const descending = (opts.order ?? "created_at.desc").endsWith("desc");
    const field = (opts.order ?? "created_at.desc").includes("created_at") ? "createdAt" : "updatedAt";
    rows.sort((a, b) => {
      const first = Number(a[field] ?? a.createdAt ?? 0);
      const second = Number(b[field] ?? b.createdAt ?? 0);
      return descending ? second - first : first - second;
    });
    return rows.slice(0, opts.limit ?? 500);
  },
  async insert(table: TableName, row: Row): Promise<void> {
    await mutateLocal((data) => {
      (data[table] as Row[]).push({ ...row });
    });
  },
  async update(table: TableName, idValue: string, patch: Row, idColumn = "id"): Promise<void> {
    await mutateLocal((data) => {
      const rows = data[table] as Row[];
      const index = rows.findIndex((row) => String(row[idColumn]) === idValue);
      if (index >= 0) rows[index] = { ...rows[index], ...patch };
    });
  },
  async remove(table: TableName, idValue: string, idColumn = "id"): Promise<void> {
    await mutateLocal((data) => {
      const rows = data[table] as Row[];
      const index = rows.findIndex((row) => String(row[idColumn]) === idValue);
      if (index >= 0) rows.splice(index, 1);
    });
  },
  async upsert(table: TableName, rows: Row[], onConflict: string): Promise<void> {
    const columns = onConflict.split(",").map((column) => column.trim());
    await mutateLocal((data) => {
      const target = data[table] as Row[];
      for (const row of rows) {
        const index = target.findIndex((existing) =>
          columns.every((column) => String(existing[column]) === String(row[column]))
        );
        if (index >= 0) target[index] = { ...target[index], ...row };
        else target.push({ ...row });
      }
    });
  },
  async clear(table: TableName): Promise<void> {
    await mutateLocal((data) => {
      data[table] = [];
    });
  },
};

/* ------------------------------------------------------------------ */

export interface TableApi {
  all(opts?: { limit?: number; order?: string }): Promise<Row[]>;
  insert(row: Row): Promise<void>;
  update(idValue: string, patch: Row, idColumn?: string): Promise<void>;
  remove(idValue: string, idColumn?: string): Promise<void>;
  upsert(rows: Row[], onConflict: string): Promise<void>;
  clear(): Promise<void>;
}

export function table(name: TableName): TableApi {
  const adapter = driver() === "supabase" ? supabaseAdapter : localAdapter;
  return {
    all: (opts) => adapter.all(name, opts),
    insert: (row) => adapter.insert(name, row),
    update: (idValue, patch, idColumn) => adapter.update(name, idValue, patch, idColumn),
    remove: (idValue, idColumn) => adapter.remove(name, idValue, idColumn),
    upsert: (rows, onConflict) => adapter.upsert(name, rows, onConflict),
    clear: () => adapter.clear(name),
  };
}

export function newId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${random.replace(/-/g, "").slice(0, 20)}`;
}
