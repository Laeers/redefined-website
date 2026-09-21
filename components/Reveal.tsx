"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "header";
}

export default function Reveal({
  children,
  delay = 0,
  y = 16,
  className,
  as = "div",
}: RevealProps) {
  const reduced = useReducedMotion();
  const Cmp = motion[as];
  return (
    <Cmp
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </Cmp>
  );
}
