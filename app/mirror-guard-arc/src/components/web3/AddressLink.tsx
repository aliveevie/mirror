import * as React from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { explorerAddress } from "@/lib/chain";
import { shortAddress } from "@/lib/format";
import { toast } from "sonner";

interface Props {
  address?: string | null;
  label?: string;
  className?: string;
  full?: boolean;
}

export function AddressLink({ address, label, className, full }: Props) {
  const [copied, setCopied] = React.useState(false);
  if (!address) return <span className={cn("text-muted-foreground num", className)}>—</span>;

  const onCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Address copied");
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <span
      className={cn(
        "group inline-flex items-center gap-1.5 num text-foreground/90",
        className,
      )}
      title={address}
    >
      <span className="tracking-tight">{label ?? (full ? address : shortAddress(address))}</span>
      <button
        type="button"
        onClick={onCopy}
        className="opacity-60 transition-opacity hover:opacity-100"
        aria-label="Copy address"
      >
        {copied ? <Check className="size-3.5 text-mint" /> : <Copy className="size-3.5" />}
      </button>
      <a
        href={explorerAddress(address)}
        target="_blank"
        rel="noreferrer"
        className="opacity-60 transition-opacity hover:opacity-100"
        aria-label="View on Arc explorer"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="size-3.5" />
      </a>
    </span>
  );
}
