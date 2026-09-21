"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Application, ApplicationStatus } from "@/lib/applications-types";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/applications-types";

interface ListPayload {
  applications: Application[];
  total: number;
  counts: Record<ApplicationStatus, number>;
}

const STATUS_TABS: { value: ApplicationStatus | "all"; label: string }[] = [
  { value: "pending", label: "Afventer" },
  { value: "awaiting_interview", label: "Afventer samtale" },
  { value: "approved", label: "Godkendt" },
  { value: "rejected", label: "Afvist" },
  { value: "changes_requested", label: "Skal rettes" },
  { value: "all", label: "Alle" },
];

export default function AdminWhitelistClient() {
  const [status, setStatus] = useState<ApplicationStatus | "all">("pending");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "updated">("newest");
  const [data, setData] = useState<ListPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    
    setError(null);
    const params = new URLSearchParams();
    params.set("status", status);
    if (search) params.set("q", search);
    if (from) params.set("from", new Date(from).toISOString());
    if (to) {
      const d = new Date(to);
      d.setHours(23, 59, 59, 999);
      params.set("to", d.toISOString());
    }
    params.set("sort", sort);
    params.set("limit", "100");
    const r = await fetch(`/api/admin/applications?${params.toString()}`);
    if (!r.ok) {
      setError(await r.json().then((j) => j.error).catch(() => "Fejl"));
      setLoading(false);
      return;
    }
    setData((await r.json()) as ListPayload);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search, from, to, sort]);

  const counts = data?.counts ?? {
    pending: 0,
    awaiting_interview: 0,
    approved: 0,
    rejected: 0,
    changes_requested: 0,
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-[var(--bg)] px-6 pb-24 pt-32">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-brand-400/85">
            Whitelist · admin
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-foreground">
            Ansøgninger
          </h1>
        </div>
        <p className="font-mono text-[12px] text-foreground-faint">
          {data ? `${data.total} resultat${data.total === 1 ? "" : "er"}` : "henter…"}
        </p>
      </header>

      {/* TABS */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-[var(--line)] pb-2">
        {STATUS_TABS.map((t) => {
          const active = status === t.value;
          const count =
            t.value === "all"
              ? Object.values(counts).reduce((a, b) => a + b, 0)
              : counts[t.value as ApplicationStatus];
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setStatus(t.value)}
              className={`rounded-md px-3 py-1.5 text-[12.5px] transition-colors ${
                active
                  ? "bg-brand-600/18 text-foreground"
                  : "text-foreground-muted hover:bg-[var(--btn-ghost-bg)] hover:text-foreground"
              }`}
            >
              {t.label}
              <span className="ml-2 font-mono text-[11px] text-foreground-faint">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* FILTERS */}
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Søg på Discord-navn, karakter eller ID…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setSearch(searchInput);
            }}
          />
          <button
            className="btn-ghost"
            onClick={() => setSearch(searchInput)}
            type="button"
          >
            Søg
          </button>
        </div>
        <DateInput label="Fra" value={from} onChange={setFrom} />
        <DateInput label="Til" value={to} onChange={setTo} />
        <SortSelect value={sort} onChange={setSort} />
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-red-700/50 bg-red-900/30 px-4 py-2 text-[13px] text-red-100">
          {error}
        </div>
      ) : null}

      <div className="rounded-md border border-[var(--line)] bg-[var(--bg-2)] overflow-hidden">
        {loading && !data ? (
          <p className="px-5 py-6 text-[13px] text-foreground-faint">Henter ansøgninger…</p>
        ) : !data?.applications.length ? (
          <p className="px-5 py-6 text-[13px] text-foreground-faint">
            Ingen ansøgninger matcher filtrene.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {data.applications.map((a) => (
              <li key={a.discordId}>
                <Link
                  href={`/applications/whitelist/${a.discordId}`}
                  className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-[var(--btn-ghost-bg)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-medium text-foreground">
                      {a.username}{" "}
                      <span className="ml-2 font-mono text-[11px] text-foreground-faint">
                        {a.discordId}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-[12.5px] text-foreground-muted">
                      {a.realName} · {a.charName} · {a.steamHours} timer · {a.age} år
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-foreground-faint">
                    {new Date(a.createdAt).toLocaleString("da-DK", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${STATUS_TONE[a.status]}`}
                  >
                    {STATUS_LABEL[a.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[11.5px] text-foreground-faint">
      <span className="font-mono uppercase tracking-widest">{label}</span>
      <input
        type="date"
        className="rounded-md border border-[var(--line-strong)] bg-[var(--bg-3)] px-2.5 py-1.5 text-[12.5px] text-foreground"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SortSelect({
  value,
  onChange,
}: {
  value: "newest" | "oldest" | "updated";
  onChange: (v: "newest" | "oldest" | "updated") => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[11.5px] text-foreground-faint">
      <span className="font-mono uppercase tracking-widest">Sortér</span>
      <select
        className="rounded-md border border-[var(--line-strong)] bg-[var(--bg-3)] px-2.5 py-1.5 text-[12.5px] text-foreground"
        value={value}
        onChange={(e) =>
          onChange(e.target.value as "newest" | "oldest" | "updated")
        }
      >
        <option value="newest">Nyeste først</option>
        <option value="oldest">Ældste først</option>
        <option value="updated">Senest opdateret</option>
      </select>
    </label>
  );
}
