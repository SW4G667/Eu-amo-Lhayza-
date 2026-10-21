"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<{
  push: (message: string, tone?: Tone) => void;
}>({ push: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: Tone = "info") => {
      counter.current += 1;
      const id = counter.current;
      setItems((current) => [...current.slice(-3), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), 4800);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex animate-toast-in items-start gap-2.5 rounded-lg border px-3.5 py-3 shadow-lift backdrop-blur-md",
              item.tone === "success" && "border-mint/25 bg-[#0E1712]/95 text-bone-100",
              item.tone === "error" && "border-ember/30 bg-[#170F0D]/95 text-bone-100",
              item.tone === "info" && "border-white/[0.1] bg-[#101313]/95 text-bone-100"
            )}
          >
            <span
              className={cn(
                "mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full",
                item.tone === "success" && "text-mint",
                item.tone === "error" && "text-ember",
                item.tone === "info" && "text-bone-400"
              )}
            >
              {item.tone === "success" ? (
                <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
              ) : item.tone === "error" ? (
                <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2.2} />
              ) : (
                <Info className="h-3.5 w-3.5" strokeWidth={2.2} />
              )}
            </span>
            <p className="flex-1 text-[12.5px] leading-snug">{item.message}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="text-bone-500 transition-colors hover:text-bone-100"
              aria-label="Fechar aviso"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
