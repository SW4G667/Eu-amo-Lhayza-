"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  Globe2,
  KeyRound,
  Layers,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Network,
  RefreshCw,
  Settings2,
  ShieldCheck,
  TerminalSquare,
  Users,
  XCircle,
} from "lucide-react";
import { BrandMark } from "@/components/brand";
import { cn, compactNumber } from "@/lib/utils";
import { EventsTab } from "./events-tab";
import { LicensesTab } from "./licenses-tab";
import { PlansTab, PlatformsTab, ProxiesTab, UsersTab } from "./catalog-tabs";
import { SecretsCard, SettingsTab } from "./settings-tab";
import { ActionButton, Card, Empty, Pill, fmtDateTime } from "./ui";
import type { AdminData, AdminTab } from "./types";

const TABS: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: "visao", label: "Visão geral", icon: LayoutDashboard },
  { id: "licencas", label: "Licenças", icon: KeyRound },
  { id: "planos", label: "Planos", icon: Layers },
  { id: "usuarios", label: "Usuários", icon: Users },
  { id: "plataformas", label: "Plataformas", icon: Globe2 },
  { id: "proxies", label: "Proxies", icon: Network },
  { id: "eventos", label: "Eventos", icon: TerminalSquare },
  { id: "ajustes", label: "Ajustes", icon: Settings2 },
];

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function AdminConsole({ label }: { label: string }) {
  const [tab, setTab] = useState<AdminTab>("visao");
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const [clock, setClock] = useState("--:--");

  const notify = useCallback((text: string, tone: "ok" | "err" = "ok") => {
    setFlash({ text, tone });
    window.setTimeout(() => setFlash(null), 4200);
  }, []);

  const load = useCallback(async () => {
    const [overview, licenses, users, platforms, proxies, events] = await Promise.all([
      getJson<AdminData["overview"]>("/api/admin/overview"),
      getJson<AdminData["licenses"]>("/api/admin/licenses"),
      getJson<AdminData["users"]>("/api/admin/users"),
      getJson<{ platforms: AdminData["platforms"] }>("/api/admin/platforms"),
      getJson<{ proxies: AdminData["proxies"] }>("/api/admin/proxies"),
      getJson<{ events: AdminData["events"] }>("/api/admin/events?limit=200"),
    ]);

    if (!overview || !licenses || !users || !platforms || !proxies || !events) {
      setError("Não foi possível carregar o painel. Sua sessão pode ter expirado.");
      setLoading(false);
      return;
    }

    setData({
      overview,
      licenses,
      users,
      platforms: platforms.platforms,
      proxies: proxies.proxies,
      events: events.events,
      settings: overview.settings,
    });
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
    tick();
    const interval = window.setInterval(tick, 10000);
    return () => window.clearInterval(interval);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  const summary = data?.overview.summary;

  return (
    <div className="min-h-screen bg-ink-950">
      <header className="sticky top-0 z-30 border-b border-white/[0.055] bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex h-[56px] max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/[0.08] bg-ink-800 text-bone-100">
              <BrandMark />
            </span>
            <div className="leading-none">
              <p className="text-[13px] font-medium text-bone-50">
                {data?.settings.branding.productName ?? "Atalaia"}
                <span className="ml-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-bone-600">
                  admin
                </span>
              </p>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-bone-600">
                painel de controle
              </p>
            </div>
          </div>

          <span className="hidden h-4 w-px bg-white/[0.08] sm:block" />

          <div className="hidden items-center gap-2 sm:flex">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                data?.overview.phanom.configured && data.overview.phanom.ok
                  ? "bg-mint"
                  : "bg-amberglow"
              )}
            />
            <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-bone-600">
              {summary ? `${summary.active} ativas · ${summary.pending} pendentes` : "carregando"}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden font-mono text-[11px] tabular-nums text-bone-500 md:block">{clock}</span>
            <ActionButton onClick={() => void load()} busy={loading} title="Recarregar dados">
              <RefreshCw className="h-3 w-3" />
            </ActionButton>
            <Link
              href="/painel"
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[11px] text-bone-300 transition-colors hover:text-bone-100"
            >
              ver console
              <ExternalLink className="h-2.5 w-2.5" />
            </Link>
            <div className="hidden items-center gap-1.5 pl-1 sm:flex">
              <span className="font-mono text-[9.5px] text-bone-600">{label}</span>
              <button
                type="button"
                onClick={() => void logout()}
                className="grid h-7 w-7 place-items-center rounded-md text-bone-500 transition-colors hover:bg-white/[0.05] hover:text-bone-100"
                title="Sair"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row">
        <nav className="lg:w-[186px] lg:shrink-0">
          <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:pb-0">
            {TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              const count =
                item.id === "licencas"
                  ? data?.licenses.counters.active
                  : item.id === "usuarios"
                    ? data?.users.users.length
                    : item.id === "plataformas"
                      ? data?.platforms.filter((platform) => platform.enabled).length
                      : item.id === "proxies"
                        ? data?.proxies.length
                        : undefined;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-md px-2.5 py-[7px] text-[12px] transition-colors lg:w-full",
                    active
                      ? "bg-white/[0.06] font-medium text-bone-50"
                      : "text-bone-500 hover:bg-white/[0.025] hover:text-bone-200"
                  )}
                >
                  <Icon
                    className={cn("h-[14px] w-[14px]", active ? "text-lime-300" : "text-bone-600")}
                    strokeWidth={1.9}
                  />
                  {item.label}
                  {typeof count === "number" && count > 0 ? (
                    <span className="ml-auto rounded-full bg-white/[0.06] px-1.5 py-[1px] font-mono text-[9px] text-bone-400">
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-3 hidden rounded-lg border border-white/[0.055] bg-[#0A0C0C] p-2.5 lg:block">
            <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-bone-700">banco</p>
            <p className="mt-0.5 text-[11px] text-bone-300">{data?.overview.driver ?? "—"}</p>
            <p className="mt-1.5 font-mono text-[8.5px] uppercase tracking-[0.14em] text-bone-700">
              versão
            </p>
            <p className="mt-0.5 font-mono text-[10.5px] text-bone-500">
              v{data?.overview.version ?? "1.1.0"}
            </p>
          </div>
        </nav>

        <main className="min-w-0 flex-1">
          {error ? (
            <Card>
              <div className="flex items-center gap-2 p-4 text-[12px] text-[#FFB4A2]">
                <AlertTriangle className="h-3.5 w-3.5" />
                {error}
              </div>
            </Card>
          ) : loading || !data || !summary ? (
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[74px] animate-pulse rounded-lg border border-white/[0.05] bg-white/[0.02]"
                />
              ))}
            </div>
          ) : tab === "visao" ? (
            <OverviewTab data={data} onGo={setTab} />
          ) : tab === "licencas" ? (
            <LicensesTab
              data={data.licenses}
              plans={data.overview.plans}
              onRefresh={load}
              notify={notify}
            />
          ) : tab === "planos" ? (
            <PlansTab plans={data.overview.plans} onRefresh={load} notify={notify} />
          ) : tab === "usuarios" ? (
            <UsersTab data={data.users} onRefresh={load} notify={notify} />
          ) : tab === "plataformas" ? (
            <PlatformsTab platforms={data.platforms} onRefresh={load} notify={notify} />
          ) : tab === "proxies" ? (
            <ProxiesTab proxies={data.proxies} onRefresh={load} notify={notify} />
          ) : tab === "eventos" ? (
            <EventsTab events={data.events} />
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              <SettingsTab
                settings={data.settings}
                plans={data.overview.plans}
                phanom={data.overview.phanom}
                driver={data.overview.driver}
                adminKeyDefault={data.overview.adminKeyDefault}
                discordConfigured={data.overview.discordConfigured}
                onRefresh={load}
                notify={notify}
              />
              <SecretsCard />
            </div>
          )}
        </main>
      </div>

      {flash ? (
        <div
          className={cn(
            "fixed bottom-4 left-1/2 z-50 -translate-x-1/2 animate-toast-in rounded-lg border px-3.5 py-2 text-[12px] shadow-lift",
            flash.tone === "ok"
              ? "border-mint/25 bg-[#0C1512] text-mint"
              : "border-ember/25 bg-[#170F0D] text-[#FFB4A2]"
          )}
        >
          {flash.text}
        </div>
      ) : null}
    </div>
  );
}

