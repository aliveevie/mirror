import { ADDRESSES } from "@/lib/addresses";
import { AddressLink } from "@/components/web3/AddressLink";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border/60">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 text-xs text-muted-foreground flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-foreground/80 font-medium">Mirror Protocol</span>
          <span>Slash-bonded social trading with autonomous AI risk supervision.</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="uppercase tracking-wider">Agent</span>
          <AddressLink address={ADDRESSES.AgentWallet} />
          <span className="text-border">·</span>
          <a
            href="https://testnet.arcscan.app"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            Arc Explorer
          </a>
        </div>
      </div>
    </footer>
  );
}
