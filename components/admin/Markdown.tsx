"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Mermaid from "./Mermaid";

// Renderer Detektivens markdown-rapport pænt: GFM-tabeller, overskrifter,
// kodeblokke og ```mermaid-diagrammer — styled til dark-temaet.
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="text-[13.5px] leading-relaxed text-foreground-secondary">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 mt-5 text-[18px] font-semibold text-foreground first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-5 border-b border-[var(--line)] pb-1.5 text-[15.5px] font-semibold text-foreground first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1.5 mt-4 text-[14px] font-semibold text-foreground">{children}</h3>
          ),
          p: ({ children }) => <p className="my-2.5">{children}</p>,
          ul: ({ children }) => <ul className="my-2.5 ml-5 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="my-2.5 ml-5 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="pl-1 marker:text-foreground-faint">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-brand-400 underline decoration-brand-500/40 underline-offset-2 hover:text-brand-300"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-brand-500/50 bg-[var(--bg-2)] py-1 pl-3 text-foreground-muted">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-5 border-[var(--line)]" />,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-[var(--line)]">
              <table className="w-full border-collapse text-[12.5px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-[var(--bg-2)]">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-[var(--line)] px-3 py-2 text-left font-semibold text-foreground">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-[var(--line)]/60 px-3 py-1.5 align-top">{children}</td>
          ),
          tr: ({ children }) => <tr className="transition-colors hover:bg-[var(--bg-2)]/50">{children}</tr>,
          code: ({ className, children }) => {
            const match = /language-(\w+)/.exec(className ?? "");
            const lang = match?.[1];
            const text = String(children).replace(/\n$/, "");
            if (lang === "mermaid") return <Mermaid code={text} />;
            if (lang) {
              return (
                <pre className="my-3 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-3">
                  <code className="font-mono text-[12px] text-foreground-secondary">{text}</code>
                </pre>
              );
            }
            return (
              <code className="rounded bg-[var(--bg-2)] px-1.5 py-0.5 font-mono text-[12px] text-foreground">
                {children}
              </code>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
