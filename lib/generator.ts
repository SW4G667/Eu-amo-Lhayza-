import crypto from "crypto";
import type { Job, PlatformId } from "./types";
import { PLATFORMS } from "./platforms";
import { allWords } from "./words";
import { scoreName } from "./score";

export interface GeneratedBatch {
  names: string[];
  cursor: string | null;
  exhausted: boolean;
}

export function uniqueCharset(charset: string): string {
  return Array.from(new Set(charset.split(""))).join("");
}

export function isValidName(platform: PlatformId, raw: string): boolean {
  const meta = PLATFORMS[platform];
  const name = raw.toLowerCase();
  if (name.length < meta.minLength || name.length > meta.maxLength) return false;
  for (const ch of name) {
    if (!meta.charset.includes(ch)) return false;
  }
  if (platform === "discord") {
    if (name.startsWith(".") || name.endsWith(".")) return false;
    if (name.includes("..")) return false;
  }
  if (platform === "github") {
    if (name.startsWith("-") || name.endsWith("-")) return false;
    if (name.includes("--")) return false;
  }
  return true;
}

function indexToName(index: number, length: number, charset: string): string {
  const base = charset.length;
  let rest = index;
  const out: string[] = new Array(length).fill(charset[0]);
  for (let pos = length - 1; pos >= 0; pos -= 1) {
    out[pos] = charset[rest % base];
    rest = Math.floor(rest / base);
  }
  return out.join("");
}

export function totalPossibilities(job: Job): number | null {
  const charset = uniqueCharset(job.charset);
  if (!charset.length) return null;
  if (job.mode === "sequential") {
    return job.lengths.reduce(
      (acc, len) => acc + Math.pow(charset.length, Math.max(1, len)),
      0
    );
  }
  if (job.mode === "wordlist") {
    return wordPool(job).length;
  }
  return null;
}

export function progressOf(job: Job): number | null {
  const total = totalPossibilities(job);
  if (!total) return null;
  if (job.mode === "sequential") {
    const [lenRaw, indexRaw] = (job.cursor ?? "").split(":");
    const len = Number(lenRaw);
    const index = Number(indexRaw);
    if (!len || Number.isNaN(index)) return 0;
    const lengths = [...job.lengths].sort((a, b) => a - b);
    const charset = uniqueCharset(job.charset);
    let done = 0;
    for (const l of lengths) {
      if (l < len) done += Math.pow(charset.length, l);
      else if (l === len) done += index;
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

export function wordPool(job: Job): string[] {
  const custom = job.words
    .flatMap((w) => w.split(/[\s,;]+/))
    .map((w) => w.toLowerCase().replace(/[^a-z0-9._-]/g, ""))
    .filter((w) => w.length >= 2 && isValidName(job.platform, w));
  const builtin = allWords().filter(
    (w) => job.lengths.includes(w.length) && isValidName(job.platform, w)
  );
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const word of [...custom, ...builtin]) {
    if (seen.has(word)) continue;
    seen.add(word);
    merged.push(word);
  }
  return merged.sort((a, b) => scoreName(b).score - scoreName(a).score || a.localeCompare(b));
}

function randomChars(length: number, charset: string): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += charset[crypto.randomInt(0, charset.length)];
  }
  return out;
}

function fillPattern(pattern: string, charset: string): string {
  let out = "";
  for (const ch of pattern.toLowerCase()) {
    if (ch === "?") out += charset[crypto.randomInt(0, charset.length)];
    else if (ch === "#") out += String(crypto.randomInt(0, 10));
    else if (ch === "*") out += "abcdefghijklmnopqrstuvwxyz"[crypto.randomInt(0, 26)];
    else out += ch;
  }
  return out;
}

function safeDelayCursor(job: Job): { len: number; index: number } | null {
  const lengths = [...job.lengths].filter((n) => n > 0).sort((a, b) => a - b);
  if (!lengths.length) return null;
  if (!job.cursor || job.cursor === "done") return { len: lengths[0], index: 0 };
  const [lenRaw, indexRaw] = job.cursor.split(":");
  const len = Number(lenRaw);
  const index = Number(indexRaw);
  if (!lengths.includes(len) || Number.isNaN(index) || index < 0) {
    return { len: lengths[0], index: 0 };
  }
  return { len, index };
}

export function generateBatch(job: Job, amountRaw: number): GeneratedBatch {
  const amount = Math.max(1, Math.min(500, Math.floor(amountRaw || 1)));
  const charset = uniqueCharset(job.charset) || "abcdefghijklmnopqrstuvwxyz";
  const names: string[] = [];
  const seen = new Set<string>();

  const push = (name: string) => {
    if (!name || seen.has(name)) return;
    if (!isValidName(job.platform, name)) return;
    seen.add(name);
    names.push(name);
  };

  if (job.mode === "pattern") {
    const pattern = (job.pattern || "???").trim();
    let guard = 0;
    while (names.length < amount && guard < amount * 60) {
      guard += 1;
      push(fillPattern(pattern, charset));
    }
    return { names, cursor: job.cursor, exhausted: false };
  }

  if (job.mode === "wordlist") {
    const pool = wordPool(job);
    if (!pool.length) return { names: [], cursor: "done", exhausted: true };
    let index = Math.max(0, Number(job.cursor ?? "0") || 0);
    while (names.length < amount && index < pool.length) {
      push(pool[index]);
      index += 1;
    }
    const exhausted = index >= pool.length;
    return {
      names,
      cursor: exhausted ? "done" : String(index),
      exhausted,
    };
  }

  if (job.mode === "random") {
    const lengths = job.lengths.length
      ? job.lengths
      : [Math.max(PLATFORMS[job.platform].minLength, 3)];
    let guard = 0;
    while (names.length < amount && guard < amount * 80) {
      guard += 1;
      const len = lengths[crypto.randomInt(0, lengths.length)];
      push(randomChars(len, charset));
    }
    return { names, cursor: job.cursor, exhausted: false };
  }

  // sequential — varredura sistemática, sem repetir nenhum nome
  const lengths = [...job.lengths].filter((n) => n > 0).sort((a, b) => a - b);
  const start = safeDelayCursor(job);
  if (!lengths.length || !start) return { names: [], cursor: "done", exhausted: true };

  let { len, index } = start;
  let guard = 0;
  while (names.length < amount && guard < amount * 2000) {
    guard += 1;
    const max = Math.pow(charset.length, len);
    if (index >= max) {
      const pos = lengths.indexOf(len);
      if (pos === -1 || pos === lengths.length - 1) {
        return { names, cursor: "done", exhausted: true };
      }
      len = lengths[pos + 1];
      index = 0;
      continue;
    }
    push(indexToName(index, len, charset));
    index += 1;
    if (index >= Math.pow(charset.length, len)) {
      const pos = lengths.indexOf(len);
      if (pos === lengths.length - 1) {
        return { names, cursor: "done", exhausted: true };
      }
      len = lengths[pos + 1];
      index = 0;
    }
  }

  return { names, cursor: `${len}:${index}`, exhausted: false };
}
