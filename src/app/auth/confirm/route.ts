import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/safeNextPath";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase redirects here after an email magic-link click (see the "Magic
 * Link" template in the Supabase dashboard — it must point at
 * `/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}`,
 * not the default hosted `{{ .ConfirmationURL }}`).
 *
 * This verifies the OTP token directly against Supabase's auth server
 * instead of exchanging a PKCE `code` (see /auth/callback, used for Kakao).
 * A PKCE exchange needs the code_verifier that was stored in the browser
 * that *requested* the link — which fails whenever the link is opened in a
 * different browser/app than the one used to sign in (e.g. a Mail app's
 * in-app browser on mobile, or a different device entirely). verifyOtp has
 * no such requirement: the token_hash is a self-contained proof, valid from
 * any device.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
