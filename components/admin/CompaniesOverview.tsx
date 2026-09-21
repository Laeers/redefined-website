"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CompanySummary, CompanyMember } from "@/lib/companies";

const kr = (n: number) => n.toLocaleString("da-DK") + " kr.";
const num = (n: number) => n.toLocaleString("da-DK");

function relTime(iso: string | null): { text: string; tone: "ok" | "warn" | "off" } {
  if (!iso) return { text: "aldrig", tone: "off" };
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (Number.isNaN(then)) return { text: "ukendt", tone: "off" };
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  let text: string;
  if (min < 1) text = "lige nu";
  else if (min < 60) text = `for ${min} min siden`;
  else if (hour < 24) text = `for ${hour} ${hour === 1 ? "time" : "timer"} siden`;
  else if (day < 30) text = `for ${day} ${day === 1 ? "dag" : "dage"} siden`;
  else {
    const mon = Math.floor(day / 30);
    text = `for ${mon} ${mon === 1 ? "måned" : "måneder"} siden`;
  }
  const tone: "ok" | "warn" | "off" = day <= 7 ? "ok" : day <= 30 ? "warn" : "off";
  return { text, tone };
}

const toneCls: Record<string, string> = {
  ok: "bg-emerald-500/15 text-emerald-300",
  warn: "bg-amber-500/15 text-amber-300",
  off: "bg-zinc-500/15 text-zinc-400",
};

type SortKey = "balance" | "members" | "active" | "label";

