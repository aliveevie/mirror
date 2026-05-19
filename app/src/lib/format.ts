import { formatUnits } from "viem";

export const fmtUsdc = (v?: bigint) => v === undefined ? "—" : `${Number(formatUnits(v, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`;
export const shorten = (a?: string) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
export const bpsToPct = (bps: number) => `${(bps / 100).toFixed(2)}%`;

export const FSM_STATES = ["NORMAL", "WATCH", "ALERT", "SLASHING", "COOLDOWN"] as const;
export type FsmState = typeof FSM_STATES[number];
