"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Snapshot } from "@/lib/snapshot-types";

interface ConsoleContextValue {
  snapshot: Snapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  mutate: (updater: (current: Snapshot) => Snapshot) => void;
}

const ConsoleContext = createContext<ConsoleContextValue>({
  snapshot: null,
  loading: true,
  error: null,
  refresh: async () => undefined,
  mutate: () => undefined,
});

export function ConsoleProvider({
  initial,
  children,
}: {
  initial: Snapshot;
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(initial);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const stateRef = useRef<Snapshot | null>(initial);
  const inFlight = useRef(false);

  stateRef.current = snapshot;

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) throw new Error("Falha ao atualizar o estado");
      const data = (await response.json()) as Snapshot;
      if (alive.current) {
        setSnapshot(data);
        setError(null);
      }
    } catch (err) {
      if (alive.current) setError(err instanceof Error ? err.message : "Falha de conexão");
    } finally {
      inFlight.current = false;
      if (alive.current) setLoading(false);
    }
  }, []);

  const mutate = useCallback((updater: (current: Snapshot) => Snapshot) => {
    setSnapshot((current) => (current ? updater(current) : current));
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const interval = window.setInterval(() => void refresh(), 2200);
    return () => {
      alive.current = false;
      window.clearInterval(interval);
    };
  }, [refresh]);

  // No modo serverless a execução precisa de um gatilho. Enquanto esta aba
  // estiver aberta, disparamos um tick que respeita o intervalo de cada monitor.
  const serverless = Boolean(snapshot?.runtime.vercel);
  useEffect(() => {
    if (!serverless) return;
    let cancelled = false;
    let timer = 0;
    const loop = async () => {
      const current = stateRef.current;
      const active = current && !current.settings.engine.paused && current.jobs.some((job) => job.enabled);
      if (active) {
        await fetch("/api/engine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "tick" }),
        }).catch(() => undefined);
      }
      if (!cancelled) timer = window.setTimeout(loop, 1600);
    };
    timer = window.setTimeout(loop, 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [serverless]);

  return (
    <ConsoleContext.Provider
      value={{ snapshot, loading, error, refresh, mutate }}
    >
      {children}
    </ConsoleContext.Provider>
  );
}

export function useConsole() {
  return useContext(ConsoleContext);
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | (T & { error?: string })
      | null;
    if (!response.ok) {
      return { ok: false, error: payload?.error ?? `Erro ${response.status}` };
    }
    return { ok: true, data: payload as T };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Falha de conexão",
    };
  }
}
