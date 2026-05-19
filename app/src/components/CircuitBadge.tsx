import { FSM_STATES, type FsmState } from "../lib/format";

const cls: Record<FsmState, string> = {
  NORMAL: "badge normal",
  WATCH: "badge watch",
  ALERT: "badge alert",
  SLASHING: "badge slashing",
  COOLDOWN: "badge normal",
};

export function CircuitBadge({ state }: { state: number | undefined }) {
  const name = state !== undefined ? FSM_STATES[state] : "NORMAL";
  return <span className={cls[name]}>{name}</span>;
}
