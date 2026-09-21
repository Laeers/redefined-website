"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ReactNode } from "react";

type Variant = "primary" | "ghost" | "discord" | "outline";

const STYLES: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-md shadow-red-950/40 hover:bg-brand-500 border border-brand-500/60",
  ghost:
    "bg-[var(--btn-ghost-bg)] text-foreground-secondary hover:bg-[var(--btn-ghost-hover)] border border-[var(--line-strong)]",
  discord:
    "bg-[#5865F2] text-white shadow-md shadow-indigo-950/40 hover:bg-[#4752c4] border border-[#5865F2]",
  outline:
    "bg-transparent text-foreground-secondary hover:text-foreground border border-[var(--line-strong)] hover:border-[var(--line)]",
};

export default function CtaButton({
  children,
  href,
  onClick,
  variant = "primary",
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: Variant;
}) {
  const base =
    "inline-flex items-center gap-2 justify-center rounded-xl px-5 py-2.5 text-[13.5px] font-medium tracking-[0.01em] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400";
  const cls = `${base} ${STYLES[variant]}`;

  const Inner = (
    <motion.span
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className={cls}
    >
      {children}
    </motion.span>
  );

  if (href) {
    const external = href.startsWith("http") || href.startsWith("fivem://");
    if (external)
      return (
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
          {Inner}
        </a>
      );
    return <Link href={href}>{Inner}</Link>;
  }
  return (
    <button type="button" onClick={onClick} className="outline-none">
      {Inner}
    </button>
  );
}
