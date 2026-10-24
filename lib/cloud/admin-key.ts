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

/**
 * Compara sem diferenciar maiúsculas/minúsculas: teclado de celular e
 * corretor automático mudam a caixa e trancavam o admin fora do painel.
 */
export function matchesAdminKey(input: string): boolean {
  const candidate = (input || "").trim().toLowerCase();
  if (!candidate) return false;
  return safeEqual(candidate, adminKey().toLowerCase());
}
