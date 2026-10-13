import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Besides the usual static-asset excludes: privacy/terms/account/delete/
  // style-guide render no signed-in-dependent content at all (none of them
  // call getCurrentUser()), and api/notifications/check authenticates via
  // its own CRON_SECRET bearer check, never a Supabase session — all five
  // get nothing from a session-cookie refresh, so there's no reason to
  // spend a Supabase Auth round-trip on every request to them. Every other
  // route still goes through updateSession() as before.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|privacy|terms|account/delete|style-guide|api/notifications/check|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
