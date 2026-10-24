"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  Eraser,
  Gauge,
  Loader2,
  Lock,
  Plus,
  Radar,
  Search,
  Terminal,
} from "lucide-react";
import { apiRequest, useConsole } from "@/components/console-provider";
import { CopyButton } from "@/components/ui/copy";
import { useToast } from "@/components/ui/toast";
import { platformMeta } from "@/lib/platforms";
import type { CheckStatus, LogEntry } from "@/lib/types";
import { cn, compactNumber, nfmt, timeAgo } from "@/lib/utils";

const LEVEL_STYLE: Record<LogEntry["level"], { tone: string; tag: string }> = {
  available: { tone: "text-mint", tag: "LIVRE" },
  taken: { tone: "text-bone-500", tag: "OCUPADO" },
  error: { tone: "text-ember", tag: "ERRO" },
  info: { tone: "text-[#AEB9FF]", tag: "INFO" },
};

function stamp(ts: number): string {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour12: false });
}

export default function PainelPage() {
  const { snapshot, refresh } = useConsole();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [clearing, setClearing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const consoleRef = useRef<HTMLDivElement>(null);

  const hits = snapshot?.hits ?? [];
  const logs = snapshot?.logs ?? [];
  const stats = snapshot?.stats;
  const paused = snapshot?.settings.engine.paused ?? true;
  const isAdmin = snapshot?.me?.kind === "admin";
  const license = snapshot?.me?.license ?? null;
  const platforms = snapshot?.platforms ?? [];

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return hits;
    return hits.filter(
      (hit) =>
        hit.username.includes(term) ||
        hit.platform.includes(term) ||
        hit.jobName.toLowerCase().includes(term)
    );
  }, [hits, query]);

  useEffect(() => {
    if (!autoScroll || !consoleRef.current) return;
    consoleRef.current.scrollTop = 0;
  }, [logs, autoScroll]);

  const logText = useMemo(
    () =>
      logs
        .slice()
        .reverse()
        .map(
          (entry) =>
            `[${stamp(entry.ts)}] ${LEVEL_STYLE[entry.level].tag.padEnd(7)} ${
              entry.platform
            } ${entry.username ?? "-"} :: ${entry.message}`
        )
        .join("\n"),
    [logs]
  );

  async function copyLog() {
    try {
      await navigator.clipboard.writeText(logText || "console vazio");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      toast.push("Log copiado para a área de transferência.", "success");
    } catch {
      toast.push("O navegador bloqueou a cópia.", "error");
    }
  }

  async function clearLog() {
    setClearing(true);
    const result = await apiRequest<{ ok: boolean; removed: number }>("/api/logs", {
      method: "DELETE",
    });
    setClearing(false);
    if (!result.ok) {
      toast.push(result.error, "error");
      return;
    }
    toast.push(`Console limpo (${result.data.removed} linha(s)).`, "info");
    await refresh();
  }

  async function toggleEngine() {
    const result = await apiRequest<{ ok: boolean }>("/api/engine", {
      method: "POST",
      body: JSON.stringify({ action: paused ? "start" : "pause" }),
    });
    if (!result.ok) {
      toast.push(result.error, "error");
      return;
    }
    await refresh();
  }

  const enabledJobs = (snapshot?.jobs ?? []).filter((job) => job.enabled).length;
  const available = stats?.available ?? 0;
  const checks = stats?.checks ?? 0;
  const efficiency = checks > 0 ? (available / checks) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* faixa de status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              paused ? "bg-amberglow" : "bg-lime-400 animate-pulse-dot"
            )}
          />
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-400">
            {paused ? "varredura pausada" : "varredura em andamento"}
          </p>
          <span className="h-3 w-px bg-white/[0.08]" />
          <p className="font-mono text-[10px] text-bone-600">
            {snapshot?.runtime.vercel ? "nuvem · vercel" : snapshot?.runtime.storage ?? "local"}
          </p>
        </div>
        {license ? (
          <p className="font-mono text-[10px] text-bone-500">
            licença {license.prefix} ·{" "}
            {license.remainingDays !== null ? `${license.remainingDays} dia(s)` : license.status}
          </p>
        ) : null}
      </div>

      {/* métricas */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Metric label="monitores ativos" value={`${enabledJobs}`} hint={`de ${snapshot?.jobs.length ?? 0}`} />
        <Metric label="checagens" value={compactNumber(checks)} hint="histórico total" />
        <Metric label="achados" value={nfmt(available)} hint="usernames livres" accent />
        <Metric label="acerto" value={`${efficiency.toFixed(2)}%`} hint="livres por checagem" />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* painel de achados */}
        <section className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-[#0A0C0C]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.055] px-4 py-3">
            <div className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-lime-300" strokeWidth={2.4} />
              <h2 className="font-mono text-[10px] uppercase tracking-[0.17em] text-bone-200">
                usernames disponíveis encontrados
              </h2>
              <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-1.5 py-[1px] font-mono text-[9px] text-bone-400">
                {filtered.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-bone-600" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="filtrar"
                  className="h-7 w-[120px] rounded-md border border-white/[0.07] bg-ink-950/70 pl-7 pr-2 font-mono text-[11px] text-bone-100 outline-none placeholder:text-bone-600 focus:border-lime-500/40"
                />
              </div>
              <Link
                href="/monitores"
                className="inline-flex h-7 items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 text-[11px] text-bone-200 transition-colors hover:bg-white/[0.07]"
              >
                <Plus className="h-3 w-3" strokeWidth={2.4} />
                monitor
              </Link>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center px-6 text-center">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-bone-500">
                  <Radar className="h-4 w-4" strokeWidth={1.7} />
                </span>
                <p className="mt-3 text-[12.5px] text-bone-300">
                  {hits.length ? "Nada bate com o filtro." : "Nenhum username encontrado ainda."}
                </p>
                <p className="mt-1 max-w-[280px] text-[11px] leading-relaxed text-bone-500">
                  {hits.length
                    ? "Limpe a busca para ver todos os achados."
                    : "Crie um monitor e ative o motor. Os nomes livres aparecem aqui em tempo real."}
                </p>
                {!hits.length ? (
                  <Link
                    href="/monitores"
                    className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-md bg-bone-50 px-3 text-[11.5px] font-medium text-ink-950 hover:bg-white"
                  >
                    Criar monitor
                    <ArrowUpRight className="h-3 w-3" strokeWidth={2.4} />
                  </Link>
                ) : null}
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.035]">
                {filtered.map((hit) => {
                  const meta = platformMeta(hit.platform);
                  return (
                    <li
                      key={hit.id}
                      className="group flex animate-row-in items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.02]"
                    >
                      <span
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-[5px] border font-mono text-[8.5px]"
                        style={{
                          color: meta.accent,
                          borderColor: `${meta.accent}33`,
                          backgroundColor: `${meta.accent}12`,
                        }}
                      >
                        {meta.short}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[12.5px] text-bone-100">
                          @{hit.username}
                        </p>
                        <p className="truncate text-[10.5px] text-bone-600">
                          {hit.jobName} · {timeAgo(hit.foundAt)}
                          {hit.latencyMs ? ` · ${hit.latencyMs}ms` : ""}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "hidden shrink-0 rounded-full border px-1.5 py-[1px] font-mono text-[9px] sm:inline",
                          hit.score >= 80
                            ? "border-lime-500/30 bg-lime-400/[0.08] text-lime-300"
                            : hit.score >= 55
                              ? "border-amberglow/25 bg-amberglow/[0.07] text-amberglow"
                              : "border-white/[0.07] bg-white/[0.03] text-bone-400"
                        )}
                        title="Pontuação do nome"
                      >
                        {hit.score}
                      </span>
                      <CopyButton value={hit.username} compact className="shrink-0" />
                      <a
                        href={meta.claimUrl(hit.username)}
                        target="_blank"
                        rel="noreferrer"
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-white/[0.07] bg-white/[0.02] text-bone-400 transition-colors hover:border-white/[0.16] hover:text-bone-100"
                        title={`Abrir ${meta.name}`}
                      >
                        <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/[0.055] px-4 py-2">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-bone-600">
              ordenado por descoberta
            </p>
            <Link
              href="/historico"
              className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-bone-500 transition-colors hover:text-bone-200"
            >
              histórico completo →
            </Link>
          </div>
        </section>

        {/* console de eventos */}
        <section className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-[#080A0A]">
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.055] px-4 py-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-bone-400" strokeWidth={2} />
              <h2 className="font-mono text-[10px] uppercase tracking-[0.17em] text-bone-200">
                console de eventos
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void copyLog()}
                className="inline-flex h-6 items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.02] px-1.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-bone-400 transition-colors hover:border-white/[0.16] hover:text-bone-100"
                title="Copiar log completo"
              >
                {copied ? <Check className="h-2.5 w-2.5 text-mint" /> : <Copy className="h-2.5 w-2.5" />}
                copiar
              </button>
              <button
                type="button"
                onClick={() => void clearLog()}
                disabled={clearing || logs.length === 0}
                className="inline-flex h-6 items-center gap-1 rounded-md border border-white/[0.07] bg-white/[0.02] px-1.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-bone-400 transition-colors hover:border-ember/30 hover:text-[#FFB4A2] disabled:opacity-40"
                title="Limpar logs"
              >
                {clearing ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Eraser className="h-2.5 w-2.5" />}
                limpar
              </button>
            </div>
          </div>

          <div
            ref={consoleRef}
            className="h-[330px] flex-1 overflow-y-auto px-3 py-2 font-mono text-[10.5px] leading-[1.55]"
          >
            {logs.length === 0 ? (
              <p className="px-1 py-2 text-bone-600">
                <span className="text-lime-500/70">$</span> console ocioso — aguardando eventos...
              </p>
            ) : (
              logs.map((entry) => (
                <div key={entry.id} className="flex gap-1.5 py-[1px]">
                  <span className="shrink-0 text-bone-700">{stamp(entry.ts)}</span>
                  <span className={cn("shrink-0", LEVEL_STYLE[entry.level].tone)}>
                    {LEVEL_STYLE[entry.level].tag}
                  </span>
                  <span className="min-w-0 text-bone-500">
                    <span className="text-bone-600">[{entry.platform}]</span>{" "}
                    {entry.username ? (
                      <span className="text-bone-300">{entry.username}</span>
                    ) : null}{" "}
                    {entry.message}
                    {entry.latencyMs ? (
                      <span className="text-bone-700"> ({entry.latencyMs}ms)</span>
                    ) : null}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/[0.055] px-4 py-2">
            <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-bone-600">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(event) => setAutoScroll(event.target.checked)}
                className="h-3 w-3 accent-lime-500"
              />
              seguir topo
            </label>
            <span className="font-mono text-[9.5px] text-bone-600">{logs.length} linhas</span>
          </div>
        </section>
      </div>

      {/* rodapé: plataformas + ações */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="rounded-xl border border-white/[0.06] bg-[#0A0C0C] p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="font-mono text-[9.5px] uppercase tracking-[0.17em] text-bone-400">
              plataformas
            </h2>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-bone-600">
              {platforms.filter((item) => item.enabled).length} de {platforms.length} liberadas
            </span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {platforms.map((platform) => (
              <button
                key={platform.id}
                type="button"
                onClick={() =>
                  !platform.enabled &&
                  toast.push(`${platform.name} chega em breve. O admin libera no painel.`, "info")
                }
                className={cn(
                  "flex min-w-[72px] flex-col items-center gap-1 rounded-lg border px-2 py-2 transition-colors",
                  platform.enabled
                    ? "border-white/[0.08] bg-white/[0.035] hover:bg-white/[0.06]"
                    : "cursor-not-allowed border-white/[0.035] bg-white/[0.01] opacity-40"
                )}
                title={platform.enabled ? `${platform.name} liberado` : `${platform.name} · ${platform.note || "Em breve"}`}
              >
                <span
                  className="grid h-5 w-5 place-items-center rounded-[5px] border font-mono text-[8px]"
                  style={
                    platform.enabled
                      ? {
                          color: platform.accent,
                          borderColor: `${platform.accent}33`,
                          backgroundColor: `${platform.accent}12`,
                        }
                      : { color: "#4C554B", borderColor: "rgba(255,255,255,0.05)" }
                  }
                >
                  {platform.short}
                </span>
                <span className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.06em] text-bone-500">
                  {!platform.enabled ? <Lock className="h-2 w-2" strokeWidth={2.2} /> : null}
                  {platform.name}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-[#0A0C0C] p-3.5">
          <div className="flex items-center gap-2">
            <Gauge className="h-3.5 w-3.5 text-bone-400" strokeWidth={2} />
            <h2 className="font-mono text-[9.5px] uppercase tracking-[0.17em] text-bone-400">
              controle
            </h2>
          </div>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => void toggleEngine()}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-lg text-[12px] font-medium transition-colors",
                paused
                  ? "bg-lime-400 text-ink-950 hover:bg-lime-300"
                  : "border border-white/[0.09] bg-white/[0.04] text-bone-100 hover:bg-white/[0.07]"
              )}
            >
              {paused ? "Retomar motor" : "Pausar motor"}
            </button>
          ) : (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-[11px] leading-relaxed text-bone-500">
                O motor é operado pelo administrador. Seus monitores rodam enquanto estiverem
                ativos.
              </p>
            </div>
          )}
          <Link
            href="/monitores"
            className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.04] text-[12px] text-bone-100 transition-colors hover:bg-white/[0.07]"
          >
            Gerenciar monitores
          </Link>
          {isAdmin ? (
            <Link
              href="/admin"
              className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/[0.06] text-[12px] text-bone-400 transition-colors hover:text-bone-100"
            >
              Painel administrativo
            </Link>
          ) : null}
        </section>
      </div>

      <p className="pb-2 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-bone-700">
        {snapshot?.me ? `${snapshot.me.kind === "admin" ? "operador" : "cliente"} · ${snapshot.me.label}` : ""}
        {" · "}v{snapshot?.runtime.version ?? "1.1.0"}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/[0.055] bg-[#0A0C0C] px-3.5 py-2.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-bone-600">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-[18px] leading-none tracking-[-0.02em]",
          accent ? "text-lime-300" : "text-bone-100"
        )}
      >
        {value}
      </p>
      <p className="mt-1 font-mono text-[9px] text-bone-700">{hint}</p>
    </div>
  );
}
