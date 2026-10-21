import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("h-5 w-5", className)}
    >
      <path
        d="M4.4 19.2 12 4.4l7.6 14.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8.1 13.4h7.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="9.1" r="1.35" fill="#CBEF6E" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.08] bg-ink-800 text-bone-100">
        <BrandMark />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-bone-50">atalaia</span>
        <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-bone-500">
          username intel
        </span>
      </span>
    </div>
  );
}
