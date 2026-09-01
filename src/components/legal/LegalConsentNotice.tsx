import Link from "next/link";

/** Small consent notice shown near login actions, linking to the two legal pages. */
export function LegalConsentNotice() {
  return (
    <p className="text-center text-caption text-ink-muted">
      계속 진행하면{" "}
      <Link href="/terms" className="underline">
        이용약관
      </Link>{" "}
      및{" "}
      <Link href="/privacy" className="underline">
        개인정보처리방침
      </Link>
      에 동의하는 것으로 간주됩니다.
    </p>
  );
}
