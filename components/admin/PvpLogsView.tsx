"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface InventoryItem {
  name: string;
  count: number;
  slot?: number;
  metadata?: unknown;
}

interface PlayerSnapshot {
  source: number | null;
  identifier: string | null;
  license: string | null;
  discord: string | null;
  steam: string | null;
  name: string | null;
  job: string | null;
  jobGrade: number | null;
  coords: string | null;
  screenshotUrl: string | null;
  videoUrl: string | null;
  inventory: InventoryItem[] | null;
}

interface PvpRow {
  id: number;
  createdAt: string;
  deathType: string;
  weapon: string | null;
  weaponHash: number | null;
  weaponItem: string | null;
  killVehicle: string | null;
  distance: number | null;
  isHeadshot: boolean;
  victim: PlayerSnapshot;
  killer: PlayerSnapshot | null;
}

interface FacetEntry {
  value: string;
  count: number;
}

interface ApiResponse {
  logs: PvpRow[];
  total: number;
  page: number;
  limit: number;
  stats24h: { pvp: number; suicide: number; npc: number; headshots: number; total: number };
  facets: { killerJobs: FacetEntry[]; victimJobs: FacetEntry[] };
}

type TypeFilter = "all" | "pvp" | "suicide" | "npc_or_env" | "environment";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function num(n: number) {
  return n.toLocaleString("da-DK");
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("da-DK", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function itemImageCandidates(name: string): string[] {
  const lower = name.toLowerCase();
  if (lower === name) return [`/items/${name}.png`];
  return [`/items/${name}.png`, `/items/${lower}.png`];
}

// Ikon for det der dræbte: køretøj (majestic CDN) eller våben-item (/items/<navn>.png).
const VEHICLE_IMG_BASE =
  "https://cdn.majestic-files.net/public/master/static/img/vehicles";

function KillIcon({
  weaponItem,
  killVehicle,
}: {
  weaponItem: string | null;
  killVehicle: string | null;
}) {
  const candidates = useMemo(() => {
    if (killVehicle) return [`${VEHICLE_IMG_BASE}/${killVehicle.toLowerCase()}.png`];
    if (weaponItem) return itemImageCandidates(weaponItem);
    return [];
  }, [weaponItem, killVehicle]);
  const [idx, setIdx] = useState(0);
  if (candidates.length === 0 || idx >= candidates.length) return null;
  const label = killVehicle || weaponItem || "";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={candidates[idx]}
      alt={label}
      title={label}
      onError={() => setIdx((i) => i + 1)}
      className="h-6 w-10 shrink-0 object-contain"
    />
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pvp: { label: "PvP", cls: "bg-red-900/40 text-red-300 ring-red-900/40" },
    suicide: { label: "Selvmord", cls: "bg-zinc-800/60 text-zinc-300 ring-zinc-700/40" },
    npc_or_env: { label: "NPC/miljø", cls: "bg-amber-900/30 text-amber-300 ring-amber-900/40" },
    environment: { label: "Miljø", cls: "bg-sky-900/30 text-sky-300 ring-sky-900/40" },
    unknown: { label: "?", cls: "bg-[var(--bg-2)] text-foreground-faint ring-[var(--line)]" },
  };
  const m = map[type] ?? map.unknown;
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ring-1 ${m.cls}`}>
      {m.label}
    </span>
  );
}

function ItemChip({ item, labels }: { item: InventoryItem; labels: Record<string, string> }) {
  const candidates = useMemo(() => itemImageCandidates(item.name), [item.name]);
  const [srcIdx, setSrcIdx] = useState(0);
  const failed = srcIdx >= candidates.length;
  const label = labels[item.name] || item.name;

  return (
    <div
      className="flex items-center gap-2 rounded border border-[var(--line)] bg-[var(--bg-2)]/60 px-2 py-1.5"
      title={`${label} · ${item.name}`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-[var(--bg)] ring-1 ring-[var(--line)]">
        {failed ? (
          <span className="font-mono text-[9px] text-foreground-faint">?</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={candidates[srcIdx]}
            alt={item.name}
            className="h-7 w-7 object-contain"
            onError={() => setSrcIdx((i) => i + 1)}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11.5px] text-foreground">{label}</p>
      </div>
      <span className="shrink-0 rounded bg-brand-600/15 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-brand-300">
        ×{num(item.count)}
      </span>
    </div>
  );
}

function PlayerCard({
  title,
  player,
  labels,
  toneClass,
}: {
  title: string;
  player: PlayerSnapshot | null;
  labels: Record<string, string>;
  toneClass: string;
}) {
  if (!player) {
    return (
      <div className="rounded border border-[var(--line)] bg-[var(--bg-2)]/30 p-4">
        <p className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
          {title}
        </p>
        <p className="text-[12.5px] italic text-foreground-faint">Ingen — selvmord, NPC eller miljø</p>
      </div>
    );
  }

  return (
    <div className={`rounded border border-[var(--line)] bg-[var(--bg-2)]/30 p-4 ring-1 ${toneClass}`}>
      <div className="mb-3 flex items-baseline justify-between">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
          {title}
        </p>
        {player.identifier && (
          <Link
            href={`/admin/players/${encodeURIComponent(player.identifier)}`}
            className="font-mono text-[10.5px] text-brand-400 hover:underline"
          >
            spillerprofil →
          </Link>
        )}
      </div>

      <p className="text-[14px] font-medium text-foreground">{player.name || "Ukendt"}</p>
      <p className="font-mono text-[10.5px] text-foreground-muted">
        {player.job ?? "—"}
        {player.jobGrade != null ? ` · grad ${player.jobGrade}` : ""}
      </p>

      <div className="mt-2 grid gap-1 font-mono text-[10.5px] text-foreground-faint">
        {player.discord && <div>discord: <span className="text-foreground-muted">{player.discord}</span></div>}
        {player.license && <div>license: <span className="text-foreground-muted">{player.license.slice(0, 18)}…</span></div>}
        {player.steam && <div>steam: <span className="text-foreground-muted">{player.steam}</span></div>}
        {player.coords && <div>coords: <span className="text-foreground-muted">{player.coords}</span></div>}
      </div>

      {/* Screenshot */}
      <div className="mt-3">
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
          Screenshot
        </p>
        {player.screenshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <a href={player.screenshotUrl} target="_blank" rel="noreferrer">
            <img
              src={player.screenshotUrl}
              alt="screenshot"
              className="w-full rounded border border-[var(--line)] object-cover transition-opacity hover:opacity-90"
            />
          </a>
        ) : (
          <div className="flex h-32 items-center justify-center rounded border border-dashed border-[var(--line)] bg-black/20 text-[11px] text-foreground-faint">
            Intet screenshot
          </div>
        )}
      </div>

      {/* Video (5s clip) */}
      <div className="mt-3">
        <p className="mb-1.5 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
          <span>Video</span>
          {player.videoUrl && (
            <a
              href={player.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-foreground-faint underline-offset-2 hover:underline"
            >
              åbn ↗
            </a>
          )}
        </p>
        {player.videoUrl ? (
          <video
            src={player.videoUrl}
            controls
            preload="metadata"
            playsInline
            className="w-full rounded border border-[var(--line)] bg-black"
          />
        ) : (
          <div className="flex h-24 items-center justify-center rounded border border-dashed border-[var(--line)] bg-black/20 text-[11px] text-foreground-faint">
            Ingen video
          </div>
        )}
      </div>

      {/* Inventory */}
      <div className="mt-4">
        <p className="mb-1.5 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
          <span>Inventar ved død</span>
          <span className="text-foreground-faint">
            {player.inventory ? `${player.inventory.length} slots` : ""}
          </span>
        </p>
        {!player.inventory || player.inventory.length === 0 ? (
          <p className="rounded border border-[var(--line)] bg-black/20 px-3 py-2 text-[11px] italic text-foreground-faint">
            {player.inventory ? "Tom" : "Ikke fanget"}
          </p>
        ) : (
          <div className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto pr-1">
            {player.inventory.map((it, i) => (
              <ItemChip key={`${i}-${it.name}-${it.slot ?? 0}`} item={it} labels={labels} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main view ───────────────────────────────────────────────────────────────

export default function PvpLogsView() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [killerJobs, setKillerJobs] = useState<Set<string>>(new Set());
  const [victimJobs, setVictimJobs] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/items.json")
      .then((r) => r.json())
      .then(setLabels)
      .catch(() => {});
  }, []);

  const load = useCallback(
    async (
      f: TypeFilter,
      q: string,
      p: number,
      kJobs: Set<string>,
      vJobs: Set<string>,
    ) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(p), limit: "50" });
        if (f !== "all") params.set("type", f);
        if (q) params.set("q", q);
        kJobs.forEach((j) => params.append("killerJob", j));
        vJobs.forEach((j) => params.append("victimJob", j));
        const res = await fetch(`/api/admin/pvp-logs?${params}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setData(json as ApiResponse);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Fejl");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(filter, search, page, killerJobs, victimJobs);
  }, [filter, search, page, killerJobs, victimJobs, load]);

  // Auto-ekspander row hvis URL har #pvp-<id>
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    const m = /#pvp-(\d+)/.exec(hash);
    if (m) setExpanded(new Set([Number(m[1])]));
  }, []);

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-5">
      {/* Stats 24h */}
      {data && (
        <div className="grid grid-cols-2 divide-x divide-y divide-[var(--line)] border border-[var(--line)] sm:grid-cols-5 sm:divide-y-0">
          <Stat label="Total 24t" value={num(data.stats24h.total)} />
          <Stat label="PvP-kills" value={num(data.stats24h.pvp)} tone="red" />
          <Stat label="Selvmord" value={num(data.stats24h.suicide)} />
          <Stat label="NPC/miljø" value={num(data.stats24h.npc)} />
          <Stat label="Headshots" value={num(data.stats24h.headshots)} tone="amber" />
        </div>
      )}

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "all" as const, label: "Alle" },
          { key: "pvp" as const, label: "PvP" },
          { key: "suicide" as const, label: "Selvmord" },
          { key: "npc_or_env" as const, label: "NPC / miljø" },
          { key: "environment" as const, label: "Andet" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setFilter(f.key);
              setPage(1);
            }}
            className={`rounded px-3 py-1.5 text-[12px] transition-colors ${
              filter === f.key
                ? "bg-brand-600/20 text-brand-300 ring-1 ring-brand-600/30"
                : "bg-[var(--bg-2)] text-foreground-muted hover:bg-[var(--bg-3)] hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}

        <form
          className="ml-auto flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(input);
            setPage(1);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Navn, weapon, discord:123, license:..."
            className="w-80 rounded border border-[var(--line)] bg-[var(--bg-2)] px-3 py-1.5 text-[12.5px] text-foreground placeholder:text-foreground-faint focus:border-[var(--line-strong)] focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setInput("");
                setSearch("");
                setPage(1);
              }}
              className="rounded border border-[var(--line)] bg-[var(--bg-2)] px-2.5 py-1.5 text-[11.5px] text-foreground-muted hover:text-foreground"
            >
              ryd
            </button>
          )}
        </form>
      </div>

      {/* Job → Job filter */}
      <div className="flex flex-wrap items-center gap-3 rounded border border-[var(--line)] bg-[var(--bg-2)]/40 px-3 py-2.5">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
          Job filter
        </span>
        <JobMultiPicker
          label="Killer-job"
          options={data?.facets?.killerJobs ?? []}
          selected={killerJobs}
          onChange={(s) => {
            setKillerJobs(s);
            setPage(1);
          }}
        />
        <span className="font-mono text-[11px] text-foreground-faint">→ dræber →</span>
        <JobMultiPicker
          label="Offer-job"
          options={data?.facets?.victimJobs ?? []}
          selected={victimJobs}
          onChange={(s) => {
            setVictimJobs(s);
            setPage(1);
          }}
        />
        {(killerJobs.size > 0 || victimJobs.size > 0) && (
          <button
            type="button"
            onClick={() => {
              setKillerJobs(new Set());
              setVictimJobs(new Set());
              setPage(1);
            }}
            className="ml-auto rounded border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1.5 text-[11px] text-foreground-muted hover:text-foreground"
          >
            ryd job-filter
          </button>
        )}
      </div>

      {error && (
        <div className="rounded border border-red-900/50 bg-red-950/20 px-4 py-3 text-[12.5px] text-red-400">
          {error}
        </div>
      )}
      {loading && <p className="py-10 text-center text-[12px] text-foreground-muted">Henter…</p>}

      {!loading && data && data.logs.length === 0 && (
        <p className="py-12 text-center text-[12.5px] text-foreground-muted">
          Ingen PvP-events fundet
          {filter !== "all" ? ` af typen "${filter}"` : ""}
          {search ? ` matchende "${search}"` : ""}.
        </p>
      )}

      {!loading && data && data.logs.length > 0 && (
        <>
          <p className="font-mono text-[11px] text-foreground-muted">
            {num(data.logs.length)} af {num(data.total)} events · side {data.page} af {totalPages}
          </p>

          <div className="overflow-hidden rounded border border-[var(--line)]">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--bg-2)] text-left">
                  <Th className="w-10" />
                  <Th className="w-[140px]">Tid</Th>
                  <Th>Offer</Th>
                  <Th>Killer</Th>
                  <Th className="hidden lg:table-cell">Våben</Th>
                  <Th className="hidden text-right md:table-cell">Distance</Th>
                  <Th className="text-center">Type</Th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((r) => {
                  const isOpen = expanded.has(r.id);
                  return (
                    <React.Fragment key={r.id}>
                      <tr
                        id={`pvp-${r.id}`}
                        className="cursor-pointer border-b border-[var(--line)] last:border-0 hover:bg-[var(--bg-2)]/60"
                        onClick={() => toggle(r.id)}
                      >
                        <td className="px-3 py-2.5 text-center text-foreground-muted">{isOpen ? "▾" : "▸"}</td>
                        <td className="px-3 py-2.5 font-mono text-[11px] tabular-nums text-foreground-muted">
                          <div className="flex items-center gap-2">
                            <span>{fmtDate(typeof r.createdAt === "string" ? r.createdAt : String(r.createdAt))}</span>
                            <KillIcon weaponItem={r.weaponItem} killVehicle={r.killVehicle} />
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-foreground">{r.victim.name ?? "—"}</span>
                          {r.victim.job && (
                            <span className="ml-1.5 font-mono text-[10.5px] text-foreground-faint">
                              · {r.victim.job}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {r.killer ? (
                            <>
                              <span className="text-foreground">{r.killer.name ?? "—"}</span>
                              {r.killer.job && (
                                <span className="ml-1.5 font-mono text-[10.5px] text-foreground-faint">
                                  · {r.killer.job}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="italic text-foreground-faint">—</span>
                          )}
                        </td>
                        <td className="hidden px-3 py-2.5 font-mono text-[11.5px] text-foreground-secondary lg:table-cell">
                          {r.weapon ?? "—"}
                          {r.isHeadshot && (
                            <span className="ml-2 rounded bg-amber-900/30 px-1 py-0.5 text-[9px] font-medium uppercase text-amber-300">
                              HS
                            </span>
                          )}
                        </td>
                        <td className="hidden px-3 py-2.5 text-right font-mono text-[11.5px] tabular-nums text-foreground-secondary md:table-cell">
                          {r.distance != null ? `${r.distance.toFixed(1)} m` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <TypeBadge type={r.deathType} />
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-[var(--line)] bg-[var(--bg-2)]/30">
                          <td colSpan={7} className="px-6 py-5">
                            <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 font-mono text-[11.5px] text-foreground-muted">
                              <span>
                                event <span className="text-foreground">#{r.id}</span>
                              </span>
                              <span>
                                tid <span className="text-foreground">{fmtDate(typeof r.createdAt === "string" ? r.createdAt : String(r.createdAt))}</span>
                              </span>
                              <span>
                                weapon <span className="text-foreground">{r.weapon ?? "?"}</span>
                                {r.weaponHash != null && r.weaponHash !== 0 && (
                                  <span className="text-foreground-faint"> ({r.weaponHash})</span>
                                )}
                              </span>
                              <span>
                                distance <span className="text-foreground">{r.distance != null ? `${r.distance.toFixed(2)} m` : "—"}</span>
                              </span>
                              <span>
                                headshot <span className="text-foreground">{r.isHeadshot ? "ja" : "nej"}</span>
                              </span>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-2">
                              <PlayerCard
                                title="Offer"
                                player={r.victim}
                                labels={labels}
                                toneClass="ring-red-900/30"
                              />
                              <PlayerCard
                                title="Killer"
                                player={r.killer}
                                labels={labels}
                                toneClass="ring-amber-900/30"
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between font-mono text-[11px] text-foreground-muted">
              <span>
                side {data.page} af {totalPages}
              </span>
              <div className="flex gap-2">
                <PageBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  ← forrige
                </PageBtn>
                <PageBtn onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  næste →
                </PageBtn>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Tiny shared ─────────────────────────────────────────────────────────────

function Stat({ label, value, tone }: { label: string; value: string; tone?: "red" | "amber" }) {
  const valueClass = tone === "red" ? "text-red-400" : tone === "amber" ? "text-amber-400" : "text-foreground";
  return (
    <div className="px-5 py-4">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">{label}</p>
      <p className={`mt-1.5 font-mono text-[20px] font-medium tracking-tight ${valueClass}`}>{value}</p>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 font-mono text-[10.5px] font-normal uppercase tracking-[0.12em] text-foreground-faint ${className}`}>
      {children}
    </th>
  );
}

function JobMultiPicker({
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
  const ref = React.useRef<HTMLDivElement>(null);

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

  const summary =
    selected.size === 0
      ? "alle"
      : selected.size === 1
        ? Array.from(selected)[0]
        : `${selected.size} jobs`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded border bg-[var(--bg)] px-3 py-1.5 text-[12px] transition-colors ${
          selected.size > 0
            ? "border-brand-600/40 text-foreground"
            : "border-[var(--line)] text-foreground-muted hover:text-foreground"
        }`}
      >
        <span className="font-mono text-[10px] uppercase tracking-wider text-foreground-faint">
          {label}:
        </span>
        <span>{summary}</span>
        {selected.size > 0 && (
          <span className="rounded bg-brand-600/20 px-1.5 py-0.5 font-mono text-[10px] text-brand-300">
            {selected.size}
          </span>
        )}
        <span className="font-mono text-[10px] text-foreground-faint">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded border border-[var(--line)] bg-[var(--bg)] shadow-xl">
          <div className="border-b border-[var(--line)] p-2">
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Søg job…"
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
                {options.length === 0 ? "Ingen jobs i log endnu" : "Ingen match"}
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
