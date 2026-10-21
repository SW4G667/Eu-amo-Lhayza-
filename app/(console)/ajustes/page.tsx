"use client";

import { useState } from "react";
import {
  Database,
  Download,
  Github,
  KeyRound,
  LogOut,
  MessageCircle,
  RefreshCw,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
  Twitch,
} from "lucide-react";
import { apiRequest, saveStateToken, useConsole } from "@/components/console-provider";
import { TimeAgo } from "@/components/time";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Badge, Panel, PanelHeader } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { RUNNER_WORKFLOW } from "@/lib/runner-workflow";
import type { CredentialInfo } from "@/lib/snapshot-types";
import { cn, duration } from "@/lib/utils";

type CredentialKey = "discord" | "github" | "twitch";

export default function AjustesPage() {
  const { snapshot, refresh } = useConsole();
  const toast = useToast();

  const [tokens, setTokens] = useState({ discord: "", github: "", twitchSecret: "", twitchId: "" });
  const [saving, setSaving] = useState<CredentialKey | null>(null);
  const [engineForm, setEngineForm] = useState({
    jitterPct: snapshot?.settings.engine.jitterPct ?? 18,
    timeoutMs: snapshot?.settings.engine.timeoutMs ?? 12000,
    maxConcurrency: snapshot?.settings.engine.maxConcurrency ?? 4,
    userAgent: snapshot?.settings.engine.userAgent ?? "",
  });
  const [savingEngine, setSavingEngine] = useState(false);
  const [ghToken, setGhToken] = useState("");
  const [connectingGh, setConnectingGh] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const credentials = snapshot?.credentials;
  const runtime = snapshot?.runtime;
  const stateInfo = runtime?.state;
  const stateConnected = Boolean(stateInfo && stateInfo.driver === "github" && stateInfo.writable);
  const stateLabel = stateInfo?.repo ? `${stateInfo.repo}@${stateInfo.branch}` : null;
  const runner = stateInfo?.runner ?? null;

  async function saveCredential(platform: CredentialKey) {
    setSaving(platform);
    let response;
    if (platform === "twitch") {
      response = await apiRequest("/api/credentials", {
        method: "POST",
        body: JSON.stringify({
          platform: "twitch",
          clientId: tokens.twitchId.trim(),
          clientSecret: tokens.twitchSecret.trim(),
        }),
      });
    } else {
      response = await apiRequest("/api/credentials", {
        method: "POST",
        body: JSON.stringify({ platform, token: tokens[platform].trim() }),
      });
    }
    setSaving(null);
    if (!response.ok) {
      toast.push(response.error, "error");
      return;
    }
    toast.push("Credencial validada e salva.", "success");
    setTokens((current) => ({
      ...current,
      [platform]: "",
      ...(platform === "twitch" ? { twitchId: "", twitchSecret: "" } : {}),
    }));
    await refresh();
  }

  async function removeCredential(platform: CredentialKey) {
    const response = await apiRequest(`/api/credentials?platform=${platform}`, { method: "DELETE" });
    if (!response.ok) {
      toast.push(response.error, "error");
      return;
    }
    toast.push("Credencial removida.", "success");
    await refresh();
  }

  async function connectGithub() {
    const token = ghToken.trim();
    if (!token) {
      toast.push("Cole o token do GitHub para conectar.", "error");
      return;
    }
    setConnectingGh(true);
    saveStateToken(token);
    const probe = await apiRequest<{ ok: boolean }>("/api/state");
    setConnectingGh(false);
    if (!probe.ok) {
      toast.push(probe.error, "error");
      return;
    }
    await refresh();
    setGhToken("");
    toast.push("GitHub conectado. O painel agora lê e grava o estado do repositório.", "success");
  }

  async function disconnectGithub() {
    saveStateToken("");
    await refresh();
    toast.push("Token removido deste navegador.", "info");
  }

  async function saveEngine() {
    setSavingEngine(true);
    const response = await apiRequest("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({
        engine: {
          jitterPct: Number(engineForm.jitterPct),
          timeoutMs: Number(engineForm.timeoutMs),
          maxConcurrency: Number(engineForm.maxConcurrency),
          userAgent: engineForm.userAgent,
        },
      }),
    });
    setSavingEngine(false);
    if (!response.ok) {
      toast.push(response.error, "error");
      return;
    }
    toast.push("Preferências do motor salvas.", "success");
    await refresh();
  }

  function exportConfig() {
    if (!snapshot) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      app: "atalaia",
      version: runtime?.version,
      settings: snapshot.settings,
      jobs: snapshot.jobs,
      proxies: snapshot.proxies.map(({ hasPassword, ...rest }) => ({ ...rest })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `atalaia-config-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function resetStats() {
    setResetting(true);
    const response = await apiRequest("/api/stats", { method: "DELETE" });
    setResetting(false);
    if (!response.ok) {
      toast.push(response.error, "error");
      return;
    }
    setConfirmReset(false);
    toast.push("Estatísticas zeradas.", "success");
    await refresh();
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="label-mono">sistema</p>
        <h2 className="mt-1 text-[19px] font-semibold tracking-[-0.025em] text-bone-50">Ajustes</h2>
        <p className="mt-0.5 text-[12px] text-bone-500">
          Credenciais cifradas, comportamento do motor e dados do console.
        </p>
      </div>

      <Panel>
        <PanelHeader
          title="Credenciais"
          subtitle="Armazenadas com AES-256-GCM. O navegador nunca recebe o valor de volta."
          icon={<KeyRound className="h-4 w-4" strokeWidth={1.7} />}
        />
        <div className="grid gap-4 p-4 lg:grid-cols-3">
          <CredentialCard
            icon={<MessageCircle className="h-4 w-4" strokeWidth={1.7} />}
            name="Discord"
            info={credentials?.discord}
            description="Token de uma conta sua, usado apenas no endpoint oficial de username."
          >
            <Field label="token da conta">
              <Input
                type="password"
                value={tokens.discord}
                onChange={(event) => setTokens({ ...tokens, discord: event.target.value })}
                placeholder={credentials?.discord.configured ? "••••••••••••••" : "MTIz..."}
                className="font-mono text-[11.5px]"
                spellCheck={false}
              />
            </Field>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={saving === "discord"}
                onClick={() => void saveCredential("discord")}
                disabled={!tokens.discord.trim()}
              >
                Validar e salvar
              </Button>
              {credentials?.discord.configured ? (
                <Button variant="ghost" size="sm" onClick={() => void removeCredential("discord")}>
                  Remover
                </Button>
              ) : null}
            </div>
            <p className="text-[10.5px] leading-relaxed text-bone-500">
              Automação de conta de usuário não é autorizada pelo Discord. Use intervalos altos e
              apenas na sua conta.
            </p>
          </CredentialCard>

          <CredentialCard
            icon={<Github className="h-4 w-4" strokeWidth={1.7} />}
            name="GitHub"
            info={credentials?.github}
            description="Opcional. Sem token, a API pública limita a 60 checagens por hora por IP."
          >
            <Field label="personal access token">
              <Input
                type="password"
                value={tokens.github}
                onChange={(event) => setTokens({ ...tokens, github: event.target.value })}
                placeholder={credentials?.github.configured ? "••••••••••••••" : "ghp_..."}
                className="font-mono text-[11.5px]"
                spellCheck={false}
              />
            </Field>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={saving === "github"}
                onClick={() => void saveCredential("github")}
                disabled={!tokens.github.trim()}
              >
                Validar e salvar
              </Button>
              {credentials?.github.configured ? (
                <Button variant="ghost" size="sm" onClick={() => void removeCredential("github")}>
                  Remover
                </Button>
              ) : null}
            </div>
            <p className="text-[10.5px] leading-relaxed text-bone-500">
              Escopo mínimo: leitura pública. Tokens clássicos com <code>read:user</code> são
              suficientes.
            </p>
          </CredentialCard>

          <CredentialCard
            icon={<Twitch className="h-4 w-4" strokeWidth={1.7} />}
            name="Twitch"
            info={credentials?.twitch}
            description="Crie um app em dev.twitch.tv e use as credenciais de client credentials."
          >
            <Field label="client id">
              <Input
                value={tokens.twitchId}
                onChange={(event) => setTokens({ ...tokens, twitchId: event.target.value })}
                placeholder={credentials?.twitch.configured ? credentials.twitch.username ?? "configurado" : "client id"}
                className="font-mono text-[11.5px]"
                spellCheck={false}
              />
            </Field>
            <Field label="client secret">
              <Input
                type="password"
                value={tokens.twitchSecret}
                onChange={(event) => setTokens({ ...tokens, twitchSecret: event.target.value })}
                placeholder="••••••••••••••"
                className="font-mono text-[11.5px]"
                spellCheck={false}
              />
            </Field>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={saving === "twitch"}
                onClick={() => void saveCredential("twitch")}
                disabled={!tokens.twitchId.trim() || !tokens.twitchSecret.trim()}
              >
                Validar e salvar
              </Button>
              {credentials?.twitch.configured ? (
                <Button variant="ghost" size="sm" onClick={() => void removeCredential("twitch")}>
                  Remover
                </Button>
              ) : null}
            </div>
          </CredentialCard>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Panel>
          <PanelHeader
            title="Motor"
            subtitle="Ajustes globais aplicados a todos os monitores"
            icon={<SlidersHorizontal className="h-4 w-4" strokeWidth={1.7} />}
          />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="jitter (%)" hint="Variação aleatória no intervalo entre rodadas.">
              <Input
                type="number"
                min={0}
                max={80}
                value={engineForm.jitterPct}
                onChange={(event) =>
                  setEngineForm({ ...engineForm, jitterPct: Number(event.target.value) })
                }
                className="font-mono"
              />
            </Field>
            <Field label="timeout (ms)" hint="Tempo máximo por requisição.">
              <Input
                type="number"
                min={3000}
                max={60000}
                step={500}
                value={engineForm.timeoutMs}
                onChange={(event) =>
                  setEngineForm({ ...engineForm, timeoutMs: Number(event.target.value) })
                }
                className="font-mono"
              />
            </Field>
            <Field label="concorrência máxima" hint="Teto global de requisições simultâneas.">
              <Input
                type="number"
                min={1}
                max={12}
                value={engineForm.maxConcurrency}
                onChange={(event) =>
                  setEngineForm({ ...engineForm, maxConcurrency: Number(event.target.value) })
                }
                className="font-mono"
              />
            </Field>
            <Field label="user-agent" hint="Assinatura enviada nas checagens públicas.">
              <Textarea
                value={engineForm.userAgent}
                onChange={(event) => setEngineForm({ ...engineForm, userAgent: event.target.value })}
                className="min-h-[38px] font-mono text-[10.5px] leading-snug"
              />
            </Field>
            <div className="sm:col-span-2 flex items-center justify-between border-t border-white/[0.05] pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={runtime?.vercel ? "info" : "neutral"} dot>
                  {runtime?.vercel ? "serverless" : "processo persistente"}
                </Badge>
                <Badge tone="muted">{runtime?.storage}</Badge>
                <span className="font-mono text-[10px] text-bone-500">
                  uptime {duration(runtime?.uptimeMs ?? 0)}
                </span>
              </div>
              <Button variant="primary" size="sm" loading={savingEngine} onClick={() => void saveEngine()}>
                Salvar motor
              </Button>
            </div>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel>
            <PanelHeader
              title="Ambiente"
              subtitle="Variáveis lidas do processo"
              icon={<Server className="h-4 w-4" strokeWidth={1.7} />}
            />
            <ul className="divide-y divide-white/[0.04]">
              <EnvRow
                name="APP_PASSWORD"
                ok={!runtime?.defaultPassword}
                value={runtime?.defaultPassword ? "senha padrão ativa" : "definida"}
              />
              <EnvRow name="APP_SECRET" ok value="chave de sessão e cifra" hint="recomendado" />
              <EnvRow name="CRON_SECRET" ok value="gatilho externo /api/cron" hint="opcional" />
              <EnvRow
                name="KV / Upstash"
                ok={runtime?.storage === "Redis"}
                value={runtime?.storage === "Redis" ? "persistência externa" : "sem redis"}
                hint="opcional"
              />
            </ul>
            {runtime?.vercel ? (
              <div className="border-t border-white/[0.05] px-4 py-3">
                <p className="text-[10.5px] leading-relaxed text-bone-500">
                  Para rodar sem depender da aba aberta, aponte um pinger externo para{" "}
                  <code className="font-mono text-bone-300">/api/cron?key=CRON_SECRET</code> a cada
                  minuto, ou rode <code className="font-mono text-bone-300">npm start</code> em um
                  VPS.
                </p>
              </div>
            ) : null}
          </Panel>

          <Panel>
            <PanelHeader
              title="Conexão GitHub"
              subtitle="Motor 24/7 nos runners"
              icon={<Github className="h-4 w-4" strokeWidth={1.7} />}
            />
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={stateConnected ? "ok" : "muted"} dot>
                  {stateConnected ? "conectado" : "desconectado"}
                </Badge>
                {stateLabel ? (
                  <span className="font-mono text-[10px] text-bone-500">{stateLabel}</span>
                ) : null}
                {runner ? (
                  <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-bone-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-lime" />
                    runner <TimeAgo ts={runner.lastSeenAt} />
                  </span>
                ) : null}
              </div>
              <p className="text-[10.5px] leading-relaxed text-bone-500">
                O workflow <code className="font-mono text-bone-300">Atalaia Runner</code> mantém o motor
                girando e grava o estado cifrado no branch{" "}
                <code className="font-mono text-bone-300">atalaia-state</code>. Para o painel editar esse
                estado, cole um token fine-grained com{" "}
                <code className="font-mono text-bone-300">Contents: Read and write</code> no repositório.
                Ele fica apenas neste navegador.
              </p>
              <Field label="token do GitHub" hint="Não é enviado para nenhum servidor além do seu.">
                <Input
                  type="password"
                  placeholder="github_pat_…"
                  value={ghToken}
                  onChange={(event) => setGhToken(event.target.value)}
                  className="font-mono text-[11px]"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3">
                <p className="text-[10.5px] leading-relaxed text-bone-500">
                  1. Copie o workflow e cole em{" "}
                  <code className="font-mono text-bone-300">.github/workflows/runner.yml</code> no
                  repositório. 2. Em <span className="text-bone-300">Settings → Secrets → Actions</span>,
                  crie <code className="font-mono text-bone-300">APP_SECRET</code> com o mesmo valor da
                  Vercel.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CopyButton value={RUNNER_WORKFLOW} />
                  <a
                    href="https://github.com/SW4G667/Eu-amo-Lhayza-/new/main/.github/workflows"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10.5px] text-bone-500 underline decoration-white/15 underline-offset-2 transition hover:text-bone-200"
                  >
                    abrir no GitHub
                  </a>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" size="sm" loading={connectingGh} onClick={() => void connectGithub()}>
                  Conectar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void disconnectGithub()}>
                  Remover
                </Button>
                <a
                  href="https://github.com/settings/personal-access-tokens/new"
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto text-[10.5px] text-bone-500 underline decoration-white/15 underline-offset-2 transition hover:text-bone-200"
                >
                  criar token
                </a>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Dados"
              subtitle="Backup e manutenção"
              icon={<Database className="h-4 w-4" strokeWidth={1.7} />}
            />
            <div className="space-y-2 p-4">
              <Button variant="secondary" size="sm" className="w-full justify-start" onClick={exportConfig}>
                <Download className="h-3.5 w-3.5" strokeWidth={1.9} />
                Exportar configuração (JSON)
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-start"
                onClick={() => setConfirmReset(true)}
              >
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.9} />
                Zerar estatísticas
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="w-full justify-start"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  window.location.href = "/login";
                }}
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.9} />
                Encerrar sessão
              </Button>
            </div>
          </Panel>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-white/[0.012] px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] text-bone-500">
          <ShieldCheck className="h-3.5 w-3.5 text-mint" strokeWidth={1.8} />
          Painel privado. Nenhuma rota expõe tokens ou senhas de proxy.
        </div>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-bone-500">
          atalaia v{runtime?.version ?? "1.0.0"}
        </span>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Zerar estatísticas"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" loading={resetting} onClick={() => void resetStats()}>
              Zerar
            </Button>
          </>
        }
      >
        <p className="text-[12.5px] leading-relaxed text-bone-400">
          Contadores de checagens, erros e gráficos serão zerados. O histórico de nomes encontrados
          permanece intacto.
        </p>
      </Modal>
    </div>
  );
}

function CredentialCard({
  icon,
  name,
  description,
  info,
  children,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
  info?: CredentialInfo;
  children: React.ReactNode;
}) {
  const status = !info?.configured
    ? { label: "ausente", tone: "muted" as const }
    : info.valid === true
      ? { label: "verificado", tone: "ok" as const }
      : info.valid === false
        ? { label: "inválido", tone: "danger" as const }
        : { label: "salvo", tone: "neutral" as const };

  return (
    <div className="space-y-3 rounded-lg border border-white/[0.055] bg-white/[0.012] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md border border-white/[0.07] bg-white/[0.02] text-bone-300">
            {icon}
          </span>
          <div>
            <p className="text-[12.5px] font-medium text-bone-100">{name}</p>
            <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-bone-500">
              {info?.configured ? info.username ?? "conectado" : "não conectado"}
            </p>
          </div>
        </div>
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
      </div>
      <p className="text-[10.5px] leading-relaxed text-bone-500">{description}</p>
      {children}
      {info?.checkedAt ? (
        <p className="font-mono text-[9.5px] text-bone-600">
          validado <TimeAgo ts={info.checkedAt} />
        </p>
      ) : null}
    </div>
  );
}

function EnvRow({
  name,
  ok,
  value,
  hint,
}: {
  name: string;
  ok: boolean;
  value: string;
  hint?: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="flex items-center gap-2">
        {ok ? (
          <ShieldCheck className="h-3.5 w-3.5 text-mint" strokeWidth={1.8} />
        ) : (
          <TriangleAlert className="h-3.5 w-3.5 text-amberglow" strokeWidth={1.8} />
        )}
        <span className="font-mono text-[11px] text-bone-200">{name}</span>
        {hint ? <span className="font-mono text-[9px] text-bone-600">{hint}</span> : null}
      </div>
      <span className={cn("font-mono text-[10px]", ok ? "text-bone-500" : "text-amberglow")}>
        {value}
      </span>
    </li>
  );
}
