"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import LogsView from "./admin/LogsView";
import PvpLogsView from "./admin/PvpLogsView";
import DetectiveView from "./admin/DetectiveView";
import KompensationerView from "./admin/KompensationerView";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Stats {
  players: number;
  vehicles: number;
  houses: number;
  economy: { bank: number; cash: number; black: number };
  topJobs: { job: string; count: number }[];
}

interface Player {
  identifier: string;
  firstname: string;
  lastname: string;
  dateofbirth: string;
  job: string;
  group: string;
  accounts: Record<string, number> | null;
}

interface PlateResult {
  plate: string;
  model: string;
  stored: boolean;
  owner: string;
  ownerName: string;
}

interface ItemPlayerHit {
  identifier: string;
  name: string;
  count: number;
}

interface ItemVehicleHit {
  plate: string;
  owner: string;
  ownerName: string;
  location: string;
  count: number;
}

interface ItemHouseHit {
  houseId: number;
  owner: string;
  ownerName: string;
  count: number;
}

interface OxItem {
  name: string;
  count: number;
  slot: number;
  metadata?: Record<string, unknown>;
}

interface HouseResult {
  id: number;
  owner: string;
  ownerName: string;
  price: number;
  shell: string | null;
  lastActive: number | null;
  items: OxItem[];
  inventoryUpdated: string | null;
}

type View =
  | "overview"
  | "players"
  | "vehicles"
  | "items"
  | "houses"
  | "logs"
  | "detective"
  | "pvp"
  | "kompensationer";

const BASE_VIEWS: { key: View; label: string; description: string }[] = [
  { key: "overview", label: "Overblik", description: "Server-statistik og økonomi" },
  { key: "players", label: "Spillere", description: "users-tabel" },
  { key: "vehicles", label: "Køretøjer", description: "owned_vehicles-tabel" },
  { key: "items", label: "Items", description: "Inventory-søgning" },
  { key: "houses", label: "Boliger", description: "allhousing-tabel" },
  { key: "logs", label: "Logs", description: "Aktivitet på tværs af resources" },
  {
    key: "detective",
    label: "Detektiv",
    description: "Spørg Claude — undersøger databasen (kun læsning) og finder hvem der har gjort hvad",
  },
  {
    key: "pvp",
    label: "PvP Logs",
    description: "Death/kill events med screenshots, weapon, distance og inventory snapshots",
  },
];

