import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CircuitBadge, type CircuitState } from "./CircuitBadge";
import { AddressLink } from "./AddressLink";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, ChevronDown, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUsdc } from "@/lib/format";

export interface LeaderRow {
  address: string;
  bond: bigint | number;
  followers: number;
  mirrored: bigint | number;
  state: CircuitState;
  pnl24h?: number;
  drawdown7d?: number;
  lastEvalAt?: number;
  lastArtifactHash?: string;
  strategyCommitment?: string;
}

type SortKey = "bond" | "followers" | "mirrored" | "pnl24h" | "drawdown7d";

interface Props {
  rows: LeaderRow[];
  loading?: boolean;
  onMirror?: (row: LeaderRow) => void;
}

export function LeaderTable({ rows, loading, onMirror }: Props) {
  const [stateFilter, setStateFilter] = React.useState<CircuitState | "ALL">("ALL");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "bond",
    dir: "desc",
  });
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    let r = rows;
    if (stateFilter !== "ALL") r = r.filter((x) => x.state === stateFilter);
    if (query) {
      const q = query.toLowerCase();
      r = r.filter((x) => x.address.toLowerCase().includes(q));
    }
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...r].sort((a, b) => {
      const av = Number(a[sort.key] ?? 0);
      const bv = Number(b[sort.key] ?? 0);
      return (av - bv) * dir;
    });
  }, [rows, stateFilter, query, sort]);

  const sortBtn = (key: SortKey, label: string) => (
    <button
      onClick={() =>
        setSort((s) =>
          s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
        )
      }
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {label}
      <ArrowUpDown className={cn("size-3", sort.key === key ? "opacity-100" : "opacity-30")} />
    </button>
  );

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by leader address…"
            className="pl-8 bg-surface-2 border-border"
          />
        </div>
        <Select value={stateFilter} onValueChange={(v) => setStateFilter(v as CircuitState | "ALL")}>
          <SelectTrigger className="w-full sm:w-44 bg-surface-2 border-border">
            <SelectValue placeholder="All states" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All states</SelectItem>
            <SelectItem value="NORMAL">Normal</SelectItem>
            <SelectItem value="WATCH">Watch</SelectItem>
            <SelectItem value="ALERT">Alert</SelectItem>
            <SelectItem value="SLASHING">Slashing</SelectItem>
            <SelectItem value="COOLDOWN">Cooldown</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="w-8" />
              <TableHead>Leader</TableHead>
              <TableHead className="text-right">{sortBtn("bond", "Bond")}</TableHead>
              <TableHead className="text-right">{sortBtn("followers", "Followers")}</TableHead>
              <TableHead className="text-right">{sortBtn("mirrored", "Mirrored")}</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="text-right">{sortBtn("pnl24h", "24h PnL")}</TableHead>
              <TableHead className="text-right">{sortBtn("drawdown7d", "7d DD")}</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                  Loading leaders from chain…
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-10">
                  No leaders match these filters.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              filtered.map((row) => {
                const open = expanded === row.address;
                return (
                  <React.Fragment key={row.address}>
                    <TableRow
                      className="border-border cursor-pointer"
                      onClick={() => setExpanded(open ? null : row.address)}
                    >
                      <TableCell>
                        {open ? (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <AddressLink address={row.address} />
                      </TableCell>
                      <TableCell className="text-right num">{formatUsdc(row.bond)}</TableCell>
                      <TableCell className="text-right num">{row.followers}</TableCell>
                      <TableCell className="text-right num">{formatUsdc(row.mirrored)}</TableCell>
                      <TableCell>
                        <CircuitBadge state={row.state} />
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right num",
                          (row.pnl24h ?? 0) >= 0 ? "text-mint" : "text-bad",
                        )}
                      >
                        {row.pnl24h == null ? "—" : `${row.pnl24h >= 0 ? "+" : ""}${row.pnl24h.toFixed(2)}%`}
                      </TableCell>
                      <TableCell className="text-right num text-muted-foreground">
                        {row.drawdown7d == null ? "—" : `${row.drawdown7d.toFixed(0)} bps`}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMirror?.(row);
                          }}
                          disabled={row.state === "SLASHING" || row.state === "ALERT"}
                        >
                          Mirror
                        </Button>
                      </TableCell>
                    </TableRow>
                    {open && (
                      <TableRow className="bg-surface-2/40 border-border">
                        <TableCell />
                        <TableCell colSpan={8}>
                          <div className="grid gap-2 py-2 text-xs sm:grid-cols-3">
                            <div>
                              <div className="text-muted-foreground uppercase tracking-wider mb-1">
                                Strategy commitment
                              </div>
                              <span className="num break-all">
                                {row.strategyCommitment ?? "—"}
                              </span>
                            </div>
                            <div>
                              <div className="text-muted-foreground uppercase tracking-wider mb-1">
                                Last evaluation
                              </div>
                              <span className="num">
                                {row.lastEvalAt
                                  ? new Date(row.lastEvalAt).toLocaleString()
                                  : "—"}
                              </span>
                            </div>
                            <div>
                              <div className="text-muted-foreground uppercase tracking-wider mb-1">
                                Last artifact
                              </div>
                              <span className="num break-all">
                                {row.lastArtifactHash ?? "—"}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
