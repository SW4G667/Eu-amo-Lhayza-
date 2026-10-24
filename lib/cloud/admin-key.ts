import { safeEqual } from "./keys";

const FALLBACK = "access-6xy-67";

/** Key mestra do painel administrativo. */
export function adminKey(): string {
  return (process.env.ADMIN_KEY || FALLBACK).trim();
}

/** Avisa no painel quando a key ainda é a de fábrica. */
export function usingFallbackAdminKey(): boolean {
  return !process.env.ADMIN_KEY;
}

export function matchesAdminKey(input: string): boolean {
  const candidate = (input || "").trim();
  if (!candidate) return false;
  return safeEqual(candidate, adminKey());
}
