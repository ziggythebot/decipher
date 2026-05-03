"use client";

import { useState } from "react";
import { PRICING } from "./pricing";

type Row = {
  id: string;
  email: string;
  createdAt: Date | string;
  lastActiveAt: Date | string | null;
  isBlocked: boolean;
  monthlyTokenBudget: number | null;
  level: number;
  totalXp: number;
  targetLanguage: string;
  sessions: number;
  inputTokens: number;
  outputTokens: number;
  ttsChars: number;
  sttSeconds: number;
  cost: number;
  monthlyUsage: number;
};

type Props = {
  rows: Row[];
  monthStart: string;
};

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export function AdminUserTable({ rows, monthStart }: Props) {
  const [localRows, setLocalRows] = useState<Row[]>(rows);
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  async function patchUser(userId: string, patch: { isBlocked?: boolean; monthlyTokenBudget?: number | null }) {
    setSaving((s) => ({ ...s, [userId]: true }));
    try {
      const res = await fetch(`/api/admin/users?userId=${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed");
      setLocalRows((prev) =>
        prev.map((r) => (r.id === userId ? { ...r, ...patch } : r))
      );
    } catch {
      alert("Save failed — check console");
    } finally {
      setSaving((s) => ({ ...s, [userId]: false }));
    }
  }

  function handleBudgetSave(userId: string) {
    const raw = budgetInputs[userId]?.trim();
    if (raw === "" || raw === undefined) {
      void patchUser(userId, { monthlyTokenBudget: null });
    } else {
      const n = parseInt(raw, 10);
      if (isNaN(n) || n < 0) return;
      void patchUser(userId, { monthlyTokenBudget: n });
    }
  }

  const monthLabel = new Date(monthStart).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-zinc-500 mb-3">
        Monthly usage vs budget shown for <span className="text-zinc-300">{monthLabel}</span>
      </div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
            <th className="pb-2 pr-4 font-medium">User</th>
            <th className="pb-2 pr-4 font-medium text-right">Sessions</th>
            <th className="pb-2 pr-4 font-medium text-right">Tokens (all)</th>
            <th className="pb-2 pr-4 font-medium text-right">TTS / STT</th>
            <th className="pb-2 pr-4 font-medium text-right">Cost</th>
            <th className="pb-2 pr-4 font-medium text-right">This month</th>
            <th className="pb-2 pr-4 font-medium text-right">Budget</th>
            <th className="pb-2 font-medium text-right">Block</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-900">
          {localRows.map((row) => {
            const isSaving = saving[row.id] ?? false;
            const budgetVal = budgetInputs[row.id] ?? (row.monthlyTokenBudget !== null ? String(row.monthlyTokenBudget) : "");
            const monthPct = row.monthlyTokenBudget
              ? Math.min(100, Math.round((row.monthlyUsage / row.monthlyTokenBudget) * 100))
              : null;
            const ttsKChars = (row.ttsChars / 1000).toFixed(1);
            const sttMins = Math.floor(row.sttSeconds / 60);
            const ttsCost = (row.ttsChars / 1000) * PRICING.ttsPerKChar;
            const sttCost = (row.sttSeconds / 60) * PRICING.sttPerMinute;

            return (
              <tr key={row.id} className={`group ${row.isBlocked ? "opacity-50" : ""}`}>
                {/* User */}
                <td className="py-3 pr-4">
                  <div className="font-medium text-white truncate max-w-[200px]">{row.email}</div>
                  <div className="text-zinc-600 text-xs mt-0.5">
                    Joined {fmtDate(row.createdAt)} · Last {fmtDate(row.lastActiveAt)} · Lv{row.level}
                  </div>
                </td>

                {/* Sessions */}
                <td className="py-3 pr-4 text-right text-zinc-300">{row.sessions}</td>

                {/* Tokens */}
                <td className="py-3 pr-4 text-right">
                  <div className="text-zinc-300">{fmtTokens(row.inputTokens + row.outputTokens)}</div>
                  <div className="text-zinc-600 text-xs">{fmtTokens(row.inputTokens)}↑ {fmtTokens(row.outputTokens)}↓</div>
                </td>

                {/* TTS / STT */}
                <td className="py-3 pr-4 text-right">
                  <div className="text-zinc-300">${(ttsCost + sttCost).toFixed(3)}</div>
                  <div className="text-zinc-600 text-xs">{ttsKChars}k ch · {sttMins}m</div>
                </td>

                {/* Cost */}
                <td className="py-3 pr-4 text-right">
                  <div className="font-semibold text-green-400">${row.cost.toFixed(3)}</div>
                </td>

                {/* This month usage vs budget */}
                <td className="py-3 pr-4 text-right">
                  <div className="text-zinc-300">{fmtTokens(row.monthlyUsage)}</div>
                  {monthPct !== null && (
                    <div className="text-xs mt-1">
                      <div className="w-20 h-1 bg-zinc-800 rounded-full ml-auto">
                        <div
                          className={`h-1 rounded-full ${monthPct >= 90 ? "bg-red-500" : monthPct >= 70 ? "bg-amber-500" : "bg-green-500"}`}
                          style={{ width: `${monthPct}%` }}
                        />
                      </div>
                      <div className="text-zinc-600 mt-0.5">{monthPct}%</div>
                    </div>
                  )}
                  {monthPct === null && (
                    <div className="text-zinc-600 text-xs">unlimited</div>
                  )}
                </td>

                {/* Budget */}
                <td className="py-3 pr-4 text-right">
                  <div className="flex items-center gap-1.5 justify-end">
                    <input
                      type="number"
                      min="0"
                      placeholder="∞"
                      value={budgetVal}
                      onChange={(e) => setBudgetInputs((b) => ({ ...b, [row.id]: e.target.value }))}
                      className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:border-zinc-500"
                    />
                    <button
                      onClick={() => handleBudgetSave(row.id)}
                      disabled={isSaving}
                      className="text-xs bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 px-2 py-1 rounded-lg transition-colors"
                    >
                      {isSaving ? "…" : "Set"}
                    </button>
                  </div>
                  <div className="text-zinc-600 text-xs mt-1 text-right">
                    {row.monthlyTokenBudget !== null ? `${fmtTokens(row.monthlyTokenBudget)} cap` : "no cap"}
                  </div>
                </td>

                {/* Block */}
                <td className="py-3 text-right">
                  <button
                    onClick={() => void patchUser(row.id, { isBlocked: !row.isBlocked })}
                    disabled={isSaving}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                      row.isBlocked
                        ? "bg-red-900/60 text-red-400 hover:bg-red-900"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {row.isBlocked ? "Unblock" : "Block"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {localRows.length === 0 && (
        <div className="text-center text-zinc-600 py-12">No users yet.</div>
      )}
    </div>
  );
}
