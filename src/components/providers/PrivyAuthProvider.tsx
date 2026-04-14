"use client";

import { useState, useEffect, type ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";

type Props = {
  children: ReactNode;
};

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function PrivyAuthProvider({ children }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render PrivyProvider on the server or during the initial hydration
  // pass — Privy validates the app ID during instantiation and throws in SSR.
  // Both server and initial client render return bare children (no mismatch).
  if (!appId || !mounted) {
    return <>{children}</>;
  }

  return (
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
  );
}
