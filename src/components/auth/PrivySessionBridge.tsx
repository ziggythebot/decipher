"use client";

import { useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";

const hasPrivyAppId = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

export function PrivySessionBridge() {
  if (!hasPrivyAppId) {
    return null;
  }
  return <PrivySessionBridgeInner />;
}

function PrivySessionBridgeInner() {
  const { ready, authenticated, getAccessToken, user } = usePrivy();
  const bootstrappedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    if (!authenticated) {
      bootstrappedForRef.current = null;
      void fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
      return;
    }

    const userId = user?.id ?? "authed";
    if (bootstrappedForRef.current === userId) return;

    void (async () => {
      const token = await getAccessToken();
      if (!token) return;
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      bootstrappedForRef.current = userId;
    })().catch(() => null);
  }, [ready, authenticated, getAccessToken, user?.id]);

  return null;
}
