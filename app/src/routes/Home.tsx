import { ConnectButton } from "../components/ConnectButton";

export default function Home() {
  return (
    <>
      <div className="panel">
        <h2>Mirror Protocol</h2>
        <p>Bonded social trading with autonomous risk supervision, settled on Arc.</p>
        <p className="muted">
          Leaders post USDC performance bonds. Followers allocate by risk profile.
          A policy-bounded supervisor monitors strategy degradation and slashes bonds in sub-second finality.
        </p>
        <ConnectButton />
      </div>

      <div className="grid">
        <div className="panel">
          <h2>For Followers</h2>
          <p>Deposit USDC, choose a risk profile, and let the supervisor route allocations across bonded leaders.</p>
          <a href="/follower">Open follower app →</a>
        </div>
        <div className="panel">
          <h2>For Leaders</h2>
          <p>Post a performance bond, commit your strategy, and earn fee attribution on follower flow.</p>
          <a href="/leader">Open leader app →</a>
        </div>
      </div>
    </>
  );
}
