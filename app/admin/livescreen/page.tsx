import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, ADMIN_ROLE_ID } from "@/lib/auth";
import { memberHasRole } from "@/lib/discord";
import PageShell from "@/components/PageShell";
import AdminLiveScreen from "@/components/AdminLiveScreen";

export const dynamic = "force-dynamic";

export default async function AdminLiveScreenPage() {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u?.discordId) redirect("/api/auth/signin/discord?callbackUrl=/admin/livescreen");

  let isAdmin = Boolean(u.isAdmin);
  if (!isAdmin) {
    try {
      isAdmin = await memberHasRole(u.discordId!, ADMIN_ROLE_ID);
    } catch {
      isAdmin = false;
    }
  }
  if (!isAdmin) {
    return (
      <PageShell
        eyebrow="Adgang nægtet"
        title="Du har ikke admin-rollen."
        description="Denne side kræver admin-rollen på Discord-serveren."
      >
        <p className="text-[14px] text-foreground-muted">
          Logget ind som <span className="font-mono text-foreground">{u.username}</span>.
        </p>
      </PageShell>
    );
  }

  return (
    <main className="relative min-h-[100svh] bg-[var(--bg)]">
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-28 sm:pt-32">
        <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-brand-400/85">
          Admin
        </p>
        <h1 className="mt-4 font-sans text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Live-view
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-foreground-muted">
          Se en online spillers skærm live (få sekunders forsinkelse). Al visning
          logges i admin-loggen.
        </p>
        <div className="mt-10">
          <AdminLiveScreen />
        </div>
      </div>
    </main>
  );
}
