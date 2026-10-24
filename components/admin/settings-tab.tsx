"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, ExternalLink, Info, Save, Server, ShieldCheck } from "lucide-react";
import type { SettingsMap, SettingsKey } from "@/lib/cloud/types";
import { ActionButton, Card, CopyInline, TextField, Toggle } from "./ui";
import type { PhanomInfo } from "./types";

type Notify = (message: string, tone?: "ok" | "err") => void;

async function saveSection<K extends SettingsKey>(
  key: K,
  value: Partial<SettingsMap[K]>
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: payload?.error ?? `Erro ${response.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Falha de conexão" };
  }
}

function redirectUri(): string {
  if (typeof window === "undefined") return "/api/auth/discord/callback";
  return `${window.location.origin}/api/auth/discord/callback`;
}

export function SettingsTab({
  settings,
  plans,
  phanom,
  driver,
  adminKeyDefault,
  discordConfigured,
  onRefresh,
  notify,
}: {
  settings: SettingsMap;
  plans: Array<{ id: string; name: string }>;
  phanom: PhanomInfo;
  driver: string;
  adminKeyDefault: boolean;
  discordConfigured: boolean;
  onRefresh: () => Promise<void>;
  notify: Notify;
}) {
  const [gate, setGate] = useState(settings.gate);
  const [branding, setBranding] = useState(settings.branding);
  const [limits, setLimits] = useState(settings.limits);
  const [alerts, setAlerts] = useState(settings.alerts);
  const [discord, setDiscord] = useState(settings.discord);
  const [busy, setBusy] = useState<string | null>(null);

  async function commit<K extends SettingsKey>(key: K, value: Partial<SettingsMap[K]>) {
    setBusy(key);
    const result = await saveSection(key, value);
    setBusy(null);
    if (!result.ok) {
      notify(result.error, "err");
      return;
    }
    notify("Configuração salva.");
    await onRefresh();
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Card title="porta de entrada" subtitle="como o cliente entra e o que é exigido">
        <div className="space-y-3 p-4">
          <Toggle
            checked={gate.requireDiscord}
            onChange={(next) => setGate({ ...gate, requireDiscord: next })}
            label="exigir login do Discord para ativar a key"
          />
          <p className="-mt-1 pl-[40px] text-[10.5px] leading-relaxed text-bone-700">
            Ligado: a key só ativa depois que o cliente conecta o Discord — é o que impede
            compartilhamento. Desligado: a key pode ser pré-ativada sem conta (o console continua
            pedindo Discord para entrar).
          </p>
          <Toggle
            checked={gate.requireGuild}
            onChange={(next) => setGate({ ...gate, requireGuild: next })}
            label="exigir participação no servidor"
          />
          <TextField
            label="id do servidor (guild)"
            placeholder="1540376884846526515"
            value={gate.guildId}
            onChange={(event) => setGate({ ...gate, guildId: event.target.value })}
          />
          <TextField
            label="mensagem de boas-vindas"
            value={gate.welcome}
            onChange={(event) => setGate({ ...gate, welcome: event.target.value })}
          />
          <div className="rounded-lg border border-amberglow/20 bg-amberglow/[0.05] p-2.5">
            <Toggle
              checked={gate.maintenance}
              onChange={(next) => setGate({ ...gate, maintenance: next })}
              label="modo manutenção"
            />
            <TextField
              label="texto da manutenção"
              value={gate.maintenanceMessage}
              onChange={(event) => setGate({ ...gate, maintenanceMessage: event.target.value })}
              className="mt-2"
            />
          </div>
          <ActionButton tone="primary" busy={busy === "gate"} onClick={() => void commit("gate", gate)}>
            <Save className="h-3 w-3" />
            salvar acesso
          </ActionButton>
        </div>
      </Card>

      <Card title="marca e limites" subtitle="nome no site e regras padrão das keys">
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2">
            <TextField
              label="nome do produto"
              value={branding.productName}
              onChange={(event) => setBranding({ ...branding, productName: event.target.value })}
            />
            <TextField
              label="assinatura"
              value={branding.tagline}
              onChange={(event) => setBranding({ ...branding, tagline: event.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <TextField
              label="ativações"
              type="number"
              min={1}
              max={10}
              value={limits.maxActivations}
              onChange={(event) => setLimits({ ...limits, maxActivations: Number(event.target.value) })}
            />
            <TextField
              label="dias padrão"
              type="number"
              min={1}
              max={3650}
              value={limits.defaultDays}
              onChange={(event) => setLimits({ ...limits, defaultDays: Number(event.target.value) })}
            />
            <label className="block">
              <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.13em] text-bone-600">
                plano padrão
              </span>
              <select
                value={limits.defaultPlan}
                onChange={(event) => setLimits({ ...limits, defaultPlan: event.target.value })}
                className="h-8 w-full rounded-md border border-white/[0.07] bg-ink-950/70 px-1.5 text-[11.5px] text-bone-100 outline-none focus:border-lime-500/40"
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id} className="bg-ink-900">
                    {plan.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-[10.5px] leading-relaxed text-bone-700">
            Ativações = quantas vezes a key pode ser vinculada a uma conta (rebind). Use 1 para
            travar em um cliente só.
          </p>
          <div className="flex gap-1.5">
            <ActionButton busy={busy === "branding"} onClick={() => void commit("branding", branding)}>
              <Save className="h-3 w-3" />
              salvar marca
            </ActionButton>
            <ActionButton busy={busy === "limits"} onClick={() => void commit("limits", limits)}>
              <Save className="h-3 w-3" />
              salvar limites
            </ActionButton>
          </div>
        </div>
      </Card>

      <Card title="alertas" subtitle="webhook do discord para avisar de nomes livres">
        <div className="space-y-3 p-4">
          <Toggle
            checked={alerts.enabled}
            onChange={(next) => setAlerts({ ...alerts, enabled: next })}
            label="enviar alertas automáticos"
          />
          <TextField
            label="webhook do discord"
            placeholder="https://discord.com/api/webhooks/..."
            value={alerts.discordWebhook}
            onChange={(event) => setAlerts({ ...alerts, discordWebhook: event.target.value })}
          />
          <TextField
            label="menção (opcional)"
            placeholder="@here, <@&id> ou vazio"
            value={alerts.mention}
            onChange={(event) => setAlerts({ ...alerts, mention: event.target.value })}
          />
          <ActionButton tone="primary" busy={busy === "alerts"} onClick={() => void commit("alerts", alerts)}>
            <Save className="h-3 w-3" />
            salvar alertas
          </ActionButton>
        </div>
      </Card>

      <Card title="discord oauth" subtitle="client id fica aqui; o secret vai nas variáveis de ambiente">
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${discordConfigured ? "bg-mint" : "bg-amberglow"}`}
            />
            <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-bone-500">
              {discordConfigured ? "oauth ativo" : "oauth pendente"}
            </p>
          </div>
          <TextField
            label="client id"
            value={discord.clientId}
            onChange={(event) => setDiscord({ ...discord, clientId: event.target.value })}
            hint="Developer Portal → OAuth2 → Client ID"
          />
          <div className="rounded-lg border border-white/[0.06] bg-ink-950/60 p-2.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-bone-600">
              redirect uri para colar no portal
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <code className="truncate font-mono text-[10.5px] text-bone-300">{redirectUri()}</code>
              <CopyInline value={redirectUri()} label="copiar" />
            </div>
          </div>
          <p className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-bone-600">
            <Info className="mt-[1px] h-3 w-3 shrink-0" />
            O <code className="font-mono text-bone-400">DISCORD_CLIENT_SECRET</code> nunca é salvo no
            banco: defina na Vercel → Settings → Environment Variables e faça um novo deploy.
          </p>
          <ActionButton tone="primary" busy={busy === "discord"} onClick={() => void commit("discord", discord)}>
            <Save className="h-3 w-3" />
            salvar discord
          </ActionButton>
        </div>
      </Card>

      <Card title="integrações" subtitle="estado real dos serviços conectados" className="xl:col-span-2">
        <div className="grid gap-2 p-4 sm:grid-cols-2">
          <Integration
            icon={<Server className="h-3.5 w-3.5" />}
            title="banco de dados"
            status={driver}
            ok
            detail="Licenças, usuários, planos, proxies e eventos."
          />
          <Integration
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            title="oauth discord"
            status={discordConfigured ? "configurado" : "faltando client id/secret"}
            ok={discordConfigured}
            detail="Sem isso o botão de Discord fica em “Em breve”."
          />
          <Integration
            icon={<Server className="h-3.5 w-3.5" />}
            title="phanomcloud"
            status={phanom.configured ? (phanom.ok ? "online" : "sem resposta") : "token ausente"}
            ok={phanom.configured && phanom.ok}
            detail={
              phanom.configured
                ? phanom.message
                : "Defina PHANOM_TOKEN (auto_...) para controlar os bots 24/7."
            }
          />
          <Integration
            icon={adminKeyDefault ? <AlertTriangle className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            title="key administrativa"
            status={adminKeyDefault ? "usando a padrão" : "personalizada"}
            ok={!adminKeyDefault}
            detail={
              adminKeyDefault
                ? "Defina ADMIN_KEY na Vercel e troque a senha padrão."
                : "Você trocou a key padrão. Guarde-a em local seguro."
            }
          />
        </div>
        <div className="border-t border-white/[0.045] px-4 py-3">
          <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-bone-600">
            <Check className="h-3 w-3" /> variáveis de ambiente esperadas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[
              "SUPABASE_URL",
              "SUPABASE_SERVICE_ROLE_KEY",
              "APP_SECRET",
              "ADMIN_KEY",
              "DISCORD_CLIENT_ID",
              "DISCORD_CLIENT_SECRET",
              "PHANOM_TOKEN",
            ].map((name) => (
              <span
                key={name}
                className="rounded border border-white/[0.07] bg-white/[0.03] px-1.5 py-[2px] font-mono text-[9.5px] text-bone-400"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function Integration({
  icon,
  title,
  status,
  ok,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  status: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-white/[0.055] bg-ink-950/50 p-2.5">
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${
          ok ? "border-mint/25 bg-mint/[0.08] text-mint" : "border-amberglow/25 bg-amberglow/[0.08] text-amberglow"
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11.5px] text-bone-100">
          {title} <span className="font-mono text-[9.5px] text-bone-600">· {status}</span>
        </p>
        <p className="mt-0.5 text-[10.5px] leading-relaxed text-bone-600">{detail}</p>
      </div>
    </div>
  );
}

export function SecretsCard() {
  return (
    <Card title="como trocar segredos" subtitle="passo a passo, sem quebrar sessões">
      <ol className="space-y-2 p-4 text-[11px] leading-relaxed text-bone-400">
        {[
          "Vercel → seu projeto → Settings → Environment Variables.",
          "Adicione ou edite ADMIN_KEY e clique em Save (Production).",
          "Troque APP_SECRET só se quiser invalidar todas as sessões — os clientes precisarão entrar de novo.",
          "Deployments → ⋯ → Redeploy para aplicar as variáveis.",
        ].map((step, index) => (
          <li key={step} className="flex gap-2">
            <span className="mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full border border-white/[0.08] font-mono text-[9px] text-bone-500">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <div className="border-t border-white/[0.045] px-4 py-2.5">
        <a
          href="https://vercel.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-bone-500 hover:text-bone-200"
        >
          abrir vercel <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
    </Card>
  );
}

export { Copy };
