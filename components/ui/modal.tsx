"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const widths = { sm: "max-w-[440px]", md: "max-w-[620px]", lg: "max-w-[820px]" };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 pt-[8vh] sm:p-6 sm:pt-[10vh]">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-black/70 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative w-full animate-fade-up overflow-hidden rounded-xl border border-white/[0.09] bg-[#0C0F0F] shadow-lift",
          widths[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-bone-50">{title}</h2>
            {description ? (
              <p className="mt-1 max-w-lg text-[12px] leading-relaxed text-bone-500">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-bone-500 transition-colors hover:bg-white/[0.05] hover:text-bone-100"
          >
            <X className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
        <div className="max-h-[62vh] overflow-y-auto px-5 py-5">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] bg-black/20 px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
