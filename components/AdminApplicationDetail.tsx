"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Application } from "@/lib/applications-types";

import { STATUS_LABEL, STATUS_TONE } from "@/lib/applications-types";

import type { DiscordMember, DiscordUser } from "@/lib/discord";

export default function AdminApplicationDetail({
  application,
  user,
  member,
}: {
  application: Application;
  user: DiscordUser | null;
  member: DiscordMember | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [status, setStatus] = useState(application.status);
  const [busy, setBusy] = useState<"interview" | "approve" | "reject" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(kind: "interview" | "approve" | "reject") {
    if (kind === "reject" && !confirm("Afvis ansøgningen og send besked til brugeren?"))
      return;
    if (
      kind === "interview" &&
      !confirm(
        "Indkald ansøgeren til samtale, giv rollen Afventer samtale og send besked i Discord?"
      )
    )
      return;
    if (
      kind === "approve" &&
      !confirm(
        "Godkend ansøgningen endeligt, fjern Afventer samtale-rollen, giv whitelist og DM brugeren?"
      )
    )
      return;

    setBusy(kind);
    setError(null);
    setFeedback(null);
    const r = await fetch(
      `/api/admin/applications/${encodeURIComponent(application.discordId)}/${kind}`,
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
    setStatus(
      kind === "interview"
        ? "awaiting_interview"
        : kind === "approve"
          ? "approved"
          : "rejected"
    );
    const parts: string[] = [];
    if (kind === "interview") {
      parts.push("Indkaldt til samtale.");
      if (j.roleAdded) parts.push("Rolle tildelt.");
      else parts.push("Rolle KUNNE IKKE tildeles.");
    } else if (kind === "approve") {
      parts.push("Godkendt.");
      if (j.roleRemoved) parts.push("Afventer-samtale fjernet.");
      else parts.push("Afventer-samtale KUNNE IKKE fjernes.");
      if (j.roleAdded) parts.push("WL-rolle tildelt.");
      else parts.push("WL-rolle KUNNE IKKE tildeles.");
    } else {
      parts.push("Afvist.");
    }
    if (j.dmSent) parts.push("DM sendt.");
    else parts.push("DM kunne ikke sendes (åbner brugeren DMs?).");
    setFeedback(parts.join(" "));
    router.refresh();
  }

  const accountAge = user
    ? msToHumanAge(Date.now() - new Date(user.createdAt).getTime())
    : null;
  const memberAge = member?.joinedAt
    ? msToHumanAge(Date.now() - new Date(member.joinedAt).getTime())
    : null;

  const canInterview = status === "pending";
  const canFinalApprove = status === "awaiting_interview";
  const canReject = status === "pending" || status === "awaiting_interview";

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-[var(--bg)] px-6 pb-24 pt-32">
      <Link
        href="/applications/whitelist"
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
            Whitelist · ansøgning
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
              className={`rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${STATUS_TONE[status]}`}
            >
              {STATUS_LABEL[status]}
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
        <Field
          label="Steam-timer"
          value={application.steamHours}
          sub={`${application.age} år`}
        />
      </div>

      {/* ANSWERS */}
      <section className="mt-10 space-y-6">
        <Block title="Rigtigt navn">
          <p className="text-[14px] text-foreground-secondary">{application.realName}</p>
        </Block>
        <Block title="Karakter">
          <p className="text-[14px] text-foreground-secondary">{application.charName}</p>
        </Block>
        <Block title="Karakter-baggrund">
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground-secondary">
            {application.charBackstory}
          </p>
        </Block>
        <Block title="RP-erfaring">
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground-secondary">
            {application.rpExperience}
          </p>
        </Block>
        <Block title="Scenarie — politi/spritkørsel">
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground-secondary">
            {application.scenario}
          </p>
        </Block>
        {application.staffNote ? (
          <Block title="Sidste staff-note" tone="info">
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
          Først indkald til samtale — derefter endelig godkendelse efter snakken på
          Discord. Note (valgfri) sendes med DM ved afvisning; ellers gemmes den
          internt.
        </p>
        <textarea
          className="input mt-3 min-h-[80px]"
          placeholder="Eksempel: vi har skudt din ansøgning ned fordi…"
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
          {canInterview ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-[13.5px] font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
              onClick={() => act("interview")}
              disabled={busy !== null}
            >
              {busy === "interview" ? "Indkalder…" : "Indkald til samtale"}
            </button>
          ) : null}
          {canFinalApprove ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-[13.5px] font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
              onClick={() => act("approve")}
              disabled={busy !== null}
            >
              {busy === "approve" ? "Godkender…" : "Godkend + giv WL"}
            </button>
          ) : null}
          {canReject ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-red-700/60 bg-red-900/30 px-4 py-2 text-[13.5px] font-medium text-red-100 transition-colors hover:bg-red-800/50 disabled:opacity-50"
              onClick={() => act("reject")}
              disabled={busy !== null}
            >
              {busy === "reject" ? "Afviser…" : "Afvis"}
            </button>
          ) : null}
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
        <p className="mt-0.5 font-mono text-[11px] text-foreground-faint">{sub}</p>
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
