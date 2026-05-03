import { db } from "@/lib/db";
import { AdminUserTable } from "./AdminUserTable";
import { PRICING } from "./pricing";

export const dynamic = "force-dynamic";

// Auth is handled entirely by Basic Auth in proxy.ts — no Privy/session here.
export default async function AdminPage() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [users, allTimeAgg, monthAgg, sessionCounts] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        createdAt: true,
        lastActiveAt: true,
        isBlocked: true,
        monthlyTokenBudget: true,
        level: true,
        totalXp: true,
        targetLanguage: true,
      },
    }),

    // All-time token totals per user
    db.conversationSession.groupBy({
      by: ["userId"],
      _sum: { inputTokens: true, outputTokens: true, ttsChars: true, sttSeconds: true },
      _count: { id: true },
    }),

    // This month's token totals per user
    db.conversationSession.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: monthStart } },
      _sum: { inputTokens: true, outputTokens: true },
    }),

    // Session counts per user
    db.conversationSession.groupBy({
      by: ["userId"],
      _count: { id: true },
    }),
  ]);

  // Index aggregates by userId for O(1) lookup
  const allTimeByUser = Object.fromEntries(allTimeAgg.map((r) => [r.userId, r]));
  const monthByUser   = Object.fromEntries(monthAgg.map((r) => [r.userId, r]));
  const countByUser   = Object.fromEntries(sessionCounts.map((r) => [r.userId, r._count.id]));

  // Compute global totals for the header
  const globalInputTokens  = allTimeAgg.reduce((s, r) => s + (r._sum.inputTokens  ?? 0), 0);
  const globalOutputTokens = allTimeAgg.reduce((s, r) => s + (r._sum.outputTokens ?? 0), 0);
  const globalTtsChars     = allTimeAgg.reduce((s, r) => s + (r._sum.ttsChars     ?? 0), 0);
  const globalSttSeconds   = allTimeAgg.reduce((s, r) => s + (r._sum.sttSeconds   ?? 0), 0);
  const globalCost = calcCost(globalInputTokens, globalOutputTokens, globalTtsChars, globalSttSeconds);

  const rows = users.map((u) => {
    const allTime = allTimeByUser[u.id];
    const month   = monthByUser[u.id];
    const inputTokens  = allTime?._sum.inputTokens  ?? 0;
    const outputTokens = allTime?._sum.outputTokens ?? 0;
    const ttsChars     = allTime?._sum.ttsChars     ?? 0;
    const sttSeconds   = allTime?._sum.sttSeconds   ?? 0;
    const monthInput   = month?._sum.inputTokens    ?? 0;
    const monthOutput  = month?._sum.outputTokens   ?? 0;
    const monthTotal   = monthInput + monthOutput;
    const cost         = calcCost(inputTokens, outputTokens, ttsChars, sttSeconds);
    const sessions     = countByUser[u.id] ?? 0;

    return {
      ...u,
      sessions,
      inputTokens,
      outputTokens,
      ttsChars,
      sttSeconds,
      cost,
      monthlyUsage: monthTotal,
    };
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black">Admin</h1>
            <p className="text-zinc-500 text-sm mt-0.5">{users.length} users · all-time platform cost</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-green-400">${globalCost.toFixed(2)}</div>
            <div className="text-xs text-zinc-500 mt-0.5">all-time spend</div>
          </div>
        </div>

        {/* Global cost breakdown */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          <CostCard label="LLM (input)" value={`$${((globalInputTokens / 1_000_000) * PRICING.inputPerMToken).toFixed(2)}`} sub={`${(globalInputTokens / 1000).toFixed(0)}k tokens`} />
          <CostCard label="LLM (output)" value={`$${((globalOutputTokens / 1_000_000) * PRICING.outputPerMToken).toFixed(2)}`} sub={`${(globalOutputTokens / 1000).toFixed(0)}k tokens`} />
          <CostCard label="TTS (Deepgram)" value={`$${((globalTtsChars / 1000) * PRICING.ttsPerKChar).toFixed(2)}`} sub={`${(globalTtsChars / 1000).toFixed(0)}k chars`} />
          <CostCard label="STT (Deepgram)" value={`$${((globalSttSeconds / 60) * PRICING.sttPerMinute).toFixed(2)}`} sub={`${Math.floor(globalSttSeconds / 60)}m audio`} />
        </div>

        <AdminUserTable rows={rows} monthStart={monthStart.toISOString()} />
      </div>
    </div>
  );
}

function calcCost(inputTokens: number, outputTokens: number, ttsChars: number, sttSeconds: number): number {
  return (
    (inputTokens  / 1_000_000) * PRICING.inputPerMToken +
    (outputTokens / 1_000_000) * PRICING.outputPerMToken +
    (ttsChars     / 1_000)     * PRICING.ttsPerKChar +
    (sttSeconds   / 60)        * PRICING.sttPerMinute
  );
}

function CostCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="text-xl font-black text-white">{value}</div>
      <div className="text-xs text-zinc-600 mt-0.5">{sub}</div>
    </div>
  );
}
