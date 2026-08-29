import type { SVGProps } from "react";

/** Kakao's speech-bubble "talk" mark, used only on the sign-in button per their branding guidelines. */
export function KakaoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" width={18} height={18} {...props}>
      <path
        fill="#191919"
        d="M9 2.25C4.72 2.25 1.25 4.98 1.25 8.36c0 2.15 1.4 4.04 3.53 5.14-.15.57-.57 2.11-.65 2.44-.1.4.15.4.31.29.13-.09 2.05-1.4 2.88-1.96.55.08 1.12.13 1.68.13 4.28 0 7.75-2.73 7.75-6.1S13.28 2.25 9 2.25Z"
      />
    </svg>
  );
}
