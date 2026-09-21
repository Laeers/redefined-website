import Reveal from "./Reveal";

interface Props {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}

export default function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
}: Props) {
  const alignCls = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <Reveal className={`max-w-2xl ${alignCls}`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-brand-400/85">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-balance font-sans text-3xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-4xl md:text-[44px]">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 max-w-xl text-pretty text-[15px] leading-relaxed text-foreground-muted">
          {description}
        </p>
      ) : null}
    </Reveal>
  );
}
