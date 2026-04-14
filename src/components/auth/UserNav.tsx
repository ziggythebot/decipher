"use client";

import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { usePrivyMounted } from "@/components/providers/PrivyAuthProvider";

function displayName(user: ReturnType<typeof usePrivy>["user"]): string {
  if (!user) return "";
  if (user.google?.name) return user.google.name;
  if (user.google?.email) return user.google.email.split("@")[0];
  if (user.twitter?.name) return user.twitter.name;
  if (user.twitter?.username) return `@${user.twitter.username}`;
  if (user.email?.address) return user.email.address.split("@")[0];
  return "You";
}

function UserNavInner() {
  const router = useRouter();
  const { user, logout } = usePrivy();

  const name = displayName(user);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await logout();
    router.push("/");
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-zinc-400 hidden sm:block">{name}</span>
      <button
        type="button"
        onClick={() => void handleLogout()}
        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded border border-zinc-800 hover:border-zinc-600"
      >
        Sign out
      </button>
    </div>
  );
}

export function UserNav() {
  const privyMounted = usePrivyMounted();
  if (!privyMounted) return null;
  return <UserNavInner />;
}
