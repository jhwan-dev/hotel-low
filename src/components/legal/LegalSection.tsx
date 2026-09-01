import type { ReactNode } from "react";

export interface LegalSectionProps {
  title: string;
  children: ReactNode;
}

/** One numbered-heading section shared by the privacy policy and terms of service pages. */
export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-h3 text-ink">{title}</h2>
      <div className="flex flex-col gap-2 text-small text-ink-muted">{children}</div>
    </section>
  );
}
