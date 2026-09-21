"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type {
  StaffApplication,
  StaffApplicationType,
} from "@/lib/staff-applications-types";
import {
  STAFF_TYPE_DESCRIPTION,
  STAFF_TYPE_LABEL,
} from "@/lib/staff-applications-types";

type FormState = {
  applicationType: StaffApplicationType;
  age: string;
  experience: string;
  motivation: string;
  availability: string;
  strengths: string;
  scenario: string;
  agree: boolean;
};

const REQUIRED_TEXT_FIELDS: (keyof FormState)[] = [
  "age",
  "experience",
  "motivation",
  "availability",
  "strengths",
  "scenario",
];

type Mode = "create" | "edit";

interface Props {
  initial?: StaffApplication | null;
  mode?: Mode;
  onSaved?: (app: StaffApplication) => void;
  readOnly?: boolean;
}

const TYPES: StaffApplicationType[] = ["whitelist_receiver", "general_staff"];

export default function StaffApplicationForm({
  initial,
  mode = "create",
  onSaved,
  readOnly = false,
}: Props) {
  const [data, setData] = useState<FormState>({
    applicationType: initial?.applicationType ?? "general_staff",
    age: initial?.age ?? "",
    experience: initial?.experience ?? "",
    motivation: initial?.motivation ?? "",
    availability: initial?.availability ?? "",
    strengths: initial?.strengths ?? "",
    scenario: initial?.scenario ?? "",
    agree: initial?.agree ?? false,
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const isWhitelistReceiver = data.applicationType === "whitelist_receiver";

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
      setError("Du skal acceptere betingelserne.");
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/staff-application", {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setStatus("ok");
      if (onSaved && j.application) onSaved(j.application as StaffApplication);
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
          {isWhitelistReceiver
            ? "Tak for din ansøgning som whitelist-modtager."
            : "Tak for din staff-ansøgning."}
        </h3>
        <p className="mt-3 text-[14.5px] leading-relaxed text-foreground-muted">
          Vi læser den manuelt og kontakter dig direkte når vi har et svar.
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-7">
      <fieldset disabled={readOnly} className="space-y-7 disabled:opacity-90">
        <div>
          <span className="block font-mono text-[11px] uppercase tracking-[0.25em] text-foreground-faint">
            Ansøgningstype
          </span>
          <span className="mt-1.5 block text-[12.5px] text-foreground-faint">
            Vælg om du søger som whitelist-modtager eller almindelig staff.
          </span>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {TYPES.map((t) => {
              const active = data.applicationType === t;
              return (
                <label
                  key={t}
                  className={`flex cursor-pointer flex-col gap-1 rounded-md border px-4 py-3 text-left transition-colors ${
                    active
                      ? "border-brand-500 bg-brand-600/10"
                      : "border-[var(--line-strong)] bg-[var(--bg-3)] hover:border-[var(--line)]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="application_type"
                      value={t}
                      checked={active}
                      onChange={() => set("applicationType", t)}
                      className="h-4 w-4 accent-brand-500"
                    />
                    <span className="text-[14px] font-medium text-foreground">
                      {STAFF_TYPE_LABEL[t]}
                    </span>
                  </div>
                  <span className="text-[12.5px] leading-relaxed text-foreground-muted">
                    {STAFF_TYPE_DESCRIPTION[t]}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

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

        <Field
          label={
            isWhitelistReceiver
              ? "Tidligere erfaring med whitelist/ansøgningsvurdering"
              : "Tidligere staff-erfaring"
          }
          hint={
            isWhitelistReceiver
              ? "Har du før vurderet ansøgninger eller arbejdet med whitelist? Hvor, og hvad lavede du?"
              : "Hvor har du været staff før? Hvilke roller, hvor længe, og hvorfor stoppede du?"
          }
        >
          <textarea
            required
            rows={4}
            maxLength={2000}
            value={data.experience}
            onChange={(e) => set("experience", e.target.value)}
            className="input min-h-[7rem]"
          />
        </Field>

        <Field
          label={
            isWhitelistReceiver
              ? "Hvorfor vil du være whitelist-modtager hos Redefined?"
              : "Hvorfor søger du staff hos Redefined?"
          }
          hint="Vær konkret — generiske svar bliver afvist."
        >
          <textarea
            required
            rows={4}
            maxLength={2000}
            value={data.motivation}
            onChange={(e) => set("motivation", e.target.value)}
            className="input min-h-[7rem]"
          />
        </Field>

        <Field
          label="Tilgængelighed"
          hint="Hvor mange timer om ugen kan du bidrage, og på hvilke tidspunkter?"
        >
          <textarea
            required
            rows={3}
            maxLength={1000}
            value={data.availability}
            onChange={(e) => set("availability", e.target.value)}
            className="input min-h-[5rem]"
          />
        </Field>

        <Field
          label="Hvad gør dig egnet til rollen?"
          hint="Personlige styrker, kompetencer, tilgang til konflikthåndtering, osv."
        >
          <textarea
            required
            rows={4}
            maxLength={2000}
            value={data.strengths}
            onChange={(e) => set("strengths", e.target.value)}
            className="input min-h-[7rem]"
          />
        </Field>

        <Field
          label={
            data.applicationType === "whitelist_receiver"
              ? "Scenarie: en ansøgning opfylder minimumskravene, men virker generisk og kort. Hvordan vurderer du den?"
              : "Scenarie: to spillere kommer op at skændes in-character, og det eskalerer til OOC-fornærmelser i chatten. Hvordan håndterer du det?"
          }
          hint="Vis os din tilgang."
        >
          <textarea
            required
            rows={4}
            maxLength={2000}
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
            {isWhitelistReceiver
              ? "Jeg er klar over at rollen som whitelist-modtager er et frivilligt ansvar, at jeg skal behandle ansøgere fair og fortroligt, og at brud kan medføre øjeblikkelig afsked."
              : "Jeg er klar over at staff-rollen er et frivilligt ansvar, at jeg skal behandle spillere fair og fortroligt, og at brud kan medføre øjeblikkelig afsked."}
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
          Ændringer gemt.
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
        <span className="mt-1.5 block text-[12.5px] text-foreground-faint">
          {hint}
        </span>
      ) : null}
      <div className="mt-2">{children}</div>
    </label>
  );
}
