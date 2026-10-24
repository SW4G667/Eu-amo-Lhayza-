"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Database,
  Globe2,
  Plus,
  RefreshCw,
  Save,
  Server,
  ShieldBan,
  Trash2,
  Zap,
} from "lucide-react";
import type { CloudProxy, Plan, PlatformState } from "@/lib/cloud/types";
import { cn } from "@/lib/utils";
import { ActionButton, Card, Empty, Pill, TextField, Toggle, fmtDate, fmtDateTime, money } from "./ui";
import type { UsersPayload } from "./types";

type Notify = (message: string, tone?: "ok" | "err") => void;

async function send<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const response = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!response.ok) return { ok: false, error: payload?.error ?? `Erro ${response.status}` };
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, error: "Falha de conexão" };
  }
}

/* ------------------------------- planos ------------------------------- */

export function PlansTab({
  plans,
  onRefresh,
  notify,
}: {
  plans: Plan[];
  onRefresh: () => Promise<void>;
  notify: Notify;
}) {
  const [drafts, setDrafts] = useState<Record<string, Partial<Plan>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setDrafts({});
  }, [plans]);

  function draft(plan: Plan): Plan {
    return { ...plan, ...(drafts[plan.id] ?? {}) };
  }

  function patch(id: string, value: Partial<Plan>) {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? {}), ...value } }));
  }

  async function save(plan: Plan) {
    const value = draft(plan);
    setBusy(plan.id);
    const result = await send<{ ok: boolean }>("/api/admin/plans", "POST", {
      id: plan.id,
      name: value.name,
      days: value.days,
      maxMonitors: value.maxMonitors,
      maxChecksDay: value.maxChecksDay,
      priceCents: value.priceCents,
      active: value.active,
      sort: value.sort,
      createdAt: plan.createdAt,
    });
    setBusy(null);
    if (!result.ok) {
      notify(result.error, "err");
      return;
    }
    notify("Plano salvo.");
    await onRefresh();
  }

  async function remove(plan: Plan) {
    setBusy(plan.id);
    const result = await send<{ ok: boolean }>(`/api/admin/plans/${plan.id}`, "DELETE");
    setBusy(null);
    if (!result.ok) {
      notify(result.error, "err");
      return;
    }
    notify("Plano apagado.");
    await onRefresh();
  }

  async function create() {
    setCreating(true);
    const result = await send<{ plan: Plan }>("/api/admin/plans", "POST", {
      name: "Novo plano",
      days: 30,
      maxMonitors: 1,
      maxChecksDay: 3000,
      priceCents: 1990,
      active: true,
    });
    setCreating(false);
    if (!result.ok) {
      notify(result.error, "err");
      return;
    }
    notify("Plano criado — ajuste os valores e salve.");
    await onRefresh();
  }

  return (
    <Card
      title="planos"
      subtitle="o que o cliente recebe em cada faixa de preço"
      action={
        <ActionButton onClick={() => void create()} busy={creating}>
          <Plus className="h-3 w-3" />
          novo plano
        </ActionButton>
      }
    >
      {plans.length === 0 ? (
        <Empty>Nenhum plano. Crie ao menos um para poder vender keys.</Empty>
      ) : (
        <div className="divide-y divide-white/[0.03]">
          {plans.map((plan) => {
            const value = draft(plan);
            return (
              <div key={plan.id} className="flex flex-wrap items-end gap-2 px-4 py-3">
                <TextField
                  label="nome"
                  value={value.name}
                  onChange={(event) => patch(plan.id, { name: event.target.value })}
                  className="w-[150px]"
                />
                <TextField
                  label="dias"
                  type="number"
                  value={value.days}
                  onChange={(event) => patch(plan.id, { days: Number(event.target.value) })}
                  className="w-[74px]"
                />
                <TextField
                  label="monitores"
                  type="number"
                  value={value.maxMonitors}
                  onChange={(event) => patch(plan.id, { maxMonitors: Number(event.target.value) })}
                  className="w-[84px]"
                />
                <TextField
                  label="checagens/dia"
                  type="number"
                  value={value.maxChecksDay}
                  onChange={(event) => patch(plan.id, { maxChecksDay: Number(event.target.value) })}
                  className="w-[110px]"
                />
                <TextField
                  label="preço (R$)"
                  type="number"
                  step="0.01"
                  value={(value.priceCents ?? 0) / 100}
                  onChange={(event) =>
                    patch(plan.id, { priceCents: Math.round(Number(event.target.value) * 100) })
                  }
                  className="w-[96px]"
                />
                <div className="flex h-8 items-center">
                  <Toggle
                    checked={value.active ?? true}
                    onChange={(next) => patch(plan.id, { active: next })}
                    label={value.active ? "visível" : "oculto"}
                  />
                </div>
                <p className="pb-1 font-mono text-[9.5px] text-bone-700">
                  id {plan.id} · {money(value.priceCents ?? 0)}
                </p>
                <div className="ml-auto flex items-center gap-1.5">
                  <ActionButton tone="primary" busy={busy === plan.id} onClick={() => void save(value as Plan)}>
                    <Save className="h-3 w-3" />
                    salvar
                  </ActionButton>
                  <ActionButton tone="danger" onClick={() => void remove(plan)} title="Apagar plano">
                    <Trash2 className="h-3 w-3" />
                  </ActionButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ usuários ------------------------------ */

export function UsersTab({
  data,
  onRefresh,
  notify,
}: {
  data: UsersPayload;
  onRefresh: () => Promise<void>;
  notify: Notify;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function toggleBan(id: string, banned: boolean) {
    setBusy(id);
    const result = await send<{ ok: boolean }>(`/api/admin/users/${id}`, "PATCH", { banned });
    setBusy(null);
    if (!result.ok) {
      notify(result.error, "err");
      return;
    }
    notify(banned ? "Usuário bloqueado." : "Usuário liberado.");
    await onRefresh();
  }

  return (
    <Card title="usuários" subtitle={`${data.users.length} conta(s) que já entraram com Discord`}>
      {data.users.length === 0 ? (
        <Empty>Ainda ninguém entrou com Discord. Compartilhe o link do site com seus clientes.</Empty>
      ) : (
        <div className="divide-y divide-white/[0.03]">
          {data.users.map((user) => (
            <div key={user.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-full border border-white/[0.08]"
                />
              ) : (
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] font-mono text-[9px] text-bone-400">
                  {(user.globalName || user.username || "?").slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="min-w-[140px] flex-1">
                <p className="text-[12px] text-bone-100">
                  {user.globalName || user.username || user.discordId}
                  {user.banned ? <span className="ml-2 text-[10px] text-ember">bloqueado</span> : null}
                </p>
                <p className="font-mono text-[9.5px] text-bone-700">
                  {user.discordId} · visto {fmtDate(user.lastLoginAt ?? user.createdAt)}
                </p>
              </div>
              <div className="min-w-[150px]">
                {user.license ? (
                  <div className="flex items-center gap-1.5">
                    <Pill tone={user.license.status === "active" ? "ok" : "muted"}>
                      {user.license.status}
                    </Pill>
                    <span className="font-mono text-[9.5px] text-bone-600">
                      {user.license.codePrefix}
                      {user.license.expiresAt ? ` · até ${fmtDate(user.license.expiresAt)}` : ""}
                    </span>
                  </div>
                ) : (
                  <span className="font-mono text-[9.5px] text-bone-700">sem licença</span>
                )}
              </div>
              <ActionButton
                tone={user.banned ? "default" : "danger"}
                busy={busy === user.id}
                onClick={() => void toggleBan(user.id, !user.banned)}
              >
                <ShieldBan className="h-3 w-3" />
                {user.banned ? "liberar" : "bloquear"}
              </ActionButton>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ---------------------------- plataformas ---------------------------- */

export function PlatformsTab({
  platforms,
  onRefresh,
  notify,
}: {
  platforms: PlatformState[];
  onRefresh: () => Promise<void>;
  notify: Notify;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function update(platform: PlatformState, patch: { enabled?: boolean; note?: string }) {
    setBusy(platform.id);
    const result = await send<{ ok: boolean }>("/api/admin/platforms", "PATCH", {
      id: platform.id,
      enabled: patch.enabled ?? platform.enabled,
      note: patch.note ?? notes[platform.id] ?? platform.note,
    });
    setBusy(null);
    if (!result.ok) {
      notify(result.error, "err");
      return;
    }
    notify(`${platform.name} ${patch.enabled === undefined ? "atualizada" : patch.enabled ? "liberada" : "bloqueada"}.`);
    await onRefresh();
  }

  return (
    <Card
      title="plataformas"
      subtitle="nada fica visível para o cliente antes de você liberar aqui"
    >
      <div className="divide-y divide-white/[0.03]">
        {platforms.map((platform) => (
          <div key={platform.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <span
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-md border font-mono text-[9px]",
                !platform.enabled && "opacity-40"
              )}
              style={{
                color: platform.enabled ? platform.accent : "#6C766B",
                borderColor: platform.enabled ? `${platform.accent}33` : "rgba(255,255,255,0.06)",
                backgroundColor: platform.enabled ? `${platform.accent}12` : "transparent",
              }}
            >
              {platform.short}
            </span>
            <div className="w-[110px]">
              <p className="text-[12px] text-bone-100">{platform.name}</p>
              <p className="font-mono text-[9px] text-bone-700">{platform.id}</p>
            </div>
            <input
              value={notes[platform.id] ?? platform.note ?? ""}
              onChange={(event) =>
                setNotes((current) => ({ ...current, [platform.id]: event.target.value }))
              }
              placeholder={platform.enabled ? "observação opcional" : "Em breve"}
              className="h-7 min-w-[160px] flex-1 rounded-md border border-white/[0.07] bg-ink-950/70 px-2 text-[11px] text-bone-200 outline-none placeholder:text-bone-600 focus:border-lime-500/40"
            />
            <div className="flex items-center gap-2">
              <Toggle
                checked={platform.enabled}
                onChange={(next) => void update(platform, { enabled: next })}
                label={platform.enabled ? "liberada" : "bloqueada"}
              />
              <ActionButton busy={busy === platform.id} onClick={() => void update(platform, {})}>
                <Save className="h-3 w-3" />
              </ActionButton>
            </div>
            <span className="w-full font-mono text-[9px] text-bone-700 sm:w-auto">
              {platform.updatedAt ? fmtDateTime(platform.updatedAt) : "—"}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------- proxies ------------------------------ */

export function ProxiesTab({
  proxies,
  onRefresh,
  notify,
}: {
  proxies: CloudProxy[];
  onRefresh: () => Promise<void>;
  notify: Notify;
}) {
  const [protocol, setProtocol] = useState("all");
  const [country, setCountry] = useState("");
  const [limit, setLimit] = useState("80");
  const [busy, setBusy] = useState<string | null>(null);

  const counters = {
    total: proxies.length,
    ok: proxies.filter((proxy) => proxy.status === "ok").length,
    dead: proxies.filter((proxy) => proxy.status === "dead").length,
  };

  async function importFromScrape() {
    setBusy("import");
    const result = await send<{ imported: number }>("/api/admin/proxies", "POST", {
      action: "import",
      protocol,
      country: country.trim() || undefined,
      limit: Number(limit) || 80,
    });
    setBusy(null);
    if (!result.ok) {
      notify(result.error, "err");
      return;
    }
    notify(`${result.data.imported} proxy(s) importadas do ProxyScrape.`);
    await onRefresh();
  }

  async function test() {
    setBusy("test");
    const result = await send<{ ok: number; total: number }>("/api/admin/proxies/test", "POST", {
      limit: 12,
    });
    setBusy(null);
    if (!result.ok) {
      notify(result.error, "err");
      return;
    }
    notify(`${result.data.ok}/${result.data.total} proxies responderam.`);
    await onRefresh();
  }

  async function prune() {
    setBusy("prune");
    const result = await send<{ removed: number }>("/api/admin/proxies", "POST", { action: "prune" });
    setBusy(null);
    if (!result.ok) {
      notify(result.error, "err");
      return;
    }
    notify(`${result.data.removed} proxy(s) morta(s) removida(s).`);
    await onRefresh();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "no pool", value: counters.total, icon: Database },
          { label: "respondendo", value: counters.ok, icon: Activity },
          { label: "mortas", value: counters.dead, icon: Server },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-white/[0.055] bg-[#0A0C0C] px-3 py-2">
            <p className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-bone-600">
              <item.icon className="h-2.5 w-2.5" />
              {item.label}
            </p>
            <p className="mt-1 font-mono text-[17px] leading-none text-bone-100">{item.value}</p>
          </div>
        ))}
      </div>

      <Card title="importar da proxyscrape" subtitle="lista pública, atualizada a cada minuto">
        <div className="flex flex-wrap items-end gap-2 p-4">
          <label className="block">
            <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.13em] text-bone-600">
              protocolo
            </span>
            <select
              value={protocol}
              onChange={(event) => setProtocol(event.target.value)}
              className="h-8 rounded-md border border-white/[0.07] bg-ink-950/70 px-2 text-[12px] text-bone-100 outline-none focus:border-lime-500/40"
            >
              {["all", "http", "socks4", "socks5"].map((item) => (
                <option key={item} value={item} className="bg-ink-900">
                  {item}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="país (opcional)"
            placeholder="BR, US..."
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            className="w-[110px]"
          />
          <TextField
            label="quantidade"
            type="number"
            min={10}
            max={300}
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            className="w-[96px]"
          />
          <ActionButton tone="primary" busy={busy === "import"} onClick={() => void importFromScrape()} className="h-8 px-3">
            <Plus className="h-3 w-3" />
            importar
          </ActionButton>
          <ActionButton busy={busy === "test"} onClick={() => void test()} className="h-8 px-3">
            <Zap className="h-3 w-3" />
            testar 12
          </ActionButton>
          <ActionButton busy={busy === "prune"} onClick={() => void prune()} className="h-8 px-3">
            <RefreshCw className="h-3 w-3" />
            limpar mortas
          </ActionButton>
        </div>
        <p className="border-t border-white/[0.045] px-4 py-2 font-mono text-[9.5px] leading-relaxed text-bone-700">
          O teste abre uma conexão TCP direta com cada proxy. Proxies que exigem autenticação
          aparecem como mortas — isso é normal na lista gratuita.
        </p>
      </Card>

      <Card title="pool" subtitle={`${proxies.length} registros`}>
        {proxies.length === 0 ? (
          <Empty>Nada importado ainda. Use o botão acima para trazer a lista pública.</Empty>
        ) : (
          <div className="max-h-[380px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[#0A0C0C]">
                <tr className="border-b border-white/[0.05]">
                  {["proxy", "país", "latência", "status", "checado"].map((head) => (
                    <th
                      key={head}
                      className="px-4 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-bone-600"
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {proxies.map((proxy) => (
                  <tr key={proxy.id} className="text-[11px]">
                    <td className="px-4 py-1.5 font-mono text-bone-200">
                      <span className="mr-1.5 rounded bg-white/[0.05] px-1 py-[1px] text-[8.5px] uppercase text-bone-500">
                        {proxy.protocol}
                      </span>
                      {proxy.host}:{proxy.port}
                    </td>
                    <td className="px-4 py-1.5 font-mono text-bone-500">
                      <span className="inline-flex items-center gap-1">
                        <Globe2 className="h-2.5 w-2.5" />
                        {proxy.country || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 font-mono text-bone-500">
                      {proxy.latencyMs ? `${proxy.latencyMs}ms` : "—"}
                    </td>
                    <td className="px-4 py-1.5">
                      <Pill tone={proxy.status === "ok" ? "ok" : proxy.status === "dead" ? "danger" : "muted"}>
                        {proxy.status}
                      </Pill>
                    </td>
                    <td className="px-4 py-1.5 font-mono text-[9.5px] text-bone-700">
                      {fmtDateTime(proxy.lastCheckedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
