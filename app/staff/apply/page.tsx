import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, WHITELIST_GRANTED_ROLE_ID } from "@/lib/auth";
import { memberHasRole } from "@/lib/discord";
import PageShell from "@/components/PageShell";
import StaffApplicationForm from "@/components/StaffApplicationForm";
import { getStaffApplication } from "@/lib/staff-applications";
import {
  STAFF_STATUS_LABEL,
  STAFF_STATUS_TONE,
  STAFF_TYPE_LABEL,
} from "@/lib/staff-applications-types";

export const dynamic = "force-dynamic";

export default async function StaffApplyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/staff/apply");
  }
  const user = session.user as {
    name?: string;
    username?: string;
    discordId?: string;
    email?: string;
    isWhitelisted?: boolean;
  };

  if (!user.discordId) {
    redirect("/api/auth/signin?callbackUrl=/staff/apply");
  }

  let isWhitelisted = Boolean(user.isWhitelisted);
  if (!isWhitelisted) {
    try {
      isWhitelisted = await memberHasRole(
        user.discordId!,
        WHITELIST_GRANTED_ROLE_ID
      );
    } catch {
      isWhitelisted = false;
    }
  }

  if (!isWhitelisted) {
    return (
      <PageShell
        eyebrow="Staff-ansøgning"
        title="Du har ikke whitelist-rollen."
        description="Du skal være whitelistet på serveren før du kan ansøge om en staff-rolle. Få whitelist først, og kig så forbi igen."
      >
        <a
          href="/whitelist"
          className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-brand-500"
        >
          Søg whitelist
        </a>
      </PageShell>
    );
  }

  const existing = user.discordId
    ? await getStaffApplication(user.discordId)
    : null;

  const readOnly = existing?.status === "approved";

  return (
    <PageShell
      eyebrow="Staff-ansøgning"
      title={
        existing
          ? existing.applicationType === "whitelist_receiver"
            ? "Din ansøgning som whitelist-modtager."
            : "Din staff-ansøgning."
          : "Ansøg om en rolle hos Redefined."
      }
      description={
        readOnly
          ? "Din ansøgning er godkendt. Du kan se din indsendelse herunder."
          : existing?.status === "rejected"
            ? "Din forrige ansøgning blev afvist. Du må gerne sende en ny ind — vær konkret om hvad du har lært."
            : "Vælg om du vil søge som whitelist-modtager eller almindelig staff. Udfyld alle felter — vi læser hver ansøgning manuelt og kontakter dig direkte."
      }
    >
      <div className="rounded-md border border-[var(--line)] bg-[var(--bg-2)] p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-foreground-faint">
          Logget ind som
        </p>
        <p className="mt-1.5 text-[15px] text-foreground">
          {user.username ?? user.name ?? user.email}
          {user.discordId ? (
            <span className="ml-2 font-mono text-[12px] text-foreground-faint">
              · {user.discordId}
            </span>
          ) : null}
        </p>
      </div>

      {existing ? (
        <div className="rounded-md border border-[var(--line)] bg-[var(--bg-2)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-foreground-faint">
                Status
              </p>
              <div className="mt-2 flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.22em] ${STAFF_STATUS_TONE[existing.status]}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {STAFF_STATUS_LABEL[existing.status]}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-foreground-faint">
                  Søgt som: {STAFF_TYPE_LABEL[existing.applicationType]}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-foreground-faint">
                  Ansøgningsnr. #{existing.revision}
                </span>
              </div>
            </div>
            <div className="text-right text-[12px] text-foreground-faint">
              <div>
                Sendt:{" "}
                <span className="font-mono text-foreground-muted">
                  {new Date(existing.createdAt).toLocaleString("da-DK")}
                </span>
              </div>
              <div>
                Sidst opdateret:{" "}
                <span className="font-mono text-foreground-muted">
                  {new Date(existing.updatedAt).toLocaleString("da-DK")}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <StaffApplicationForm
        initial={existing}
        mode={existing ? "edit" : "create"}
        readOnly={readOnly}
      />
    </PageShell>
  );
}
