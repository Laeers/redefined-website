import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renderer en regel-sektions Markdown med præcis den styling det tidligere
// hardcodede regelsæt brugte: brand-farvede list-markers, fede fremhævninger
// i foreground, og indrykkede cirkel-underlister.
export default function RulesMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p>{children}</p>,
        // Top-niveau som disc, indrykkede underlister som cirkler.
        ul: ({ children }) => (
          <ul className="list-disc space-y-3 pl-5 marker:text-brand-500/70 [&_ul]:mt-2 [&_ul]:list-[circle] [&_ul]:space-y-1 [&_ul]:pl-5">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal space-y-3 pl-5 marker:text-brand-500/70">
            {children}
          </ol>
        ),
        li: ({ children }) => <li>{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        a: ({ children, href }) => (
          <a
            href={href}
            className="text-brand-400 underline decoration-brand-500/40 underline-offset-2 hover:text-brand-300"
          >
            {children}
          </a>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-semibold text-foreground">{children}</h3>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
