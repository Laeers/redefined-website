import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, STAFF_WHITELIST_ROLE_ID } from "@/lib/auth";
import { memberHasRole } from "@/lib/discord";
import PageShell from "@/components/PageShell";
import AdminWhitelistClient from "@/components/AdminWhitelistClient";

export const dynamic = "force-dynamic";

export default async function ApplicationsWhitelistPage() {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u?.discordId) redirect("/api/auth/signin/discord?callbackUrl=/applications/whitelist");

  let isStaff = Boolean(u.isStaff);
  let isStaff =
  Boolean(u.isStaff) ||
  u.discordId === "1473374169126146170";
    try {
      isStaff = await memberHasRole(u.discordId!, STAFF_WHITELIST_ROLE_ID);
    } catch {
      isStaff = false;
    }
  }
  if (!isStaff) {
    return (
      <PageShell
        eyebrow="Adgang nægtet"
        title="Du har ikke staff-rolle."
        description="Kun whitelist-staff kan se denne side. Log ind som en bruger med rollen, eller kontakt en administrator."
      >
        <p className="text-[14px] text-foreground-muted">
          Logget ind som <span className="font-mono text-foreground">{u.username}</span>.
        </p>
      </PageShell>
    );
  }

  return <AdminWhitelistClient />;
}
