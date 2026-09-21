"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface KomItem {
  name: string;
  count: number;
}

interface KomRow {
  id: number;
  targetDiscordId: string;
  targetDiscordTag: string | null;
  targetIdentifier: string | null;
  recipientName: string | null;
  items: KomItem[];
  reason: string | null;
  status: "pending" | "given" | "cancelled";
  createdByDiscordId: string;
  createdByTag: string | null;
  channelId: string | null;
  channelName: string | null;
  createdAt: string | null;
  givenAt: string | null;
  failureReason: string | null;
}

// Discord-tag kan komme i to formater:
//   - moderne: "username" eller "display_name"  (uden discriminator)
//   - legacy: "username#1234"
// Vi viser bare hvad der står i db'en, men trimmer "#0" (Discord skjuler nu).
function fmtDiscordTag(tag: string | null): string | null {
  if (!tag) return null;
  return tag.endsWith("#0") ? tag.slice(0, -2) : tag;
}

interface ApiResponse {
  total: number;
  limit: number;
  offset: number;
  statusCounts: Record<string, number>;
  rows: KomRow[];
}

type StatusFilter = "all" | "pending" | "given" | "cancelled";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function num(n: number) {
  return n.toLocaleString("da-DK");
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("da-DK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ox_inventory image-mapping: filerne på /items/<name>.png er typisk lowercase,
// men WEAPON_* har historisk uppercase varianter — vi prøver begge.
function itemImageCandidates(name: string): string[] {
  const lower = name.toLowerCase();
  if (lower === name) {
    return [`/items/${name}.png`];
  }
  return [`/items/${name}.png`, `/items/${lower}.png`];
}

// ─── Item display ────────────────────────────────────────────────────────────

function ItemChip({
  item,
  labels,
}: {
  item: KomItem;
  labels: Record<string, string>;
}) {
  const candidates = useMemo(() => itemImageCandidates(item.name), [item.name]);
  const [srcIdx, setSrcIdx] = useState(0);
  const label = labels[item.name] || item.name;
  const failed = srcIdx >= candidates.length;

  return (
    <div className="flex items-center gap-2.5 rounded border border-[var(--line)] bg-[var(--bg-2)]/50 px-2.5 py-1.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-[var(--bg)] ring-1 ring-[var(--line)]">
        {failed ? (
          <span className="font-mono text-[9px] uppercase tracking-tight text-foreground-faint">
            ?
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={candidates[srcIdx]}
            alt={item.name}
            className="h-8 w-8 object-contain"
            onError={() => setSrcIdx((i) => i + 1)}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] text-foreground" title={label}>
          {label}
        </p>
        <p className="font-mono text-[10px] text-foreground-faint">{item.name}</p>
      </div>
      <span className="shrink-0 rounded bg-brand-600/15 px-1.5 py-0.5 font-mono text-[11.5px] font-medium tabular-nums text-brand-300">
        ×{num(item.count)}
      </span>
    </div>
  );
}

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: KomRow["status"] }) {
  const map: Record<KomRow["status"], { label: string; cls: string }> = {
    pending: {
      label: "Afventer",
      cls: "bg-amber-900/30 text-amber-400 ring-amber-900/40",
    },
    given: {
      label: "Modtaget",
      cls: "bg-emerald-900/30 text-emerald-400 ring-emerald-900/40",
    },
    cancelled: {
      label: "Annulleret",
      cls: "bg-zinc-900/30 text-zinc-400 ring-zinc-700/40",
    },
  };
  const m = map[status];
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ring-1 ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

// ─── Main view ───────────────────────────────────────────────────────────────

export default function KompensationerView() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch("/items.json")
      .then((r) => r.json())
      .then(setLabels)
      .catch(() => {});
  }, []);

  const load = useCallback(async (f: StatusFilter, q: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (f !== "all") params.set("status", f);
      if (q) params.set("q", q);
      const res = await fetch(`/api/admin/kompensationer?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json as ApiResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fejl");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter, search);
  }, [filter, search, load]);

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const counts = data?.statusCounts ?? { pending: 0, given: 0, cancelled: 0 };

  return (
    <div className="space-y-5">
      {/* Filter / search */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "all" as const, label: "Alle" },
          { key: "pending" as const, label: `Afventer (${counts.pending ?? 0})` },
          { key: "given" as const, label: `Modtaget (${counts.given ?? 0})` },
          {
            key: "cancelled" as const,
            label: `Annulleret (${counts.cancelled ?? 0})`,
          },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
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
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Søg på ID, modtager, kanal, årsag…"
            className="w-72 rounded border border-[var(--line)] bg-[var(--bg-2)] px-3 py-1.5 text-[12.5px] text-foreground placeholder:text-foreground-faint focus:border-[var(--line-strong)] focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setInput("");
                setSearch("");
              }}
              className="rounded border border-[var(--line)] bg-[var(--bg-2)] px-2.5 py-1.5 text-[11.5px] text-foreground-muted hover:text-foreground"
            >
              ryd
            </button>
          )}
        </form>
      </div>

      {error && (
        <div className="rounded border border-red-900/50 bg-red-950/20 px-4 py-3 text-[12.5px] text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <p className="py-12 text-center text-[12px] text-foreground-muted">Henter…</p>
      )}

      {!loading && data && data.rows.length === 0 && (
        <p className="py-12 text-center text-[12.5px] text-foreground-muted">
          Ingen kompensationssager fundet
          {filter !== "all" ? ` med status "${filter}"` : ""}
          {search ? ` matchende "${search}"` : ""}.
        </p>
      )}

      {!loading && data && data.rows.length > 0 && (
        <>
          <p className="font-mono text-[11px] text-foreground-muted">
            {num(data.rows.length)} af {num(data.total)} sager
          </p>

          <div className="overflow-hidden rounded border border-[var(--line)]">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--bg-2)] text-left">
                  <th className="w-12 px-3 py-2.5 font-mono text-[10.5px] font-normal uppercase tracking-[0.12em] text-foreground-faint" />
                  <th className="w-14 px-3 py-2.5 font-mono text-[10.5px] font-normal uppercase tracking-[0.12em] text-foreground-faint">
                    ID
                  </th>
                  <th className="px-3 py-2.5 font-mono text-[10.5px] font-normal uppercase tracking-[0.12em] text-foreground-faint">
                    Modtager
                  </th>
                  <th className="px-3 py-2.5 font-mono text-[10.5px] font-normal uppercase tracking-[0.12em] text-foreground-faint">
                    Oprettet af
                  </th>
                  <th className="px-3 py-2.5 text-right font-mono text-[10.5px] font-normal uppercase tracking-[0.12em] text-foreground-faint">
                    Items
                  </th>
                  <th className="px-3 py-2.5 font-mono text-[10.5px] font-normal uppercase tracking-[0.12em] text-foreground-faint">
                    Kanal
                  </th>
                  <th className="px-3 py-2.5 text-center font-mono text-[10.5px] font-normal uppercase tracking-[0.12em] text-foreground-faint">
                    Status
                  </th>
                  <th className="px-3 py-2.5 text-right font-mono text-[10.5px] font-normal uppercase tracking-[0.12em] text-foreground-faint">
                    Oprettet
                  </th>
                  <th className="px-3 py-2.5 text-right font-mono text-[10.5px] font-normal uppercase tracking-[0.12em] text-foreground-faint">
                    Modtaget
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const isOpen = expanded.has(r.id);
                  const itemCount = r.items.reduce((s, it) => s + it.count, 0);
                  const recipientDiscord = fmtDiscordTag(r.targetDiscordTag);
                  const creatorDiscord = fmtDiscordTag(r.createdByTag);
                  return (
                    <React.Fragment key={r.id}>
                      <tr
                        className="cursor-pointer border-b border-[var(--line)] last:border-0 hover:bg-[var(--bg-2)]/60"
                        onClick={() => toggle(r.id)}
                      >
                        <td className="px-3 py-2.5 text-center text-foreground-muted">
                          {isOpen ? "▾" : "▸"}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[12px] text-foreground-secondary">
                          #{r.id}
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <div className="text-foreground">
                            {r.recipientName ? (
                              <>{r.recipientName}</>
                            ) : recipientDiscord ? (
                              <>{recipientDiscord}</>
                            ) : (
                              <span className="italic text-foreground-faint">Ikke claimet endnu</span>
                            )}
                          </div>
                          {(recipientDiscord || r.targetDiscordId) && (
                            <div className="mt-0.5 flex items-baseline gap-1.5 font-mono text-[10.5px] leading-snug">
                              {recipientDiscord && (
                                <span className="text-foreground-muted">@{recipientDiscord}</span>
                              )}
                              <span className="text-foreground-faint">{r.targetDiscordId}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <div className="text-foreground-secondary">
                            {creatorDiscord || r.createdByDiscordId}
                          </div>
                          <div className="mt-0.5 font-mono text-[10.5px] leading-snug text-foreground-faint">
                            {r.createdByDiscordId}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right align-top text-foreground-secondary">
                          <span className="font-mono text-[12px] tabular-nums">
                            {r.items.length}
                          </span>
                          <span className="ml-1 text-foreground-faint">· {num(itemCount)} stk.</span>
                        </td>
                        <td className="px-3 py-2.5 align-top font-mono text-[11.5px] text-foreground-muted">
                          {r.channelName ? `#${r.channelName}` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center align-top">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-3 py-2.5 text-right align-top font-mono text-[11px] text-foreground-muted">
                          {fmtDate(r.createdAt)}
                        </td>
                        <td className="px-3 py-2.5 text-right align-top font-mono text-[11px] text-foreground-muted">
                          {fmtDate(r.givenAt)}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-[var(--line)] bg-[var(--bg-2)]/40">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
                              {/* Items */}
                              <div>
                                <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
                                  Indhold ({r.items.length} item
                                  {r.items.length === 1 ? "" : "s"} · {num(itemCount)} stk.)
                                </p>
                                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                                  {r.items.map((it, i) => (
                                    <ItemChip
                                      key={`${r.id}-${i}-${it.name}`}
                                      item={it}
                                      labels={labels}
                                    />
                                  ))}
                                </div>
                              </div>

                              {/* Metadata */}
                              <div className="space-y-3 text-[12px]">
                                {r.reason && (
                                  <div>
                                    <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
                                      Begrundelse
                                    </p>
                                    <p className="mt-0.5 whitespace-pre-wrap text-foreground-secondary">
                                      {r.reason}
                                    </p>
                                  </div>
                                )}
                                {r.targetIdentifier && (
                                  <div>
                                    <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
                                      Modtager identifier
                                    </p>
                                    <p className="mt-0.5 font-mono text-[10.5px] text-foreground-muted">
                                      {r.targetIdentifier}
                                    </p>
                                  </div>
                                )}
                                {r.failureReason && (
                                  <div>
                                    <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
                                      Sidste fejl
                                    </p>
                                    <p className="mt-0.5 text-amber-400">{r.failureReason}</p>
                                  </div>
                                )}
                                {!r.reason && !r.targetIdentifier && !r.failureReason && (
                                  <p className="italic text-foreground-faint">
                                    Ingen ekstra metadata.
                                  </p>
                                )}
                              </div>
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
        </>
      )}
    </div>
  );
}
