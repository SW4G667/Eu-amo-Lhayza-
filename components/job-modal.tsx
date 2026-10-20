"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Layers, Loader2 } from "lucide-react";
import { apiRequest, useConsole } from "@/components/console-provider";
import { PlatformChip } from "@/components/platform-chip";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { Badge, SectionLabel } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PLATFORM_LIST, platformMeta } from "@/lib/platforms";
import type { Job, JobMode, PlatformId } from "@/lib/types";
import { cn, clamp } from "@/lib/utils";

const MODES: { id: JobMode; label: string; help: string }[] = [
  {
    id: "sequential",
    label: "Sequencial",
    help: "Percorre todas as combinações na ordem, sem repetir nenhum nome. É o modo mais confiável para 3 e 4 letras.",
  },
  {
    id: "random",
    label: "Aleatório",
    help: "Sorteia nomes dentro do conjunto escolhido. Bom para vigílias longas em plataformas com muitos nomes ocupados.",
  },
  {
    id: "pattern",
    label: "Máscara",
    help: "Você fixa posições e o motor sorteia o resto. Use ? para caractere livre, # para dígito e * para letra.",
  },
  {
    id: "wordlist",
    label: "Dicionário",
    help: "Usa uma lista de palavras curtas (português e inglês) somada às suas próprias palavras.",
  },
];

interface FormState {
  name: string;
  platform: PlatformId;
  mode: JobMode;
  lengths: number[];
  charset: string;
  pattern: string;
  words: string;
  batchSize: number;
  intervalSec: number;
  concurrency: number;
  useProxies: boolean;
  minScore: number;
  enabled: boolean;
  startNow: boolean;
}

function defaults(platform: PlatformId = "discord"): FormState {
  const meta = platformMeta(platform);
  return {
    name: "",
    platform,
    mode: "sequential",
    lengths: [3, 4].filter((n) => n >= meta.minLength && n <= meta.maxLength),
    charset: "abcdefghijklmnopqrstuvwxyz",
    pattern: "",
    words: "",
    batchSize: 10,
    intervalSec: 2,
    concurrency: 1,
    useProxies: false,
    minScore: 0,
    enabled: true,
    startNow: true,
  };
}

function fromJob(job: Job): FormState {
  return {
    name: job.name,
    platform: job.platform,
    mode: job.mode,
    lengths: job.lengths,
    charset: job.charset,
    pattern: job.pattern,
    words: job.words.join("\n"),
    batchSize: job.batchSize,
    intervalSec: Math.max(0.5, job.intervalMs / 1000),
    concurrency: job.concurrency,
    useProxies: job.useProxies,
    minScore: job.minScore,
    enabled: job.enabled,
    startNow: false,
  };
}

