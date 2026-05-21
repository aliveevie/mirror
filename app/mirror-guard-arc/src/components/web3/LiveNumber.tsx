import * as React from "react";
import { cn } from "@/lib/utils";

interface Props {
  value: number | string | null | undefined;
  className?: string;
  format?: (v: number | string) => string;
}

export function LiveNumber({ value, className, format }: Props) {
  const [flash, setFlash] = React.useState(false);
  const prev = React.useRef<typeof value>(undefined);

  React.useEffect(() => {
    if (prev.current !== undefined && prev.current !== value) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 900);
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value]);

  const display =
    value == null
      ? "—"
      : format
      ? format(value)
      : typeof value === "number"
      ? value.toLocaleString()
      : value;

  return (
    <span
      className={cn(
        "num inline-block rounded px-1 -mx-1 transition-colors",
        flash && "flash-update",
        className,
      )}
    >
      {display}
    </span>
  );
}
