import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { wagmiConfig } from "./lib/wagmi";
import FollowerPage from "./routes/Follower";
import LeaderPage from "./routes/Leader";
import HomePage from "./routes/Home";

const queryClient = new QueryClient();

function Shell() {
  return (
    <div className="shell">
      <nav className="nav">
        <span className="brand">Mirror</span>
        <NavLink to="/" end className="muted">Home</NavLink>
        <NavLink to="/follower" className="muted">Follower</NavLink>
        <NavLink to="/leader" className="muted">Leader</NavLink>
        <span style={{ flex: 1 }} />
        <span className="muted mono">Arc Testnet</span>
      </nav>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/follower" element={<FollowerPage />} />
        <Route path="/leader" element={<LeaderPage />} />
      </Routes>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
