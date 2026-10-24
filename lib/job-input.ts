import { isPlatformId, PLATFORMS } from "./platforms";
import type { Job, JobMode } from "./types";
import { clamp, uid } from "./utils";

const MODES: JobMode[] = ["sequential", "random", "pattern", "wordlist"];

export interface JobInput {
  name?: string;
  platform?: string;
  mode?: string;
  lengths?: number[] | string;
  charset?: string;
  pattern?: string;
  words?: string[] | string;
  batchSize?: number;
  intervalMs?: number;
  concurrency?: number;
  useProxies?: boolean;
  minScore?: number;
  enabled?: boolean;
}

function toLengths(value: JobInput["lengths"], platformMin: number, platformMax: number): number[] {
  const raw = Array.isArray(value)
    ? value
    : String(value ?? "")
        .split(/[\s,;]+/)
        .filter(Boolean);
  const parsed = raw
    .map((n) => Math.floor(Number(n)))
    .filter((n) => Number.isFinite(n) && n >= platformMin && n <= Math.min(platformMax, 16));
  const unique = Array.from(new Set(parsed)).sort((a, b) => a - b);
  return unique.slice(0, 5);
}

function toWords(value: JobInput["words"]): string[] {
  const raw = Array.isArray(value) ? value : String(value ?? "").split(/[\n,;]+/);
  return Array.from(
    new Set(
      raw
        .flatMap((entry) => String(entry).split(/\s+/))
        .map((word) => word.trim().toLowerCase())
        .filter((word) => word.length > 0 && word.length <= 32)
    )
  ).slice(0, 3000);
}

export function buildJob(
  input: JobInput,
  existing?: Job
): { ok: true; job: Job } | { ok: false; error: string } {
  const platformRaw = input.platform ?? existing?.platform ?? "discord";
  if (!isPlatformId(platformRaw)) return { ok: false, error: "Plataforma inválida" };
  const meta = PLATFORMS[platformRaw];

  const mode = (input.mode ?? existing?.mode ?? "sequential") as JobMode;
  if (!MODES.includes(mode)) return { ok: false, error: "Modo inválido" };

  const lengths = toLengths(
    input.lengths ?? existing?.lengths ?? [3],
    meta.minLength,
    meta.maxLength
  );
  if (!lengths.length) {
    return {
      ok: false,
      error: `Escolha pelo menos um comprimento entre ${meta.minLength} e ${meta.maxLength}`,
    };
  }

  const charsetRaw = String(input.charset ?? existing?.charset ?? "abcdefghijklmnopqrstuvwxyz")
    .toLowerCase()
    .split("")
    .filter((ch) => meta.charset.includes(ch));
  const charset = Array.from(new Set(charsetRaw)).join("");
  if (!charset) return { ok: false, error: "Conjunto de caracteres inválido para a plataforma" };

  let pattern = String(input.pattern ?? existing?.pattern ?? "").toLowerCase().trim();
  if (mode === "pattern" && !pattern) pattern = "?".repeat(lengths[0]);
  if (mode === "pattern") {
    if (!/^[a-z0-9._?#*-]+$/.test(pattern)) {
      return { ok: false, error: "Máscara aceita letras, números, ? # * - . _" };
    }
    if (pattern.length < meta.minLength || pattern.length > meta.maxLength) {
      return { ok: false, error: `A máscara precisa ter entre ${meta.minLength} e ${meta.maxLength} caracteres` };
    }
  }

  const words = toWords(input.words ?? existing?.words ?? []);

  const batchSize = clamp(
    Math.floor(Number(input.batchSize ?? existing?.batchSize ?? 10)) || 10,
    1,
    200
  );
  const intervalMs = clamp(
    Math.floor(Number(input.intervalMs ?? existing?.intervalMs ?? 2000)) || 2000,
    500,
    600_000
  );
  const concurrency = clamp(
    Math.floor(Number(input.concurrency ?? existing?.concurrency ?? 1)) || 1,
    1,
    8
  );
  const minScore = clamp(Math.floor(Number(input.minScore ?? existing?.minScore ?? 0)) || 0, 0, 99);

  const fallbackName = `${meta.name} · ${lengths.join("/")} letras`;
  const name = String(input.name ?? existing?.name ?? fallbackName).trim().slice(0, 60) || fallbackName;

  const configChanged =
    existing &&
    (existing.mode !== mode ||
      existing.platform !== platformRaw ||
      existing.charset !== charset ||
      existing.lengths.join(",") !== lengths.join(","));

  const job: Job = {
    id: existing?.id ?? uid("job"),
    owner: existing?.owner ?? null,
    name,
    platform: platformRaw,
    enabled: Boolean(input.enabled ?? existing?.enabled ?? false),
    mode,
    lengths,
    charset,
    pattern,
    words,
    batchSize,
    intervalMs,
    concurrency,
    useProxies: Boolean(input.useProxies ?? existing?.useProxies ?? false),
    minScore,
    cursor: configChanged ? null : existing?.cursor ?? null,
    checked: existing?.checked ?? 0,
    found: existing?.found ?? 0,
    createdAt: existing?.createdAt ?? Date.now(),
    lastRunAt: existing?.lastRunAt ?? null,
    lastError: existing?.lastError ?? null,
  };

  return { ok: true, job };
}
