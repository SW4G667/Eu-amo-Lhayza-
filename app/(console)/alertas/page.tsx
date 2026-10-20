"use client";

import { useState } from "react";
import {
  BellRing,
  CheckCircle2,
  Hash,
  Link2,
  Send,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { apiRequest, useConsole } from "@/components/console-provider";
import { Badge, Panel, PanelHeader, SectionLabel } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { platformMeta } from "@/lib/platforms";
import { ToggleLeft } from "lucide-react";

export default function AlertasPage() {
  const { snapshot, refresh } = useConsole();
  const toast = useToast();

  const [webhook, setWebhook] = useState(snapshot?.settings.alerts.discordWebhook ?? "");
  const [mention, setMention] = useState(snapshot?.settings.alerts.mention ?? "");
  const [discordEnabled, setDiscordEnabled] = useState(
    snapshot?.settings.alerts.discordEnabled ?? false
  );
  const [savingDiscord, setSavingDiscord] = useState(false);
  const [testingDiscord, setTestingDiscord] = useState(false);

  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState(snapshot?.settings.alerts.telegramChatId ?? "");
  const [telegramEnabled, setTelegramEnabled] = useState(
    snapshot?.settings.alerts.telegramEnabled ?? false
  );
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);

  const bot = snapshot?.credentials.telegramBot;
  const notified = snapshot?.hits.filter((hit) => hit.notified).length ?? 0;
  const sample = snapshot?.hits[0];
  const previewName = sample?.username ?? "vex";
  const previewPlatform = sample?.platform ?? "discord";
  const previewMeta = platformMeta(previewPlatform);

  async function saveDiscord(showToast = true) {
    if (discordEnabled && !webhook.trim()) {
      toast.push("Informe a URL do webhook antes de ativar.", "error");
      return false;
    }
    setSavingDiscord(true);
    const response = await apiRequest("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({
        alerts: {
          discordWebhook: webhook.trim(),
          discordEnabled,
          mention: mention.trim(),
        },
      }),
    });
    setSavingDiscord(false);
    if (!response.ok) {
      toast.push(response.error, "error");
      return false;
    }
    if (showToast) toast.push("Configuração do Discord salva.", "success");
    await refresh();
    return true;
  }

  async function testDiscord() {
    if (!webhook.trim()) {
      toast.push("Informe a URL do webhook.", "error");
      return;
    }
    setTestingDiscord(true);
    const saved = await saveDiscord(false);
    if (!saved) {
      setTestingDiscord(false);
      return;
    }
    const response = await apiRequest("/api/webhook/test", {
      method: "POST",
      body: JSON.stringify({ url: webhook.trim() }),
    });
    setTestingDiscord(false);
    if (!response.ok) {
      toast.push(response.error, "error");
      return;
    }
    toast.push("Teste enviado. Confira o canal no Discord.", "success");
  }

  async function saveTelegram() {
    if (telegramEnabled && (!chatId.trim() || (!bot?.configured && !botToken.trim()))) {
      toast.push("Informe token do bot e chat ID antes de ativar.", "error");
      return;
    }
    setSavingTelegram(true);

    if (botToken.trim()) {
      const credential = await apiRequest("/api/credentials", {
        method: "POST",
        body: JSON.stringify({ platform: "telegramBot", token: botToken.trim() }),
      });
      if (!credential.ok) {
        setSavingTelegram(false);
        toast.push(credential.error, "error");
        return;
      }
      setBotToken("");
    }

    const response = await apiRequest("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({
        alerts: { telegramChatId: chatId.trim(), telegramEnabled },
      }),
    });
    setSavingTelegram(false);
    if (!response.ok) {
      toast.push(response.error, "error");
      return;
    }
    toast.push("Telegram atualizado.", "success");
    await refresh();
  }

  async function testTelegram() {
    setTestingTelegram(true);
    const response = await apiRequest("/api/telegram/test", {
      method: "POST",
      body: JSON.stringify({ token: botToken.trim() || undefined, chatId: chatId.trim() }),
    });
    setTestingTelegram(false);
    if (!response.ok) {
      toast.push(response.error, "error");
      return;
    }
    toast.push("Mensagem de teste enviada no Telegram.", "success");
  }

  async function removeBot() {
    const response = await apiRequest("/api/credentials?platform=telegramBot", {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.push(response.error, "error");
      return;
    }
    setTelegramEnabled(false);
    await apiRequest("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ alerts: { telegramEnabled: false } }),
    });
    toast.push("Bot removido.", "success");
    await refresh();
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="label-mono">notificações</p>
        <h2 className="mt-1 text-[19px] font-semibold tracking-[-0.025em] text-bone-50">Alertas</h2>
        <p className="mt-0.5 text-[12px] text-bone-500">
          Um nome livre dura segundos. Configure o canal antes de ligar o motor.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        <div className="space-y-5">
          <Panel>
            <PanelHeader
              title="Webhook do Discord"
              subtitle="Mensagem em embed com link direto para capturar"
              icon={<Link2 className="h-4 w-4" strokeWidth={1.7} />}
              action={
                discordEnabled && webhook ? (
                  <Badge tone="ok" dot>ativo</Badge>
                ) : webhook ? (
                  <Badge tone="warn" dot>desativado</Badge>
                ) : (
                  <Badge tone="muted" dot>vazio</Badge>
                )
              }
            />
            <div className="space-y-4 p-4">
              <Field
                label="url do webhook"
                hint="No Discord: editar canal → Integrações → Webhooks → copiar URL."
              >
                <Input
                  value={webhook}
                  onChange={(event) => setWebhook(event.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="font-mono text-[11.5px]"
                  spellCheck={false}
                />
              </Field>

              <Switch
                checked={discordEnabled}
                onChange={setDiscordEnabled}
                label="Enviar alertas neste canal"
                description="Desligado, os nomes continuam sendo registrados no histórico."
              />

              <Field
                label="mencionar (opcional)"
                hint="ID do cargo para marcar a equipe, ou @here / @everyone."
              >
                <div className="relative">
                  <Hash className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-bone-500" />
                  <Input
                    value={mention}
                    onChange={(event) => setMention(event.target.value)}
                    placeholder="123456789012345678"
                    className="pl-8 font-mono text-[12px]"
                  />
                </div>
              </Field>

              <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-3">
                <Button variant="primary" size="sm" loading={savingDiscord} onClick={() => void saveDiscord()}>
                  Salvar
                </Button>
                <Button variant="secondary" size="sm" loading={testingDiscord} onClick={() => void testDiscord()}>
                  <Send className="h-3 w-3" strokeWidth={2} />
                  Enviar teste
                </Button>
                <span className="ml-auto font-mono text-[9.5px] uppercase tracking-wider text-bone-500">
                  {notified} alertas enviados
                </span>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Telegram (opcional)"
              subtitle="Segundo canal, útil quando o Discord está mutado"
              icon={<Send className="h-4 w-4" strokeWidth={1.7} />}
              action={
                bot?.configured ? (
                  <Badge tone="ok" dot>bot @{bot.username}</Badge>
                ) : (
                  <Badge tone="muted" dot>não configurado</Badge>
                )
              }
            />
            <div className="space-y-4 p-4">
              <Field
                label="token do bot"
                hint={
                  bot?.configured
                    ? "Bot já salvo. Preencha apenas para substituir o token."
                    : "Crie um bot com @BotFather e cole o token aqui."
                }
              >
                <Input
                  type="password"
                  value={botToken}
                  onChange={(event) => setBotToken(event.target.value)}
                  placeholder={bot?.configured ? "••••••••••••••••" : "123456:ABC-DEF..."}
                  className="font-mono text-[11.5px]"
                  spellCheck={false}
                />
              </Field>
              <Field label="chat id" hint="Envie uma mensagem para o bot e consulte @userinfobot.">
                <Input
                  value={chatId}
                  onChange={(event) => setChatId(event.target.value)}
                  placeholder="-1001234567890"
                  className="font-mono text-[12px]"
                />
              </Field>

              <Switch
                checked={telegramEnabled}
                onChange={setTelegramEnabled}
                label="Enviar alertas no Telegram"
                description="Funciona em paralelo com o webhook do Discord."
              />

              <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-3">
                <Button variant="primary" size="sm" loading={savingTelegram} onClick={() => void saveTelegram()}>
                  Salvar
                </Button>
                <Button variant="secondary" size="sm" loading={testingTelegram} onClick={() => void testTelegram()}>
                  Testar
                </Button>
                {bot?.configured ? (
                  <button
                    type="button"
                    onClick={() => void removeBot()}
                    className="ml-auto inline-flex items-center gap-1 text-[11px] text-bone-500 transition-colors hover:text-[#FFA48E]"
                  >
                    <Trash2 className="h-3 w-3" /> remover bot
                  </button>
                ) : null}
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel>
            <PanelHeader
              title="Prévia do alerta"
              subtitle="Como a mensagem chega no canal"
              icon={<BellRing className="h-4 w-4" strokeWidth={1.7} />}
              action={<Badge tone="muted">exemplo</Badge>}
            />
            <div className="p-4">
              <div className="rounded-lg bg-[#2B2D31] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-lime-400 text-[9px] font-bold text-[#0B0D08]">
                    A
                  </span>
                  <span className="text-[11.5px] font-medium text-[#F2F3F5]">Atalaia</span>
                  <Badge tone="lime" className="border-lime-500/30 bg-[#4B6A2A] text-[#D7F7A8]">
                    APP
                  </Badge>
                  <span className="ml-auto font-mono text-[9px] text-[#949BA4]">hoje</span>
                </div>
                {mention ? (
                  <p className="mb-1.5 text-[11.5px] text-[#C4C9FF]">
                    {/^\d{16,22}$/.test(mention) ? "@equipe" : mention}
                  </p>
                ) : null}
                <div className="flex gap-2.5">
                  <div
                    className="w-[3px] shrink-0 rounded-full"
                    style={{ backgroundColor: previewMeta.accent }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[9.5px] font-semibold uppercase tracking-wide text-[#B5BAC1]">
                      Atalaia · nome disponível
                    </p>
                    <p className="mt-0.5 text-[12.5px] font-semibold text-[#00A8FC]">
                      {previewName} está livre no {previewMeta.name}
                    </p>
                    <p className="mt-1 text-[11.5px] text-[#DBDEE1]">
                      <span className="rounded bg-[#1E1F22] px-1 font-mono text-[11px]">
                        {previewName}
                      </span>{" "}
                      · {previewName.length} caracteres · pontuação{" "}
                      <strong className="text-[#F2F3F5]">{sample?.score ?? 96}/99</strong>
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {[
                        ["Plataforma", previewMeta.name],
                        ["Monitor", sample?.jobName ?? "3 letras · Discord"],
                        ["Latência", `${sample?.latencyMs ?? 184} ms`],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-[9px] font-semibold text-[#B5BAC1]">{label}</p>
                          <p className="truncate text-[10.5px] text-[#DBDEE1]">{value}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[10.5px] font-medium text-[#00A8FC]">
                      Abrir {previewMeta.name} ↗
                    </p>
                    <p className="mt-2 text-[9px] text-[#949BA4]">Atalaia · raro</p>
                  </div>
                </div>
              </div>
              <p className="mt-2.5 text-[10.5px] leading-relaxed text-bone-500">
                O embed real inclui data, link de captura e cor por plataforma. Nomes repetidos nunca
                geram alerta duplicado.
              </p>
            </div>
          </Panel>

          <Panel className="p-4">
            <SectionLabel>regras de disparo</SectionLabel>
            <ul className="mt-3 space-y-2.5">
              <Rule
                icon={<CheckCircle2 className="h-3.5 w-3.5 text-mint" />}
                text="Um alerta é enviado por nome/plataforma. Se o mesmo nome aparecer de novo, não há spam."
              />
              <Rule
                icon={<ShieldAlert className="h-3.5 w-3.5 text-amberglow" />}
                text="A pontuação mínima é definida por monitor. 70+ filtra nomes com números ou separadores."
              />
              <Rule
                icon={<ToggleLeft className="h-3.5 w-3.5 text-bone-400" />}
                text="Com o canal desligado, os achados continuam no histórico e podem ser reenviados depois."
              />
              <Rule
                icon={<BellRing className="h-3.5 w-3.5 text-[#AEB9FF]" />}
                text="Você também pode reenviar qualquer achado pelo botão de envio no histórico."
              />
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Rule({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-[1px] shrink-0">{icon}</span>
      <p className="text-[11px] leading-relaxed text-bone-400">{text}</p>
    </li>
  );
}
