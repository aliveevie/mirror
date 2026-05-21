import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

type Point = { t: number; bps: number };

interface Props {
  /** Optional seed series. If absent, shows a skeleton until data is provided. */
  data?: Point[];
  height?: number;
  loading?: boolean;
}

export function DrawdownChart({ data, height = 240, loading }: Props) {
  if (loading) {
    return <Skeleton className="w-full" style={{ height }} />;
  }
  if (!data || data.length === 0) {
    return (
      <div
        className="w-full flex items-center justify-center text-xs text-muted-foreground panel-2"
        style={{ height }}
      >
        No telemetry yet — waiting for first agent evaluation.
      </div>
    );
  }
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="dd" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--bad)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="var(--bad)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="t"
            tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            stroke="var(--muted-foreground)"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) => new Date(v as number).toLocaleString()}
            formatter={(v: number) => [`${v.toFixed(0)} bps`, "Drawdown"]}
          />
          <ReferenceLine
            y={300}
            stroke="var(--warn)"
            strokeDasharray="4 4"
            label={{ value: "WATCH 300", fill: "var(--warn)", fontSize: 10, position: "right" }}
          />
          <ReferenceLine
            y={800}
            stroke="var(--bad)"
            strokeDasharray="4 4"
            label={{ value: "ALERT 800", fill: "var(--bad)", fontSize: 10, position: "right" }}
          />
          <Area
            type="monotone"
            dataKey="bps"
            stroke="var(--bad)"
            fill="url(#dd)"
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export type DrawdownPoint = Point;
