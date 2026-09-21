"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

const PUBLIC_NAV = [
  { href: "/", label: "Hjem" },
  { href: "/regler", label: "Regler" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Luk menuen ved route-skift
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Esc lukker, og lås body-scroll når menuen er åben
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const nav = (() => {
    const base = [...PUBLIC_NAV];
    if (session?.user) base.push({ href: "/dashboard", label: "Dashboard" });
    const u = session?.user as
      | {
          isStaff?: boolean;
          isAdmin?: boolean;
          isWhitelisted?: boolean;
          canReadStaffApps?: boolean;
        }
      | undefined;
    if (u?.isWhitelisted) base.push({ href: "/staff/apply", label: "Søg staff" });
    if (u?.isStaff)
      base.push({ href: "/applications/whitelist", label: "WL-ansøgninger" });
    if (u?.canReadStaffApps)
      base.push({ href: "/applications/staff", label: "Staff-ansøgninger" });
    if (u?.isAdmin) base.push({ href: "/admin/players", label: "Admin" });
    return base;
  })();

  /** Øverst på forsiden (hero-billede): lys tekst uanset tema */
  const onHero = pathname === "/" && !scrolled && !menuOpen;
  const barSolid = scrolled || menuOpen;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        barSolid
          ? "border-b border-[var(--navbar-border)] bg-[var(--navbar-scrolled)] backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-3 justify-self-start"
          aria-label="Redefined Roleplay"
          onClick={() => setMenuOpen(false)}
        >
          <Image
            src="/logo.png"
            alt=""
            width={56}
            height={56}
            priority
            className="h-11 w-11 select-none sm:h-14 sm:w-14"
          />
          <span
            className={`hidden font-mono text-[12px] uppercase tracking-[0.32em] sm:inline-block ${
              onHero ? "text-white/90" : "text-foreground-secondary"
            }`}
          >
            Redefined
          </span>
        </Link>

        <nav className="hidden items-center justify-self-center gap-1 md:flex">
          {nav.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`relative rounded-md px-3 py-1.5 text-[13.5px] transition-colors ${
                  onHero
                    ? active
                      ? "text-white"
                      : "text-white/75 hover:text-white"
                    : active
                      ? "text-foreground"
                      : "text-foreground-muted hover:text-foreground"
                }`}
              >
                {n.label}
                {active ? (
                  <span
                    className={`absolute inset-x-3 -bottom-px h-px ${
                      onHero ? "bg-white" : "bg-brand-500"
                    }`}
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-self-end gap-2">
          <ThemeToggle onHero={onHero} />

          {/* Desktop: Whitelist + Log ud / Login */}
          <div className="hidden items-center gap-2 md:flex">
            {session?.user ? (
              <>
                <Link
                  href="/whitelist"
                  className="rounded-md bg-brand-600 px-3.5 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-500"
                >
                  Whitelist →
                </Link>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className={
                    onHero
                      ? "rounded-md border border-white/25 bg-white/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-white transition-colors hover:bg-white/15"
                      : "rounded-md border border-[var(--line-strong)] bg-[var(--btn-ghost-bg)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-foreground-muted transition-colors hover:bg-[var(--btn-ghost-hover)] hover:text-foreground"
                  }
                >
                  Log ud
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => signIn("discord", { callbackUrl: "/dashboard" })}
                className="inline-flex items-center gap-2 rounded-md bg-[#5865F2] px-3.5 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-[#4752c4]"
              >
                Login
              </button>
            )}
          </div>

          {/* Mobile: hamburger */}
          <button
            type="button"
            aria-label={menuOpen ? "Luk menu" : "Åbn menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((v) => !v)}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-md border md:hidden ${
              onHero
                ? "border-white/25 bg-white/10 text-white hover:bg-white/15"
                : "border-[var(--line-strong)] bg-[var(--btn-ghost-bg)] text-foreground hover:bg-[var(--btn-ghost-hover)]"
            }`}
          >
            <BurgerIcon open={menuOpen} />
          </button>
        </div>
      </div>

      {/* Mobil-menu — slide-down panel */}
      <div
        id="mobile-nav"
        className={`md:hidden ${
          menuOpen
            ? "pointer-events-auto visible"
            : "pointer-events-none invisible"
        }`}
      >
        <div
          aria-hidden={!menuOpen}
          className={`fixed inset-x-0 top-[64px] z-40 border-b border-[var(--line)] bg-[var(--bg)] shadow-2xl transition-all duration-200 ${
            menuOpen
              ? "translate-y-0 opacity-100"
              : "-translate-y-2 opacity-0"
          }`}
        >
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4">
            {nav.map((n) => {
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex items-center justify-between rounded-md border px-4 py-3 text-[15px] transition-colors ${
                    active
                      ? "border-brand-500/40 bg-brand-600/10 text-foreground"
                      : "border-[var(--line)] bg-[var(--bg-2)] text-foreground-secondary hover:border-[var(--line-strong)] hover:text-foreground"
                  }`}
                >
                  <span>{n.label}</span>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-foreground-faint">
                    {active ? "·" : "→"}
                  </span>
                </Link>
              );
            })}

            <div className="mt-3 flex flex-col gap-2 border-t border-[var(--line)] pt-3">
              {session?.user ? (
                <>
                  <p className="px-1 font-mono text-[11px] uppercase tracking-widest text-foreground-faint">
                    Logget ind som{" "}
                    <span className="text-foreground-muted">
                      {(session.user as { username?: string; name?: string })
                        .username ??
                        session.user.name ??
                        "ukendt"}
                    </span>
                  </p>
                  <Link
                    href="/whitelist"
                    className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-3 text-[14px] font-medium text-white transition-colors hover:bg-brand-500"
                  >
                    Whitelist-ansøgning →
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      signOut({ callbackUrl: "/" });
                    }}
                    className="inline-flex items-center justify-center rounded-md border border-[var(--line-strong)] bg-[var(--btn-ghost-bg)] px-4 py-3 font-mono text-[12px] uppercase tracking-widest text-foreground-muted transition-colors hover:bg-[var(--btn-ghost-hover)] hover:text-foreground"
                  >
                    Log ud
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    signIn("discord", { callbackUrl: "/dashboard" });
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#5865F2] px-4 py-3 text-[14px] font-medium text-white transition-colors hover:bg-[#4752c4]"
                >
                  Login med Discord
                </button>
              )}
            </div>
          </nav>
        </div>

        {/* Backdrop bag panelet */}
        <button
          type="button"
          aria-label="Luk menu"
          tabIndex={-1}
          onClick={() => setMenuOpen(false)}
          className={`fixed inset-0 top-[64px] z-30 bg-black/40 transition-opacity duration-200 ${
            menuOpen ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>
    </header>
  );
}

function BurgerIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {open ? (
        <>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </>
      ) : (
        <>
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </>
      )}
    </svg>
  );
}
