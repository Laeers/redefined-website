"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { StaffApplication } from "@/lib/staff-applications-types";
import {
  STAFF_STATUS_LABEL,
  STAFF_STATUS_TONE,
  STAFF_TYPE_LABEL,
} from "@/lib/staff-applications-types";
import type { DiscordMember, DiscordUser } from "@/lib/discord";

export default function StaffApplicationDetail({
  application,
  user,
  member,
}: {
  application: StaffApplication;
  user: DiscordUser | null;
  member: DiscordMember | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState(application.staffNote ?? "");
  const [status, setStatus] = useState(application.status);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(kind: "approve" | "reject") {
    if (kind === "reject" && !confirm("Markér ansøgningen som afvist?")) return;
    if (kind === "approve" && !confirm("Markér ansøgningen som godkendt?"))
      return;

    setBusy(kind);
    setError(null);
    setFeedback(null);
    const r = await fetch(
      `/api/admin/staff-applications/${encodeURIComponent(application.discordId)}/${kind}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: note.trim() || undefined }),
      }
    );
    setBusy(null);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(j.error || `HTTP ${r.status}`);
      return;
    }
    setStatus(kind === "approve" ? "approved" : "rejected");
    setFeedback(
      kind === "approve"
        ? "Markeret som godkendt. Husk at kontakte ansøgeren manuelt."
        : "Markeret som afvist. Husk at kontakte ansøgeren manuelt."
    );
    router.refresh();
  }

  const accountAge = user
    ? msToHumanAge(Date.now() - new Date(user.createdAt).getTime())
    : null;
  const memberAge = member?.joinedAt
    ? msToHumanAge(Date.now() - new Date(member.joinedAt).getTime())
    : null;

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-[var(--bg)] px-6 pb-24 pt-32">
      <Link
        href="/applications/staff"
        className="font-mono text-[11.5px] uppercase tracking-widest text-foreground-faint hover:text-foreground"
      >
        ← Oversigt
      </Link>

      {/* HEADER */}
      <header className="mt-4 flex flex-wrap items-start gap-5 border-b border-[var(--line)] pb-6">
        {user?.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt=""
            width={88}
            height={88}
            unoptimized
            className="h-[72px] w-[72px] rounded-md border border-[var(--line-strong)]"
          />
        ) : (
          <div className="h-[72px] w-[72px] rounded-md border border-[var(--line-strong)] bg-[var(--bg-3)]" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-brand-400/85">
            Staff · ansøgning
          </p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-foreground">
            {application.username}
          </h1>
          <p className="mt-1 font-mono text-[12px] text-foreground-faint">
            ID {application.discordId}
            {member?.nick ? ` · server-nick ${member.nick}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${STAFF_STATUS_TONE[status]}`}
            >
              {STAFF_STATUS_LABEL[status]}
            </span>
            <span className="rounded-full border border-[var(--line-strong)] bg-[var(--bg-3)] px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-foreground-muted">
              {STAFF_TYPE_LABEL[application.applicationType]}
            </span>
            <span className="font-mono text-[11px] text-foreground-faint">
              Ansøgningsnr. #{application.revision}
            </span>
          </div>
        </div>
        <div className="grid min-w-[220px] gap-2 text-[12.5px] text-foreground-muted">
          <Field
            label="Discord oprettet"
            value={
              user
                ? new Date(user.createdAt).toLocaleDateString("da-DK", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "—"
            }
            sub={accountAge ?? undefined}
          />
          <Field
            label="Server-medlem siden"
            value={
              member?.joinedAt
                ? new Date(member.joinedAt).toLocaleDateString("da-DK", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "Ikke i guild"
            }
            sub={memberAge ?? undefined}
          />
        </div>
      </header>

      {/* TIMESTAMPS */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Field
          label="Sendt"
          value={new Date(application.createdAt).toLocaleString("da-DK")}
        />
        <Field
          label="Opdateret"
          value={new Date(application.updatedAt).toLocaleString("da-DK")}
        />
        <Field label="Alder" value={`${application.age} år`} />
      </div>

      {/* ANSWERS */}
      <section className="mt-10 space-y-6">
        <Block
          title={
            application.applicationType === "whitelist_receiver"
              ? "Tidligere erfaring med whitelist/ansøgningsvurdering"
              : "Tidligere staff-erfaring"
          }
        >
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground-secondary">
            {application.experience}
          </p>
        </Block>
        <Block
          title={
            application.applicationType === "whitelist_receiver"
              ? "Hvorfor vil du være whitelist-modtager?"
              : "Hvorfor søger du staff?"
          }
        >
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground-secondary">
            {application.motivation}
          </p>
        </Block>
        <Block title="Tilgængelighed">
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground-secondary">
            {application.availability}
          </p>
        </Block>
        <Block title="Hvad gør dig egnet?">
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground-secondary">
            {application.strengths}
          </p>
        </Block>
        <Block
          title={
            application.applicationType === "whitelist_receiver"
              ? "Scenarie — vurdering af whitelist-ansøgning"
              : "Scenarie — konflikthåndtering"
          }
        >
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground-secondary">
            {application.scenario}
          </p>
        </Block>
        {application.staffNote ? (
          <Block title="Intern staff-note" tone="info">
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground-secondary">
              {application.staffNote}
            </p>
          </Block>
        ) : null}
      </section>

      {/* ACTIONS */}
      <section className="mt-10 rounded-md border border-[var(--line)] bg-[var(--bg-2)] p-5">
        <p className="font-mono text-[11px] uppercase tracking-widest text-foreground-faint">
          Handling
        </p>
        <p className="mt-1 text-[12.5px] text-foreground-faint">
          Note gemmes internt. Der sendes <span className="font-semibold">ikke</span>{" "}
          DM og <span className="font-semibold">ingen</span> broadcast — staff
          kontakter selv ansøgeren.
        </p>
        <textarea
          className="input mt-3 min-h-[80px]"
          placeholder="Intern note (valgfri)…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error ? (
          <div className="mt-3 rounded-md border border-red-700/50 bg-red-900/30 px-3 py-2 text-[12.5px] text-red-100">
            {error}
          </div>
        ) : null}
        {feedback ? (
          <div className="mt-3 rounded-md border border-emerald-700/50 bg-emerald-900/20 px-3 py-2 text-[12.5px] text-emerald-100">
            {feedback}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-[13.5px] font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            onClick={() => act("approve")}
            disabled={busy !== null || status === "approved"}
          >
            {busy === "approve" ? "Markerer…" : "Markér som godkendt"}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-red-700/60 bg-red-900/30 px-4 py-2 text-[13.5px] font-medium text-red-100 transition-colors hover:bg-red-800/50 disabled:opacity-50"
            onClick={() => act("reject")}
            disabled={busy !== null || status === "rejected"}
          >
            {busy === "reject" ? "Markerer…" : "Markér som afvist"}
          </button>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-widest text-foreground-faint">
        {label}
      </p>
      <p className="mt-1 text-[13px] text-foreground-secondary">{value}</p>
      {sub ? (
        <p className="mt-0.5 font-mono text-[11px] text-foreground-faint">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function Block({
  title,
  children,
  tone,
}: {
  title: string;
  children: React.ReactNode;
  tone?: "info";
}) {
  return (
    <div
      className={`rounded-md border px-5 py-4 ${
        tone === "info"
          ? "border-sky-300/80 bg-sky-50/90 dark:border-sky-700/40 dark:bg-sky-900/20"
          : "border-[var(--line)] bg-[var(--bg-2)]"
      }`}
    >
      <p className="font-mono text-[10.5px] uppercase tracking-widest text-foreground-faint">
        {title}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function msToHumanAge(ms: number): string {
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) return "i dag";
  if (days < 30) return `${days} dage`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mdr`;
  const years = (days / 365).toFixed(1);
  return `${years} år`;
}
