"use client";

import React, { useEffect, useId, useRef, useState } from "react";

// Render en ```mermaid-blok som et rigtigt SVG-diagram. Mermaid er tungt og
// browser-only, så det importeres dynamisk i useEffect (aldrig på serveren).
let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;
function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => {
      const mermaid = m.default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "dark",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        themeVariables: {
          background: "transparent",
          primaryColor: "#1c1c22",
          primaryBorderColor: "#3a3a44",
          primaryTextColor: "#e7e7ea",
          lineColor: "#6b6b78",
        },
      });
      return mermaid;
    });
  }
  return mermaidPromise;
}

export default function Mermaid({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getMermaid()
      .then((mermaid) => mermaid.render(`mmd-${rawId}`, code))
      .then(({ svg }) => {
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? "Kunne ikke tegne diagram.");
      });
    return () => {
      cancelled = true;
    };
  }, [code, rawId]);

  if (error) {
    return (
      <pre className="overflow-auto rounded-md border border-amber-500/30 bg-amber-500/5 p-3 font-mono text-[11.5px] text-amber-200/80">
        {code}
      </pre>
    );
  }

  return (
    <div
      ref={ref}
      className="my-3 flex justify-center overflow-auto rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-3 [&_svg]:h-auto [&_svg]:max-w-full"
    />
  );
}
