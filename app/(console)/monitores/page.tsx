"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Pause,
  Pencil,
  Play,
  Plus,
  Radar,
  Timer,
  Trash2,
  Zap,
} from "lucide-react";
import { apiRequest, useConsole } from "@/components/console-provider";
import { JobModal } from "@/components/job-modal";
import { PlatformChip } from "@/components/platform-chip";
import { TimeAgo } from "@/components/time";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge, EmptyState, Panel } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { ProgressBar } from "@/components/charts";
import { etaForJob, intervalLabel, modeLabel, progressForJob, totalForJob } from "@/lib/progress";
import type { Job } from "@/lib/types";
import { cn, duration, nfmt } from "@/lib/utils";

interface RunResult {
  checked: number;
  available: number;
  rateLimited: number;
  errors: number;
  message?: string;
  hits: { username: string; score: number }[];
}

export default function MonitoresPage() {
  const { snapshot, refresh } = useConsole();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [deleting, setDeleting] = useState<Job | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const jobs = [...(snapshot?.jobs ?? [])].sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
  const active = jobs.filter((job) => job.enabled).length;
  const totalChecks = jobs.reduce((acc, job) => acc + job.checked, 0);
  const totalFound = jobs.reduce((acc, job) => acc + job.found, 0);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(job: Job) {
    setEditing(job);
    setModalOpen(true);
  }

  async function toggle(job: Job) {
    setBusyId(job.id);
    const response = await apiRequest(`/api/jobs/${job.id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !job.enabled }),
    });
    setBusyId(null);
    if (!response.ok) {
      toast.push(response.error, "error");
      return;
    }
    toast.push(job.enabled ? "Monitor pausado." : "Monitor ativo.", job.enabled ? "info" : "success");
    await refresh();
  }

  async function runNow(job: Job) {
    setBusyId(job.id);
    const response = await apiRequest<{ result: RunResult }>("/api/engine", {
      method: "POST",
      body: JSON.stringify({ action: "run", jobId: job.id }),
    });
    setBusyId(null);
    if (!response.ok) {
      toast.push(response.error, "error");
      return;
    }
    const result = response.data.result;
    if (result.message && result.checked === 0) {
      toast.push(result.message, "error");
    } else if (result.available > 0) {
      toast.push(
        `${result.available} nome(s) livre(s): ${result.hits.map((hit) => hit.username).join(", ")}`,
        "success"
      );
    } else {
      toast.push(`${result.checked} checagens concluídas, nenhum nome livre.`, "info");
    }
    await refresh();
  }

  async function remove() {
    if (!deleting) return;
    setRemoving(true);
    const response = await apiRequest(`/api/jobs/${deleting.id}`, { method: "DELETE" });
    setRemoving(false);
    if (!response.ok) {
      toast.push(response.error, "error");
      return;
    }
    toast.push("Monitor removido.", "success");
    setDeleting(null);
    await refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-mono">varreduras</p>
          <h2 className="mt-1 text-[19px] font-semibold tracking-[-0.025em] text-bone-50">
            Monitores
          </h2>
          <p className="mt-0.5 text-[12px] text-bone-500">
            Cada monitor vigia uma plataforma e uma faixa de comprimento. Vários podem rodar juntos.
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
          Novo monitor
        </Button>
      </div>

      <Panel className="flex flex-wrap divide-y divide-white/[0.05] sm:flex-nowrap sm:divide-x sm:divide-y-0">
        <Summary label="monitores" value={String(jobs.length)} detail={`${active} ativos`} />
        <Summary label="checagens" value={nfmt(totalChecks)} detail="acumulado" />
        <Summary label="achados" value={nfmt(totalFound)} detail="nomes livres" tone="mint" />
        <Summary
          label="motor"
          value={snapshot?.settings.engine.paused ? "pausado" : "ativo"}
          detail={snapshot?.engine.mode === "serverless" ? "nuvem" : "servidor"}
          tone={snapshot?.settings.engine.paused ? "muted" : "lime"}
        />
      </Panel>

      {jobs.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Radar className="h-4 w-4" />}
            title="Nenhum monitor configurado"
            description="Comece com 3 e 4 letras no Discord. O motor percorre as combinações em ordem e não repete nomes."
            action={
              <Button variant="primary" size="sm" onClick={openCreate}>
                Criar primeiro monitor
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {jobs.map((job) => {
            const progress = progressForJob(job);
            const total = totalForJob(job);
            const eta = etaForJob(job);
            const busy = busyId === job.id;
            return (
              <Panel key={job.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3 px-4 pt-4">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <PlatformChip platform={job.platform} />
                    <div className="min-w-0">
                      <h3 className="truncate text-[13px] font-medium text-bone-50">{job.name}</h3>
                      <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-bone-500">
                        {modeLabel(job.mode)} · {job.lengths.join("/")} chars ·{" "}
                        {intervalLabel(job.intervalMs)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {job.lastError ? (
                      <span title={job.lastError} className="text-ember">
                        <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                      </span>
                    ) : null}
                    {job.enabled ? (
                      <Badge tone="lime" dot>
                        ativo
                      </Badge>
                    ) : (
                      <Badge tone="muted" dot>
                        pausado
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-3 px-4 py-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between font-mono text-[10px] text-bone-500">
                      <span>
                        {progress === null
                          ? "varredura contínua"
                          : `${Math.round(progress * 100)}% · ${nfmt(Math.round((total ?? 0) * progress))} de ${nfmt(total ?? 0)}`}
                      </span>
                      {eta !== null ? (
                        <span className="flex items-center gap-1">
                          <Timer className="h-3 w-3" strokeWidth={1.8} />
                          {progress !== null && progress >= 1 ? "concluído" : `~${duration(eta)}`}
                        </span>
                      ) : null}
                    </div>
                    <ProgressBar value={progress === null ? 100 : progress * 100} tone={progress === null ? "muted" : "lime"} />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <MiniStat label="checadas" value={nfmt(job.checked)} />
                    <MiniStat label="achados" value={nfmt(job.found)} tone="mint" />
                    <MiniStat
                      label="ritmo"
                      value={`${job.batchSize}/${intervalLabel(job.intervalMs)}`}
                    />
                  </div>

                  {job.lastError ? (
                    <p className="truncate rounded-md border border-amberglow/15 bg-amberglow/[0.05] px-2 py-1.5 text-[10.5px] text-amberglow/90">
                      {job.lastError}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-white/[0.05] px-3 py-2.5">
                  <span className="pl-1 font-mono text-[10px] text-bone-500">
                    última: <TimeAgo ts={job.lastRunAt} />
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={busy}
                      onClick={() => void runNow(job)}
                      title="Executar uma rodada agora"
                    >
                      <Zap className="h-3 w-3" strokeWidth={2} />
                      Rodar
                    </Button>
                    <Button
                      variant={job.enabled ? "ghost" : "subtle"}
                      size="sm"
                      loading={busy}
                      onClick={() => void toggle(job)}
                      title={job.enabled ? "Pausar monitor" : "Ativar monitor"}
                    >
                      {job.enabled ? (
                        <Pause className="h-3 w-3" strokeWidth={2} />
                      ) : (
                        <Play className="h-3 w-3" strokeWidth={2} />
                      )}
                      {job.enabled ? "Pausar" : "Ativar"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => openEdit(job)}
                      className="grid h-8 w-8 place-items-center rounded-md text-bone-500 transition-colors hover:bg-white/[0.05] hover:text-bone-100"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(job)}
                      className="grid h-8 w-8 place-items-center rounded-md text-bone-500 transition-colors hover:bg-ember/10 hover:text-[#FFA48E]"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </button>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <JobModal
        open={modalOpen}
        job={editing}
        onClose={() => setModalOpen(false)}
        onSaved={async () => {
          await refresh();
        }}
      />

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Excluir monitor"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" loading={removing} onClick={() => void remove()}>
              Excluir definitivamente
            </Button>
          </>
        }
      >
        <p className="text-[12.5px] leading-relaxed text-bone-400">
          O monitor <span className="font-medium text-bone-100">{deleting?.name}</span> será
          removido. Os nomes já encontrados continuam no histórico.
        </p>
      </Modal>
    </div>
  );
}

function Summary({
  label,
  value,
  detail,
  tone = "bone",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "bone" | "mint" | "lime" | "muted";
}) {
  const tones = {
    bone: "text-bone-50",
    mint: "text-mint",
    lime: "text-lime-300",
    muted: "text-bone-400",
  };
  return (
    <div className="min-w-[150px] flex-1 px-4 py-3">
      <p className="label-mono">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={cn("font-mono text-[18px] leading-none mono-num", tones[tone])}>{value}</span>
        <span className="text-[10.5px] text-bone-500">{detail}</span>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "bone",
}: {
  label: string;
  value: string;
  tone?: "bone" | "mint";
}) {
  return (
    <div className="rounded-md border border-white/[0.05] bg-white/[0.015] px-2.5 py-1.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-bone-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-mono text-[12px] mono-num",
          tone === "mint" ? "text-mint" : "text-bone-100"
        )}
      >
        {value}
      </p>
    </div>
  );
}
