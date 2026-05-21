import { cn } from "@/lib/utils";

export type CircuitState = "NORMAL" | "WATCH" | "ALERT" | "SLASHING" | "COOLDOWN";

const tone: Record<CircuitState, string> = {
  NORMAL:
    "text-mint bg-[color-mix(in_oklab,var(--mint)_12%,transparent)] ring-1 ring-[color-mix(in_oklab,var(--mint)_30%,transparent)]",
  WATCH:
    "text-warn bg-[color-mix(in_oklab,var(--warn)_12%,transparent)] ring-1 ring-[color-mix(in_oklab,var(--warn)_30%,transparent)]",
  ALERT:
    "text-bad bg-[color-mix(in_oklab,var(--bad)_14%,transparent)] ring-1 ring-[color-mix(in_oklab,var(--bad)_35%,transparent)]",
  SLASHING:
    "text-bad bg-[color-mix(in_oklab,var(--bad)_18%,transparent)] ring-1 ring-[color-mix(in_oklab,var(--bad)_45%,transparent)] animate-pulse",
  COOLDOWN:
    "text-muted-foreground bg-[color-mix(in_oklab,var(--muted-foreground)_12%,transparent)] ring-1 ring-border",
};

export function CircuitBadge({
  state,
  className,
  small,
}: {
  state: CircuitState;
  className?: string;
  small?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wider",
        small ? "px-1.5 py-0 text-[9px]" : "px-2.5 py-0.5 text-[11px]",
        tone[state],
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          state === "NORMAL" && "bg-mint",
          state === "WATCH" && "bg-warn",
          (state === "ALERT" || state === "SLASHING") && "bg-bad",
          state === "COOLDOWN" && "bg-muted-foreground",
        )}
      />
      {state}
    </span>
  );
}
