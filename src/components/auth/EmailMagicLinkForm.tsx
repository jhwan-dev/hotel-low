"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Button, Input } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";

export interface EmailMagicLinkFormProps {
  /** Where to land after a successful login. Must be a same-site path. */
  next?: string;
}

/** Passwordless email login — sends a one-time link instead of asking for a password. */
export function EmailMagicLinkForm({ next = "/" }: EmailMagicLinkFormProps) {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setPending(false);
    if (error) {
      setError("로그인 링크를 보내지 못했어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <p className="rounded-control bg-surface-muted p-4 text-center text-small text-ink-muted">
        <span className="font-semibold text-ink">{sentTo}</span>로 로그인 링크를 보냈어요.
        <br />
        메일함에서 링크를 눌러 로그인을 완료해주세요.
      </p>
    );
  }

  if (!showForm) {
    return (
      <Button
        type="button"
        variant="outline"
        size="lg"
        fullWidth
        disabled={!configured}
        onClick={() => setShowForm(true)}
      >
        이메일로 로그인
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
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
        onClick={() => setShowForm(false)}
        className="text-small font-medium text-ink-muted"
      >
        뒤로
      </button>
    </form>
  );
}
