"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  Cloud,
  Crosshair,
  Radar,
  Search,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { ActivityBars, Sparkline } from "@/components/charts";
import { apiRequest, useConsole } from "@/components/console-provider";
import { PlatformChip } from "@/components/platform-chip";
import { STATUS_META } from "@/components/status";
import { Clock, TimeAgo } from "@/components/time";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy";
import { Input, Select } from "@/components/ui/form";
import { Badge, EmptyState, Panel, PanelHeader, SectionLabel, StatusDot } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { PLATFORM_LIST, platformMeta } from "@/lib/platforms";
import type { CheckStatus, LogEntry, PlatformId } from "@/lib/types";
import { cn, compactNumber, nfmt } from "@/lib/utils";

const LOG_TONE: Record<LogEntry["level"], "ok" | "idle" | "danger" | "info"> = {
  available: "ok",
  taken: "idle",
  error: "danger",
  info: "info",
};

interface QuickResult {
  username: string;
  platform: PlatformId;
  status: CheckStatus;
  detail: string;
  latencyMs: number;
  proxy: string | null;
  score: number;
  tier: string;
  reasons: string[];
}

export default function PainelPage() {
  const { snapshot } = useConsole();
  const jobs = snapshot?.jobs ?? [];
  const logs = snapshot?.logs ?? [];
  const stats = snapshot?.stats;
  const paused = snapshot?.settings.engine.paused ?? true;
  const activeJobs = jobs.filter((job) => job.enabled).length;

  const lastMinute = stats?.buckets.at(-1)?.checks ?? 0;
  const hitRate = stats?.checks ? (stats.available / stats.checks) * 100 : 0;
  const issues = (stats?.errors ?? 0) + (stats?.rateLimited ?? 0);
  const sparkData = useMemo(() => {
    const buckets = stats?.buckets.slice(-24).map((bucket) => bucket.checks) ?? [];
    return buckets.length ? buckets : [0, 0, 0, 0, 0, 0];
  }, [stats?.buckets]);

  const steps = [
    {
      done: Boolean(snapshot?.credentials.discord.configured),
      title: "Conectar token do Discord",
      detail: "Sem token o Discord não responde se o nome está livre.",
      href: "/ajustes",
    },
    {
      done: (snapshot?.proxies.length ?? 0) > 0,
      title: "Adicionar proxies",
      detail: "Rotação de saída evita bloqueio por IP.",
      href: "/proxies",
    },
    {
      done: Boolean(snapshot?.settings.alerts.discordEnabled && snapshot?.settings.alerts.discordWebhook),
      title: "Ativar webhook",
      detail: "Receba o nome livre com link de captura.",
      href: "/alertas",
    },
    {
      done: activeJobs > 0,
      title: "Ligar um monitor",
      detail: "Escolha plataforma, comprimento e intervalo.",
      href: "/monitores",
    },
  ];
  const pendingSteps = steps.filter((step) => !step.done).length;

  return (
    <div className="space-y-5">
      {snapshot?.runtime.vercel && snapshot.runtime.storage !== "Redis" ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-amberglow/20 bg-amberglow/[0.045] px-3.5 py-2.5">
          <Cloud className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amberglow/70" strokeWidth={1.8} />
          <p className="text-[11.5px] leading-relaxed text-bone-300/90">
            <span className="font-medium text-amberglow/90">Deploy sem Redis.</span> Monitores e achados vivem
            na memória da instância e podem ser reiniciados. Para persistir, conecte um Redis REST em{" "}
            <Link href="/ajustes" className="underline decoration-white/20 underline-offset-2 hover:text-bone-50">
              Ajustes
            </Link>
            .
          </p>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="checagens"
          value={nfmt(stats?.checks ?? 0)}
          detail={`${lastMinute}/min`}
          icon={<Activity className="h-3.5 w-3.5" strokeWidth={1.8} />}
          spark={sparkData}
        />
        <Stat
          label="disponíveis"
          value={nfmt(stats?.available ?? 0)}
          detail={`taxa ${hitRate.toFixed(1).replace(".", ",")}%`}
          icon={<Crosshair className="h-3.5 w-3.5" strokeWidth={1.8} />}
          accent="mint"
          spark={sparkData.map((value, index) => (index % 3 === 0 ? value * 0.2 : value * 0.05))}
        />
        <Stat
          label="monitores ativos"
          value={`${activeJobs}/${jobs.length}`}
          detail={paused ? "motor pausado" : "motor ativo"}
          icon={<Radar className="h-3.5 w-3.5" strokeWidth={1.8} />}
          accent={paused ? "muted" : "lime"}
          pulse={!paused && activeJobs > 0}
        />
        <Stat
          label="falhas e limites"
          value={nfmt(issues)}
          detail={`${nfmt(stats?.rateLimited ?? 0)} limites`}
          icon={<ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.8} />}
          accent={issues > 0 ? "ember" : "muted"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Panel>
            <PanelHeader
              title="Fluxo ao vivo"
              subtitle="Cada linha é uma checagem real feita pelo motor"
              icon={<Terminal className="h-4 w-4" strokeWidth={1.7} />}
              action={
                <>
                  {paused ? (
                    <Badge tone="muted" dot>
                      pausado
                    </Badge>
                  ) : (
                    <Badge tone="lime" dot>
                      ao vivo
                    </Badge>
                  )}
                  <Link
                    href="/monitores"
                    className="font-mono text-[10px] uppercase tracking-wider text-bone-400 transition-colors hover:text-bone-100"
                  >
                    monitores
                  </Link>
                </>
              }
            />
            {logs.length === 0 ? (
              <EmptyState
                icon={<Terminal className="h-4 w-4" />}
                title="Nenhuma checagem ainda"
                description="Crie um monitor e inicie o motor. As checagens aparecem aqui em tempo real, com latência e proxy usado."
                action={
                  <Link href="/monitores">
                    <Button size="sm" variant="primary">
                      Configurar monitor
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-white/[0.035]">
                {logs.slice(0, 13).map((log) => (
                  <div
                    key={log.id}
                    className="grid animate-row-in grid-cols-[58px_10px_minmax(0,1fr)_auto] items-center gap-2.5 px-4 py-2 sm:grid-cols-[62px_10px_minmax(0,1fr)_86px_64px] sm:px-5"
                  >
                    <Clock ts={log.ts} className="font-mono text-[10.5px] tabular-nums text-bone-500" />
                    <StatusDot tone={LOG_TONE[log.level]} />
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="truncate font-mono text-[12px] text-bone-100">
                        {log.username ?? "sistema"}
                      </span>
                      {log.platform ? <PlatformChip platform={log.platform} size="sm" /> : null}
                      <span className="hidden truncate text-[11px] text-bone-500 sm:inline">
                        {log.message}
                      </span>
                    </div>
                    <span className="hidden justify-self-end font-mono text-[10.5px] tabular-nums text-bone-500 sm:block">
                      {log.latencyMs ? `${log.latencyMs} ms` : "—"}
                    </span>
                    <span className="hidden justify-self-end truncate font-mono text-[10px] text-bone-500 sm:block">
                      {log.proxy ?? "direto"}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between border-t border-white/[0.05] px-5 py-2.5">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-bone-500">
                últimas {Math.min(logs.length, 13)} de {Math.max(logs.length, 0)} em memória
              </span>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-bone-500">
                atualiza a cada 2s
              </span>
            </div>
          </Panel>

          <div className="grid gap-5 md:grid-cols-2">
            <Panel className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <SectionLabel>atividade</SectionLabel>
                  <p className="mt-1 text-[12px] text-bone-500">Últimos 30 minutos</p>
                </div>
                <span className="font-mono text-[10px] text-bone-500">
                  pico {compactNumber(Math.max(0, ...(stats?.buckets.map((bucket) => bucket.checks) ?? [0])))}/min
                </span>
              </div>
              <ActivityBars buckets={stats?.buckets ?? []} className="mt-3" />
              <div className="mt-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.12em] text-bone-500">
                <span>−30min</span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-mint" /> achado
                </span>
                <span>agora</span>
              </div>
            </Panel>

            <Panel>
              <PanelHeader
                title="Por plataforma"
                subtitle="Volume acumulado"
                className="px-4 py-3"
                action={
                  <Link
                    href="/monitores"
                    className="text-bone-500 transition-colors hover:text-bone-100"
                    aria-label="Ver monitores"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
              <div className="space-y-2.5 px-4 py-3.5">
                {Object.entries(stats?.byPlatform ?? {}).length === 0 ? (
                  <p className="py-6 text-center text-[11.5px] text-bone-500">
                    Nenhuma plataforma acionada ainda.
                  </p>
                ) : (
                  Object.entries(stats?.byPlatform ?? {})
                    .sort((a, b) => b[1].checks - a[1].checks)
                    .slice(0, 5)
                    .map(([platform, values]) => {
                      const max = Math.max(
                        1,
                        ...Object.values(stats?.byPlatform ?? {}).map((entry) => entry.checks)
                      );
                      return (
                        <div key={platform} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <PlatformChip platform={platform as PlatformId} showName size="sm" />
                            <span className="font-mono text-[10.5px] tabular-nums text-bone-400">
                              {nfmt(values.checks)}
                              {values.available > 0 ? (
                                <span className="ml-1.5 text-mint">+{values.available}</span>
                              ) : null}
                            </span>
                          </div>
                          <div className="h-[3px] overflow-hidden rounded-full bg-white/[0.05]">
                            <div
                              className="h-full rounded-full bg-bone-500/60"
                              style={{ width: `${Math.max(3, (values.checks / max) * 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </Panel>
          </div>
        </div>

        <div className="space-y-5">
          {pendingSteps > 0 ? <SetupSteps steps={steps} /> : null}

          <QuickCheck />

          <Panel>
            <PanelHeader
              title="Últimos achados"
              subtitle={`${snapshot?.hits.length ?? 0} nomes livres registrados`}
              className="px-4 py-3"
              action={
                <Link
                  href="/historico"
                  className="font-mono text-[10px] uppercase tracking-wider text-bone-400 hover:text-bone-100"
                >
                  histórico
                </Link>
              }
            />
            {(snapshot?.hits.length ?? 0) === 0 ? (
              <p className="px-4 py-6 text-center text-[11.5px] text-bone-500">
                Nenhum nome livre encontrado até agora.
              </p>
            ) : (
              <ul className="divide-y divide-white/[0.035]">
                {snapshot?.hits.slice(0, 5).map((hit) => (
                  <li key={hit.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-mono text-[12.5px] text-bone-50">
                        {hit.username}
                      </span>
                      <PlatformChip platform={hit.platform} size="sm" />
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-[10.5px] text-mint">{hit.score}</span>
                      <TimeAgo ts={hit.foundAt} className="font-mono text-[10px] text-bone-500" />
                      <CopyButton value={hit.username} compact />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {snapshot?.runtime.vercel ? (
            <div className="rounded-xl border border-[#8B9CFF]/20 bg-[#8B9CFF]/[0.045] p-4">
              <div className="flex items-center gap-2">
                <Cloud className="h-3.5 w-3.5 text-[#AEB9FF]" strokeWidth={1.8} />
                <p className="text-[11.5px] font-medium text-[#C3CBFF]">Execução em nuvem</p>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-bone-400">
                Na Vercel não existe processo contínuo. A varredura roda enquanto este painel estiver
                aberto e em rajadas via <code className="font-mono">/api/cron</code>. Para operar 24/7,
                rode o worker local ou em um VPS.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
  icon,
  spark,
  accent = "bone",
  pulse,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  spark?: number[];
  accent?: "bone" | "mint" | "lime" | "ember" | "muted";
  pulse?: boolean;
}) {
  const accents = {
    bone: "text-bone-50",
    mint: "text-mint",
    lime: "text-lime-300",
    ember: "text-[#FFA48E]",
    muted: "text-bone-300",
  };
  return (
    <Panel className="relative overflow-hidden px-4 py-3.5">
      <div className="flex items-center justify-between">
        <span className="label-mono">{label}</span>
        <span className={cn("flex items-center gap-1.5 text-bone-500", accent === "ember" && "text-ember")}>
          {pulse ? <StatusDot tone="ok" pulse /> : icon}
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <span className={cn("font-mono text-[26px] leading-none tracking-[-0.02em] mono-num", accents[accent])}>
          {value}
        </span>
        <span className="mb-[2px] font-mono text-[10px] text-bone-500">{detail}</span>
      </div>
      {spark ? (
        <div className="-mx-1 mt-2 opacity-80">
          <Sparkline data={spark} height={22} className="h-[22px]" stroke={accent === "mint" ? "#63E6A4" : "#CBEF6E"} />
        </div>
      ) : null}
    </Panel>
  );
}

function SetupSteps({
  steps,
}: {
  steps: { done: boolean; title: string; detail: string; href: string }[];
}) {
  return (
    <Panel>
      <PanelHeader
        title="Primeiros passos"
        subtitle="Três minutos para a primeira varredura"
        className="px-4 py-3"
        action={<Badge tone="lime">{steps.filter((step) => step.done).length}/{steps.length}</Badge>}
      />
      <ul className="divide-y divide-white/[0.035]">
        {steps.map((step) => (
          <li key={step.title}>
            <Link
              href={step.href}
              className="group flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.015]"
            >
              {step.done ? (
                <CheckCircle2 className="mt-[1px] h-4 w-4 shrink-0 text-mint" strokeWidth={1.8} />
              ) : (
                <CircleDashed className="mt-[1px] h-4 w-4 shrink-0 text-bone-500" strokeWidth={1.6} />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[12px] font-medium",
                    step.done ? "text-bone-400 line-through decoration-bone-600/60" : "text-bone-100"
                  )}
                >
                  {step.title}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-bone-500">{step.detail}</p>
              </div>
              <ArrowRight className="mt-1 h-3 w-3 shrink-0 text-bone-600 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function QuickCheck() {
  const toast = useToast();
  const { snapshot } = useConsole();
  const [platform, setPlatform] = useState<PlatformId>(() =>
    snapshot?.credentials.discord.configured ? "discord" : "github"
  );
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuickResult | null>(null);
  const meta = platformMeta(platform);
  const missingCredential = meta.requires === "discord"
    ? !snapshot?.credentials.discord.configured
    : meta.requires === "twitch"
      ? !snapshot?.credentials.twitch.configured
      : false;

  async function run() {
    const username = name.trim().toLowerCase().replace(/^@/, "");
    if (!username) {
      toast.push("Digite um nome para checar.", "error");
      return;
    }
    setLoading(true);
    setResult(null);
    const response = await apiRequest<QuickResult>("/api/check", {
      method: "POST",
      body: JSON.stringify({ platform, username }),
    });
    setLoading(false);
    if (!response.ok) {
      toast.push(response.error, "error");
      return;
    }
    setResult(response.data);
  }

  const statusView = result
    ? result.status === "available"
      ? { text: "livre", tone: "mint" as const }
      : result.status === "taken"
        ? { text: "em uso", tone: "neutral" as const }
        : result.status === "unconfigured"
          ? { text: "sem credencial", tone: "warn" as const }
          : { text: "não concluído", tone: "danger" as const }
    : null;

  return (
    <Panel>
      <PanelHeader
        title="Checagem avulsa"
        subtitle="Uma consulta, sem criar monitor"
        className="px-4 py-3"
        icon={<Search className="h-4 w-4" strokeWidth={1.7} />}
      />
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2">
          <Select value={platform} onChange={(event) => setPlatform(event.target.value as PlatformId)}>
            {PLATFORM_LIST.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-bone-500">
              @
            </span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void run();
              }}
              placeholder={`${meta.minLength}–${meta.maxLength} caracteres`}
              className="pl-7 font-mono"
              maxLength={meta.maxLength}
            />
          </div>
        </div>
        {missingCredential ? (
          <p className="rounded-md border border-amberglow/20 bg-amberglow/[0.05] px-2.5 py-1.5 text-[10.5px] leading-snug text-amberglow/90">
            {meta.name} exige credencial.{" "}
            <a href="/ajustes" className="underline underline-offset-2">Configurar agora</a>.
          </p>
        ) : null}
        <Button variant="primary" size="sm" className="w-full" loading={loading} onClick={() => void run()}>
          Verificar disponibilidade
        </Button>

        {result && statusView ? (
          <div className="animate-fade-up rounded-lg border border-white/[0.06] bg-ink-950/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[13px] text-bone-50">{result.username}</span>
              <Badge
                tone={
                  result.status === "available"
                    ? "ok"
                    : result.status === "taken"
                      ? "neutral"
                      : result.status === "unconfigured" || result.status === "rate_limited"
                        ? "warn"
                        : "danger"
                }
              >
                {STATUS_META[result.status]?.label ?? statusView.text}
              </Badge>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-bone-500">{result.detail}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] text-bone-500">
              <span>{result.latencyMs} ms</span>
              <span>{result.score}/99 · {result.tier}</span>
              <span>{result.proxy ?? "conexão direta"}</span>
            </div>
            {result.status === "available" ? (
              <div className="mt-2.5 flex items-center gap-2">
                <CopyButton value={result.username} />
                <a
                  href={meta.claimUrl(result.username)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-lime-300 hover:underline"
                >
                  capturar <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-[10.5px] leading-relaxed text-bone-500">
            Consulta real na plataforma escolhida. Respeita o token e o proxy configurados em Ajustes.
          </p>
        )}
      </div>
    </Panel>
  );
}
