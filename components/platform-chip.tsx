import { platformMeta } from "@/lib/platforms";
import type { PlatformId } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PlatformChip({
  platform,
  showName = false,
  size = "md",
  className,
}: {
  platform: PlatformId;
  showName?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const meta = platformMeta(platform);
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-[5px] border font-mono font-medium",
          size === "sm" ? "h-[18px] px-1 text-[8.5px]" : "h-[22px] px-1.5 text-[9.5px]"
        )}
        style={{
          color: meta.accent,
          borderColor: `${meta.accent}33`,
          backgroundColor: `${meta.accent}0F`,
        }}
        title={meta.name}
      >
        {meta.short}
      </span>
      {showName ? (
        <span className={cn("text-bone-200", size === "sm" ? "text-[11.5px]" : "text-[12.5px]")}>
          {meta.name}
        </span>
      ) : null}
    </span>
  );
}
