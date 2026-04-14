"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";

type Props = {
  children: ReactNode;
};

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const isValidPrivyAppId = /^cl[a-z0-9]+$/i.test(appId);

export function PrivyAuthProvider({ children }: Props) {
  if (!appId || !isValidPrivyAppId) {
    console.warn("Privy disabled: missing or invalid NEXT_PUBLIC_PRIVY_APP_ID");
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
