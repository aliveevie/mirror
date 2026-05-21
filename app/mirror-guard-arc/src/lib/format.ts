export function shortAddress(addr?: string | null, head = 6, tail = 4) {
  if (!addr) return "—";
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

const usdcFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

export function formatUsdc(raw: bigint | number | string | undefined, decimals = 6) {
  if (raw === undefined || raw === null) return "—";
  let value: number;
  if (typeof raw === "bigint") {
    value = Number(raw) / 10 ** decimals;
  } else {
    value = Number(raw);
  }
  if (!Number.isFinite(value)) return "—";
  return usdcFmt.format(value);
}

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});
export function compactNumber(n: number | bigint | undefined) {
  if (n === undefined || n === null) return "—";
  return compact.format(typeof n === "bigint" ? Number(n) : n);
}

export function timeAgo(date: Date | number | undefined) {
  if (date == null) return "—";
  const t = typeof date === "number" ? date : date.getTime();
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function utcStamp(date: Date | number | undefined) {
  if (date == null) return "—";
  const d = typeof date === "number" ? new Date(date) : date;
  return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export function bpsFmt(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(0)} bps`;
}
