/**
 * Kakao's default OAuth scope (set by Supabase's Kakao provider) includes
 * account_email, which our Kakao app has no consent for yet — Kakao's
 * authorize endpoint rejects the request outright until that consent item
 * is approved through their review process. Flip this env var to "true"
 * once that review passes; no code change needed.
 */
export function isKakaoLoginEnabled(): boolean {
  return process.env.NEXT_PUBLIC_KAKAO_LOGIN_ENABLED === "true";
}
