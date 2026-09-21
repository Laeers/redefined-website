"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Application } from "@/lib/applications-types";

type FormState = {
  age: string;
  steamHours: string;
  realName: string;
  charName: string;
  charBackstory: string;
  rpExperience: string;
  scenario: string;
  agree: boolean;
};

const REQUIRED_TEXT_FIELDS: (keyof FormState)[] = [
  "age",
  "steamHours",
  "realName",
  "charName",
  "charBackstory",
  "rpExperience",
  "scenario",
];

type Mode = "create" | "edit";

interface Props {
  initial?: Application | null;
  mode?: Mode;
  onSaved?: (app: Application) => void;
  /** Hvis sat til true, render som read-only (fx godkendt ansøgning). */
  readOnly?: boolean;
}

export default function WhitelistForm({
  initial,
  mode = "create",
  onSaved,
  readOnly = false,
}: Props) {
  const [data, setData] = useState<FormState>({
    age: initial?.age ?? "",
    steamHours: initial?.steamHours ?? "",
    realName: initial?.realName ?? "",
    charName: initial?.charName ?? "",
    charBackstory: initial?.charBackstory ?? "",
    rpExperience: initial?.rpExperience ?? "",
    scenario: initial?.scenario ?? "",
    agree: initial?.agree ?? false,
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setError(null);

    for (const f of REQUIRED_TEXT_FIELDS) {
      if (!String(data[f]).trim()) {
        setError("Udfyld alle felter.");
        return;
      }
    }
    if (!data.agree) {
      setError("Du skal acceptere reglerne.");
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/whitelist", {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setStatus("ok");
      if (onSaved && j.application) onSaved(j.application as Application);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Ukendt fejl");
    }
  }

  if (status === "ok" && mode === "create") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-md border border-[var(--line)] bg-[var(--bg-2)] p-8 text-center"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-brand-400">
          Modtaget
        </p>
        <h3 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground">
          Tak for din ansøgning.
        </h3>
        <p className="mt-3 text-[14.5px] leading-relaxed text-foreground-muted">
          Vi vender tilbage. Hold øje med dit{" "}
          <a href="/dashboard" className="text-brand-400 underline underline-offset-4">
            dashboard
          </a>
          .
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-7">
      <fieldset disabled={readOnly} className="space-y-7 disabled:opacity-90">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Alder">
            <input
              type="number"
              min={13}
              max={99}
              required
              value={data.age}
              onChange={(e) => set("age", e.target.value)}
              className="input"
              placeholder="fx 18"
            />
          </Field>
          <Field label="Timer i GTA V (Steam)">
            <input
              type="number"
              min={0}
              required
              value={data.steamHours}
              onChange={(e) => set("steamHours", e.target.value)}
              className="input"
              placeholder="fx 240"
            />
          </Field>
        </div>

        <Field label="Rigtigt navn">
          <input
            type="text"
            required
            maxLength={100}
            value={data.realName}
            onChange={(e) => set("realName", e.target.value)}
            className="input"
            placeholder="Dit rigtige fornavn og efternavn"
          />
        </Field>

        <Field label="Karakternavn (i RP)">
          <input
            type="text"
            required
            maxLength={64}
            value={data.charName}
            onChange={(e) => set("charName", e.target.value)}
            className="input"
            placeholder="Fornavn Efternavn"
          />
        </Field>

        <Field
          label="Karakterens historie"
          hint="Kort baggrund — hvor kommer karakteren fra, motivation, mål."
        >
          <textarea
            required
            rows={5}
            maxLength={2000}
            value={data.charBackstory}
            onChange={(e) => set("charBackstory", e.target.value)}
            className="input min-h-[8rem]"
          />
        </Field>

        <Field label="RP-erfaring" hint="Tidligere servere, roller eller projekter.">
          <textarea
            required
            rows={3}
            maxLength={1500}
            value={data.rpExperience}
            onChange={(e) => set("rpExperience", e.target.value)}
            className="input min-h-[6rem]"
          />
        </Field>

        <Field
          label="Scenarie: en betjent stopper dig for spirituskørsel — hvordan reagerer din karakter?"
          hint="Vis os din RP-tilgang."
        >
          <textarea
            required
            rows={4}
            maxLength={1500}
            value={data.scenario}
            onChange={(e) => set("scenario", e.target.value)}
            className="input min-h-[7rem]"
          />
        </Field>

        <label className="flex items-start gap-3 text-sm text-foreground-secondary">
          <input
            type="checkbox"
            checked={data.agree}
            onChange={(e) => set("agree", e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[var(--line-strong)] bg-[var(--bg-3)] accent-brand-500"
          />
          <span>
            Jeg har læst{" "}
            <a href="/regler" className="text-brand-400 underline underline-offset-4">
              reglerne
            </a>{" "}
            og forstår at brud kan medføre ban.
          </span>
        </label>
      </fieldset>

      {error ? (
        <p className="rounded-md border border-red-500/30 bg-red-900/20 px-4 py-2.5 text-[13.5px] text-red-200">
          {error}
        </p>
      ) : null}

      {status === "ok" && mode === "edit" ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-900/20 px-4 py-2.5 text-[13.5px] text-emerald-200">
          Ændringer gemt og sendt til staff.
        </p>
      ) : null}

      {!readOnly ? (
        <button
          type="submit"
          disabled={status === "submitting"}
          className="inline-flex items-center justify-center rounded-md bg-brand-600 px-6 py-3 text-[14px] font-medium tracking-wide text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "submitting"
            ? "Sender …"
            : mode === "edit"
            ? "Gem ændringer"
            : "Send ansøgning"}
        </button>
      ) : null}
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block font-mono text-[11px] uppercase tracking-[0.25em] text-foreground-faint">
        {label}
      </span>
      {hint ? (
        <span className="mt-1.5 block text-[12.5px] text-foreground-faint">{hint}</span>
      ) : null}
      <div className="mt-2">{children}</div>
    </label>
  );
}
