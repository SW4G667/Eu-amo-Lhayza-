"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellRing,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Pause,
  Play,
  Radar,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Wordmark } from "@/components/brand";
import { Sparkline } from "@/components/charts";
import { apiRequest, useConsole } from "@/components/console-provider";
import { Badge, StatusDot } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, duration, nfmt } from "@/lib/utils";
import type { Snapshot } from "@/lib/snapshot-types";

const NAV = [
  {
    group: "Operação",
    items: [
      { href: "/painel", label: "Painel", icon: LayoutDashboard, desc: "Visão geral da operação" },
      { href: "/monitores", label: "Monitores", icon: Radar, desc: "Varreduras ativas e configuração" },
      { href: "/historico", label: "Histórico", icon: History, desc: "Nomes capturados e alertas" },
    ],
  },
  {
    group: "Rede",
    items: [
      { href: "/proxies", label: "Proxies", icon: Network, desc: "Pool de saída e rotação" },
      { href: "/alertas", label: "Alertas", icon: BellRing, desc: "Webhook do Discord e Telegram" },
    ],
  },
  {
    group: "Sistema",
    items: [
      { href: "/ajustes", label: "Ajustes", icon: SlidersHorizontal, desc: "Credenciais, motor e dados" },
    ],
  },
];

function pageInfo(pathname: string) {
  for (const group of NAV) {
    for (const item of group.items) {
      if (pathname.startsWith(item.href)) return item;
    }
  }
  return NAV[0].items[0];
}

export function ConsoleShell({ children }: { children: ReactNode }) {
  const { snapshot, refresh } = useConsole();
  const toast = useToast();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [clock, setClock] = useState("--:--:--");
  const [busy, setBusy] = useState(false);

  const active = pageInfo(pathname);
  const paused = snapshot?.settings.engine.paused ?? true;
  const activeJobs = snapshot?.jobs.filter((job) => job.enabled).length ?? 0;
  const spark = useMemo(() => {
    const buckets = snapshot?.stats.buckets ?? [];
    const last = buckets.slice(-18).map((bucket) => bucket.checks);
    return last.length ? last : [0, 0, 0, 0, 0, 0];
  }, [snapshot?.stats.buckets]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        now.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, []);

  async function toggleEngine() {
    setBusy(true);
    const result = await apiRequest<{ ok: boolean }>("/api/engine", {
      method: "POST",
      body: JSON.stringify({ action: paused ? "start" : "pause" }),
    });
    setBusy(false);
    if (!result.ok) {
      toast.push(result.error, "error");
      return;
    }
    toast.push(paused ? "Motor retomado." : "Motor pausado.", paused ? "success" : "info");
    await refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-ink-950">
      {open ? (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[238px] flex-col border-r border-white/[0.055] bg-[#090B0B] transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-[60px] items-center justify-between border-b border-white/[0.05] px-4">
          <Wordmark />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-7 w-7 place-items-center rounded-md text-bone-500 hover:bg-white/[0.05] hover:text-bone-100 lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((section) => (
            <div key={section.group} className="mb-5">
              <p className="mb-2 px-2 font-mono text-[9.5px] uppercase tracking-[0.19em] text-bone-500/80">
                {section.group}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[12.5px] transition-colors",
                          isActive
                            ? "bg-white/[0.045] font-medium text-bone-50"
                            : "text-bone-400 hover:bg-white/[0.025] hover:text-bone-100"
                        )}
                      >
                        {isActive ? (
                          <span className="absolute -left-3 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r bg-lime-400" />
                        ) : null}
                        <Icon
                          className={cn(
                            "h-[15px] w-[15px]",
                            isActive ? "text-lime-300" : "text-bone-500 group-hover:text-bone-300"
                          )}
                          strokeWidth={1.8}
                        />
                        {item.label}
                        {item.href === "/monitores" && activeJobs > 0 ? (
                          <span className="ml-auto rounded-full bg-white/[0.06] px-1.5 py-[1px] font-mono text-[9.5px] text-bone-300">
                            {activeJobs}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="space-y-3 border-t border-white/[0.05] p-3">
          <div className="rounded-lg border border-white/[0.06] bg-[#0C0F0F] p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-bone-500">
                motor
              </span>
              <StatusDot tone={paused ? "idle" : "ok"} pulse={!paused} />
            </div>
            <p className="mt-1.5 text-[12px] font-medium text-bone-100">
              {paused ? "Pausado" : "Rastreando"}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-bone-500">
              {activeJobs} {activeJobs === 1 ? "monitor" : "monitores"} ·{" "}
              {nfmt(snapshot?.stats.checks ?? 0)} checagens
            </p>
            <div className="mt-2">
              <Sparkline data={spark} height={26} className="h-[26px]" />
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] font-mono text-[10px] text-bone-300">
                AT
              </span>
              <div>
                <p className="text-[11px] leading-tight text-bone-200">operador</p>
                <p className="font-mono text-[9px] leading-tight text-bone-500">
                  {snapshot?.runtime.storage ?? "local"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="grid h-7 w-7 place-items-center rounded-md text-bone-500 transition-colors hover:bg-white/[0.05] hover:text-bone-100"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[238px]">
        <header className="sticky top-0 z-30 border-b border-white/[0.055] bg-ink-950/85 backdrop-blur-md">
          <div className="flex h-[60px] items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="grid h-8 w-8 place-items-center rounded-md border border-white/[0.07] text-bone-300 lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="hidden font-mono text-[9.5px] uppercase tracking-[0.16em] text-bone-500 sm:inline">
                  atalaia /
                </span>
                <h1 className="truncate text-[14px] font-medium tracking-[-0.005em] text-bone-50">
                  {active.label}
                </h1>
              </div>
              <p className="hidden truncate text-[11px] text-bone-500 sm:block">{active.desc}</p>
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <span className="font-mono text-[11px] tabular-nums text-bone-400">{clock}</span>
              <span className="h-3.5 w-px bg-white/[0.08]" />
              <Badge tone={snapshot?.runtime.vercel ? "info" : "neutral"} dot>
                {snapshot?.runtime.vercel ? "nuvem" : snapshot?.runtime.storage ?? "local"}
              </Badge>
            </div>

            <Button
              variant={paused ? "primary" : "secondary"}
              size="sm"
              loading={busy}
              onClick={() => void toggleEngine()}
              className="shrink-0"
            >
              {paused ? (
                <>
                  <Play className="h-3 w-3" strokeWidth={2.4} /> Retomar
                </>
              ) : (
                <>
                  <Pause className="h-3 w-3" strokeWidth={2.4} /> Pausar
                </>
              )}
            </Button>
          </div>
        </header>

        <main key={pathname} className="mx-auto w-full max-w-[1280px] animate-fade-up px-4 py-5 sm:px-6 sm:py-7">
          {snapshot?.runtime.defaultPassword ? (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amberglow/25 bg-amberglow/[0.06] px-4 py-2.5">
              <p className="text-[12px] text-amberglow">
                Senha padrão ativa. Defina <code className="font-mono">APP_PASSWORD</code> no ambiente
                antes de expor este painel.
              </p>
              <Link href="/ajustes" className="font-mono text-[10px] uppercase tracking-wider text-amberglow underline-offset-4 hover:underline">
                revisar
              </Link>
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}

export function SessionMeter({ snapshot }: { snapshot: Snapshot | null }) {
  if (!snapshot) return null;
  return (
    <span className="font-mono text-[10px] text-bone-500">
      sessão {duration(snapshot.runtime.uptimeMs)}
    </span>
  );
}
