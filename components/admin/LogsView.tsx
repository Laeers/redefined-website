"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LogRow {
  id: number;
  createdAt: string;
  resource: string;
  category: string;
  action: string;
  severity: string;
  message: string | null;
  source: number | null;
  identifier: string | null;
  license: string | null;
  steam: string | null;
  discord: string | null;
  playerName: string | null;
  esxName: string | null;
  job: string | null;
  jobGrade: number | null;
  targetIdentifier: string | null;
  targetDiscord: string | null;
  targetName: string | null;
  amount: number | null;
  item: string | null;
  weapon: string | null;
  plate: string | null;
  coords: string | null;
  metadata: unknown;
  screenshotUrl?: string | null;
}

interface FacetEntry {
  value: string;
  count: number;
}

interface Facets {
  resources: FacetEntry[];
  categories: FacetEntry[];
  severities: FacetEntry[];
  actions: FacetEntry[];
  jobs: FacetEntry[];
  stats: { last24h: number; errors24h: number; warnings24h: number; lastHour: number };
}

interface LogsResponse {
  logs: LogRow[];
  total: number;
  page: number;
  limit: number;
}

interface ActiveFilters {
  resource: Set<string>;
  category: Set<string>;
  severity: Set<string>;
  action: Set<string>;
  job: Set<string>;
  from: string;
  to: string;
}

const EMPTY_FILTERS: ActiveFilters = {
  resource: new Set(),
  category: new Set(),
  severity: new Set(),
  action: new Set(),
  job: new Set(),
  from: "",
  to: "",
};

