"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "./Markdown";

type JobStatus = "queued" | "running" | "done" | "error";

interface Investigation {
  id: string;
  question: string;
  status: JobStatus;
  output: string;
  error?: string;
}

interface SharedItem {
  id: string;
  question: string;
  status: JobStatus;
  askedBy: string;
  submittedAt: number | null;
  finishedAt: number | null;
}

function timeAgo(ts: number | null): string {
  if (!ts) return "";
  const d = Math.max(0, Date.now() - ts);
  const m = Math.floor(d / 60000);
  if (m < 1) return "lige nu";
  if (m < 60) return `${m} min siden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} t siden`;
  return `${Math.floor(h / 24)} d siden`;
}

const EXAMPLES = [
  "Hvem er de 10 rigeste spillere lige nu, og hvordan har de tjent pengene?",
  "Har nogen farmet coke_pooch mere end 15 ad gangen? Vis discord-tags og mængde.",
  "Undersøg spilleren Noah Hebo — hvor kommer hans penge fra?",
  "Er der nogen der har spammet smuggler-events eller kørt trigger-loops?",
  "Hvilke konti har fået store sorte penge uden en logget kilde?",
];

const POLL_MS = 2500;
const TERMINAL: JobStatus[] = ["done", "error"];

export default function DetectiveView() {
  const [question, setQuestion] = useState("");
  const [current, setCurrent] = useState<Investigation | null>(null);
  const [shared, setShared] = useState<SharedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reuse, setReuse] = useState<{ by: string; at: number | null } | null>(null);
  const [lastQ, setLastQ] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadShared = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/detective?list=1", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.items)) setShared(data.items as SharedItem[]);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadShared();
  }, [loadShared]);

  // Åbn en tidligere (delt) undersøgelse og vis dens fulde rapport.
  const openShared = useCallback(
    async (item: SharedItem) => {
      setCurrent({ id: item.id, question: item.question, status: item.status, output: "" });
      try {
        const res = await fetch(`/api/admin/detective?id=${encodeURIComponent(item.id)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const job = await res.json();
        setCurrent({
          id: item.id,
          question: item.question,
          status: job.status as JobStatus,
          output: job.output ?? "",
          error: job.error,
        });
      } catch {
        // ignore
      }
    },
    [],
  );

  const running = current != null && !TERMINAL.includes(current.status);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const poll = useCallback(
    (id: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/admin/detective?id=${encodeURIComponent(id)}`, {
            cache: "no-store",
          });
          if (!res.ok) return;
          const job = await res.json();
          setCurrent((prev) =>
            prev && prev.id === id
              ? {
                  ...prev,
                  status: job.status as JobStatus,
                  output: job.output ?? prev.output,
                  error: job.error,
                }
              : prev,
          );
          if (TERMINAL.includes(job.status)) {
            stopPolling();
            loadShared();
          }
        } catch {
          // transient — keep polling
        }
      }, POLL_MS);
    },
    [stopPolling, loadShared],
  );

  const run = useCallback(
    async (q: string, force: boolean) => {
      q = q.trim();
      if (!q || running) return;
      setError(null);
      setReuse(null);
      setLastQ(q);
      try {
        const res = await fetch("/api/admin/detective", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, force }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? "Kunne ikke starte undersøgelsen.");
          return;
        }
        setQuestion("");
        if (data.reused) {
          // Token-besparelse: samme spørgsmål er allerede besvaret ≤12t siden —
          // vis det eksisterende svar med det samme i stedet for at køre nyt job.
          setReuse({ by: data.reusedBy ?? "?", at: data.reusedAt ?? null });
          await openShared({
            id: data.id,
            question: q,
            status: "done",
            askedBy: data.reusedBy ?? "?",
            submittedAt: data.reusedAt ?? null,
            finishedAt: data.reusedAt ?? null,
          });
          return;
        }
        setCurrent({ id: data.id, question: q, status: "queued", output: "" });
        poll(data.id);
      } catch {
        setError("Netværksfejl — prøv igen.");
      }
    },
    [running, poll, openShared],
  );

  const submit = useCallback(() => run(question, false), [run, question]);

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-4">
        <p className="text-[13px] text-foreground-secondary">
          Skriv hvad du vil have undersøgt, så graver <span className="text-foreground">Detektiven</span>{" "}
          i databasen (<span className="font-mono text-[12px]">kun læsning</span>) og skriver en rapport —
          fx hvem der har snydt, hvor penge kommer fra, eller hvad en bestemt spiller har lavet.
        </p>
        <p className="mt-2 text-[11.5px] text-foreground-faint">
          Detektiven kan kun læse data — den kan ikke ændre, slette, banne eller røre serveren.
        </p>
      </div>

      {/* Input */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-1)] p-4">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          rows={3}
          placeholder="Fx: Undersøg om nogen har dupet coke_pooch og hvem der har modtaget det…"
          disabled={running}
          className="w-full resize-y rounded-md border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2 text-[14px] text-foreground placeholder:text-foreground-faint focus:border-brand-500 focus:outline-none disabled:opacity-60"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[11px] text-foreground-faint">⌘/Ctrl + Enter for at sende</span>
          <button
            onClick={submit}
            disabled={running || !question.trim()}
            className="rounded-md bg-brand-600 px-4 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running ? "Undersøger…" : "Undersøg"}
          </button>
        </div>

        {/* Eksempler */}
        {!current && (
          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setQuestion(ex)}
                className="rounded-full border border-[var(--line)] px-3 py-1 text-[11.5px] text-foreground-muted transition-colors hover:border-brand-500/50 hover:text-foreground-secondary"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-[13px] text-red-300">
          {error}
        </div>
      )}

      {/* Genbrugt svar (token-besparelse) */}
      {reuse && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-brand-500/30 bg-brand-500/5 px-3 py-2 text-[12.5px] text-foreground-secondary">
          <span>
            ♻️ Samme spørgsmål blev besvaret {timeAgo(reuse.at)} af{" "}
            <span className="text-foreground">{reuse.by}</span> — viser det svar (sparer tokens).
          </span>
          <button
            onClick={() => run(lastQ, true)}
            disabled={running}
            className="shrink-0 rounded-md border border-[var(--line)] px-2.5 py-1 text-[11.5px] text-foreground-muted transition-colors hover:border-brand-500/50 hover:text-foreground-secondary disabled:opacity-40"
          >
            Undersøg igen
          </button>
        </div>
      )}

      {/* Aktiv undersøgelse */}
      {current && <ResultCard inv={current} running={running} />}

      {/* Delt historik — alle staff ser hvad der er spurgt og svaret om */}
      {shared.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-foreground-faint">
              Delte undersøgelser · alle staff
            </p>
            <button
              onClick={loadShared}
              className="font-mono text-[10.5px] text-foreground-faint transition-colors hover:text-foreground-secondary"
            >
              ↻ opdatér
            </button>
          </div>
          <div className="divide-y divide-[var(--line)] overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg-1)]">
            {shared.map((item) => {
              const active = current?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => openShared(item)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--bg-2)] ${
                    active ? "bg-[var(--bg-2)]" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-foreground">{item.question}</p>
                    <p className="mt-0.5 text-[11px] text-foreground-faint">
                      {item.askedBy} · {timeAgo(item.finishedAt ?? item.submittedAt)}
                    </p>
                  </div>
                  <StatusBadge status={item.status} running={false} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultCard({
  inv,
  running,
  collapsed = false,
}: {
  inv: Investigation;
  running: boolean;
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(!collapsed);

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-1)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-[13.5px] text-foreground">{inv.question}</span>
        <StatusBadge status={inv.status} running={running} />
      </button>
      {open && (
        <div className="border-t border-[var(--line)] px-4 py-3">
          {inv.status === "error" ? (
            <p className="text-[13px] text-red-300">{inv.error ?? "Undersøgelsen fejlede."}</p>
          ) : inv.output ? (
            <div className="max-h-[70vh] overflow-auto pr-1">
              <Markdown>{inv.output}</Markdown>
            </div>
          ) : running ? (
            <p className="text-[13px] text-foreground-muted">Detektiven undersøger databasen…</p>
          ) : (
            <p className="text-[13px] text-foreground-muted">Ingen output.</p>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, running }: { status: JobStatus; running: boolean }) {
  const map: Record<JobStatus, { label: string; cls: string }> = {
    queued: { label: "I kø…", cls: "text-amber-300 border-amber-400/30" },
    running: { label: "Undersøger…", cls: "text-amber-300 border-amber-400/30" },
    done: { label: "Færdig", cls: "text-emerald-300 border-emerald-400/30" },
    error: { label: "Fejl", cls: "text-red-300 border-red-400/30" },
  };
  const s = map[status] ?? map.queued;
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10.5px] ${s.cls} ${
        running ? "animate-pulse" : ""
      }`}
    >
      {s.label}
    </span>
  );
}
