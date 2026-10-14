"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, OtpInput } from "@/components/ui";
import { checkIsReviewerEmail } from "@/lib/auth/actions";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";

export interface EmailMagicLinkFormProps {
  /** Where to land after a successful login. Must be a same-site path. */
  next?: string;
  /**
   * Called right after a successful login (OTP or reviewer password),
   * before the redirect. `next` is very often the page the form is
   * already showing on (e.g. a LoginPromptSheet's `next` is just the
   * current path) — `router.push(next)` alone is then a no-op navigation
   * and this form's own "code"/"password" step state never resets, so a
   * caller rendering this inside a modal (LoginPromptSheet) MUST pass this
   * to close it. Otherwise the OTP input just sits there, looking like
   * nothing happened even though the user is now signed in.
   */
  onSuccess?: () => void;
}

type Step = "trigger" | "email" | "code" | "password" | "success";

const CODE_LENGTH = 6;

/**
 * Passwordless email login via a 6-digit code — no clickable link. A link
 * only completes sign-in in whichever browser/app opens it, which is very
 * often *not* the browser the user is actually sitting in (a mail app's
 * in-app browser, a different device) — each keeps its own separate
 * cookies, and some in-app browsers fail to load the page at all. Typing
 * the code back in here instead completes sign-in in this exact tab, with
 * no navigation or hand-off involved.
 */
export function EmailMagicLinkForm({ next = "/", onSuccess }: EmailMagicLinkFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("trigger");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  async function handleSendCode(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    // Store reviewers can't receive the OTP email, so the one account
    // created for them (REVIEWER_EMAIL, checked server-side — see
    // checkIsReviewerEmail) signs in with a password instead. Every other
    // email takes the normal OTP path below.
    if (await checkIsReviewerEmail(email)) {
      setPending(false);
      setStep("password");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email });
    setPending(false);
    if (error) {
      setError("코드를 보내지 못했어요. 잠시 후 다시 시도해주세요.");
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
    setStep("success");
    onSuccess?.();
    router.push(next);
    router.refresh();
  }

  async function handlePasswordSignIn(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);
    if (error) {
      setError("로그인하지 못했어요.");
      return;
    }
    setStep("success");
    onSuccess?.();
    router.push(next);
    router.refresh();
  }

  if (step === "success") {
    return (
      <p className="flex w-full items-center justify-center gap-2 rounded-control bg-primary-light p-4 text-small font-semibold text-primary">
        ✓ 로그인됐어요
      </p>
    );
  }

  if (step === "password") {
    return (
      <form onSubmit={handlePasswordSignIn} className="flex w-full flex-col gap-3">
        <Input
          type="password"
          required
          autoFocus
          placeholder="비밀번호"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isPending}
          errorText={error ?? undefined}
        />
        <Button type="submit" disabled={isPending} fullWidth>
          {isPending ? "로그인 중..." : "로그인"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setPassword("");
            setError(null);
          }}
          className="text-small font-medium text-ink-muted"
        >
          뒤로
        </button>
      </form>
    );
  }

  if (step === "code") {
    return (
      <div className="flex w-full flex-col gap-3">
        <p className="rounded-control bg-surface-muted p-4 text-center text-small text-ink-muted">
          <span className="font-semibold text-ink">{email}</span>로 인증 코드를 보냈어요.
          <br />
          메일함에서 받은 {CODE_LENGTH}자리 코드를 입력해주세요.
        </p>
        <form onSubmit={handleVerifyCode} className="flex w-full flex-col gap-3">
          <OtpInput
            length={CODE_LENGTH}
            value={code}
            onChange={setCode}
            autoFocus
            disabled={isPending}
            errorText={error ?? undefined}
          />
          <Button type="submit" disabled={isPending || code.length < CODE_LENGTH} fullWidth>
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
    <form onSubmit={handleSendCode} className="flex w-full flex-col gap-3">
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
        {isPending ? "전송 중..." : "인증 코드 받기"}
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
