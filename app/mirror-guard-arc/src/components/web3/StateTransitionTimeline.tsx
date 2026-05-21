import { cn } from "@/lib/utils";
import type { CircuitState } from "./CircuitBadge";
import { Check } from "lucide-react";

const STEPS: { key: CircuitState; label: string; description: string }[] = [
  { key: "NORMAL", label: "Normal", description: "Within all risk thresholds." },
  { key: "WATCH", label: "Watch", description: "Drawdown > 300 bps. Heightened monitoring." },
  { key: "ALERT", label: "Alert", description: "Drawdown > 800 bps. Slash window armed." },
  { key: "SLASHING", label: "Slashing", description: "Bond is being slashed on-chain." },
  { key: "COOLDOWN", label: "Cooldown", description: "Post-slash recovery. No new allocations." },
];

const TONE_TEXT: Record<CircuitState, string> = {
  NORMAL: "text-mint",
  WATCH: "text-warn",
  ALERT: "text-bad",
  SLASHING: "text-bad",
  COOLDOWN: "text-muted-foreground",
};

const TONE_BG: Record<CircuitState, string> = {
  NORMAL:
    "bg-[color-mix(in_oklab,var(--mint)_18%,transparent)] border-[color-mix(in_oklab,var(--mint)_55%,transparent)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--mint)_15%,transparent)]",
  WATCH:
    "bg-[color-mix(in_oklab,var(--warn)_18%,transparent)] border-[color-mix(in_oklab,var(--warn)_55%,transparent)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--warn)_15%,transparent)]",
  ALERT:
    "bg-[color-mix(in_oklab,var(--bad)_18%,transparent)] border-[color-mix(in_oklab,var(--bad)_55%,transparent)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--bad)_15%,transparent)]",
  SLASHING:
    "bg-[color-mix(in_oklab,var(--bad)_22%,transparent)] border-[color-mix(in_oklab,var(--bad)_60%,transparent)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--bad)_18%,transparent)]",
  COOLDOWN:
    "bg-surface-2 border-border shadow-[0_0_0_4px_color-mix(in_oklab,var(--muted-foreground)_10%,transparent)]",
};

export function StateTransitionTimeline({
  current,
  className,
}: {
  current: CircuitState;
  className?: string;
}) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {STEPS.map((step, i) => {
          const isCurrent = i === idx;
          const isPast = i < idx;
          return (
            <div key={step.key} className="flex items-center gap-2 flex-1 min-w-[110px]">
              <div className="flex flex-col items-center gap-1.5 flex-1" title={step.description}>
                <div
                  className={cn(
                    "size-8 rounded-full border flex items-center justify-center text-[11px] font-semibold transition-all",
                    isCurrent && TONE_BG[step.key],
                    isCurrent && TONE_TEXT[step.key],
                    isPast && "bg-surface-2 border-border text-muted-foreground",
                    !isCurrent && !isPast && "bg-transparent border-border text-muted-foreground/60",
                  )}
                >
                  {isPast ? <Check className="size-3.5" /> : i + 1}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-center">
                  <span
                    className={cn(
                      isCurrent ? `${TONE_TEXT[step.key]} font-semibold` : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("h-px flex-1", isPast ? "bg-border" : "bg-border/40")} />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {STEPS[idx]?.description ?? "Awaiting first telemetry."}
      </p>
    </div>
  );
}
