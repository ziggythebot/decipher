"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 p-6 text-white">
      <p className="text-sm font-semibold uppercase tracking-widest text-red-400">Something went wrong</p>
      <p className="max-w-md text-center text-zinc-400">{error.message}</p>
      {error.digest && (
        <p className="text-xs text-zinc-600">digest: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium hover:bg-zinc-700"
      >
        Try again
      </button>
    </div>
  );
}