const KOMPENSATIONER_VIEW = {
  key: "kompensationer" as View,
  label: "Kompensationssager",
  description: "Items oprettet via /kompensation i Discord",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function num(n: number) {
  return n.toLocaleString("da-DK");
}
function kr(n: number) {
  return n.toLocaleString("da-DK") + " kr.";
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminDashboard({
  canSeeKompensationer = false,
}: {
  canSeeKompensationer?: boolean;
} = {}) {
  const [view, setView] = useState<View>("overview");
  const VIEWS = useMemo(
    () => (canSeeKompensationer ? [...BASE_VIEWS, KOMPENSATIONER_VIEW] : BASE_VIEWS),
    [canSeeKompensationer],
  );
  const current = VIEWS.find((v) => v.key === view) ?? VIEWS[0];

  return (
    <div className="min-h-screen pt-20">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-8">
          {/* ── Sidebar ── */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 py-8">
              <p className="mb-3 px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
                Database
              </p>
              <nav className="space-y-px">
                {VIEWS.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => setView(v.key)}
                    className={`block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                      view === v.key
                        ? "bg-brand-600/10 text-foreground"
                        : "text-foreground-muted hover:bg-[var(--bg-2)] hover:text-foreground-secondary"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </nav>

              <p className="mb-3 mt-7 px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
                Sider
              </p>
              <nav className="space-y-px">
                <Link
                  href="/admin/firmaer"
                  className="block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] text-foreground-muted transition-colors hover:bg-[var(--bg-2)] hover:text-foreground-secondary"
                >
                  Firma-oversigt
                </Link>
                <Link
                  href="/admin/bander"
                  className="block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] text-foreground-muted transition-colors hover:bg-[var(--bg-2)] hover:text-foreground-secondary"
                >
                  Bande-oversigt
                </Link>
                <Link
                  href="/admin/biler"
                  className="block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] text-foreground-muted transition-colors hover:bg-[var(--bg-2)] hover:text-foreground-secondary"
                >
                  Bil-tuner
                </Link>
              </nav>
            </div>
          </aside>

          {/* ── Main ── */}
          <main className="py-8 lg:py-10">
            {/* Mobile nav */}
            <div className="mb-6 flex gap-1 overflow-x-auto border-b border-[var(--line)] lg:hidden">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  onClick={() => setView(v.key)}
                  className={`whitespace-nowrap px-3 py-2 text-[13px] ${
                    view === v.key
                      ? "border-b border-brand-500 text-foreground"
                      : "text-foreground-muted"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {/* Page header */}
            <div className="mb-8 border-b border-[var(--line)] pb-5">
              <p className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
                Admin
              </p>
              <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
                {current.label}
              </h1>
              <p className="mt-1 text-[12.5px] text-foreground-muted">{current.description}</p>
            </div>

            {view === "overview" && <Overview />}
            {view === "players" && <Players />}
            {view === "vehicles" && <Vehicles />}
            {view === "items" && <Items />}
            {view === "houses" && <Houses />}
            {view === "logs" && <Logs />}
            {view === "detective" && <DetectiveView />}
            {view === "pvp" && <PvpLogsView />}
            {view === "kompensationer" && canSeeKompensationer && <KompensationerView />}
          </main>
        </div>
      </div>
    </div>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────

function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!stats) return <ErrorBox msg="Kunne ikke hente statistik" />;

  const totalEconomy = stats.economy.bank + stats.economy.cash + stats.economy.black;

  return (
    <div className="space-y-10">
      {/* KPIs */}
      <div>
        <SectionLabel>Nøgletal</SectionLabel>
        <div className="grid grid-cols-2 divide-x divide-y divide-[var(--line)] border border-[var(--line)] sm:grid-cols-4 sm:divide-y-0">
          <Kpi label="Spillere" value={num(stats.players)} />
          <Kpi label="Køretøjer" value={num(stats.vehicles)} />
          <Kpi label="Boliger" value={num(stats.houses)} />
          <Kpi label="Samlet økonomi" value={kr(totalEconomy)} />
        </div>
      </div>

      {/* Economy + Top jobs */}
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <SectionLabel>Økonomi-fordeling</SectionLabel>
          <div className="border border-[var(--line)]">
            <Bar label="Bank" value={stats.economy.bank} total={totalEconomy} />
            <Bar label="Kontant" value={stats.economy.cash} total={totalEconomy} />
            <Bar label="Sorte penge" value={stats.economy.black} total={totalEconomy} />
          </div>
        </div>

        <div>
          <SectionLabel>Top jobs</SectionLabel>
          <table className="w-full border border-[var(--line)] text-[13px]">
            <tbody>
              {stats.topJobs.map((j, i) => (
                <tr
                  key={j.job}
                  className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--bg-2)]"
                >
                  <td className="w-8 py-2 pl-4 font-mono text-[11px] text-foreground-faint">
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td className="py-2 text-foreground">{j.job}</td>
                  <td className="py-2 pr-4 text-right font-mono text-foreground-secondary">
                    {num(j.count)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-5">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
        {label}
      </p>
      <p className="mt-2 font-mono text-[20px] font-medium tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

function Bar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="border-b border-[var(--line)] px-4 py-3 last:border-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-4">
        <span className="text-[12.5px] text-foreground-secondary">{label}</span>
        <span className="font-mono text-[12px] tabular-nums text-foreground">{kr(value)}</span>
      </div>
      <div className="h-[3px] w-full overflow-hidden bg-[var(--bg-2)]">
        <div className="h-full bg-brand-600" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 font-mono text-[10.5px] text-foreground-faint">{pct.toFixed(1)}%</p>
    </div>
  );
}

// ─── Players ─────────────────────────────────────────────────────────────────

type PlayerSortColumn = "name" | "identifier" | "job" | "bank" | "cash" | "group";
type SortDir = "asc" | "desc";

function Players() {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<PlayerSortColumn>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [data, setData] = useState<{ players: Player[]; total: number; limit: number } | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const toggleSort = (column: PlayerSortColumn) => {
    setPage(1);
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir(column === "bank" || column === "cash" ? "desc" : "asc");
    }
  };

  const load = useCallback(async (q: string, p: number, sort: PlayerSortColumn, dir: SortDir) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        sort,
        dir,
      });
      if (q) params.set("search", q);
      const res = await fetch(`/api/admin/players?${params}`);
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(search, page, sortBy, sortDir);
  }, [search, page, sortBy, sortDir, load]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="space-y-4">
      <SearchBar
        value={input}
        onChange={setInput}
        onSubmit={() => {
          setPage(1);
          setSearch(input);
        }}
        onClear={
          search
            ? () => {
                setInput("");
                setSearch("");
                setPage(1);
              }
            : undefined
        }
        placeholder="Søg på navn eller identifier"
      />

      {data && (
        <p className="font-mono text-[11px] text-foreground-muted">
          {num(data.total)} rækker{search ? ` matcher "${search}"` : ""}
        </p>
      )}

      <div className="border border-[var(--line)]">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--bg-2)] text-left">
              <SortTh
                label="Navn"
                column="name"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <SortTh
                label="Identifier"
                column="identifier"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
                className="hidden lg:table-cell"
              />
              <SortTh
                label="Job"
                column="job"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <SortTh
                label="Bank"
                column="bank"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
                className="hidden text-right md:table-cell"
                align="right"
              />
              <SortTh
                label="Kontant"
                column="cash"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
                className="hidden text-right md:table-cell"
                align="right"
              />
              <SortTh
                label="Gruppe"
                column="group"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
                className="text-center"
                align="center"
              />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-foreground-muted">
                  Henter…
                </td>
              </tr>
            )}
            {!loading && data?.players.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-foreground-muted">
                  Ingen spillere fundet.
                </td>
              </tr>
            )}
            {!loading &&
              data?.players.map((p) => {
                const fullName = [p.firstname, p.lastname].filter(Boolean).join(" ");
                return (
                  <tr
                    key={p.identifier}
                    className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--bg-2)]"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/players/${encodeURIComponent(p.identifier)}`}
                        className="text-foreground hover:text-brand-400"
                      >
                        {fullName || (
                          <span className="italic text-foreground-faint">Intet navn</span>
                        )}
                      </Link>
                      {p.dateofbirth && (
                        <span className="ml-2 font-mono text-[10.5px] text-foreground-faint">
                          {p.dateofbirth}
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-2.5 lg:table-cell">
                      <span className="font-mono text-[11px] text-foreground-muted">
                        {p.identifier}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-foreground-secondary">{p.job}</td>
                    <td className="hidden px-4 py-2.5 text-right font-mono text-[12px] tabular-nums text-foreground-secondary md:table-cell">
                      {p.accounts?.bank != null ? kr(p.accounts.bank) : "–"}
                    </td>
                    <td className="hidden px-4 py-2.5 text-right font-mono text-[12px] tabular-nums text-foreground-secondary md:table-cell">
                      {p.accounts?.money != null ? kr(p.accounts.money) : "–"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <GroupTag group={p.group} />
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between font-mono text-[11px] text-foreground-muted">
          <span>
            side {page} af {totalPages}
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
    </div>
  );
}

// ─── Vehicles (plate search) ─────────────────────────────────────────────────

function Vehicles() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<PlateResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/search/plate?q=${encodeURIComponent(input)}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResults(json.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fejl");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <SearchBar
        value={input}
        onChange={(v) => setInput(v.toUpperCase())}
        onSubmit={search}
        placeholder="ABC123 — søg på del af nummerplade"
        mono
      />

      {error && <ErrorBox msg={error} />}
      {loading && <Spinner />}

      {results && (
        <div className="border border-[var(--line)]">
          {results.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-foreground-muted">
              Ingen køretøjer fundet.
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--bg-2)] text-left">
                  <Th>Plade</Th>
                  <Th>Model</Th>
                  <Th>Ejer</Th>
                  <Th className="text-center">Status</Th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr
                    key={r.plate}
                    className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--bg-2)]"
                  >
                    <td className="px-4 py-2.5 font-mono text-[12.5px] tracking-wider text-foreground">
                      {r.plate}
                    </td>
                    <td className="px-4 py-2.5 text-foreground-secondary">{r.model}</td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/players/${encodeURIComponent(r.owner)}`}
                        className="text-foreground hover:text-brand-400"
                      >
                        {r.ownerName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                          r.stored
                            ? "bg-[var(--bg-2)] text-foreground-faint"
                            : "bg-emerald-900/40 text-emerald-400"
                        }`}
                      >
                        {r.stored ? "parkeret" : "i spil"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Items ───────────────────────────────────────────────────────────────────

function Items() {
  const [input, setInput] = useState("");
  const [playerHits, setPlayerHits] = useState<ItemPlayerHit[] | null>(null);
  const [vehicleHits, setVehicleHits] = useState<ItemVehicleHit[] | null>(null);
  const [houseHits, setHouseHits] = useState<ItemHouseHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/items.json")
      .then((r) => r.json())
      .then(setLabels)
      .catch(() => {});
  }, []);

  async function search() {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/search/item?name=${encodeURIComponent(input)}`);
      const json = await res.json();
      setPlayerHits(json.players ?? []);
      setVehicleHits(json.vehicles ?? []);
      setHouseHits(json.houses ?? []);
    } finally {
      setLoading(false);
    }
  }

  const itemLabel = labels[input.trim()] ?? input.trim();

  return (
    <div className="space-y-4">
      <SearchBar
        value={input}
        onChange={setInput}
        onSubmit={search}
        placeholder="Item-navn (f.eks. coke, bandage, weapon_pistol)"
      />

      {loading && <Spinner />}

      {playerHits &&
        playerHits.length === 0 &&
        vehicleHits &&
        vehicleHits.length === 0 &&
        houseHits &&
        houseHits.length === 0 && (
        <p className="py-10 text-center text-[13px] text-foreground-muted">
          Ingen fandt dette item.
        </p>
      )}

      {playerHits && playerHits.length > 0 && (
        <div>
          <SectionLabel>Hos spillere · {itemLabel}</SectionLabel>
          <div className="border border-[var(--line)]">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--bg-2)] text-left">
                  <Th className="w-12">#</Th>
                  <Th>Spiller</Th>
                  <Th className="text-right">Antal</Th>
                </tr>
              </thead>
              <tbody>
                {playerHits.map((h, i) => (
                  <tr
                    key={h.identifier + i}
                    className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--bg-2)]"
                  >
                    <td className="px-4 py-2 font-mono text-[11px] text-foreground-faint">
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/players/${encodeURIComponent(h.identifier)}`}
                        className="text-foreground hover:text-brand-400"
                      >
                        {h.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-[12.5px] font-medium tabular-nums text-foreground">
                      {num(h.count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {houseHits && houseHits.length > 0 && (
        <div>
          <SectionLabel>I boliger</SectionLabel>
          <div className="border border-[var(--line)]">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--bg-2)] text-left">
                  <Th>Hus #</Th>
                  <Th>Ejer</Th>
                  <Th className="text-right">Antal</Th>
                </tr>
              </thead>
              <tbody>
                {houseHits.map((h) => (
                  <tr
                    key={h.houseId}
                    className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--bg-2)]"
                  >
                    <td className="px-4 py-2 font-mono text-[12px] tracking-wider text-foreground">
                      {h.houseId}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/players/${encodeURIComponent(h.owner)}`}
                        className="text-foreground hover:text-brand-400"
                      >
                        {h.ownerName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-[12.5px] tabular-nums text-foreground">
                      {num(h.count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {vehicleHits && vehicleHits.length > 0 && (
        <div>
          <SectionLabel>I køretøjer</SectionLabel>
          <div className="border border-[var(--line)]">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--bg-2)] text-left">
                  <Th>Plade</Th>
                  <Th>Sted</Th>
                  <Th>Ejer</Th>
                  <Th className="text-right">Antal</Th>
                </tr>
              </thead>
              <tbody>
                {vehicleHits.map((h, i) => (
                  <tr
                    key={h.plate + i}
                    className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--bg-2)]"
                  >
                    <td className="px-4 py-2 font-mono text-[12px] tracking-wider text-foreground">
                      {h.plate}
                    </td>
                    <td className="px-4 py-2 text-foreground-muted">{h.location}</td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/players/${encodeURIComponent(h.owner)}`}
                        className="text-foreground hover:text-brand-400"
                      >
                        {h.ownerName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-[12.5px] tabular-nums text-foreground">
                      {num(h.count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Logs ────────────────────────────────────────────────────────────────────

function Logs() {
  return <LogsView />;
}

// ─── Houses ──────────────────────────────────────────────────────────────────

function Houses() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<HouseResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/search/house?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setResults(json.results ?? []);
      setExpanded(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <SearchBar
        value={input}
        onChange={setInput}
        onSubmit={() => load(input)}
        placeholder="Søg på hus-ID, ejer eller identifier"
      />

      {loading && <Spinner />}

      {results && (
        <div className="border border-[var(--line)]">
          {results.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-foreground-muted">
              Ingen boliger fundet.
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--bg-2)] text-left">
                  <Th className="w-10">{" "}</Th>
                  <Th className="w-16">ID</Th>
                  <Th>Ejer</Th>
                  <Th>Shell</Th>
                  <Th className="text-right">Pris</Th>
                  <Th className="text-right">Inventar</Th>
                  <Th className="hidden text-right md:table-cell">Sidst aktiv</Th>
                </tr>
              </thead>
              <tbody>
                {results.map((h) => {
                  const isOpen = expanded.has(h.id);
                  const itemCount = h.items.reduce((s, it) => s + (it.count ?? 0), 0);
                  const hasInv = h.items.length > 0;
                  return (
                    <React.Fragment key={h.id}>
                      <tr
                        className="cursor-pointer border-b border-[var(--line)] last:border-0 hover:bg-[var(--bg-2)]"
                        onClick={() => toggle(h.id)}
                      >
                        <td className="px-4 py-2.5 text-foreground-muted">
                          {hasInv ? (isOpen ? "▾" : "▸") : ""}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[12px] text-foreground-secondary">
                          #{h.id}
                        </td>
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <Link
                            href={`/admin/players/${encodeURIComponent(h.owner)}`}
                            className="text-foreground hover:text-brand-400"
                          >
                            {h.ownerName}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11.5px] text-foreground-muted">
                          {h.shell ?? "–"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[12px] tabular-nums text-foreground-secondary">
                          {kr(h.price)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[11.5px] tabular-nums">
                          {hasInv ? (
                            <span className="text-foreground">
                              {h.items.length} slot{h.items.length !== 1 ? "s" : ""} · {num(itemCount)} stk.
                            </span>
                          ) : (
                            <span className="text-foreground-faint">Tom</span>
                          )}
                        </td>
                        <td className="hidden px-4 py-2.5 text-right font-mono text-[11.5px] text-foreground-muted md:table-cell">
                          {h.lastActive
                            ? new Date(h.lastActive * 1000).toLocaleDateString("da-DK")
                            : "–"}
                        </td>
                      </tr>
                      {isOpen && hasInv && (
                        <tr className="border-b border-[var(--line)] last:border-0 bg-[var(--bg-2)]/40">
                          <td colSpan={7} className="px-6 py-3">
                            <div className="mb-2 flex items-baseline justify-between">
                              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
                                Stash · house_{h.id}
                              </p>
                              {h.inventoryUpdated && (
                                <p className="font-mono text-[10.5px] text-foreground-faint">
                                  {new Date(h.inventoryUpdated).toLocaleString("da-DK")}
                                </p>
                              )}
                            </div>
                            <HouseItemList items={h.items} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function HouseItemList({ items }: { items: OxItem[] }) {
  const sorted = [...items].sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {sorted.map((it) => (
        <div
          key={`${it.slot}-${it.name}`}
          className="flex items-baseline justify-between font-mono text-[11.5px]"
        >
          <span className="truncate text-foreground" title={it.name}>{it.name}</span>
          <span className="ml-2 tabular-nums text-foreground-secondary">×{it.count}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
      {children}
    </p>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-2 font-mono text-[10.5px] font-normal uppercase tracking-[0.12em] text-foreground-faint ${className}`}
    >
      {children}
    </th>
  );
}

function SortTh({
  label,
  column,
  sortBy,
  sortDir,
  onSort,
  className = "",
  align = "left",
}: {
  label: string;
  column: PlayerSortColumn;
  sortBy: PlayerSortColumn;
  sortDir: SortDir;
  onSort: (column: PlayerSortColumn) => void;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  const active = sortBy === column;
  const alignCls =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const indicator = !active ? "↕" : sortDir === "asc" ? "↑" : "↓";

  return (
    <th className={`px-4 py-2 ${alignCls} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1.5 font-mono text-[10.5px] font-normal uppercase tracking-[0.12em] transition-colors hover:text-foreground ${
          active ? "text-brand-400" : "text-foreground-faint"
        } ${align === "right" ? "ml-auto" : align === "center" ? "mx-auto" : ""}`}
        title={active ? (sortDir === "asc" ? "Sorter A→Z / lav→høj" : "Sorter Z→A / høj→lav") : "Klik for at sortere"}
      >
        <span>{label}</span>
        <span className="text-[9px] tabular-nums opacity-80">{indicator}</span>
      </button>
    </th>
  );
}

function GroupTag({ group }: { group: string }) {
  const cls =
    group === "admin"
      ? "bg-red-900/30 text-red-400"
      : group === "superadmin"
        ? "bg-purple-900/30 text-purple-400"
        : "bg-[var(--bg-2)] text-foreground-faint";
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cls}`}
    >
      {group}
    </span>
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

function SearchBar({
  value,
  onChange,
  onSubmit,
  onClear,
  placeholder,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onClear?: () => void;
  placeholder: string;
  mono?: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex gap-2"
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`flex-1 rounded border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2 text-[13px] text-foreground placeholder:text-foreground-faint focus:border-[var(--line-strong)] focus:outline-none ${mono ? "font-mono uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal" : ""}`}
      />
      <button
        type="submit"
        className="rounded border border-[var(--line)] bg-brand-600/15 px-4 py-2 text-[12px] font-medium uppercase tracking-wider text-brand-400 transition-colors hover:bg-brand-600/25"
      >
        Søg
      </button>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="rounded border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2 text-[12px] text-foreground-muted hover:text-foreground"
        >
          ryd
        </button>
      )}
    </form>
  );
}

function Spinner() {
  return <p className="py-12 text-center text-[12px] text-foreground-muted">Henter…</p>;
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="rounded border border-red-900/50 bg-red-950/20 px-4 py-3 text-[12.5px] text-red-400">
      {msg}
    </div>
  );
}
