"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";

interface Player {
  identifier: string;
  firstname: string;
  lastname: string;
  dateofbirth: string;
  sex: string;
  job: string;
  job_grade: number;
  group: string;
  accounts: Record<string, number> | null;
}

interface ApiResponse {
  players: Player[];
  total: number;
  page: number;
  limit: number;
  error?: string;
}

function moneyFmt(n: number) {
  return n?.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) ?? "–";
}

export default function AdminPlayerList() {
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlayers = useCallback(async (q: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (q) params.set("search", q);
      const res = await fetch(`/api/admin/players?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Ukendt fejl");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fejl ved hentning");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlayers(search, page);
  }, [search, page, fetchPlayers]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(input);
  }

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 pt-28">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-foreground-muted">Admin</p>
          <h1 className="text-2xl font-semibold text-foreground">Spillere</h1>
          {data && (
            <p className="mt-0.5 text-[13px] text-foreground-muted">{data.total.toLocaleString("da-DK")} spillere i alt</p>
          )}
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-6 flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Søg på navn eller identifier…"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-[13.5px] text-foreground placeholder:text-foreground-muted focus:border-brand-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-500"
        >
          Søg
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setInput(""); setPage(1); setSearch(""); }}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-[13px] text-foreground-muted transition-colors hover:text-foreground"
          >
            Ryd
          </button>
        )}
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-[13px] text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-header)]">
              <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-widest text-foreground-muted">Navn</th>
              <th className="hidden px-4 py-3 text-left font-mono text-[11px] uppercase tracking-widest text-foreground-muted md:table-cell">Identifier</th>
              <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-widest text-foreground-muted">Job</th>
              <th className="hidden px-4 py-3 text-right font-mono text-[11px] uppercase tracking-widest text-foreground-muted lg:table-cell">Bank</th>
              <th className="hidden px-4 py-3 text-right font-mono text-[11px] uppercase tracking-widest text-foreground-muted lg:table-cell">Cash</th>
              <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-widest text-foreground-muted">Gruppe</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-foreground-muted">
                  Henter…
                </td>
              </tr>
            )}
            {!loading && data?.players.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-foreground-muted">
                  Ingen spillere fundet.
                </td>
              </tr>
            )}
            {!loading && data?.players.map((p) => (
              <tr
                key={p.identifier}
                className="border-b border-[var(--border)] last:border-0 transition-colors hover:bg-[var(--bg-hover)]"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/players/${encodeURIComponent(p.identifier)}`}
                    className="font-medium text-foreground hover:text-brand-400"
                  >
                    {p.firstname || p.lastname ? `${p.firstname} ${p.lastname}`.trim() : <span className="text-foreground-muted italic">Intet navn</span>}
                  </Link>
                  {p.dateofbirth && (
                    <div className="mt-0.5 text-[11.5px] text-foreground-muted">{p.dateofbirth}</div>
                  )}
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <span className="font-mono text-[11.5px] text-foreground-muted">{p.identifier}</span>
                </td>
                <td className="px-4 py-3 text-foreground-muted">{p.job}</td>
                <td className="hidden px-4 py-3 text-right font-mono text-foreground-muted lg:table-cell">
                  {p.accounts?.bank != null ? moneyFmt(p.accounts.bank) : "–"}
                </td>
                <td className="hidden px-4 py-3 text-right font-mono text-foreground-muted lg:table-cell">
                  {p.accounts?.money != null ? moneyFmt(p.accounts.money) : "–"}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 font-mono text-[11px] ${
                    p.group === "admin"
                      ? "bg-red-900/50 text-red-300"
                      : p.group === "superadmin"
                        ? "bg-purple-900/50 text-purple-300"
                        : "bg-[var(--bg)] text-foreground-muted"
                  }`}>
                    {p.group}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-[13px] text-foreground-muted">
          <span>Side {page} / {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40"
            >
              ← Forrige
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40"
            >
              Næste →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
