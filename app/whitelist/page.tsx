import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import PageShell from "@/components/PageShell";
import WhitelistForm from "@/components/WhitelistForm";
import { getApplication } from "@/lib/applications";

export const dynamic = "force-dynamic";

export default async function WhitelistPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/whitelist");
  }
  const user = session.user as {
    name?: string;
    username?: string;
    discordId?: string;
    email?: string;
  };

  if (user.discordId) {
    const existing = await getApplication(user.discordId);
    if (existing && existing.status !== "changes_requested") {
      redirect("/dashboard");
    }
  }

  return (
    <PageShell
      eyebrow="Whitelist-ansøgning"
      title="Søg om whitelist."
      description="Udfyld formularen grundigt. Korte eller copy-paste-svar bliver afvist. Vi læser hver eneste ansøgning manuelt."
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
      <WhitelistForm mode="create" />
    </PageShell>
  );
}
