"use client";

import { Component, useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";

// Signals to child components that PrivyProvider is in the tree and safe to
// call usePrivy(). Starts false on server and initial client render to prevent
// usePrivy() being called without a provider context.
const PrivyMountedContext = createContext(false);
export const usePrivyMounted = () => useContext(PrivyMountedContext);

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

// Catches PrivyProvider throwing for invalid app ID — degrades to no-auth
// rather than crashing the whole page.
class PrivyErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { crashed: boolean }
> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch(err: Error) {
    console.error("[PrivyAuthProvider] Privy failed to initialise:", err.message);
  }
  render() {
    return this.state.crashed ? this.props.fallback : this.props.children;
  }
}

export function PrivyAuthProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const privyReady = Boolean(appId) && mounted;

  return (
    <PrivyMountedContext.Provider value={privyReady}>
      {privyReady ? (
        <PrivyErrorBoundary fallback={children}>
          <PrivyProvider
            appId={appId}
            config={{
              loginMethods: ["email", "google", "apple"],
              appearance: {
                theme: "dark",
                accentColor: "#4f46e5",
              },
            }}
          >
            {children}
          </PrivyProvider>
        </PrivyErrorBoundary>
      ) : (
        children
      )}
    </PrivyMountedContext.Provider>
  );
}
