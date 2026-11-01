import type { ReactNode } from "react";

export function Legal({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <article className="pb-10">
      <h1 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.01em] sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-fg-faint">
        Last updated {updated}
      </p>
      <div className="mt-7 space-y-7">{children}</div>
    </article>
  );
}

export function Clause({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">{heading}</h2>
      <div className="space-y-2.5 text-sm leading-relaxed text-fg-dim">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5 text-sm leading-relaxed text-fg-dim">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden className="mt-[0.45em] size-1 shrink-0 rounded-full bg-accent/60" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
