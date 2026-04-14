"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { usePrivyMounted } from "@/components/providers/PrivyAuthProvider";

export function HomeAuthActions() {
  const privyMounted = usePrivyMounted();

  if (!privyMounted) {
    return <p className="text-xs text-zinc-400">Loading...</p>;
  }

  return <HomeAuthActionsWithPrivy />;
}

function HomeAuthActionsWithPrivy() {
  const router = useRouter();
  const { ready, authenticated, login, logout, getAccessToken } = usePrivy();
  const [loading, setLoading] = useState(false);

  if (!ready) {
    return <p className="text-xs text-zinc-400">Loading auth...</p>;
  }

  if (!authenticated) {
    return (
      <button
        type="button"
        onClick={login}
        disabled={loading}
        className="rounded-xl bg-indigo-600 px-5 py-4 text-center text-sm font-bold transition-colors hover:bg-indigo-500"
      >
        Sign in to start
      </button>
    );
  }

  async function continueToDashboard() {
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      await logout();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={() => void continueToDashboard()}
        disabled={loading}
        className="rounded-xl bg-indigo-600 px-5 py-4 text-center text-sm font-bold transition-colors hover:bg-indigo-500"
      >
        {loading ? "Loading..." : "Open Dashboard"}
      </button>
      <button
        type="button"
        onClick={() => void handleLogout()}
        disabled={loading}
        className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-4 text-center text-sm font-semibold transition-colors hover:border-zinc-500"
      >
        Log out
      </button>
    </div>
  );
}
