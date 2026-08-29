/** "또는" rule between two sign-in methods (Kakao / email) — shared across every login surface so the divider stays visually identical everywhere. */
export function OrDivider() {
  return (
    <div className="flex w-full items-center gap-3 text-caption text-ink-muted">
      <span className="h-px flex-1 bg-border" />
      또는
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
