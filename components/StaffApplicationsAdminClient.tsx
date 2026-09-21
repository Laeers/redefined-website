"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  StaffApplication,
  StaffApplicationStatus,
  StaffApplicationType,
} from "@/lib/staff-applications-types";
import {
  STAFF_STATUS_LABEL,
  STAFF_STATUS_TONE,
  STAFF_TYPE_LABEL,
} from "@/lib/staff-applications-types";

interface ListPayload {
  applications: StaffApplication[];
  total: number;
  counts: Record<StaffApplicationStatus, number>;
  typeCounts: Record<StaffApplicationType, number>;
}

const STATUS_TABS: { value: StaffApplicationStatus | "all"; label: string }[] = [
  { value: "pending", label: "Afventer" },
  { value: "approved", label: "Godkendt" },
  { value: "rejected", label: "Afvist" },
  { value: "all", label: "Alle" },
];

const TYPE_TABS: { value: StaffApplicationType | "all"; label: string }[] = [
  { value: "all", label: "Alle typer" },
  { value: "whitelist_receiver", label: "Whitelist-modtager" },
  { value: "general_staff", label: "Almindelig staff" },
];

interface Props {
  allowedTypes?: StaffApplicationType[] | null;
}

export default function StaffApplicationsAdminClient({ allowedTypes }: Props) {
  const hasFullAccess = allowedTypes === null || allowedTypes === undefined;
  const visibleTypeTabs = hasFullAccess
    ? TYPE_TABS
    : TYPE_TABS.filter(
        (t) => t.value === "all" || allowedTypes!.includes(t.value as StaffApplicationType)
      );

  const [status, setStatus] = useState<StaffApplicationStatus | "all">("pending");
  const defaultType = hasFullAccess
    ? "all"
    : allowedTypes!.length === 1
      ? allowedTypes![0]
      : "all";
  const [type, setType] = useState<StaffApplicationType | "all">(defaultType);
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
    params.set("type", type);
    if (search) params.set("q", search);
    if (from) params.set("from", new Date(from).toISOString());
    if (to) {
      const d = new Date(to);
      d.setHours(23, 59, 59, 999);
      params.set("to", d.toISOString());
    }
    params.set("sort", sort);
    params.set("limit", "100");
    const r = await fetch(`/api/admin/staff-applications?${params.toString()}`);
    if (!r.ok) {
      setError(
        await r
          .json()
          .then((j) => j.error)
          .catch(() => "Fejl")
      );
      setLoading(false);
      return;
    }
    setData((await r.json()) as ListPayload);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, type, search, from, to, sort]);

  const counts = data?.counts ?? { pending: 0, approved: 0, rejected: 0 };

  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-[var(--bg)] px-6 pb-24 pt-32">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-brand-400/85">
            Staff · ansøgninger
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-foreground">
            Staff-ansøgninger
          </h1>
        </div>
        <p className="font-mono text-[12px] text-foreground-faint">
          {data
            ? `${data.total} resultat${data.total === 1 ? "" : "er"}`
            : "henter…"}
        </p>
      </header>

      {/* STATUS TABS */}
      <div className="mb-3 flex flex-wrap gap-1 border-b border-[var(--line)] pb-2">
        {STATUS_TABS.map((t) => {
          const active = status === t.value;
          const count =
            t.value === "all"
              ? Object.values(counts).reduce((a, b) => a + b, 0)
              : counts[t.value as StaffApplicationStatus];
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

      {/* TYPE TABS */}
      <div className="mb-4 flex flex-wrap gap-1">
        {visibleTypeTabs.map((t) => {
          const active = type === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`rounded-full border px-3 py-1 text-[11.5px] transition-colors ${
                active
                  ? "border-brand-500 bg-brand-600/15 text-foreground"
                  : "border-[var(--line)] text-foreground-muted hover:border-[var(--line-strong)] hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* FILTERS */}
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Søg på Discord-navn eller ID…"
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

      <div className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--bg-2)]">
        {loading && !data ? (
          <p className="px-5 py-6 text-[13px] text-foreground-faint">
            Henter ansøgninger…
          </p>
        ) : !data?.applications.length ? (
          <p className="px-5 py-6 text-[13px] text-foreground-faint">
            Ingen ansøgninger matcher filtrene.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {data.applications.map((a) => (
              <li key={a.discordId}>
                <Link
                  href={`/applications/staff/${a.discordId}`}
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
                      {STAFF_TYPE_LABEL[a.applicationType]} · {a.age} år
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-foreground-faint">
                    {new Date(a.createdAt).toLocaleString("da-DK", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${STAFF_STATUS_TONE[a.status]}`}
                  >
                    {STAFF_STATUS_LABEL[a.status]}
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
