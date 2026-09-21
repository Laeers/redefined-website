import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getApplication, STATUS_LABEL, STATUS_TONE } from "@/lib/applications";
import PageShell from "@/components/PageShell";
import WhitelistForm from "@/components/WhitelistForm";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/dashboard");
  }
  const user = session.user as {
    name?: string;
    username?: string;
    discordId?: string;
    isWhitelisted?: boolean;
  };

  const application = user.discordId ? await getApplication(user.discordId) : null;

  if (!application) {
    return (
      <PageShell
        eyebrow="Dashboard"
        title={`Hej ${user.username ?? user.name ?? "spiller"}.`}
        description="Du har ikke sendt en whitelist-ansøgning endnu. Når du gør, vil du kunne se og redigere den her."
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="/whitelist"
            className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-brand-500"
          >
            Søg whitelist nu
          </Link>
          <Link
            href="/regler"
            className="inline-flex items-center gap-2 rounded-md border border-[var(--line-strong)] px-5 py-2.5 text-[14px] font-medium text-foreground-secondary transition-colors hover:border-[var(--line)] hover:text-foreground"
          >
            Læs reglerne først
          </Link>
        </div>
      </PageShell>
    );
  }

  const readOnly =
    application.status === "approved" ||
    application.status === "awaiting_interview";
  const statusLabel = STATUS_LABEL[application.status];
  const statusTone = STATUS_TONE[application.status];

  return (
    <PageShell
      eyebrow="Dashboard"
      title="Din whitelist-ansøgning."
      description={
        application.status === "approved"
          ? "Din ansøgning er godkendt. Du kan se din indsendelse herunder."
          : application.status === "awaiting_interview"
            ? "Du er indkaldt til samtale på Discord. Vi kontakter dig der — du kan ikke redigere ansøgningen i denne fase."
            : "Her kan du se din ansøgning og redigere den, så længe staff ikke har lukket sagen."
      }
    >
      <div className="rounded-md border border-[var(--line)] bg-[var(--bg-2)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-foreground-faint">
              Status
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.22em] ${statusTone}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {statusLabel}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-foreground-faint">
                Ansøgningsnr. #{application.revision}
              </span>
            </div>
          </div>
          <div className="text-right text-[12px] text-foreground-faint">
            <div>
              Sendt:{" "}
              <span className="font-mono text-foreground-muted">
                {new Date(application.createdAt).toLocaleString("da-DK")}
              </span>
            </div>
            <div>
              Sidst opdateret:{" "}
              <span className="font-mono text-foreground-muted">
                {new Date(application.updatedAt).toLocaleString("da-DK")}
              </span>
            </div>
          </div>
        </div>
        {application.staffNote ? (
          <div className="mt-4 rounded-md border border-[var(--line)] bg-[var(--bg-3)] p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-foreground-faint">
              Besked fra staff
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-foreground-secondary">
              {application.staffNote}
            </p>
          </div>
        ) : null}
      </div>

      {user.isWhitelisted ? (
        <div className="rounded-md border border-[var(--line)] bg-[var(--bg-2)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-foreground-faint">
                Vil du være staff?
              </p>
              <p className="mt-1 text-[14px] text-foreground-secondary">
                Du kan ansøge om at blive whitelist-modtager eller almindelig
                staff.
              </p>
            </div>
            <Link
              href="/staff/apply"
              className="inline-flex items-center gap-2 rounded-md border border-[var(--line-strong)] bg-[var(--bg-3)] px-4 py-2 text-[13.5px] font-medium text-foreground transition-colors hover:bg-[var(--btn-ghost-hover)]"
            >
              Søg staff →
            </Link>
          </div>
        </div>
      ) : null}

      <div className="!mt-10">
        <WhitelistForm initial={application} mode="edit" readOnly={readOnly} />
      </div>
    </PageShell>
  );
}