export function JobModal({
  open,
  job,
  onClose,
  onSaved,
}: {
  open: boolean;
  job: Job | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const toast = useToast();
  const { snapshot } = useConsole();
  const [form, setForm] = useState<FormState>(() => defaults());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(job ? fromJob(job) : defaults());
  }, [open, job]);

  const meta = platformMeta(form.platform);
  const extraChars = useMemo(
    () =>
      Array.from(new Set(meta.charset.split(""))).filter(
        (ch) => !"abcdefghijklmnopqrstuvwxyz".includes(ch) && !"0123456789".includes(ch)
      ),
    [meta.charset]
  );
  const maxLength = Math.min(meta.maxLength, 8);
  const lengthOptions = useMemo(() => {
    const list: number[] = [];
    for (let value = meta.minLength; value <= maxLength; value += 1) list.push(value);
    return list;
  }, [meta.minLength, maxLength]);

  const rate = form.batchSize / Math.max(0.5, form.intervalSec);
  const needsCredential =
    (form.platform === "discord" && !snapshot?.credentials.discord.configured) ||
    (form.platform === "twitch" && !snapshot?.credentials.twitch.configured);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function changePlatform(platform: PlatformId) {
    const targetMeta = platformMeta(platform);
    setForm((current) => ({
      ...current,
      platform,
      lengths: current.lengths.filter(
        (length) => length >= targetMeta.minLength && length <= targetMeta.maxLength
      ).length
        ? current.lengths.filter(
            (length) => length >= targetMeta.minLength && length <= targetMeta.maxLength
          )
        : [Math.min(Math.max(3, targetMeta.minLength), targetMeta.maxLength)],
      charset: Array.from(
        new Set(
          current.charset
            .split("")
            .filter((ch) => targetMeta.charset.includes(ch))
            .join("") || "abcdefghijklmnopqrstuvwxyz"
        )
      ).join(""),
    }));
  }

  function toggleLength(length: number) {
    setForm((current) => {
      const has = current.lengths.includes(length);
      const next = has
        ? current.lengths.filter((value) => value !== length)
        : [...current.lengths, length].sort((a, b) => a - b);
      return { ...current, lengths: next.length ? next : [length] };
    });
  }

  function toggleCharset(chars: string) {
    setForm((current) => {
      const present = [...chars].every((ch) => current.charset.includes(ch));
      const next = present
        ? current.charset
            .split("")
            .filter((ch) => !chars.includes(ch))
            .join("")
        : Array.from(new Set(current.charset + chars)).join("");
      if (!next) return current;
      return { ...current, charset: next };
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim() || undefined,
      platform: form.platform,
      mode: form.mode,
      lengths: form.lengths,
      charset: form.charset,
      pattern: form.pattern,
      words: form.words,
      batchSize: clamp(Math.round(form.batchSize), 1, 200),
      intervalMs: Math.round(clamp(form.intervalSec, 0.5, 600) * 1000),
      concurrency: clamp(Math.round(form.concurrency), 1, 8),
      useProxies: form.useProxies,
      minScore: clamp(Math.round(form.minScore), 0, 99),
      enabled: form.enabled || form.startNow,
    };

    const response = job
      ? await apiRequest<{ job: Job }>(`/api/jobs/${job.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
      : await apiRequest<{ job: Job }>("/api/jobs", {
          method: "POST",
          body: JSON.stringify(payload),
        });

    if (!response.ok) {
      setError(response.error);
      setSaving(false);
      return;
    }

    if (!job && form.startNow) {
      await apiRequest("/api/engine", {
        method: "POST",
        body: JSON.stringify({ action: "start" }),
      });
    }

    setSaving(false);
    toast.push(job ? "Monitor atualizado." : "Monitor criado.", "success");
    await onSaved();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={job ? "Editar monitor" : "Novo monitor"}
      description={
        job
          ? "Alterações de comprimento, modo ou conjunto reiniciam o cursor de varredura."
          : "Escolha onde monitorar, qual faixa de comprimento e com que ritmo o motor deve checar."
      }
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            form="job-form"
            loading={saving}
          >
            {job ? "Salvar alterações" : "Criar monitor"}
          </Button>
        </>
      }
    >
      <form
        id="job-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="space-y-5"
      >
        <div className="space-y-2">
          <SectionLabel>plataforma</SectionLabel>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {PLATFORM_LIST.map((platform) => {
              const active = form.platform === platform.id;
              return (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => changePlatform(platform.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                    active
                      ? "border-lime-500/40 bg-lime-400/[0.055]"
                      : "border-white/[0.06] bg-white/[0.015] hover:border-white/[0.13]"
                  )}
                >
                  <PlatformChip platform={platform.id} size="sm" />
                  <span
                    className={cn(
                      "truncate text-[11.5px]",
                      active ? "text-bone-50" : "text-bone-300"
                    )}
                  >
                    {platform.name}
                  </span>
                  {active ? (
                    <Check className="ml-auto h-3 w-3 shrink-0 text-lime-300" strokeWidth={2.4} />
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] leading-relaxed text-bone-500">{meta.note}</p>
          {needsCredential ? (
            <div className="flex items-center gap-2 rounded-md border border-amberglow/25 bg-amberglow/[0.06] px-2.5 py-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amberglow" strokeWidth={2} />
              <p className="text-[11px] text-amberglow">
                Esta plataforma exige credencial.{" "}
                <a href="/ajustes" className="underline underline-offset-2">
                  Configurar em Ajustes
                </a>
                .
              </p>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="nome do monitor" hint="Opcional. Um nome curto ajuda a ler os alertas.">
            <Input
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder={`${meta.name} · ${form.lengths.join("/")} letras`}
              maxLength={60}
            />
          </Field>
          <Field
            label="modo de varredura"
            hint={MODES.find((mode) => mode.id === form.mode)?.help}
          >
            <Select value={form.mode} onChange={(event) => update("mode", event.target.value as JobMode)}>
              {MODES.map((mode) => (
                <option key={mode.id} value={mode.id}>
                  {mode.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {form.mode === "pattern" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="máscara"
              hint="? = livre · # = dígito · * = letra. Ex: ??a, a##, *xy"
            >
              <Input
                value={form.pattern}
                onChange={(event) => update("pattern", event.target.value.toLowerCase())}
                placeholder="???"
                className="font-mono"
                maxLength={meta.maxLength}
              />
            </Field>
            <div className="flex items-end pb-2">
              <p className="text-[11px] leading-relaxed text-bone-500">
                A máscara fixa as posições literais e sorteia apenas onde houver curinga. Cada
                rodada gera nomes diferentes.
              </p>
            </div>
          </div>
        ) : null}

        {form.mode === "wordlist" ? (
          <Field
            label="suas palavras"
            hint="Uma por linha ou separadas por vírgula. Somam-se ao dicionário interno."
          >
            <Textarea
              value={form.words}
              onChange={(event) => update("words", event.target.value)}
              placeholder={"kai\nluma\nvox\nnorth"}
              className="min-h-[80px] font-mono text-[12px]"
            />
          </Field>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <SectionLabel>comprimento</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {lengthOptions.map((length) => {
                const active = form.lengths.includes(length);
                return (
                  <button
                    key={length}
                    type="button"
                    onClick={() => toggleLength(length)}
                    className={cn(
                      "h-8 min-w-[36px] rounded-md border font-mono text-[12px] transition-colors",
                      active
                        ? "border-lime-500/40 bg-lime-400/[0.09] text-lime-200"
                        : "border-white/[0.06] bg-white/[0.015] text-bone-400 hover:border-white/[0.14]"
                    )}
                  >
                    {length}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-bone-500">
              Cada número é a quantidade de caracteres do username.
            </p>
          </div>

          <div className="space-y-2">
            <SectionLabel>conjunto de caracteres</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              <CharToggle
                active={form.charset.includes("a")}
                onClick={() => toggleCharset("abcdefghijklmnopqrstuvwxyz")}
              >
                a–z
              </CharToggle>
              <CharToggle
                active={"0123456789".split("").every((ch) => form.charset.includes(ch))}
                onClick={() => toggleCharset("0123456789")}
              >
                0–9
              </CharToggle>
              {extraChars.length ? (
                <CharToggle
                  active={extraChars.every((ch) => form.charset.includes(ch))}
                  onClick={() => toggleCharset(extraChars.join(""))}
                >
                  {extraChars.join(" ")}
                </CharToggle>
              ) : null}
            </div>
            <p className="text-[11px] text-bone-500">
              Menos caracteres = menos combinações, mais rápido encontrar.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="nomes por rodada" hint="Gerados e checados a cada tick.">
            <Input
              type="number"
              min={1}
              max={200}
              value={form.batchSize}
              onChange={(event) => update("batchSize", Number(event.target.value) || 1)}
              className="font-mono"
            />
          </Field>
          <Field label="intervalo (s)" hint="Tempo entre rodadas.">
            <Input
              type="number"
              min={0.5}
              max={600}
              step={0.5}
              value={form.intervalSec}
              onChange={(event) => update("intervalSec", Number(event.target.value) || 0.5)}
              className="font-mono"
            />
          </Field>
          <Field label="concorrência" hint="Requisições simultâneas.">
            <Input
              type="number"
              min={1}
              max={8}
              value={form.concurrency}
              onChange={(event) => update("concurrency", Number(event.target.value) || 1)}
              className="font-mono"
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-ink-950/50 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 text-lime-300" strokeWidth={2} />
            <span className="text-[11.5px] text-bone-300">
              Ritmo estimado:{" "}
              <span className="font-mono text-bone-100">
                {rate.toFixed(rate < 1 ? 2 : 1).replace(".", ",")} nomes/s
              </span>
            </span>
          </div>
          <Badge tone="muted">
            {form.batchSize} × a cada {form.intervalSec}s
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-white/[0.06] bg-white/[0.012] p-3">
            <Switch
              checked={form.useProxies}
              onChange={(value) => update("useProxies", value)}
              label="Rotacionar proxies"
              description={
                (snapshot?.proxies.length ?? 0) > 0
                  ? `${snapshot?.proxies.length} proxy(s) no pool`
                  : "Nenhuma proxy cadastrada — sairá direto pelo IP do servidor"
              }
            />
          </div>
          <div className="space-y-3 rounded-lg border border-white/[0.06] bg-white/[0.012] p-3">
            {job ? (
              <Switch
                checked={form.enabled}
                onChange={(value) => update("enabled", value)}
                label="Monitor ativo"
                description="Pausar mantém o cursor e o histórico."
              />
            ) : (
              <Switch
                checked={form.startNow}
                onChange={(value) => update("startNow", value)}
                label="Iniciar agora"
                description="Cria já ativo e retoma o motor."
              />
            )}
          </div>
        </div>

        <Field
          label={`alertar apenas acima de ${form.minScore} pontos`}
          hint="0 alerta qualquer nome livre. 70+ exige nomes realmente raros."
        >
          <input
            type="range"
            min={0}
            max={95}
            step={5}
            value={form.minScore}
            onChange={(event) => update("minScore", Number(event.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/[0.08] accent-lime-400"
          />
        </Field>

        {error ? (
          <p className="rounded-md border border-ember/25 bg-ember/[0.07] px-3 py-2 text-[12px] text-[#FFA48E]">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-2 border-t border-white/[0.05] pt-3">
          <Layers className="h-3.5 w-3.5 text-bone-500" strokeWidth={1.8} />
          <p className="text-[10.5px] leading-relaxed text-bone-500">
            O motor respeita 429 e aplica pausa automática quando a plataforma pede. Varreduras
            sequenciais retomam de onde pararam.
          </p>
        </div>
      </form>
    </Modal>
  );
}

function CharToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 rounded-md border px-2.5 font-mono text-[11px] transition-colors",
        active
          ? "border-lime-500/40 bg-lime-400/[0.09] text-lime-200"
          : "border-white/[0.06] bg-white/[0.015] text-bone-400 hover:border-white/[0.14]"
      )}
    >
      {children}
    </button>
  );
}
