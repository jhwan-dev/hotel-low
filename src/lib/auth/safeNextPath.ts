/**
 * Only ever redirect to a path on our own site. Without this, a `?next=`
 * query param would be an open redirect: `//evil.com` or `https://evil.com`
 * both parse as "not a same-site path" and get rejected.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
