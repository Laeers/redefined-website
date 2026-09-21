"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type OnlinePlayer = {
  serverId: number;
  name: string;
  identifier?: string;
  job?: string;
  watching?: boolean;
};

type LiveClip = { url: string; ts: number; seq: number };

type WatchResult = {
  ok: boolean;
  online?: boolean;
  clips?: LiveClip[];
  clipMs?: number;
  error?: string;
  max?: number;
};

const ONLINE_POLL_MS = 5000;
const WATCH_POLL_MS = 2500;
const FADE_MS = 500;

export default function AdminLiveScreen() {
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OnlinePlayer | null>(null);
  const [status, setStatus] = useState<string>("");
  const [hasVideo, setHasVideo] = useState(false);

  // Søgning / filter
  const [query, setQuery] = useState("");
  const [jobFilter, setJobFilter] = useState("");

  const selectedRef = useRef<OnlinePlayer | null>(null);
  selectedRef.current = selected;

  // ── Dobbelt-buffer video (crossfade, ingen sort blink) ─────────────────────
  const videosRef = useRef<Array<HTMLVideoElement | null>>([null, null]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(0); // hvilken buffer der vises
  const visibleRef = useRef(0);
  visibleRef.current = visible;

  const loadedRef = useRef<Array<string | null>>([null, null]); // url i hver buffer
  const queueRef = useRef<string[]>([]);
  const enqueuedRef = useRef<Set<number>>(new Set());
  const startedRef = useRef(false);
  const frozenRef = useRef(false); // sidste klip slut, intet næste klar → frys sidste frame

  const assign = useCallback((idx: number, url: string) => {
    const v = videosRef.current[idx];
    if (!v) return;
    loadedRef.current[idx] = url;
    v.src = url;
    v.load();
  }, []);

  const resetPlayback = useCallback(() => {
    queueRef.current = [];
    enqueuedRef.current = new Set();
    startedRef.current = false;
    frozenRef.current = false;
    loadedRef.current = [null, null];
    visibleRef.current = 0;
    setVisible(0);
    setHasVideo(false);
    for (const v of videosRef.current) {
      if (v) {
        v.removeAttribute("src");
        v.load();
      }
    }
  }, []);

  // Koordinator: starter afspilning, preloader næste klip, og håndterer "frys".
  const coordinate = useCallback(() => {
    const vis = visibleRef.current;
    const other = vis ^ 1;

    // Start første klip på den synlige buffer.
    if (!startedRef.current && !loadedRef.current[vis] && queueRef.current.length) {
      const url = queueRef.current.shift()!;
      assign(vis, url);
      videosRef.current[vis]?.play().catch(() => {});
      startedRef.current = true;
      setHasVideo(true);
      setStatus("");
    }

    // Preload næste klip i den skjulte buffer.
    if (startedRef.current && !loadedRef.current[other] && queueRef.current.length) {
      assign(other, queueRef.current.shift()!);
    }

    // Hvis vi frøs (forrige klip slut uden næste) og der nu er et klip klar → skift.
    if (frozenRef.current && loadedRef.current[other]) {
      frozenRef.current = false;
      videosRef.current[other]?.play().catch(() => {});
      loadedRef.current[vis] = null;
      visibleRef.current = other;
      setVisible(other);
      setStatus("");
      // Genindlæs den gamle buffer efter faden, så den fading-out video ikke flimrer.
      window.setTimeout(() => coordinate(), FADE_MS + 50);
    }
  }, [assign]);

  const onEnded = useCallback(
    (idx: number) => {
      if (idx !== visibleRef.current) return;
      const other = idx ^ 1;
      if (loadedRef.current[other]) {
        // Næste klip er preloadet → crossfade til det.
        videosRef.current[other]?.play().catch(() => {});
        visibleRef.current = other;
        setVisible(other);
        // Ryd + preload næste i den gamle buffer FØRST efter faden (undgå flimmer).
        window.setTimeout(() => {
          loadedRef.current[idx] = null;
          coordinate();
        }, FADE_MS + 50);
      } else {
        // Intet klar → frys på sidste frame (ingen sort), vent på næste.
        frozenRef.current = true;
        setStatus("Venter på næste klip…");
      }
    },
    [coordinate],
  );

  // ── Online-liste (poll) ────────────────────────────────────────────────────
  const loadOnline = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/livescreen/online", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "fejl");
      setPlayers(j.players ?? []);
      setOnlineError(null);
    } catch (e) {
      setOnlineError(e instanceof Error ? e.message : "Kunne ikke hente online-liste");
    }
  }, []);

  useEffect(() => {
    loadOnline();
    const id = setInterval(loadOnline, ONLINE_POLL_MS);
    return () => clearInterval(id);
  }, [loadOnline]);

  // ── Klip-poll for valgt spiller ────────────────────────────────────────────
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      const sid = selectedRef.current?.serverId;
      if (!sid) return;
      try {
        const res = await fetch("/api/admin/livescreen/watch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ serverId: sid }),
        });
        const j: WatchResult = await res.json();
        if (cancelled) return;
        if (!res.ok || !j.ok) {
          if (j.error === "player_offline") setStatus("Spilleren er offline.");
          else if (j.error === "max_watched")
            setStatus(`Maks. antal samtidige live-views nået (${j.max}).`);
          else setStatus(j.error ?? "Kunne ikke hente video.");
          return;
        }
        const clips = (j.clips ?? []).slice().sort((a, b) => a.seq - b.seq);
        let added = false;
        for (const c of clips) {
          if (!enqueuedRef.current.has(c.seq)) {
            enqueuedRef.current.add(c.seq);
            queueRef.current.push(c.url);
            added = true;
          }
        }
        if (added) coordinate();
        else if (!startedRef.current)
          setStatus("Optager første klip… (få sekunders forsinkelse)");
      } catch {
        if (!cancelled) setStatus("Forbindelse til spilserveren fejlede.");
      }
    };

    poll();
    const id = setInterval(poll, WATCH_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selected, coordinate]);

  const open = (p: OnlinePlayer) => {
    resetPlayback();
    setStatus("Starter live-view…");
    setSelected(p);
  };

  const stopWatchBeacon = (sid: number, keepalive = false) => {
    fetch("/api/admin/livescreen/watch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ serverId: sid, stop: true }),
      keepalive,
    }).catch(() => {});
  };

  const close = useCallback(() => {
    const sid = selectedRef.current?.serverId;
    if (sid) stopWatchBeacon(sid);
    setSelected(null);
    resetPlayback();
    setStatus("");
  }, [resetPlayback]);

  useEffect(() => {
    return () => {
      const sid = selectedRef.current?.serverId;
      if (sid) stopWatchBeacon(sid, true);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  // ── Søgning / job-filter ─────────────────────────────────────────────────
  const jobs = useMemo(() => {
    const set = new Set<string>();
    for (const p of players) if (p.job) set.add(p.job);
    return Array.from(set).sort();
  }, [players]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players.filter((p) => {
      if (jobFilter && p.job !== jobFilter) return false;
      if (!q) return true;
      return (
        String(p.serverId).includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.identifier?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [players, query, jobFilter]);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[300px_1fr]">
      {/* Online-liste + søgning/filter */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-foreground-muted">
            Online ({filtered.length}/{players.length})
          </h2>
          <button
            onClick={loadOnline}
            className="text-[11px] text-foreground-muted hover:text-foreground"
          >
            Opdatér
          </button>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søg ID, navn eller identifier…"
          className="mb-2 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[13px] text-foreground placeholder:text-foreground-muted/60 focus:border-white/25 focus:outline-none"
        />
        <select
          value={jobFilter}
          onChange={(e) => setJobFilter(e.target.value)}
          className="mb-3 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[13px] text-foreground focus:border-white/25 focus:outline-none"
        >
          <option value="">Alle jobs</option>
          {jobs.map((j) => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </select>

        {onlineError && <p className="mb-2 text-[12px] text-red-400">{onlineError}</p>}
        <ul className="max-h-[65vh] space-y-1 overflow-y-auto">
          {filtered.map((p) => (
            <li key={p.serverId}>
              <button
                onClick={() => open(p)}
                className={`flex w-full flex-col rounded-md px-2 py-1.5 text-left transition ${
                  selected?.serverId === p.serverId ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <span className="text-[13px] text-foreground">{p.name}</span>
                <span className="text-[11px] text-foreground-muted">
                  ID {p.serverId}
                  {p.job ? ` · ${p.job}` : ""}
                </span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && !onlineError && (
            <li className="px-2 py-1 text-[12px] text-foreground-muted">
              {players.length === 0 ? "Ingen spillere online." : "Ingen match."}
            </li>
          )}
        </ul>
      </div>

      {/* Viewer */}
      <div className="rounded-lg border border-white/10 bg-black/40 p-3">
        {!selected ? (
          <div className="flex h-[60vh] items-center justify-center text-[13px] text-foreground-muted">
            Vælg en spiller til venstre for at se deres skærm.
          </div>
        ) : (
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-semibold text-foreground">
                  {selected.name}{" "}
                  <span className="text-[12px] font-normal text-foreground-muted">
                    (ID {selected.serverId})
                  </span>
                </h2>
                {selected.identifier && (
                  <p className="truncate font-mono text-[11px] text-foreground-muted">
                    {selected.identifier}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={toggleFullscreen}
                  className="rounded-md bg-white/10 px-3 py-1.5 text-[12px] text-foreground hover:bg-white/20"
                >
                  Fullscreen
                </button>
                <button
                  onClick={close}
                  className="rounded-md bg-white/10 px-3 py-1.5 text-[12px] text-foreground hover:bg-white/20"
                >
                  Luk
                </button>
              </div>
            </div>

            <div
              ref={containerRef}
              className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-md bg-black"
            >
              {[0, 1].map((i) => (
                <video
                  key={i}
                  ref={(el) => {
                    videosRef.current[i] = el;
                  }}
                  muted
                  playsInline
                  onEnded={() => onEnded(i)}
                  className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-500 ${
                    visible === i && hasVideo ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))}
              {!hasVideo && (
                <span className="z-10 px-4 text-center text-[13px] text-foreground-muted">
                  {status || "Indlæser…"}
                </span>
              )}
              <button
                onClick={toggleFullscreen}
                title="Fullscreen"
                className="absolute bottom-2 right-2 z-10 rounded-md bg-black/50 px-2 py-1 text-[11px] text-white/90 hover:bg-black/70"
              >
                ⛶
              </button>
            </div>

            {hasVideo && status && (
              <p className="mt-2 text-[11px] text-foreground-muted">{status}</p>
            )}
            <p className="mt-1 text-[11px] text-foreground-muted/70">
              Video sammensættes af korte klip (få sekunders forsinkelse). Optagelse
              kører kun mens dette view er åbent. Visningen logges i admin-loggen.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