const SEVERITY_TONE: Record<string, string> = {
  info: "bg-sky-900/30 text-sky-300",
  debug: "bg-[var(--bg-2)] text-foreground-faint",
  warn: "bg-amber-900/30 text-amber-300",
  error: "bg-red-900/30 text-red-300",
  critical: "bg-red-700/40 text-red-100",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function LogsView() {
  const [facets, setFacets] = useState<Facets | null>(null);
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LogRow | null>(null);
  const reqIdRef = useRef(0);

  // Hent facets én gang ved mount + når man trykker refresh
  const loadFacets = useCallback(() => {
    fetch("/api/admin/logs/facets")
      .then((r) => r.json())
      .then((json) => {
        // Normalisér så vi aldrig render undefined felter
        setFacets({
          resources: Array.isArray(json?.resources) ? json.resources : [],
          categories: Array.isArray(json?.categories) ? json.categories : [],
          severities: Array.isArray(json?.severities) ? json.severities : [],
          actions: Array.isArray(json?.actions) ? json.actions : [],
          jobs: Array.isArray(json?.jobs) ? json.jobs : [],
          stats: {
            last24h: Number(json?.stats?.last24h ?? 0),
            errors24h: Number(json?.stats?.errors24h ?? 0),
            warnings24h: Number(json?.stats?.warnings24h ?? 0),
            lastHour: Number(json?.stats?.lastHour ?? 0),
          },
        });
      })
      .catch(() =>
        setFacets({
          resources: [],
          categories: [],
          severities: [],
          actions: [],
          jobs: [],
          stats: { last24h: 0, errors24h: 0, warnings24h: 0, lastHour: 0 },
        })
      );
  }, []);

  useEffect(() => {
    loadFacets();
  }, [loadFacets]);

  const load = useCallback(async () => {
    setLoading(true);
    const myId = ++reqIdRef.current;
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      filters.resource.forEach((v) => params.append("resource", v));
      filters.category.forEach((v) => params.append("category", v));
      filters.severity.forEach((v) => params.append("severity", v));
      filters.action.forEach((v) => params.append("action", v));
      filters.job.forEach((v) => params.append("job", v));
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      params.set("page", String(page));

      const res = await fetch(`/api/admin/logs?${params}`);
      const json = await res.json().catch(() => null);
      if (myId !== reqIdRef.current) return;
      // Normalisér så data altid har gyldige felter, selv på 500/error
      setData({
        logs: Array.isArray(json?.logs) ? json.logs : [],
        total: Number(json?.total ?? 0),
        page: Number(json?.page ?? page),
        limit: Number(json?.limit ?? 50),
      });
    } catch {
      if (myId === reqIdRef.current) {
        setData({ logs: [], total: 0, page, limit: 50 });
      }
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }
  }, [search, filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  // når noget ændrer i filter/search, gå tilbage til side 1
  const updateFilters = (next: ActiveFilters) => {
    setFilters(next);
    setPage(1);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const activeFilterCount =
    filters.resource.size +
    filters.category.size +
    filters.severity.size +
    filters.action.size +
    filters.job.size +
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0);

  return (
    <div className="space-y-5">
      {/* Stats */}
      {facets && (
        <div className="grid grid-cols-2 divide-x divide-y divide-[var(--line)] border border-[var(--line)] sm:grid-cols-4 sm:divide-y-0">
          <Stat label="Sidste 24t" value={facets.stats.last24h.toLocaleString("da-DK")} />
          <Stat label="Sidste time" value={facets.stats.lastHour.toLocaleString("da-DK")} />
          <Stat
            label="Warnings 24t"
            value={facets.stats.warnings24h.toLocaleString("da-DK")}
            tone={facets.stats.warnings24h > 0 ? "amber" : undefined}
          />
          <Stat
            label="Errors 24t"
            value={facets.stats.errors24h.toLocaleString("da-DK")}
            tone={facets.stats.errors24h > 0 ? "red" : undefined}
          />
        </div>
      )}

      {/* Søg */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
        className="flex flex-wrap gap-2"
      >
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Fri tekst, eller discord:123, license:..., steam:..., plate:ABC123, item:bandage"
          className="flex-1 min-w-[260px] rounded border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2 text-[13px] text-foreground placeholder:text-foreground-faint focus:border-[var(--line-strong)] focus:outline-none"
        />
        <button
          type="submit"
          className="rounded border border-[var(--line)] bg-brand-600/15 px-4 py-2 text-[12px] font-medium uppercase tracking-wider text-brand-400 hover:bg-brand-600/25"
        >
          Søg
        </button>
        {(search || activeFilterCount > 0) && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setSearch("");
              updateFilters({ ...EMPTY_FILTERS, resource: new Set(), category: new Set(), severity: new Set(), action: new Set(), job: new Set() });
            }}
            className="rounded border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2 text-[12px] text-foreground-muted hover:text-foreground"
          >
            ryd alt
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            loadFacets();
            load();
          }}
          className="rounded border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2 text-[12px] text-foreground-muted hover:text-foreground"
        >
          opdater
        </button>
      </form>

      {/* Filter rækken */}
      {facets && (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <MultiFilter
            label="Resource"
            options={facets.resources}
            selected={filters.resource}
            onChange={(s) => updateFilters({ ...filters, resource: s })}
          />
          <MultiFilter
            label="Kategori"
            options={facets.categories}
            selected={filters.category}
            onChange={(s) => updateFilters({ ...filters, category: s })}
          />
          <MultiFilter
            label="Severity"
            options={facets.severities}
            selected={filters.severity}
            onChange={(s) => updateFilters({ ...filters, severity: s })}
          />
          <MultiFilter
            label="Action"
            options={facets.actions}
            selected={filters.action}
            onChange={(s) => updateFilters({ ...filters, action: s })}
          />
          <MultiFilter
            label="Job"
            options={facets.jobs}
            selected={filters.job}
            onChange={(s) => updateFilters({ ...filters, job: s })}
          />
        </div>
      )}

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-3 text-[12px] text-foreground-muted">
        <label className="flex items-center gap-2">
          fra
          <input
            type="datetime-local"
            value={filters.from}
            onChange={(e) => updateFilters({ ...filters, from: e.target.value })}
            className="rounded border border-[var(--line)] bg-[var(--bg-2)] px-2 py-1 text-[12px] text-foreground"
          />
        </label>
        <label className="flex items-center gap-2">
          til
          <input
            type="datetime-local"
            value={filters.to}
            onChange={(e) => updateFilters({ ...filters, to: e.target.value })}
            className="rounded border border-[var(--line)] bg-[var(--bg-2)] px-2 py-1 text-[12px] text-foreground"
          />
        </label>
        {(filters.from || filters.to) && (
          <button
            onClick={() => updateFilters({ ...filters, from: "", to: "" })}
            className="text-foreground-faint hover:text-foreground"
          >
            ryd dato
          </button>
        )}
        {data && (
          <span className="ml-auto font-mono text-[11px] text-foreground-faint">
            {data.total.toLocaleString("da-DK")} hits
          </span>
        )}
      </div>

      {/* Resultater */}
      <div className="border border-[var(--line)]">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--bg-2)] text-left">
              <Th className="w-[72px]">Shot</Th>
              <Th className="w-[140px]">Tid</Th>
              <Th className="w-[110px]">Resource</Th>
              <Th className="w-[150px]">Action</Th>
              <Th className="w-[80px]">Sev</Th>
              <Th>Spiller</Th>
              <Th className="hidden lg:table-cell">Besked</Th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-foreground-muted">
                  Henter…
                </td>
              </tr>
            )}
            {!loading && data?.logs.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-foreground-muted">
                  Ingen logs matcher.
                </td>
              </tr>
            )}
            {!loading &&
              data?.logs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => setSelected(log)}
                  className="cursor-pointer border-b border-[var(--line)] last:border-0 hover:bg-[var(--bg-2)]"
                >
                  <td className="px-3 py-2">
                    {log.screenshotUrl ? (
                      <a
                        href={log.screenshotUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="block w-fit"
                        title="Åbn fuldt screenshot"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={log.screenshotUrl}
                          alt=""
                          loading="lazy"
                          className="h-8 w-14 rounded border border-[var(--line)] object-cover transition-opacity hover:opacity-80"
                        />
                      </a>
                    ) : (
                      <span className="text-foreground-faint">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-foreground-muted">
                    {formatTime(log.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-[var(--bg-2)] px-1.5 py-0.5 font-mono text-[10.5px] text-foreground-secondary">
                      {log.resource}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11.5px] text-foreground">{log.action}</td>
                  <td className="px-3 py-2">
                    <SeverityBadge severity={log.severity} />
                  </td>
                  <td className="px-3 py-2">
                    <PlayerCell log={log} />
                  </td>
                  <td className="hidden truncate px-3 py-2 text-foreground-secondary lg:table-cell">
                    {log.message ?? <span className="text-foreground-faint">—</span>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && data && totalPages > 1 && (
        <div className="flex items-center justify-between font-mono text-[11px] text-foreground-muted">
          <span>
            side {data.page} af {totalPages}
          </span>
          <div className="flex gap-2">
            <PageBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              ← forrige
            </PageBtn>
            <PageBtn
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              næste →
            </PageBtn>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {selected && <LogDetail log={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function Stat({ label, value, tone }: { label: string; value: string; tone?: "amber" | "red" }) {
  const valueClass =
    tone === "red"
      ? "text-red-400"
      : tone === "amber"
        ? "text-amber-400"
        : "text-foreground";
  return (
    <div className="px-5 py-4">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
        {label}
      </p>
      <p className={`mt-1.5 font-mono text-[20px] font-medium tracking-tight ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

function MultiFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: FacetEntry[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const filtered = useMemo(() => {
    const f = filter.toLowerCase().trim();
    if (!f) return options;
    return options.filter((o) => o.value.toLowerCase().includes(f));
  }, [options, filter]);

  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(next);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2 text-left text-[12.5px] text-foreground hover:border-[var(--line-strong)]"
      >
        <span>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
            {label}
          </span>
          {selected.size > 0 && (
            <span className="ml-2 rounded bg-brand-600/20 px-1.5 py-0.5 font-mono text-[10.5px] text-brand-300">
              {selected.size}
            </span>
          )}
        </span>
        <span className="font-mono text-[10.5px] text-foreground-faint">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded border border-[var(--line)] bg-[var(--bg)] shadow-xl">
          <div className="border-b border-[var(--line)] p-2">
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={`Søg ${label.toLowerCase()}…`}
              className="w-full rounded border border-[var(--line)] bg-[var(--bg-2)] px-2 py-1 text-[12px] text-foreground placeholder:text-foreground-faint focus:outline-none"
            />
          </div>
          {selected.size > 0 && (
            <div className="border-b border-[var(--line)] px-3 py-1.5">
              <button
                onClick={() => onChange(new Set())}
                className="font-mono text-[10.5px] uppercase tracking-wider text-foreground-faint hover:text-foreground"
              >
                ryd ({selected.size})
              </button>
            </div>
          )}
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-center text-[11.5px] text-foreground-faint">
                Ingen
              </p>
            )}
            {filtered.map((o) => {
              const checked = selected.has(o.value);
              return (
                <button
                  key={o.value}
                  onClick={() => toggle(o.value)}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[12.5px] hover:bg-[var(--bg-2)] ${
                    checked ? "bg-brand-600/10 text-foreground" : "text-foreground-secondary"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-block h-3 w-3 rounded-sm border ${
                        checked ? "border-brand-500 bg-brand-600" : "border-[var(--line-strong)]"
                      }`}
                    />
                    <span className="truncate font-mono text-[11.5px]">{o.value}</span>
                  </span>
                  <span className="font-mono text-[10.5px] tabular-nums text-foreground-faint">
                    {o.count.toLocaleString("da-DK")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const tone = SEVERITY_TONE[severity] ?? SEVERITY_TONE.info;
  return (
    <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tone}`}>
      {severity}
    </span>
  );
}

function PlayerCell({ log }: { log: LogRow }) {
  const name = log.esxName || log.playerName;
  if (!name && !log.discord && !log.identifier) {
    return <span className="text-foreground-faint">—</span>;
  }
  return (
    <div className="flex flex-col">
      {name && <span className="text-foreground">{name}</span>}
      <span className="font-mono text-[10.5px] text-foreground-faint">
        {log.discord ? `discord:${log.discord}` : log.identifier ?? ""}
        {log.job ? ` · ${log.job}` : ""}
      </span>
    </div>
  );
}

function LogDetail({ log, onClose }: { log: LogRow; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-[640px] overflow-y-auto border-l border-[var(--line)] bg-[var(--bg)] p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
              Log #{log.id}
            </p>
            <p className="mt-1 font-mono text-[14px] text-foreground">{log.action}</p>
          </div>
          <div className="flex items-center gap-2">
            <SeverityBadge severity={log.severity} />
            <button
              onClick={onClose}
              className="rounded border border-[var(--line)] bg-[var(--bg-2)] px-2 py-1 text-[11px] text-foreground-muted hover:text-foreground"
            >
              luk
            </button>
          </div>
        </div>

        <dl className="space-y-2 text-[12.5px]">
          <Row k="Tid" v={formatTime(log.createdAt, true)} />
          <Row k="Resource" v={log.resource} mono />
          <Row k="Kategori" v={log.category} />
          <Row k="Besked" v={log.message ?? "—"} wrap />
          <hr className="my-3 border-[var(--line)]" />
          <Row k="Spiller" v={log.esxName || log.playerName || "—"} />
          <Row k="Identifier" v={log.identifier ?? "—"} mono />
          <Row k="License" v={log.license ?? "—"} mono />
          <Row k="Steam" v={log.steam ?? "—"} mono />
          <Row k="Discord" v={log.discord ?? "—"} mono />
          <Row k="Job" v={`${log.job ?? "—"}${log.jobGrade != null ? " (grad " + log.jobGrade + ")" : ""}`} />
          <Row k="Source" v={log.source != null ? String(log.source) : "—"} mono />
          {(log.targetIdentifier || log.targetName || log.targetDiscord) && (
            <>
              <hr className="my-3 border-[var(--line)]" />
              <Row k="Target navn" v={log.targetName ?? "—"} />
              <Row k="Target ID" v={log.targetIdentifier ?? "—"} mono />
              <Row k="Target Discord" v={log.targetDiscord ?? "—"} mono />
            </>
          )}
          {(log.amount != null || log.item || log.weapon || log.plate || log.coords) && (
            <>
              <hr className="my-3 border-[var(--line)]" />
              <Row k="Item" v={log.item ?? "—"} mono />
              <Row k="Weapon" v={log.weapon ?? "—"} mono />
              <Row k="Antal" v={log.amount != null ? log.amount.toLocaleString("da-DK") : "—"} />
              <Row k="Plate" v={log.plate ?? "—"} mono />
              <Row k="Coords" v={log.coords ?? "—"} mono />
            </>
          )}
        </dl>

        {log.screenshotUrl && (
          <div className="mt-5">
            <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
              Screenshot
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a href={log.screenshotUrl} target="_blank" rel="noreferrer">
              <img
                src={log.screenshotUrl}
                alt="screenshot"
                className="w-full rounded border border-[var(--line)] transition-opacity hover:opacity-90"
              />
            </a>
          </div>
        )}

        {log.metadata != null && (
          <div className="mt-5">
            <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
              Metadata
            </p>
            <pre className="max-h-[400px] overflow-auto rounded border border-[var(--line)] bg-black/40 p-3 font-mono text-[11.5px] text-foreground-secondary">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v, mono, wrap }: { k: string; v: string; mono?: boolean; wrap?: boolean }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">{k}</dt>
      <dd
        className={`text-foreground ${mono ? "font-mono text-[11.5px]" : ""} ${wrap ? "whitespace-pre-wrap break-words" : "truncate"}`}
      >
        {v}
      </dd>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2 font-mono text-[10.5px] font-normal uppercase tracking-[0.12em] text-foreground-faint ${className}`}
    >
      {children}
    </th>
  );
}

function PageBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-[var(--line)] bg-[var(--bg-2)] px-3 py-1 text-[11px] uppercase tracking-wider transition-colors hover:bg-[var(--bg-3)] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function formatTime(iso: string, full = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (full) {
    return d.toLocaleString("da-DK", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  return d.toLocaleString("da-DK", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
