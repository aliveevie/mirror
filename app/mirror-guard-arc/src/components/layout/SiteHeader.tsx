import { Link, useRouterState } from "@tanstack/react-router";
import { ConnectWallet } from "@/components/web3/ConnectWallet";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/leader", label: "Leader" },
  { to: "/follower", label: "Follower" },
  { to: "/agent", label: "Agent" },
] as const;

export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="relative size-7 rounded-md bg-gradient-to-br from-mint to-chart-4 shadow-[0_0_16px_color-mix(in_oklab,var(--mint)_35%,transparent)]">
            <div className="absolute inset-[3px] rounded-[5px] bg-background grid place-items-center">
              <span className="text-mint text-[11px] font-bold">M</span>
            </div>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">Mirror Protocol</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Arc · Chain 5042002
            </span>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((n) => {
            const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-surface-2 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-2/60",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-mint pulse-dot" />
            <span className="uppercase tracking-wider">Agent online</span>
          </span>
          <ConnectWallet />
        </div>
      </div>
      <nav className="flex md:hidden items-center gap-1 px-4 pb-2 overflow-x-auto">
        {NAV.map((n) => {
          const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm",
                active ? "bg-surface-2 text-foreground" : "text-muted-foreground",
              )}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
