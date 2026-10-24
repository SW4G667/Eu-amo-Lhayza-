"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Download, Eye, KeyRound, Plus, RotateCcw, ShieldOff, Trash2 } from "lucide-react";
import type { AdminLicense } from "@/lib/cloud/serialize";
import type { Plan } from "@/lib/cloud/types";
import { cn } from "@/lib/utils";
import { ActionButton, Card, CopyInline, Empty, Pill, TextField, fmtDate, money } from "./ui";
import type { LicensesPayload } from "./types";

const STATUS_TONE: Record<string, "ok" | "warn" | "danger" | "info" | "muted"> = {
  active: "ok",
  pending: "warn",
  expired: "muted",
  revoked: "danger",
  suspended: "info",
};

function remainingDays(license: AdminLicense): number | null {
  if (license.status !== "active" || !license.expiresAt) return null;
  return Math.max(0, Math.ceil((license.expiresAt - Date.now()) / 86400000));
}

const STATUS_LABEL: Record<string, string> = {
  active: "ativa",
  pending: "pendente",
  expired: "expirada",
  revoked: "revogada",
  suspended: "suspensa",
};

export function LicensesTab({
  data,
  plans,
  onRefresh,
  notify,
}: {
  data: LicensesPayload;
  plans: Plan[];
  onRefresh: () => Promise<void>;
  notify: (message: string, tone?: "ok" | "err") => void;
}) {
  const [planId, setPlanId] = useState(plans.find((plan) => plan.active)?.id ?? plans[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [days, setDays] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState<string[]>([]);
  const [filter, setFilter] = useState("todas");
  const [term, setTerm] = useState("");
  const [copiedAll, setCopiedAll] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const plan = plans.find((item) => item.id === planId) ?? null;

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return data.licenses.filter((license) => {
      if (filter !== "todas" && license.status !== filter) return false;
      if (!needle) return true;
      return (
        license.codePrefix.toLowerCase().includes(needle) ||
        (license.discordUsername || "").toLowerCase().includes(needle) ||
        (license.note || "").toLowerCase().includes(needle)
      );
    });
  }, [data.licenses, filter, term]);

  async function generate() {
    if (!planId) {
      notify("Cadastre um plano antes de gerar keys.", "err");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          quantity: Number(quantity) || 1,
          days: days ? Number(days) : undefined,
          note: note.trim() || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; codes?: string[]; error?: string }
        | null;
      if (!response.ok || !payload?.ok) {
        notify(payload?.error ?? "Falha ao gerar keys.", "err");
        return;
      }
      setGenerated(payload.codes ?? []);
      notify(`${payload.codes?.length ?? 0} key(s) geradas. Copie e entregue ao cliente.`);
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function act(license: AdminLicense, action: string, extra?: Record<string, unknown>) {
    setRowBusy(license.id);
    try {
      const response = await fetch(`/api/admin/licenses/${license.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; code?: string }
        | null;
      if (!response.ok || !payload?.ok) {
        notify(payload?.error ?? "Ação não concluída.", "err");
        return;
      }
      if (action === "reveal" && payload.code) {
        setRevealed((current) => ({ ...current, [license.id]: payload.code as string }));
        return;
      }
      const messages: Record<string, string> = {
        revoke: "Licença revogada.",
        suspend: "Licença suspensa.",
        resume: "Licença reativada.",
        extend: "Licença estendida.",
      };
      notify(messages[action] ?? "Feito.");
      await onRefresh();
    } finally {
      setRowBusy(null);
    }
  }

  async function remove(license: AdminLicense) {
    if (confirmDelete !== license.id) {
      setConfirmDelete(license.id);
      window.setTimeout(() => setConfirmDelete((current) => (current === license.id ? null : current)), 4000);
      return;
    }
    setRowBusy(license.id);
    try {
      const response = await fetch(`/api/admin/licenses/${license.id}`, { method: "DELETE" });
      if (!response.ok) {
        notify("Não foi possível excluir.", "err");
        return;
      }
      notify("Licença excluída.");
      setConfirmDelete(null);
      await onRefresh();
    } finally {
      setRowBusy(null);
    }
  }

  function downloadCodes() {
    const blob = new Blob(
      [
        `Atalaia — ${plan?.name ?? planId}\n${plan?.days ?? days} dias · ${plan?.maxMonitors ?? "?"} monitores\n\n${generated.join("\n")}\n`,
      ],
      { type: "text/plain;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `atalaia-keys-${new Date().toISOString().slice(0, 10)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        {(["active", "pending", "expired", "suspended", "revoked"] as const).map((key) => (
          <div key={key} className="rounded-lg border border-white/[0.055] bg-[#0A0C0C] px-3 py-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-bone-600">
              {STATUS_LABEL[key]}
            </p>
            <p className="mt-1 font-mono text-[17px] leading-none text-bone-100">
              {data.counters?.[key] ?? 0}
            </p>
          </div>
        ))}
      </div>

      <Card
        title="gerar keys"
        subtitle="a key nasce pendente e só começa a contar quando o cliente ativa"
      >
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.7fr_0.7fr_1.6fr_auto]">
          <label className="block">
            <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.13em] text-bone-600">
              plano
            </span>
            <select
              value={planId}
              onChange={(event) => setPlanId(event.target.value)}
              className="h-8 w-full rounded-md border border-white/[0.07] bg-ink-950/70 px-2 text-[12px] text-bone-100 outline-none focus:border-lime-500/40"
            >
              {plans.map((item) => (
                <option key={item.id} value={item.id} className="bg-ink-900">
                  {item.name} · {item.days >= 3650 ? "vitalício" : `${item.days}d`} ·{" "}
                  {item.maxMonitors} mon · {money(item.priceCents)}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="quantidade"
            type="number"
            min={1}
            max={50}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <TextField
            label="dias"
            type="number"
            min={1}
            max={3650}
            placeholder={plan ? String(plan.days) : "30"}
            value={days}
            onChange={(event) => setDays(event.target.value)}
            hint="vazio usa o plano"
          />
          <TextField
            label="anotação"
            placeholder="cliente, lote, campanha..."
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="flex items-end">
            <ActionButton tone="primary" busy={busy} onClick={() => void generate()} className="h-8 w-full px-3">
              <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
              gerar
            </ActionButton>
          </div>
        </div>

        {generated.length ? (
          <div className="border-t border-white/[0.055] bg-lime-400/[0.03] px-4 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-lime-300">
                {generated.length} key(s) recém-geradas — copie agora, o código não é mostrado de novo
              </p>
              <div className="flex items-center gap-1.5">
                <ActionButton
                  onClick={async () => {
                    await navigator.clipboard.writeText(generated.join("\n"));
                    setCopiedAll(true);
                    window.setTimeout(() => setCopiedAll(false), 1600);
                  }}
                >
                  {copiedAll ? <Check className="h-3 w-3 text-mint" /> : <Copy className="h-3 w-3" />}
                  copiar todas
                </ActionButton>
                <ActionButton onClick={downloadCodes}>
                  <Download className="h-3 w-3" />
                  .txt
                </ActionButton>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {generated.map((code) => (
                <span
                  key={code}
                  className="rounded-md border border-lime-500/20 bg-ink-950/60 px-2 py-1 font-mono text-[11px] tracking-[0.08em] text-lime-200"
                >
                  {code}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <Card
        title="licenças"
        subtitle={`${filtered.length} de ${data.licenses.length}`}
        action={
          <div className="flex items-center gap-1.5">
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="buscar key, discord, nota"
              className="h-7 w-[190px] rounded-md border border-white/[0.07] bg-ink-950/70 px-2 text-[11.5px] text-bone-100 outline-none placeholder:text-bone-600 focus:border-lime-500/40"
            />
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="h-7 rounded-md border border-white/[0.07] bg-ink-950/70 px-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-bone-300 outline-none focus:border-lime-500/40"
            >
              {["todas", "active", "pending", "expired", "suspended", "revoked"].map((item) => (
                <option key={item} value={item} className="bg-ink-900">
                  {item === "todas" ? "todas" : STATUS_LABEL[item]}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <Empty>Nenhuma licença encontrada. Gere a primeira no painel acima.</Empty>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {filtered.map((license) => (
              <div key={license.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <div className="min-w-[150px] flex-1">
                  <p className="flex items-center gap-1.5 font-mono text-[11.5px] text-bone-100">
                    <KeyRound className="h-3 w-3 text-bone-600" strokeWidth={2} />
                    {revealed[license.id] ? (
                      <span className="text-lime-200">{revealed[license.id]}</span>
                    ) : (
                      <span>{license.codePrefix}</span>
                    )}
                  </p>
                  <p className="mt-0.5 font-mono text-[9.5px] text-bone-700">
                    {license.planId ?? "avulso"} · {license.days}d ·{" "}
                    {license.activatedAt ? `ativa desde ${fmtDate(license.activatedAt)}` : "nunca ativada"}
                    {license.note ? ` · ${license.note}` : ""}
                  </p>
                </div>

                <Pill tone={STATUS_TONE[license.status] ?? "muted"}>{STATUS_LABEL[license.status]}</Pill>

                <span className="hidden w-[110px] font-mono text-[10px] text-bone-500 sm:block">
                  {remainingDays(license) !== null ? `${remainingDays(license)} dia(s)` : "—"}
                </span>

                <span className="hidden w-[130px] truncate font-mono text-[10px] text-bone-500 md:block">
                  {license.discordUsername ? `@${license.discordUsername}` : "sem discord"}
                </span>

                <span className="font-mono text-[9.5px] text-bone-700">
                  {license.activations}/{license.maxActivations}
                </span>

                <div className="flex items-center gap-1">
                  <ActionButton
                    title="Revelar código"
                    busy={rowBusy === license.id}
                    onClick={() => void act(license, "reveal")}
                  >
                    <Eye className="h-3 w-3" />
                  </ActionButton>
                  <ActionButton title="Estender 30 dias" onClick={() => void act(license, "extend", { days: 30 })}>
                    +30d
                  </ActionButton>
                  {license.status === "suspended" ? (
                    <ActionButton title="Reativar" onClick={() => void act(license, "resume")}>
                      <RotateCcw className="h-3 w-3" />
                    </ActionButton>
                  ) : (
                    <ActionButton
                      title="Suspender"
                      onClick={() => void act(license, "suspend")}
                      disabled={license.status === "revoked" || license.status === "expired"}
                    >
                      <ShieldOff className="h-3 w-3" />
                    </ActionButton>
                  )}
                  <ActionButton
                    title="Revogar"
                    tone="danger"
                    onClick={() => void act(license, "revoke", { reason: "revogada pelo admin" })}
                    disabled={license.status === "revoked"}
                  >
                    revogar
                  </ActionButton>
                  <ActionButton
                    tone="danger"
                    title="Excluir definitivamente"
                    onClick={() => void remove(license)}
                    className={confirmDelete === license.id ? "bg-ember/20" : undefined}
                  >
                    <Trash2 className="h-3 w-3" />
                    {confirmDelete === license.id ? "confirmar" : null}
                  </ActionButton>
                </div>

                {revealed[license.id] ? (
                  <div className="w-full">
                    <CopyInline value={revealed[license.id]} label="copiar código" />
                    <span className={cn("ml-2 font-mono text-[9px] text-bone-700")}>
                      revelado agora — não fica salvo na tela
                    </span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