function LogoBadge({ c }: { c: CompanySummary }) {
  const [broken, setBroken] = useState(false);
  if (c.logo && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={c.logo}
        alt=""
        className="h-10 w-10 shrink-0 rounded-md object-contain bg-[var(--bg)] p-1"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-600/15 text-[15px] font-semibold text-brand-300">
      {(c.label || c.job).slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function CompaniesOverview({
  initial,
  variant = "company",
  apiBase = "/api/admin/companies",
}: {
  initial: CompanySummary[];
  variant?: "company" | "gang";
  apiBase?: string;
}) {
  const isGang = variant === "gang";
  const L = {
    count: isGang ? "Bander" : "Firmaer",
    searchPlaceholder: isGang
      ? "Søg bande, job eller boss…"
      : "Søg firma, job eller chef…",
    empty: isGang ? "Ingen bander matcher." : "Ingen firmaer matcher.",
    members: isGang ? "medlemmer" : "ansatte",
    noMembers: isGang
      ? "Ingen medlemmer registreret."
      : "Ingen ansatte registreret.",
  };

  const [companies] = useState<CompanySummary[]>(initial);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("balance");
  const [open, setOpen] = useState<string | null>(null);

  const totals = useMemo(() => {
    const money = companies.reduce((s, c) => s + c.balance, 0);
    const members = companies.reduce((s, c) => s + c.members, 0);
    const active = companies.reduce((s, c) => s + c.active, 0);
    return { money, members, active, count: companies.length };
  }, [companies]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = companies.filter(
      (c) =>
        !needle ||
        c.label.toLowerCase().includes(needle) ||
        c.job.toLowerCase().includes(needle) ||
        (c.boss ?? "").toLowerCase().includes(needle)
    );
    list.sort((a, b) => {
      if (sort === "label") return a.label.localeCompare(b.label, "da");
      return b[sort] - a[sort];
    });
    return list;
  }, [companies, q, sort]);

  const SORTS: { key: SortKey; label: string }[] = [
    { key: "balance", label: "Økonomi" },
    { key: "members", label: "Medlemmer" },
    { key: "active", label: "Aktive" },
    { key: "label", label: "Navn" },
  ];

  return (
    <div className="space-y-6">
      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={L.count} value={num(totals.count)} />
        <Stat label="Samlet society-økonomi" value={kr(totals.money)} />
        <Stat label="Medlemmer i alt" value={num(totals.members)} />
        <Stat label="Aktive (7 dage)" value={num(totals.active)} />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={L.searchPlaceholder}
          className="min-w-[220px] flex-1 rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[14px] text-foreground outline-none focus:border-brand-500/60"
        />
        <div className="flex items-center gap-1">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`rounded-md px-3 py-2 text-[13px] transition-colors ${
                sort === s.key
                  ? "bg-brand-600/15 text-foreground"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {filtered.map((c) => (
          <CompanyRow
            key={c.job}
            c={c}
            open={open === c.job}
            onToggle={() => setOpen(open === c.job ? null : c.job)}
            apiBase={apiBase}
            membersLabel={L.members}
            noMembers={L.noMembers}
          />
        ))}
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-[14px] text-foreground-muted">
            {L.empty}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
        {label}
      </p>
      <p className="mt-1.5 text-[18px] font-semibold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

function CompanyRow({
  c,
  open,
  onToggle,
  apiBase,
  membersLabel,
  noMembers,
}: {
  c: CompanySummary;
  open: boolean;
  onToggle: () => void;
  apiBase: string;
  membersLabel: string;
  noMembers: string;
}) {
  const last = relTime(c.lastActivity);
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg-2)]">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-[var(--bg)]/40"
      >
        <LogoBadge c={c} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-foreground">
            {c.label}
          </p>
          <p className="truncate font-mono text-[11px] text-foreground-faint">
            {c.job}
            {c.boss ? <span className="text-foreground-muted"> · Chef: {c.boss}</span> : null}
          </p>
        </div>
        <div className="hidden sm:block sm:text-right">
          <p className="text-[15px] font-semibold tabular-nums text-foreground">
            {kr(c.balance)}
          </p>
          <p className="text-[11px] text-foreground-faint">society-konto</p>
        </div>
        <div className="text-right">
          <p className="text-[14px] tabular-nums text-foreground">
            <span className="text-emerald-300">{num(c.active)}</span>
            <span className="text-foreground-faint"> / {num(c.members)}</span>
          </p>
          <p className="text-[11px] text-foreground-faint">aktive / {membersLabel}</p>
        </div>
        <span
          className={`hidden shrink-0 rounded px-2 py-0.5 text-[11px] md:inline-block ${toneCls[last.tone]}`}
        >
          {last.text}
        </span>
        <span className="shrink-0 text-foreground-faint">{open ? "▲" : "▼"}</span>
      </button>
      {open ? <MemberPanel job={c.job} apiBase={apiBase} noMembers={noMembers} /> : null}
    </div>
  );
}

function MemberPanel({
  job,
  apiBase,
  noMembers,
}: {
  job: string;
  apiBase: string;
  noMembers: string;
}) {
  const [members, setMembers] = useState<CompanyMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setMembers(null);
    setError(null);
    fetch(`${apiBase}/${encodeURIComponent(job)}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Fejl");
        return r.json();
      })
      .then((d) => alive && setMembers(d.members))
      .catch((e) => alive && setError(String(e.message ?? e)));
    return () => {
      alive = false;
    };
  }, [job, apiBase]);

  if (error)
    return (
      <p className="border-t border-[var(--line)] px-4 py-3 text-[13px] text-red-300">
        {error}
      </p>
    );
  if (!members)
    return (
      <p className="border-t border-[var(--line)] px-4 py-3 text-[13px] text-foreground-muted">
        Henter medlemmer…
      </p>
    );
  if (members.length === 0)
    return (
      <p className="border-t border-[var(--line)] px-4 py-3 text-[13px] text-foreground-muted">
        {noMembers}
      </p>
    );

  return (
    <div className="border-t border-[var(--line)] bg-[var(--bg)]/30">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-foreground-faint">
            <th className="px-4 py-2 font-medium">Navn</th>
            <th className="px-4 py-2 font-medium">Rang</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Sidst online</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const last = relTime(m.lastSeen);
            return (
              <tr
                key={m.identifier}
                className="border-t border-[var(--line)]/50 hover:bg-[var(--bg-2)]/40"
              >
                <td className="px-4 py-2">
                  <Link
                    href={`/admin/players/${encodeURIComponent(m.identifier)}`}
                    className="text-foreground transition-colors hover:text-brand-300"
                  >
                    {m.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-foreground-secondary">
                  {m.gradeLabel}
                  {m.isBoss ? (
                    <span className="ml-2 rounded bg-brand-600/20 px-1.5 py-0.5 text-[10px] font-medium text-brand-300">
                      CHEF
                    </span>
                  ) : null}
                  {m.multiJob ? (
                    <span
                      title="Har firmaet gemt som multijob i companyapp (ikke deres nuværende job)"
                      className="ml-2 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-300"
                    >
                      MULTIJOB
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] ${
                      m.active ? toneCls.ok : toneCls.off
                    }`}
                  >
                    {m.active ? "Aktiv" : "Inaktiv"}
                  </span>
                </td>
                <td className="px-4 py-2 text-foreground-muted">{last.text}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
