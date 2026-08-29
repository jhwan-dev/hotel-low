"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";

export interface EmailMagicLinkFormProps {
  /** Where to land after a successful login. Must be a same-site path. */
  next?: string;
}

type Step = "trigger" | "email" | "code";

/**
 * Passwordless email login. Sends both a clickable link and a 6-digit code:
 * the link only completes sign-in in whichever browser/app opens it, which
 * is very often *not* the browser the user is actually sitting in (e.g. it
 * opens in the mail app's in-app browser, or a different app entirely on
 * mobile) — each keeps its own separate cookies, so that tab shows signed
 * in and the one the user started from doesn't. Typing the code back in
 * here instead completes sign-in in this exact tab, with no hand-off.
 */
export function EmailMagicLinkForm({ next = "/" }: EmailMagicLinkFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("trigger");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  async function handleSendLink(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createClient();
    // Just the final destination — the Magic Link email template embeds this
    // as {{ .RedirectTo }} in a link to /auth/confirm, which verifies the
    // OTP token itself (see that route for why, vs. /auth/callback's PKCE
    // code exchange used for Kakao).
    const redirectTo = `${window.location.origin}${next}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setPending(false);
    if (error) {
      setError("로그인 링크를 보내지 못했어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    setStep("code");
  }

  async function handleVerifyCode(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setPending(false);
    if (error) {
      setError("코드가 올바르지 않거나 만료됐어요.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  if (step === "code") {
    return (
      <div className="flex w-full flex-col gap-3">
        <p className="rounded-control bg-surface-muted p-4 text-center text-small text-ink-muted">
          <span className="font-semibold text-ink">{email}</span>로 로그인 링크와 6자리 코드를
          보냈어요.
          <br />
          메일함에서 링크를 눌러도 되고, 지금 이 화면에서 코드를 입력해도 로그인할 수 있어요.
        </p>
        <form onSubmit={handleVerifyCode} className="flex w-full flex-col gap-3">
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="6자리 코드"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            disabled={isPending}
            errorText={error ?? undefined}
          />
          <Button type="submit" disabled={isPending || code.length < 6} fullWidth>
            {isPending ? "확인 중..." : "코드로 로그인"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className="text-small font-medium text-ink-muted"
          >
            다른 이메일로 다시 받기
          </button>
        </form>
      </div>
    );
  }

  if (step === "trigger") {
    return (
      <Button
        type="button"
        variant="outline"
        size="lg"
        fullWidth
        disabled={!configured}
        onClick={() => setStep("email")}
      >
        이메일로 로그인
      </Button>
    );
  }

  return (
    <form onSubmit={handleSendLink} className="flex w-full flex-col gap-3">
      <Input
        type="email"
        required
        autoFocus
        placeholder="이메일 주소"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={!configured || isPending}
        errorText={error ?? undefined}
      />
      <Button type="submit" disabled={!configured || isPending} fullWidth>
        {isPending ? "전송 중..." : "이메일로 로그인 링크 받기"}
      </Button>
      <button
        type="button"
        onClick={() => setStep("trigger")}
        className="text-small font-medium text-ink-muted"
      >
        뒤로
      </button>
    </form>
  );
}
