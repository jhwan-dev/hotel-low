import type { SVGProps } from "react";

/**
 * The "H" brand mark — Claude Design "Hotelow Logo Directions" project,
 * symbol g4 (Turn 4 final). Fill is the brand green (#19B89A) hardcoded,
 * not --color-primary — the mark's color is independent of the in-app UI
 * accent color. Same shape backs the Android app icon/splash/notification
 * icon (android/app/src/main/res, generated green-on-white reversed).
 */
export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" fill="#19B89A" aria-hidden="true" {...props}>
      <rect x="24" y="7" width="16" height="86" />
      <rect x="60" y="7" width="16" height="86" />
      <polygon points="39,44 61,53.5 61,62.5 39,53" />
    </svg>
  );
}
