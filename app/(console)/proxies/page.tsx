"use client";

import { useState } from "react";
import {
  Activity,
  Gauge,
  Network,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";
import { apiRequest, useConsole } from "@/components/console-provider";
import { TimeAgo } from "@/components/time";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { SafeProxy } from "@/lib/snapshot-types";
import { nfmt } from "@/lib/utils";

interface TestResult {
  id: string;
  ok: boolean;
  latencyMs: number | null;
  ip: string | null;
  error: string | null;
}

export default function ProxiesPage() {
  const { snapshot, refresh } = useConsole();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState("");
  const [protocol, setProtocol] = useState<"http" | "https" | "socks5">("http");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ips, setIps] = useState<Record<string, string | null>>({});

  const proxies = snapshot?.proxies ?? [];
  const enabled = proxies.filter((proxy) => proxy.enabled);
  const healthy = proxies.filter((proxy) => proxy.ok === true);
  const withLatency = proxies.filter((proxy) => proxy.latencyMs !== null);
  const avgLatency = withLatency.length
    ? Math.round(withLatency.reduce((acc, proxy) => acc + (proxy.latencyMs ?? 0), 0) / withLatency.length)
    : null;

  async function addProxies() {
    if (!list.trim()) {
      toast.push("Cole ao menos uma proxy.", "error");
      return;
    }
    setSaving(true);
    const response = await apiRequest<{ added: number; skipped: number; invalid: number }>(
      "/api/proxies",
      { method: "POST", body: JSON.stringify({ list, protocol }) }
    );
    setSaving(false);
    if (!response.ok) {
      toast.push(response.error, "error");
      return;
    }
    const { added, skipped, invalid } = response.data;
    toast.push(
      `${added} adicionada(s)${skipped ? ` · ${skipped} duplicada(s)` : ""}${invalid ? ` · ${invalid} inválida(s)` : ""}`,
      added ? "success" : "info"
    );
    setList("");
    setOpen(false);
    await refresh();
  }

  async function testAll() {
    if (!proxies.length) return;
    setTesting(true);
    const response = await apiRequest<{ results: TestResult[] }>("/api/proxies/test", {
      method: "POST",
      body: JSON.stringify({}),
    });
    setTesting(false);
    if (!response.ok) {
      toast.push(response.error, "error");
      return;
    }
    const map: Record<string, string | null> = {};
    for (const result of response.data.results) map[result.id] = result.ip;
    setIps((current) => ({ ...current, ...map }));
    const ok = response.data.results.filter((result) => result.ok).length;
    toast.push(
      `${ok} de ${response.data.results.length} responderam com sucesso.`,
      ok ? "success" : "error"
    );
    await refresh();
  }

  async function testOne(proxy: SafeProxy) {
    setBusyId(proxy.id);
    const response = await apiRequest<{ results: TestResult[] }>("/api/proxies/test", {
      method: "POST",
      body: JSON.stringify({ id: proxy.id }),
    });
    setBusyId(null);
    if (!response.ok) {
      toast.push(response.error, "error");
      return;
    }
    const result = response.data.results[0];
    if (!result) return;
    setIps((current) => ({ ...current, [proxy.id]: result.ip }));
    toast.push(
      result.ok
        ? `Respondeu em ${result.latencyMs} ms${result.ip ? ` · IP ${result.ip}` : ""}`
        : `Falhou: ${result.error ?? "sem resposta"}`,
      result.ok ? "success" : "error"
    );
    await refresh();
  }

  async function toggle(proxy: SafeProxy) {
    setBusyId(proxy.id);
    const response = await apiRequest(`/api/proxies/${proxy.id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !proxy.enabled }),
    });
    setBusyId(null);
    if (!response.ok) {
      toast.push(response.error, "error");
      return;
    }
    await refresh();
  }

  async function remove(proxy: SafeProxy) {
    setBusyId(proxy.id);
    const response = await apiRequest(`/api/proxies/${proxy.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!response.ok) {
      toast.push(response.error, "error");
      return;
    }
    toast.push("Proxy removida.", "success");
    await refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-mono">rede</p>
          <h2 className="mt-1 text-[19px] font-semibold tracking-[-0.025em] text-bone-50">Proxies</h2>
          <p className="mt-0.5 text-[12px] text-bone-500">
            Rotação de saída com cooldown automático. Proxies com erro saem da fila por alguns minutos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" loading={testing} onClick={() => void testAll()} disabled={!proxies.length}>
            <RefreshCw className="h-3 w-3" strokeWidth={2} />
            Testar ativas
          </Button>
          <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-3 w-3" strokeWidth={2.4} />
            Adicionar
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Network className="h-3.5 w-3.5" />} label="no pool" value={nfmt(proxies.length)} detail={`${enabled.length} ativas`} />
        <Metric icon={<ShieldCheck className="h-3.5 w-3.5" />} label="saudáveis" value={nfmt(healthy.length)} detail="último teste ok" />
        <Metric icon={<Gauge className="h-3.5 w-3.5" />} label="latência média" value={avgLatency ? `${avgLatency} ms` : "—"} detail="até o destino" />
        <Metric icon={<Activity className="h-3.5 w-3.5" />} label="em cooldown" value={nfmt(proxies.filter((proxy) => proxy.failures > 0).length)} detail="falhas recentes" />
      </div>

      <Panel>
        <PanelHeader
          title="Pool de saída"
          subtitle="Round-robin entre as proxies ativas e sem cooldown"
          icon={<Network className="h-4 w-4" strokeWidth={1.7} />}
          action={
            <Badge tone="muted">
              {protocol.toUpperCase()}
            </Badge>
          }
        />
        {proxies.length === 0 ? (
          <EmptyState
            icon={<Network className="h-4 w-4" />}
            title="Nenhuma proxy cadastrada"
            description="Sem proxies o motor usa o IP do servidor. Para volumes maiores, adicione um pool HTTP ou SOCKS5."
            action={
              <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
                Adicionar proxies
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-white/[0.05] text-left">
                  {["endereço", "protocolo", "status", "latência", "ip de saída", "último teste", ""].map(
                    (heading, index) => (
                      <th
                        key={`${heading}-${index}`}
                        className="px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-bone-500"
                      >
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {proxies.map((proxy) => (
                  <tr
                    key={proxy.id}
                    className="border-b border-white/[0.03] transition-colors last:border-0 hover:bg-white/[0.018]"
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-[12px] text-bone-100">
                        {proxy.host}:{proxy.port}
                      </span>
                      {proxy.username ? (
                        <span className="ml-2 font-mono text-[10px] text-bone-500">
                          {proxy.username}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone="muted">{proxy.protocol}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {!proxy.enabled ? (
                        <Badge tone="muted" dot>desligada</Badge>
                      ) : proxy.ok === true ? (
                        <Badge tone="ok" dot>ok</Badge>
                      ) : proxy.ok === false ? (
                        <Badge tone="danger" dot>falha</Badge>
                      ) : (
                        <Badge tone="neutral" dot>não testada</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-bone-400">
                      {proxy.latencyMs ? `${proxy.latencyMs} ms` : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-bone-400">
                      {ips[proxy.id] ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[10.5px] text-bone-500">
                      <TimeAgo ts={proxy.lastChecked} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => void testOne(proxy)}
                          disabled={busyId === proxy.id}
                          title="Testar"
                          className="grid h-7 w-7 place-items-center rounded-md text-bone-500 transition-colors hover:bg-white/[0.05] hover:text-bone-100"
                        >
                          <Zap className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggle(proxy)}
                          disabled={busyId === proxy.id}
                          className="rounded-md px-2 py-1 font-mono text-[9.5px] uppercase tracking-wider text-bone-500 transition-colors hover:bg-white/[0.05] hover:text-bone-100"
                        >
                          {proxy.enabled ? "desligar" : "ligar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(proxy)}
                          disabled={busyId === proxy.id}
                          title="Remover"
                          className="grid h-7 w-7 place-items-center rounded-md text-bone-500 transition-colors hover:bg-ember/10 hover:text-[#FFA48E]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-3 md:grid-cols-3">
        <Info
          title="Rotação real"
          text="Cada checagem consome a próxima proxy disponível. O contador persiste entre rodadas, então o tráfego se distribui de forma uniforme."
        />
        <Info
          title="Cooldown"
          text="Se a conexão falhar, a proxy entra em pausa progressiva (30s a 10min) e volta sozinha. Respostas 429 não penalizam a proxy."
        />
        <Info
          title="Qualidade"
          text="Proxies residenciais funcionam melhor em Instagram e TikTok. Datacenter costuma ser bloqueado por essas redes."
        />
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Adicionar proxies"
        description="Uma por linha. Aceita host:porta, host:porta:usuário:senha e links com protocolo."
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" loading={saving} onClick={() => void addProxies()}>
              Adicionar ao pool
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field
            label="lista de proxies"
            hint="Ex: 191.101.12.4:8000:user:pass · socks5://10.0.0.2:1080 · proxy.site.com:3128"
          >
            <Textarea
              value={list}
              onChange={(event) => setList(event.target.value)}
              placeholder={"191.101.12.4:8000:usuario:senha\n45.12.90.7:3128\nsocks5://127.0.0.1:1080"}
              className="min-h-[140px] font-mono text-[12px]"
            />
          </Field>
          <Field label="protocolo padrão" hint="Usado quando a linha não informa o esquema.">
            <Select value={protocol} onChange={(event) => setProtocol(event.target.value as typeof protocol)}>
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
              <option value="socks5">SOCKS5</option>
            </Select>
          </Field>
          <p className="rounded-md border border-white/[0.06] bg-white/[0.015] px-3 py-2 text-[11px] leading-relaxed text-bone-500">
            As credenciais são cifradas com AES-256-GCM antes de gravar. O navegador nunca recebe a
            senha de volta.
          </p>
        </div>
      </Modal>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Panel className="px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="label-mono">{label}</span>
        <span className="text-bone-500">{icon}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-mono text-[19px] leading-none mono-num text-bone-50">{value}</span>
        <span className="text-[10.5px] text-bone-500">{detail}</span>
      </div>
    </Panel>
  );
}

function Info({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.012] p-3.5">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-bone-400">{title}</p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-bone-500">{text}</p>
    </div>
  );
}
