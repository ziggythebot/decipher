import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">
          Decipher
        </p>

        <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
          Learn French for real conversations, fast.
        </h1>

        <p className="mt-5 max-w-2xl text-zinc-300">
          Frequency-first vocabulary, a 20-minute grammar unlock, and guided speaking
          practice. Built for people who need fluency, not endless streak mechanics.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 md:max-w-2xl">
          <Link
            href="/dashboard"
            className="rounded-xl bg-indigo-600 px-5 py-4 text-center text-sm font-bold transition-colors hover:bg-indigo-500"
          >
            Open Dashboard
          </Link>
          <Link
            href="/learn/vocab"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-4 text-center text-sm font-bold transition-colors hover:border-zinc-500"
          >
            Start Vocab Session
          </Link>
          <Link
            href="/learn/deconstruct"
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 text-center text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-600"
          >
            Explore Deconstruction Dozen
          </Link>
          <Link
            href="/progress"
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 text-center text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-600"
          >
            View Progress
          </Link>
        </div>

        <div className="mt-12 grid gap-3 text-sm text-zinc-400 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="font-semibold text-zinc-200">Frequency-first vocab</p>
            <p className="mt-1">Learn the highest-impact words before thematic extras.</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="font-semibold text-zinc-200">Grammar upfront</p>
            <p className="mt-1">Understand sentence mechanics before brute-force memorization.</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="font-semibold text-zinc-200">Speak early</p>
            <p className="mt-1">Conversation practice is integrated into the daily loop.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