function OverviewTab({ data, onGo }: { data: AdminData; onGo: (tab: AdminTab) => void }) {
  const summary = data.overview.summary;
  const phanom = data.overview.phanom;

  const checklist = useMemo(
    () => [
      {
        label: "Banco conectado",
        done: data.overview.driver.toLowerCase().includes("supabase"),
        detail: data.overview.driver,
        tab: "ajustes" as AdminTab,
      },
      {
        label: "Login do Discord ativo",
        done: data.overview.discordConfigured,
        detail: data.overview.discordConfigured ? "OAuth configurado" : "falta client id/secret",
        tab: "ajustes" as AdminTab,
      },
      {
        label: "Ao menos um plano ativo",
        done: data.overview.plans.some((plan) => plan.active),
        detail: `${data.overview.plans.filter((plan) => plan.active).length} plano(s) ativo(s)`,
        tab: "planos" as AdminTab,
      },
      {
        label: "Plataforma liberada",
        done: data.platforms.some((platform) => platform.enabled),
        detail: `${data.platforms.filter((platform) => platform.enabled).length} liberada(s)`,
        tab: "plataformas" as AdminTab,
      },
      {
        label: "Pool de proxies",
        done: data.proxies.length > 0,
        detail: `${data.proxies.length} proxy(s)`,
        tab: "proxies" as AdminTab,
      },
      {
        label: "Key administrativa trocada",
        done: !data.overview.adminKeyDefault,
        detail: data.overview.adminKeyDefault ? "usando access-6xy-67" : "personalizada",
        tab: "ajustes" as AdminTab,
      },
    ],
    [data]
  );

  const done = checklist.filter((item) => item.done).length;

  return (
    <div className="space-y-3">
      {data.overview.adminKeyDefault ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amberglow/25 bg-amberglow/[0.06] px-3.5 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amberglow" />
          <p className="text-[11.5px] text-amberglow">
            Você está com a key administrativa padrão. Defina <code className="font-mono">ADMIN_KEY</code> na
            Vercel antes de divulgar o site.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <Stat label="licenças ativas" value={summary.active} icon={KeyRound} accent />
        <Stat label="pendentes" value={summary.pending} icon={CircleDollarSign} />
        <Stat label="usuários" value={summary.users} icon={Users} />
        <Stat label="proxies ok" value={`${summary.proxiesOk}/${summary.proxies}`} icon={Network} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.05fr_1fr]">
        <Card
          title="configuração inicial"
          subtitle={`${done} de ${checklist.length} prontos`}
          action={
            <span className="font-mono text-[9.5px] text-bone-600">
              {Math.round((done / checklist.length) * 100)}%
            </span>
          }
        >
          <div className="h-1 w-full bg-white/[0.04]">
            <div
              className="h-1 bg-lime-400/70 transition-all"
              style={{ width: `${(done / checklist.length) * 100}%` }}
            />
          </div>
          <ul className="divide-y divide-white/[0.03]">
            {checklist.map((item) => (
              <li key={item.label}>
                <button
                  type="button"
                  onClick={() => onGo(item.tab)}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-white/[0.02]"
                >
                  {item.done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-mint" strokeWidth={2.2} />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-bone-700" strokeWidth={2.2} />
                  )}
                  <span className={cn("text-[11.5px]", item.done ? "text-bone-300" : "text-bone-500")}>
                    {item.label}
                  </span>
                  <span className="ml-auto truncate font-mono text-[9.5px] text-bone-700">
                    {item.detail}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="serviços" subtitle="integrações que sustentam a operação">
          <div className="divide-y divide-white/[0.03]">
            <ServiceRow
              icon={<ShieldCheck className="h-3 w-3" />}
              label="Supabase"
              ok={data.overview.driver.toLowerCase().includes("supabase")}
              value={data.overview.driver}
            />
            <ServiceRow
              icon={<Globe2 className="h-3 w-3" />}
              label="Discord OAuth"
              ok={data.overview.discordConfigured}
              value={data.overview.discordConfigured ? "online" : "pendente"}
            />
            <ServiceRow
              icon={<Activity className="h-3 w-3" />}
              label="PhanomCloud"
              ok={phanom.configured && phanom.ok}
              value={
                phanom.configured
                  ? phanom.version
                    ? `online · v${phanom.version}`
                    : phanom.message
                  : "token ausente"
              }
            />
            <ServiceRow
              icon={<Network className="h-3 w-3" />}
              label="ProxyScrape"
              ok
              value={summary.proxies ? `${summary.proxies} no pool` : "sem importação"}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-white/[0.045] px-4 py-2.5">
            <MiniStat label="expirando" value={summary.expiringSoon} hint="próx. 3 dias" />
            <MiniStat label="bloqueados" value={summary.banned} hint="usuários" />
            <MiniStat label="eventos hoje" value={summary.eventsToday} hint="auditoria" />
          </div>
        </Card>
      </div>

      <Card
        title="últimos eventos"
        subtitle="tudo que o sistema viu nas últimas horas"
        action={
          <button
            type="button"
            onClick={() => onGo("eventos")}
            className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-bone-600 hover:text-bone-200"
          >
            ver tudo
          </button>
        }
      >
        {data.events.length === 0 ? (
          <Empty>Sem eventos ainda. Gere uma key ou entre com Discord para começar a trilha.</Empty>
        ) : (
          <ul className="divide-y divide-white/[0.03]">
            {data.events.slice(0, 6).map((event) => (
              <li key={event.id} className="flex items-center gap-2.5 px-4 py-1.5">
                <span className="w-[86px] shrink-0 font-mono text-[9.5px] text-bone-700">
                  {fmtDateTime(event.createdAt)}
                </span>
                <Pill
                  tone={
                    event.severity === "danger"
                      ? "danger"
                      : event.severity === "warn"
                        ? "warn"
                        : event.severity === "success"
                          ? "ok"
                          : "info"
                  }
                >
                  {event.severity}
                </Pill>
                <span className="truncate text-[11px] text-bone-300">{event.message}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-2.5 sm:grid-cols-3">
        <QuickLink href="/painel" label="Console de busca" hint="monitores e achados" icon={ListChecks} />
        <QuickLink href="/monitores" label="Criar monitor" hint="discord e outras" icon={Activity} />
        <QuickLink href="/" label="Tela de entrada" hint="como o cliente vê" icon={ExternalLink} />
      </div>

      <p className="pb-2 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-bone-800">
        atalaia v{data.overview.version} · {compactNumber(data.licenses.counters.total)} keys no histórico
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: typeof KeyRound;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/[0.055] bg-[#0A0C0C] px-3 py-2.5">
      <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-bone-600">
        <Icon className="h-2.5 w-2.5" strokeWidth={2} />
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-mono text-[19px] leading-none tracking-[-0.02em]",
          accent ? "text-lime-300" : "text-bone-100"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div>
      <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-bone-700">{label}</p>
      <p className="mt-0.5 font-mono text-[13px] text-bone-200">{value}</p>
      <p className="font-mono text-[8.5px] text-bone-800">{hint}</p>
    </div>
  );
}

function ServiceRow({
  icon,
  label,
  ok,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  ok: boolean;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-1.5">
      <span
        className={cn(
          "grid h-5 w-5 place-items-center rounded border",
          ok ? "border-mint/20 bg-mint/[0.07] text-mint" : "border-amberglow/25 bg-amberglow/[0.07] text-amberglow"
        )}
      >
        {icon}
      </span>
      <span className="text-[11.5px] text-bone-300">{label}</span>
      <span className="ml-auto truncate font-mono text-[9.5px] text-bone-600">{value}</span>
    </div>
  );
}

function QuickLink({
  href,
  label,
  hint,
  icon: Icon,
}: {
  href: string;
  label: string;
  hint: string;
  icon: typeof KeyRound;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 rounded-lg border border-white/[0.055] bg-[#0A0C0C] px-3 py-2.5 transition-colors hover:border-white/[0.12]"
    >
      <span className="grid h-6 w-6 place-items-center rounded-md border border-white/[0.07] bg-white/[0.03] text-bone-500 group-hover:text-bone-200">
        <Icon className="h-3 w-3" strokeWidth={1.9} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11.5px] text-bone-200">{label}</span>
        <span className="block truncate font-mono text-[9px] text-bone-700">{hint}</span>
      </span>
      <ExternalLink className="ml-auto h-2.5 w-2.5 shrink-0 text-bone-800 group-hover:text-bone-500" />
    </Link>
  );
}
