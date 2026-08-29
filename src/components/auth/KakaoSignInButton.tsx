"use client";

import { useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";
import { KakaoIcon } from "./KakaoIcon";

export interface KakaoSignInButtonProps {
  /** Where to land after a successful login. Must be a same-site path. */
  next?: string;
  className?: string;
  fullWidth?: boolean;
}

export function KakaoSignInButton({ next = "/", className, fullWidth }: KakaoSignInButtonProps) {
  const [isPending, setPending] = useState(false);
  const configured = isSupabaseConfigured();

  async function handleClick() {
    setPending(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo },
    });
    // On success the browser navigates away to Kakao immediately; we only
    // ever get here to reset the button if the request itself failed.
    if (error) setPending(false);
  }

  return (
    <Button
      type="button"
      variant="kakao"
      disabled={!configured || isPending}
      onClick={handleClick}
      fullWidth={fullWidth}
      className={className}
    >
      <KakaoIcon />
      {isPending ? "이동 중..." : "카카오로 계속하기"}
    </Button>
  );
}
