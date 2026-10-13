"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { Container } from "@/components/layout";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Store-reviewer-only sign-in. Not linked from anywhere in the app — the
 * URL is handed to Play Console / App Review as a private reviewer note,
 * never shown in the UI. Exists because reviewers can't receive the email
 * OTP code every other account uses (see EmailMagicLinkForm.tsx).
 *
 * Safe to leave reachable by anyone who finds the URL: every real account
 * was created via OTP and has no password hash at all, so
 * signInWithPassword() fails against them regardless of what's guessed —
 * only the one admin-created reviewer row has a password, and Supabase
 * Auth rate-limits sign-in attempts against it.
 */
export default function ReviewerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  async function handleSubmit(event: FormEvent) {
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
    router.push("/");
    router.refresh();
  }

  return (
    <Container className="flex flex-1 flex-col items-center justify-center gap-6 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-h1 font-bold text-primary">HOTELow</span>
        <p className="text-body text-ink-muted">리뷰어 로그인</p>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
        <Input
          type="email"
          required
          autoFocus
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={!configured || isPending}
        />
        <Input
          type="password"
          required
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={!configured || isPending}
          errorText={error ?? undefined}
        />
        <Button type="submit" disabled={!configured || isPending} fullWidth>
          {isPending ? "로그인 중..." : "로그인"}
        </Button>
      </form>
    </Container>
  );
}
