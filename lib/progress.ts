import type { Job } from "./types";
import { allWords } from "./words";

function uniqueCharset(charset: string): string {
  return Array.from(new Set(charset.split(""))).join("");
}

export function totalForJob(job: Job): number | null {
  const charset = uniqueCharset(job.charset);
  if (!charset.length) return null;
  if (job.mode === "sequential") {
    return job.lengths.reduce((acc, len) => acc + Math.pow(charset.length, Math.max(1, len)), 0);
  }
  if (job.mode === "wordlist") {
    const custom = job.words.join(" ").split(/\s+/).filter(Boolean).length;
    const builtin = allWords().filter((word) => job.lengths.includes(word.length)).length;
    return custom + builtin;
  }
  return null;
}

export function progressForJob(job: Job): number | null {
  const total = totalForJob(job);
  if (!total) return null;

  if (job.mode === "sequential") {
    const [lenRaw, indexRaw] = (job.cursor ?? "").split(":");
    const len = Number(lenRaw);
    const index = Number(indexRaw);
    if (!len || Number.isNaN(index)) return 0;
    const lengths = [...job.lengths].sort((a, b) => a - b);
    const charset = uniqueCharset(job.charset);
    let done = 0;
    for (const length of lengths) {
      if (length < len) done += Math.pow(charset.length, length);
      else if (length === len) done += index;
    }
    return Math.min(1, done / total);
  }

  if (job.mode === "wordlist") {
    const index = Number(job.cursor ?? "0");
    if (Number.isNaN(index)) return 0;
    return Math.min(1, index / Math.max(1, total));
  }

  return null;
}

export function modeLabel(mode: Job["mode"]): string {
  const labels: Record<Job["mode"], string> = {
    sequential: "sequencial",
    random: "aleatório",
    pattern: "máscara",
    wordlist: "dicionário",
  };
  return labels[mode];
}

export function intervalLabel(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  return `${seconds % 1 === 0 ? seconds.toFixed(0) : seconds.toFixed(1).replace(".", ",")}s`;
}

export function etaForJob(job: Job): number | null {
  const total = totalForJob(job);
  const progress = progressForJob(job);
  if (total === null || progress === null) return null;
  if (progress >= 1) return 0;
  const remaining = total * (1 - progress);
  const perSecond = job.batchSize / (job.intervalMs / 1000);
  if (perSecond <= 0) return null;
  return Math.round((remaining / perSecond) * 1000);
}
