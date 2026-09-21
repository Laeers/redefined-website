"use client";

import Link from "next/link";
import Image from "next/image";

const COLS = [
  {
    title: "Server",
    links: [
      { label: "Hjem", href: "/" },
      { label: "Regler", href: "/regler" },
    ],
  },
  {
    title: "Spillere",
    links: [
      { label: "Whitelist", href: "/whitelist" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "Community",
    links: [{ label: "Discord", href: "https://discord.gg/redefinedrp" }],
  },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-[var(--line)] bg-[var(--bg-2)]">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link href="/" className="flex items-center gap-3">
              <Image src="/logo.png" alt="" width={56} height={56} className="h-14 w-14" />
              <span className="font-mono text-[12px] uppercase tracking-[0.32em] text-foreground-secondary">
                Redefined Roleplay
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-sm text-foreground-muted">
              Dansk FiveM RP-server. Whitelist-only. Frihed under ansvar — og en
              by hvor dine valg har konsekvens.
            </p>
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-foreground-faint">
                {c.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-foreground-muted transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-[var(--line)] pt-6 text-xs text-foreground-faint md:flex-row md:items-center">
          <p className="font-mono uppercase tracking-[0.25em]">
            © {new Date().getFullYear()} · redefinedrp.dk
          </p>
          <p>
            Bygget i Danmark · ikke tilknyttet Rockstar Games eller Cfx.re.
          </p>
        </div>
      </div>
    </footer>
  );
}
