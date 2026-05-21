import * as React from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { explorerTx } from "@/lib/chain";
import { shortAddress } from "@/lib/format";
import { toast } from "sonner";

interface Props {
  hash?: string | null;
  className?: string;
  label?: string;
}

export function TxLink({ hash, className, label }: Props) {
  const [copied, setCopied] = React.useState(false);
  if (!hash) return <span className={cn("text-muted-foreground num", className)}>—</span>;
  return (
    <span
      className={cn("group inline-flex items-center gap-1.5 num text-foreground/90", className)}
      title={hash}
    >
      <span>{label ?? shortAddress(hash, 8, 6)}</span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          navigator.clipboard.writeText(hash);
          setCopied(true);
          toast.success("Tx hash copied");
          setTimeout(() => setCopied(false), 1200);
        }}
        className="opacity-60 transition-opacity hover:opacity-100"
        aria-label="Copy tx hash"
      >
        {copied ? <Check className="size-3.5 text-mint" /> : <Copy className="size-3.5" />}
      </button>
      <a
        href={explorerTx(hash)}
        target="_blank"
        rel="noreferrer"
        className="opacity-60 transition-opacity hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
        aria-label="Open tx on Arc explorer"
      >
        <ExternalLink className="size-3.5" />
      </a>
    </span>
  );
}
