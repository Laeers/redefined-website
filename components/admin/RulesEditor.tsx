"use client";

import { useState, useCallback } from "react";
import RulesMarkdown from "@/components/RulesMarkdown";
import type { RuleSection, RulesMeta } from "@/lib/rules";

type Section = RuleSection;

const inputCls =
  "w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[14px] text-foreground outline-none focus:border-brand-500/60";
const labelCls =
  "block font-mono text-[10px] uppercase tracking-[0.2em] text-foreground-faint mb-1.5";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-50";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded-md border border-[var(--line-strong)] px-3 py-2 text-[13px] font-medium text-foreground-secondary transition-colors hover:text-foreground disabled:opacity-40";

export default function RulesEditor({
  initialSections,
  initialMeta,
}: {
  initialSections: Section[];
  initialMeta: RulesMeta;
  editor: string;
}) {
  const [sections, setSections] = useState<Section[]>(initialSections);
  const [meta, setMeta] = useState<RulesMeta>(initialMeta);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/rules", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setSections(data.sections);
      setMeta(data.meta);
    }
  }, []);

  const saveMeta = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/rules/meta", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meta),
      });
      if (!res.ok) setError((await res.json()).error ?? "Kunne ikke gemme header.");
    } finally {
      setBusy(false);
    }
  }, [meta]);

  const saveSection = useCallback(
    async (s: Section) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/rules/${s.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(s),
        });
        if (!res.ok) {
          setError((await res.json()).error ?? "Kunne ikke gemme sektionen.");
        } else {
          await refresh();
        }
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const deleteSection = useCallback(
    async (id: number) => {
      if (!confirm("Slet denne sektion permanent?")) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/rules/${id}`, { method: "DELETE" });
        if (!res.ok) setError((await res.json()).error ?? "Kunne ikke slette.");
        else await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const addSection = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nav_label: "Ny sektion",
          eyebrow: "Ny sektion",
          title: "Ny sektion",
          body: "Skriv reglen her. Brug **fed** og lister med bindestreg.",
          is_published: false,
        }),
      });
      if (!res.ok) setError((await res.json()).error ?? "Kunne ikke oprette.");
      else await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const move = useCallback(
    async (index: number, dir: -1 | 1) => {
      const next = index + dir;
      if (next < 0 || next >= sections.length) return;
      const reordered = [...sections];
      const [item] = reordered.splice(index, 1);
      reordered.splice(next, 0, item);
      setSections(reordered);
      setBusy(true);
      try {
        await fetch("/api/admin/rules/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: reordered.map((s) => s.id) }),
        });
      } finally {
        setBusy(false);
      }
    },
    [sections]
  );

  const patch = (id: number, p: Partial<Section>) =>
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)));

  return (
    <div className="space-y-8">
      {error ? (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-[13px] text-red-300">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <a href="/regler" target="_blank" rel="noreferrer" className={btnGhost}>
          Se /regler →
        </a>
        <button onClick={addSection} disabled={busy} className={btnPrimary}>
          + Tilføj sektion
        </button>
      </div>

      {/* SIDE-HEADER */}
      <section className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-5">
        <h2 className="mb-4 text-[15px] font-semibold text-foreground">
          Side-header
        </h2>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Eyebrow</label>
            <input
              className={inputCls}
              value={meta.page_eyebrow}
              onChange={(e) => setMeta({ ...meta, page_eyebrow: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Titel</label>
            <input
              className={inputCls}
              value={meta.page_title}
              onChange={(e) => setMeta({ ...meta, page_title: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Beskrivelse</label>
            <textarea
              className={`${inputCls} min-h-[80px] resize-y`}
              value={meta.page_description}
              onChange={(e) =>
                setMeta({ ...meta, page_description: e.target.value })
              }
            />
          </div>
        </div>
        <div className="mt-4">
          <button onClick={saveMeta} disabled={busy} className={btnPrimary}>
            Gem header
          </button>
        </div>
      </section>

      {/* SEKTIONER */}
      <div className="space-y-6">
        {sections.map((s, i) => (
          <section
            key={s.id}
            className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] tracking-wider text-foreground-faint">
                #{String(i + 1).padStart(2, "0")} · /regler#{s.slug}
                {s.is_published ? "" : " · (skjult)"}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => move(i, -1)}
                  disabled={busy || i === 0}
                  className={btnGhost}
                  title="Flyt op"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={busy || i === sections.length - 1}
                  className={btnGhost}
                  title="Flyt ned"
                >
                  ↓
                </button>
                <button
                  onClick={() => deleteSection(s.id)}
                  disabled={busy}
                  className="inline-flex items-center rounded-md border border-red-500/40 px-3 py-2 text-[13px] font-medium text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-40"
                >
                  Slet
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Menu-label (indholdsfortegnelse)</label>
                <input
                  className={inputCls}
                  value={s.nav_label}
                  onChange={(e) => patch(s.id, { nav_label: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Slug (anker i URL)</label>
                <input
                  className={inputCls}
                  value={s.slug}
                  onChange={(e) => patch(s.id, { slug: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Eyebrow</label>
                <input
                  className={inputCls}
                  value={s.eyebrow}
                  onChange={(e) => patch(s.id, { eyebrow: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Titel</label>
                <input
                  className={inputCls}
                  value={s.title}
                  onChange={(e) => patch(s.id, { title: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div>
                <label className={labelCls}>Indhold (Markdown)</label>
                <textarea
                  className={`${inputCls} min-h-[220px] resize-y font-mono text-[12.5px] leading-relaxed`}
                  value={s.body}
                  onChange={(e) => patch(s.id, { body: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Forhåndsvisning</label>
                <div className="min-h-[220px] rounded-md border border-[var(--line)] bg-[var(--bg)] p-4 text-[14px] leading-[1.7] text-foreground-secondary [&>*+*]:mt-4">
                  <RulesMarkdown>{s.body}</RulesMarkdown>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-[13px] text-foreground-secondary">
                <input
                  type="checkbox"
                  checked={s.is_published}
                  onChange={(e) => patch(s.id, { is_published: e.target.checked })}
                  className="h-4 w-4 accent-brand-600"
                />
                Synlig på /regler
              </label>
              <button
                onClick={() => saveSection(s)}
                disabled={busy}
                className={btnPrimary}
              >
                Gem sektion
              </button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
