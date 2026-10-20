"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Download,
  Filter,
  Search,
  Send,
  Trash2,
  Trophy,
} from "lucide-react";
import { apiRequest, useConsole } from "@/components/console-provider";
import { PlatformChip } from "@/components/platform-chip";
import { scoreTone } from "@/components/status";
import { Clock, TimeAgo } from "@/components/time";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy";
import { Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Badge, EmptyState, Panel } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { PLATFORM_LIST, platformMeta } from "@/lib/platforms";
import type { Hit, PlatformId } from "@/lib/types";
import { nfmt } from "@/lib/utils";

type SortKey = "recent" | "score" | "name";

export default function HistoricoPage() {
  const { snapshot, refresh } = useConsole();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<PlatformId | "all">("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const hits = snapshot?.hits ?? [];

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = hits.filter((hit) => {
      if (platform !== "all" && hit.platform !== platform) return false;
      if (!term) return true;
      return (
        hit.username.toLowerCase().includes(term) ||
        hit.jobName.toLowerCase().includes(term) ||
        hit.platform.includes(term)
      );
    });
    return list.sort((a, b) => {
      if (sort === "score") return b.score - a.score;
      if (sort === "name") return a.username.localeCompare(b.username);
      return b.foundAt - a.foundAt;
    });
  }, [hits, platform, query, sort]);

  const best = hits.reduce((acc, hit) => (hit.score > acc ? hit.score : acc), 0);
  const threeLetters = hits.filter((hit) => hit.username.length === 3).length;
  const notified = hits.filter((hit) => hit.notified).length;

  async function resend(hit: Hit) {
    setBusyId(hit.id);
    const response = await apiRequest("/api/hits", {
      method: "POST",
      body: JSON.stringify({ id: hit.id }),
    });
    setBusyId(null);
    if (!response.ok) {
      toast.push(response.error, "error");
      return;
    }
    toast.push("Alerta reenviado.", "success");
    await refresh();
  }

  async function remove(hit: Hit) {
    setBusyId(hit.id);
    const response = await apiRequest(`/api/hits?id=${hit.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!response.ok) {
      toast.push(response.error, "error");
      return;
    }
    await refresh();
  }

  async function clearAll() {
    setClearing(true);
    const response = await apiRequest("/api/hits", { method: "DELETE" });
    setClearing(false);
    if (!response.ok) {
      toast.push(response.error, "error");
      return;
    }
    setConfirmClear(false);
    toast.push("Histórico limpo.", "success");
    await refresh();
  }

  function exportCsv() {
    const rows = [
      ["nome", "plataforma", "comprimento", "pontuacao", "monitor", "encontrado_em", "notificado"],
      ...filtered.map((hit) => [
        hit.username,
        platformMeta(hit.platform).name,
        String(hit.username.length),
        String(hit.score),
        hit.jobName,
        new Date(hit.foundAt).toISOString(),
        hit.notified ? "sim" : "não",
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `atalaia-historico-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-mono">capturas</p>
          <h2 className="mt-1 text-[19px] font-semibold tracking-[-0.025em] text-bone-50">
            Histórico
          </h2>
          <p className="mt-0.5 text-[12px] text-bone-500">
            Nomes que o motor encontrou livres, com pontuação e status do alerta.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-3 w-3" strokeWidth={2} />
            Exportar CSV
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmClear(true)}
            disabled={!hits.length}
          >
            <Trash2 className="h-3 w-3" strokeWidth={2} />
            Limpar
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="nomes livres" value={nfmt(hits.length)} detail="registrados" />
        <Summary label="3 letras" value={nfmt(threeLetters)} detail="mais raros" tone="mint" />
        <Summary label="melhor score" value={String(best || 0)} detail="de 99" tone="lime" />
        <Summary label="alertas enviados" value={nfmt(notified)} detail="webhook/telegram" />
      </div>

      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.05] px-4 py-3">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-bone-500" strokeWidth={1.8} />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar nome, monitor ou plataforma"
              className="h-8 pl-8 text-[12px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-bone-500" strokeWidth={1.8} />
            <Select
              value={platform}
              onChange={(event) => setPlatform(event.target.value as PlatformId | "all")}
              className="h-8 w-[132px] text-[12px]"
            >
              <option value="all">Todas</option>
              {PLATFORM_LIST.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="h-8 w-[132px] text-[12px]"
            >
              <option value="recent">Mais recentes</option>
              <option value="score">Maior score</option>
              <option value="name">Nome A–Z</option>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-4 w-4" />}
            title={hits.length ? "Nenhum resultado para este filtro" : "Nenhum nome livre ainda"}
            description={
              hits.length
                ? "Ajuste a busca ou troque a plataforma."
                : "Assim que o motor encontrar um username disponível, ele aparece aqui e dispara o alerta."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-white/[0.05] text-left">
                  {["nome", "plataforma", "score", "monitor", "encontrado", "alerta", ""].map(
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
                {filtered.map((hit) => (
                  <tr
                    key={hit.id}
                    className="group border-b border-white/[0.03] transition-colors last:border-0 hover:bg-white/[0.018]"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[13px] text-bone-50">{hit.username}</span>
                        <CopyButton value={hit.username} compact />
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <PlatformChip platform={hit.platform} showName />
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={scoreTone(hit.score)}>{hit.score}</Badge>
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-2.5 text-[11.5px] text-bone-400">
                      {hit.jobName}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 font-mono text-[10.5px] text-bone-500">
                        <Clock ts={hit.foundAt} />
                        <TimeAgo ts={hit.foundAt} className="text-bone-600" />
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {hit.notified ? (
                        <Badge tone="ok" dot>
                          enviado
                        </Badge>
                      ) : (
                        <Badge tone="muted">pendente</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                        <a
                          href={platformMeta(hit.platform).claimUrl(hit.username)}
                          target="_blank"
                          rel="noreferrer"
                          title="Abrir plataforma"
                          className="grid h-7 w-7 place-items-center rounded-md text-bone-500 transition-colors hover:bg-white/[0.05] hover:text-bone-100"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => void resend(hit)}
                          disabled={busyId === hit.id}
                          title="Reenviar alerta"
                          className="grid h-7 w-7 place-items-center rounded-md text-bone-500 transition-colors hover:bg-white/[0.05] hover:text-bone-100"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(hit)}
                          disabled={busyId === hit.id}
                          title="Remover registro"
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
        <div className="flex items-center justify-between border-t border-white/[0.05] px-4 py-2.5">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-bone-500">
            {filtered.length} de {hits.length} registros
          </span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-bone-500">
            score = raridade estimada
          </span>
        </div>
      </Panel>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Limpar histórico"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" loading={clearing} onClick={() => void clearAll()}>
              Limpar tudo
            </Button>
          </>
        }
      >
        <p className="text-[12.5px] leading-relaxed text-bone-400">
          Remove todos os {hits.length} registros e zera o contador de achados dos monitores. Esta
          ação não afeta os monitores em execução.
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
  tone?: "bone" | "mint" | "lime";
}) {
  const tones = { bone: "text-bone-50", mint: "text-mint", lime: "text-lime-300" };
  return (
    <Panel className="px-4 py-3">
      <p className="label-mono">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`font-mono text-[19px] leading-none mono-num ${tones[tone]}`}>{value}</span>
        <span className="text-[10.5px] text-bone-500">{detail}</span>
      </div>
    </Panel>
  );
}
