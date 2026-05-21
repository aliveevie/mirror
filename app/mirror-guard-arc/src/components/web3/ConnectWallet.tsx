import * as React from "react";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ARC_TESTNET_ID, arcTestnet } from "@/lib/chain";
import { shortAddress } from "@/lib/format";
import { toast } from "sonner";
import { ChevronDown, LogOut, Wallet, AlertTriangle, Loader2 } from "lucide-react";

export function ConnectWallet() {
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();

  const wrongChain = isConnected && chainId !== ARC_TESTNET_ID;

  React.useEffect(() => {
    if (error) toast.error(error.message);
  }, [error]);

  if (!isConnected) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="default" size="sm" className="gap-2">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
            Connect Wallet
            <ChevronDown className="size-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
            Choose wallet
          </DropdownMenuLabel>
          {connectors.map((c) => (
            <DropdownMenuItem
              key={c.uid}
              onClick={() => {
                connect(
                  { connector: c, chainId: ARC_TESTNET_ID },
                  {
                    onSuccess: () => toast.success(`Connected via ${c.name}`),
                  },
                );
              }}
              className="cursor-pointer"
            >
              <Wallet className="size-4" />
              {c.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (wrongChain) {
    return (
      <Button
        variant="destructive"
        size="sm"
        className="gap-2"
        disabled={switching}
        onClick={() => {
          switchChain(
            { chainId: ARC_TESTNET_ID, addEthereumChainParameter: {
              chainName: arcTestnet.name,
              nativeCurrency: arcTestnet.nativeCurrency,
              rpcUrls: ["https://rpc.testnet.arc.network"],
              blockExplorerUrls: ["https://testnet.arcscan.app"],
            } },
            {
              onSuccess: () => toast.success("Switched to Arc Testnet"),
              onError: (e) => toast.error(e.message),
            },
          );
        }}
      >
        {switching ? <Loader2 className="size-4 animate-spin" /> : <AlertTriangle className="size-4" />}
        Switch to Arc
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 num">
          <span className="size-1.5 rounded-full bg-mint pulse-dot" />
          {shortAddress(address)}
          <ChevronDown className="size-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">
          <div className="text-muted-foreground uppercase tracking-wider">Connected</div>
          <div className="mt-1 num">{shortAddress(address)}</div>
          {connector?.name && (
            <div className="mt-0.5 text-[10px] text-muted-foreground">via {connector.name}</div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            if (address) navigator.clipboard.writeText(address);
            toast.success("Address copied");
          }}
        >
          Copy address
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            disconnect();
            toast("Disconnected");
          }}
          className="text-bad focus:text-bad"
        >
          <LogOut className="size-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
