import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = "id"): string {
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj?.randomUUID) return `${prefix}_${cryptoObj.randomUUID().replace(/-/g, "").slice(0, 14)}`;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function nfmt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0";
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function compactNumber(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0).replace(".", ",")}k`;
  return `${(value / 1_000_000).toFixed(1).replace(".", ",")}m`;
}

export function timeAgo(ts: number | null | undefined): string {
  if (!ts) return "—";
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 5000) return "agora";
  if (diff < 60_000) return `há ${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `há ${Math.floor(diff / 3_600_000)}h`;
  return `há ${Math.floor(diff / 86_400_000)}d`;
}

export function clock(ts: number | null | undefined): string {
  if (!ts) return "--:--:--";
  return new Date(ts).toLocaleTimeString("pt-BR", { hour12: false });
}

export function dateShort(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function duration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isFinite(n) ? n : fallback;
}

export function maskMiddle(value: string, visible = 4): string {
  if (!value) return "";
  if (value.length <= visible * 2) return "•".repeat(value.length);
  return `${value.slice(0, visible)}${"•".repeat(Math.max(6, value.length - visible * 2))}${value.slice(-visible)}`;
}

export function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
