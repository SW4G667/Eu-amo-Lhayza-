"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import type { BrandingSettings } from "@/lib/cloud/types";
import { cn } from "@/lib/utils";

interface GateProps {
  branding: BrandingSettings;
  discordConfigured: boolean;
  discordUser: { username: string; banned: boolean } | null;
  maintenance: boolean;
  welcome: string;
  requireDiscord: boolean;
}

/**
 * Só formata keys de licença (ATL-...). A key administrativa é texto livre:
 * mexer nela (maiúsculas/hífens) fazia o login do admin falhar.
 */
function maskKey(value: string): string {
  if (/^\s*atl/i.test(value)) {
    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17);
    return (clean.match(/.{1,5}/g) ?? []).join("-");
  }
  return value.slice(0, 64);
}

export function Gate({
  branding,
  discordConfigured,
  discordUser,
  maintenance,
  welcome,
  requireDiscord,
}: GateProps) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsDiscord, setNeedsDiscord] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const failure = params.get("erro");
    if (failure) setError(failure);
    if (params.get("ok") === "discord" && discordUser) {
      setKey("");
    }
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    const raw = key.trim();
    if (!raw) {
      setError("Cole sua key para entrar.");
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    setNeedsDiscord(false);
    try {
      const response = await fetch("/api/auth/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: raw }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; redirect?: string; reason?: string }
        | null;

      if (payload?.reason === "discord_required") {
        setNeedsDiscord(true);
        setError(payload.error ?? "Conecte o Discord antes de usar esta key.");
        return;
      }
      if (!response.ok || !payload?.ok) {
        setError(payload?.error ?? `Não foi possível validar (${response.status}).`);
        return;
      }
      window.location.href = payload.redirect ?? "/painel";
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-transparent px-5 py-10">
      {/* brilho suave, sem textura pesada */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-lime-500/[0.07] blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-[360px] w-[520px] rounded-full bg-[#8B9CFF]/[0.06] blur-[130px]" />

      <div className="relative w-full max-w-[380px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="mb-3 grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-bone-100 backdrop-blur-xl">
            <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={1.7} />
          </span>
          <h1 className="text-[17px] font-medium tracking-[-0.01em] text-bone-50">
            {branding.productName}
          </h1>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-bone-600">
            {maintenance ? "em manutenção" : branding.tagline}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 shadow-[0_24px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
          {/* Discord */}
          <button
            type="button"
            disabled={!discordConfigured}
            onClick={() => {
              window.location.href = "/api/auth/discord/start";
            }}
            className={cn(
              "flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-medium transition-colors",
              discordConfigured
                ? "bg-[#5865F2] text-white hover:bg-[#4a57e6]"
                : "cursor-not-allowed border border-white/[0.06] bg-white/[0.03] text-bone-600"
            )}
          >
            <DiscordGlyph />
            {discordUser ? discordUser.username : "Entrar com Discord"}
            {!discordConfigured ? (
              <span className="ml-1 rounded-full border border-white/10 px-1.5 py-[1px] font-mono text-[8.5px] uppercase tracking-[0.08em]">
                em breve
              </span>
            ) : null}
          </button>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-white/[0.07]" />
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-bone-700">ou</span>
            <span className="h-px flex-1 bg-white/[0.07]" />
          </div>

          {/* Key */}
          <div className="space-y-2">
            <div className="relative">
              <KeyRound
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-bone-600"
                strokeWidth={1.9}
              />
              <input
                ref={inputRef}
                value={key}
                onChange={(event) => {
                  setKey(maskKey(event.target.value));
                  if (error) setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submit();
                }}
                placeholder="ATL-XXXXX-XXXXX-XXXXX"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={cn(
                  "h-11 w-full rounded-xl border bg-black/25 pl-9 pr-3 font-mono text-[12px] tracking-[0.09em] text-bone-100 outline-none transition-colors backdrop-blur",
                  "placeholder:tracking-[0.02em] placeholder:text-bone-700",
                  error ? "border-ember/40" : "border-white/[0.09] focus:border-lime-500/50"
                )}
              />
            </div>

            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className={cn(
                "flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-lime-500/25 bg-lime-400/[0.12] text-[12.5px] font-medium text-lime-200 transition-colors",
                busy ? "opacity-70" : "hover:bg-lime-400/[0.18]"
              )}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                </>
              )}
            </button>
          </div>

          {error ? (
            <div className="mt-3 rounded-lg border border-ember/25 bg-ember/[0.08] px-3 py-2">
              <p className="text-[11.5px] leading-relaxed text-[#FFB4A2]">{error}</p>
              {needsDiscord ? (
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/api/auth/discord/start";
                  }}
                  disabled={!discordConfigured}
                  className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-bone-200 underline-offset-4 hover:underline disabled:opacity-50"
                >
                  {discordConfigured ? "conectar discord agora" : "discord ainda não configurado"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <p className="mt-4 text-center text-[10.5px] leading-relaxed text-bone-700">
          {discordUser
            ? "Discord conectado. Cole sua key para liberar o console."
            : requireDiscord
              ? "A key só ativa com o Discord conectado."
              : welcome}
        </p>
      </div>
    </div>
  );
}

function DiscordGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
      <path d="M19.3 5.4A16.4 16.4 0 0 0 15.2 4l-.3.6a12 12 0 0 0-5.8 0L8.8 4a16.4 16.4 0 0 0-4.1 1.4C2.1 9.2 1.5 12.9 1.8 16.6a16.7 16.7 0 0 0 5 2.5l.6-1a11 11 0 0 1-1.8-.9l.4-.3a11.8 11.8 0 0 0 10.1 0l.4.3c-.6.4-1.2.7-1.8.9l.6 1a16.6 16.6 0 0 0 5-2.5c.4-4.3-.6-8-2.6-11.2ZM8.6 14.4c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.8 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
    </svg>
  );
}
