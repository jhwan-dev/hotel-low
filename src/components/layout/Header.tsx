import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { Container } from "./Container";

export interface HeaderProps {
  rightSlot?: ReactNode;
}

export function Header({ rightSlot }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
      <Container className="flex h-14 items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-h3 font-bold tracking-tight text-primary"
        >
          <Logo className="h-6 w-6" />
          HOTELow
        </Link>
        <div className="flex items-center gap-2">{rightSlot}</div>
      </Container>
    </header>
  );
}
