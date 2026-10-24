"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, KeyRound, Loader2, Lock, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import type { PlatformState, BrandingSettings } from "@/lib/cloud/types";
import { BrandMark } from "@/components/brand";
import { cn } from "@/lib/utils";

interface PlanPreview {
  id: string;
  name: string;
  days: number;
  maxMonitors: number;
  priceCents: number;
}

interface GateProps {
  branding: BrandingSettings;
  platforms: PlatformState[];
  plans: PlanPreview[];
  discordConfigured: boolean;
  maintenance: boolean;
  requireDiscord: boolean;
  welcome: string;
  discordUser: { username: string; banned: boolean } | null;
}

const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function maskKey(value: string): string {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17);
  const groups = clean.match(/.{1,5}/g) ?? [];
  return groups.join("-");
}

export function Gate({
  branding,
  platforms,
  plans,
  discordConfigured,
  maintenance,
  requireDiscord,
  welcome,
  discordUser,
}: GateProps) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<"key" | "admin" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsDiscord, setNeedsDiscord] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const adminRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const failure = params.get("erro");
    if (failure) setError(failure);
    if (params.get("ok") === "discord" && discordUser) {
      setNotice(`Discord conectado como ${discordUser.username}. Agora ative sua key.`);
    }
    if (discordUser) keyRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enabled = useMemo(() => platforms.filter((platform) => platform.enabled), [platforms]);
  const soon = useMemo(() => platforms.filter((platform) => !platform.enabled), [platforms]);

  useEffect(() => {
    if (adminOpen) adminRef.current?.focus();
  }, [adminOpen]);

  async function submitKey(raw: string, mode: "key" | "admin") {
    if (!raw.trim()) {
      setError("Digite sua key.");
      return;
    }
    setBusy(mode);
    setError(null);
    setNotice(null);
    setNeedsDiscord(false);
    try {
      const response = await fetch("/api/auth/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: raw.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; redirect?: string; message?: string; reason?: string }
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
      setNotice(payload.message ?? "Acesso liberado.");
      window.location.href = payload.redirect ?? "/painel";
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-70" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-lime-500/[0.055] blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 noise" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1080px] flex-col px-5 pb-8 pt-6 sm:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-ink-800 text-bone-100">
              <BrandMark />
            </span>
            <div className="leading-none">
              <p className="text-[15px] font-semibold tracking-[-0.01em] text-bone-50">
                {branding.productName}
              </p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-bone-500">
                {branding.tagline}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                maintenance ? "bg-amberglow" : "bg-lime-400 animate-pulse-dot"
              )}
            />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-bone-400">
              {maintenance ? "manutenção" : "sistemas ativos"}
            </span>
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-center py-10">
          <div className="max-w-[600px]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-[3px] font-mono text-[9px] uppercase tracking-[0.18em] text-bone-400">
              <Sparkles className="h-2.5 w-2.5 text-lime-400" strokeWidth={2.2} />
              {discordUser ? "discord conectado" : "acesso restrito"}
            </span>
            <h1 className="mt-4 text-[32px] font-semibold leading-[1.08] tracking-[-0.03em] text-bone-50 sm:text-[40px]">
              Encontre o username
              <br />
              <span className="text-bone-400">antes de todo mundo.</span>
            </h1>
            <p className="mt-3 max-w-[470px] text-[13px] leading-relaxed text-bone-400">
              {welcome}
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {/* Discord */}
            <section
              className={cn(
                "group relative flex flex-col rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.035] to-white/[0.008] p-5",
                "transition-colors duration-200 hover:border-white/[0.11]"
              )}
            >
              <div className="flex items-start justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-[#8B9CFF]/20 bg-[#8B9CFF]/[0.09] text-[#AEB9FF]">
                  <DiscordGlyph />
                </span>
                <span className="rounded-full border border-lime-500/20 bg-lime-400/[0.07] px-2 py-[2px] font-mono text-[8.5px] uppercase tracking-[0.14em] text-lime-300">
                  recomendado
                </span>
              </div>
              <h2 className="mt-4 text-[15px] font-medium text-bone-50">
                {discordUser ? discordUser.username : "Entrar com Discord"}
              </h2>
              <p className="mt-1.5 text-[12px] leading-relaxed text-bone-500">
                {discordUser
                  ? "Conta conectada. Falta só ativar a key para liberar o console."
                  : "Vincula sua key à sua conta. Depois do primeiro login, entrar fica em um clique."}
              </p>
              <div className="mt-auto pt-5">
                <button
                  type="button"
                  disabled={!discordConfigured}
                  onClick={() => {
                    window.location.href = "/api/auth/discord/start";
                  }}
                  className={cn(
                    "flex h-10 w-full items-center justify-center gap-2 rounded-lg text-[12.5px] font-medium transition-colors",
                    discordConfigured
                      ? "bg-bone-50 text-ink-950 hover:bg-white"
                      : "cursor-not-allowed border border-white/[0.06] bg-white/[0.03] text-bone-500"
                  )}
                >
                  {discordConfigured ? (
                    <>
                      {discordUser ? "Trocar de conta" : "Conectar Discord"}
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </>
                  ) : (
                    <>
                      <Wrench className="h-3.5 w-3.5" strokeWidth={2} />
                      Em breve
                    </>
                  )}
                </button>
                {!discordConfigured ? (
                  <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-bone-600">
                    OAuth do Discord ainda não configurado
                  </p>
                ) : null}
              </div>
            </section>

            {/* Key */}
            <section className="relative flex flex-col rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.035] to-white/[0.008] p-5 transition-colors duration-200 hover:border-white/[0.11]">
              <div className="flex items-start justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-lime-500/20 bg-lime-400/[0.08] text-lime-300">
                  <KeyRound className="h-4 w-4" strokeWidth={1.9} />
                </span>
                {requireDiscord ? (
                  <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-[2px] font-mono text-[8.5px] uppercase tracking-[0.14em] text-bone-500">
                    exige discord
                  </span>
                ) : null}
              </div>
              <h2 className="mt-4 text-[15px] font-medium text-bone-50">Tenho uma key</h2>
              <p className="mt-1.5 text-[12px] leading-relaxed text-bone-500">
                Cole a key que você recebeu. A contagem de dias só começa na primeira ativação.
              </p>

              <form
                className="mt-auto pt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitKey(key, "key");
                }}
              >
                <input
                  ref={keyRef}
                  value={key}
                  onChange={(event) => setKey(maskKey(event.target.value))}
                  placeholder="ATL-XXXXX-XXXXX-XXXXX"
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="text"
                  className={cn(
                    "h-10 w-full rounded-lg border bg-ink-950/80 px-3 font-mono text-[12px] tracking-[0.08em] text-bone-100 outline-none transition-colors",
                    "placeholder:text-bone-600 placeholder:tracking-[0.03em]",
                    error ? "border-ember/40" : "border-white/[0.07] focus:border-lime-500/45"
                  )}
                />
                <button
                  type="submit"
                  disabled={busy !== null}
                  className={cn(
                    "mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-lime-500/25 bg-lime-400/[0.1] text-[12.5px] font-medium text-lime-300 transition-colors",
                    busy ? "opacity-70" : "hover:bg-lime-400/[0.16]"
                  )}
                >
                  {busy === "key" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      Ativar key
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </>
                  )}
                </button>
              </form>
            </section>
          </div>

          {error ? (
            <div className="mt-3 animate-fade-up rounded-lg border border-ember/25 bg-ember/[0.07] px-3.5 py-2.5">
              <p className="text-[12px] leading-relaxed text-[#FFB4A2]">{error}</p>
              {needsDiscord && discordConfigured ? (
                <a
                  href="/api/auth/discord/start"
                  className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-bone-100 underline-offset-4 hover:underline"
                >
                  Conectar Discord agora
                  <ArrowRight className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          ) : null}

          {notice ? (
            <div className="mt-3 rounded-lg border border-mint/25 bg-mint/[0.07] px-3.5 py-2.5 text-[12px] text-mint">
              {notice}
            </div>
          ) : null}

          {plans.length ? (
            <div className="mt-7">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-bone-600">
                planos disponíveis
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex items-baseline gap-2 rounded-lg border border-white/[0.055] bg-white/[0.018] px-3 py-2"
                  >
                    <span className="text-[12px] text-bone-200">{plan.name}</span>
                    <span className="font-mono text-[10px] text-bone-500">
                      {plan.days >= 3650 ? "vitalício" : `${plan.days}d`} ·{" "}
                      {plan.maxMonitors} mon
                    </span>
                    <span className="font-mono text-[10px] text-lime-300">{money(plan.priceCents)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-4">
            <div className="flex items-center gap-3 text-[11px] text-bone-600">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
                keys cifradas e sessões assinadas
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAdminOpen((value) => !value)}
              className="inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-bone-600 transition-colors hover:text-bone-300"
            >
              <Lock className="h-3 w-3" strokeWidth={1.9} />
              acesso administrativo
            </button>
          </div>

          {adminOpen ? (
            <form
              className="mt-3 animate-fade-up rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submitKey(adminKey, "admin");
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <input
                    ref={adminRef}
                    value={adminKey}
                    onChange={(event) => setAdminKey(event.target.value)}
                    type="password"
                    placeholder="key administrativa"
                    autoComplete="off"
                    className="h-9 w-full rounded-lg border border-white/[0.07] bg-ink-950/70 px-3 font-mono text-[12px] text-bone-100 outline-none focus:border-lime-500/40"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy !== null}
                  className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.05] px-3.5 text-[12px] text-bone-100 transition-colors hover:bg-white/[0.08]"
                >
                  {busy === "admin" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Lock className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                  Entrar no painel
                </button>
              </div>
              <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-bone-600">
                sessão de 12 horas · registrada em auditoria
              </p>
            </form>
          ) : null}
        </main>

        <PlatformDock enabled={enabled} soon={soon} />
      </div>
    </div>
  );
}

function PlatformDock({ enabled, soon }: { enabled: PlatformState[]; soon: PlatformState[] }) {
  return (
    <div className="relative">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-bone-600">plataformas</p>
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-bone-600">
          {enabled.length} liberada{enabled.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[...enabled, ...soon].map((platform) => (
          <div
            key={platform.id}
            title={platform.enabled ? `${platform.name} · liberado` : `${platform.name} · em breve`}
            className={cn(
              "flex min-w-[74px] flex-1 flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 transition-colors",
              platform.enabled
                ? "border-white/[0.07] bg-white/[0.03]"
                : "border-white/[0.04] bg-white/[0.012] opacity-45"
            )}
          >
            <span
              className="grid h-6 w-6 place-items-center rounded-[6px] border font-mono text-[8.5px] font-medium"
              style={
                platform.enabled
                  ? {
                      color: platform.accent || "#CBEF6E",
                      borderColor: `${platform.accent || "#CBEF6E"}33`,
                      backgroundColor: `${platform.accent || "#CBEF6E"}12`,
                    }
                  : { color: "#6C766B", borderColor: "rgba(255,255,255,0.06)" }
              }
            >
              {platform.short}
            </span>
            <span
              className={cn(
                "font-mono text-[8.5px] uppercase tracking-[0.08em]",
                platform.enabled ? "text-bone-400" : "text-bone-600"
              )}
            >
              {platform.name}
            </span>
            <span className="h-[3px] w-6 rounded-full bg-white/[0.05] overflow-hidden">
              <span
                className={cn("block h-full rounded-full", platform.enabled ? "w-full bg-lime-500/70" : "w-1/3 bg-white/10")}
              />
            </span>
          </div>
        ))}
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
