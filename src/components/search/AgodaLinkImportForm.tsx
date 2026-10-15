"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoginPromptSheet } from "@/components/auth/LoginPromptSheet";
import { LinkIcon } from "@/components/icons";
import { Button, Input } from "@/components/ui";
import {
  confirmAgodaCandidate,
  importFromAgodaLink,
  type AgodaImportCandidates,
} from "@/lib/hotels/agodaLink/actions";
import type { AgodaCandidate } from "@/lib/hotels/agodaLink/match";

/** Shared by home (src/app/page.tsx) and search (src/app/search/page.tsx) — "붙여넣으면 바로 그 호텔 상세로" is the whole point, so this never shows a confirmation step of its own beyond the candidate picker SerpApi itself couldn't avoid. */
export function AgodaLinkImportForm() {
  const router = useRouter();
  const pathname = usePathname();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [candidateState, setCandidateState] = useState<AgodaImportCandidates | null>(null);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  /**
   * iOS's share sheet "Copy" sometimes puts the title and the URL on the
   * clipboard as two separate items (text/plain = just the title, the URL
   * only in text/uri-list or as an <a href> inside text/html) rather than
   * one combined string — confirmed via a real production paste that
   * reached the server with zero URL in it at all (see
   * importFromAgodaLink's diagnostic log). The default paste-into-input
   * behavior only ever reads text/plain, so it silently drops the link in
   * that case. Check the other clipboard formats ourselves and splice the
   * URL back in before that happens.
   */
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const plain = e.clipboardData.getData("text/plain");
    if (/https?:\/\//i.test(plain)) return; // already has a link — default paste is fine as-is

    const uriList = e.clipboardData.getData("text/uri-list");
    const html = e.clipboardData.getData("text/html");
    let url: string | null = null;
    if (uriList) {
      url = uriList.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.startsWith("#")) ?? null;
    }
    if (!url && html) {
      const match = /<a\s[^>]*href=["']([^"']+)["']/i.exec(html);
      if (match) url = match[1];
    }
    if (!url) return; // nothing extra found — let the normal (text-only) paste happen

    e.preventDefault();
    setInput(plain ? `${plain} ${url}` : url);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setError(null);
    setCandidateState(null);

    startTransition(async () => {
      const result = await importFromAgodaLink(input.trim());
      if ("error" in result) {
        if (result.error === "로그인이 필요해요.") {
          setLoginPromptOpen(true);
        } else {
          setError(result.error);
        }
        return;
      }
      if ("redirectTo" in result) {
        router.push(result.redirectTo);
        return;
      }
      setCandidateState(result);
    });
  }

  function pickCandidate(candidate: AgodaCandidate) {
    if (!candidateState) return;
    setError(null);
    startTransition(async () => {
      const result = await confirmAgodaCandidate(
        candidate,
        candidateState.detailPath,
        candidateState.cityGuess,
        candidateState.stay,
        candidateState.stayExplicit,
        candidateState.nameIsProvisional,
      );
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push(result.redirectTo);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={handlePaste}
          placeholder="아고다 호텔 링크나 공유 문구를 붙여넣으세요"
          leftIcon={<LinkIcon width={18} height={18} />}
          autoComplete="off"
          disabled={isPending}
        />
        <Button type="submit" variant="outline" size="md" fullWidth disabled={isPending || !input.trim()}>
          {isPending ? "확인 중..." : "아고다 링크로 추적하기"}
        </Button>
      </form>

      {error && <p className="text-small text-price-down">{error}</p>}

      {candidateState && (
        <div className="flex flex-col gap-2">
          <p className="text-small text-ink-muted">여러 호텔이 검색됐어요. 맞는 호텔을 골라주세요.</p>
          {candidateState.candidates.map((candidate) => (
            <button
              key={candidate.propertyToken}
              type="button"
              disabled={isPending}
              onClick={() => pickCandidate(candidate)}
              className="flex items-center gap-3 rounded-control border border-border p-2 text-left hover:bg-surface-muted disabled:opacity-60"
            >
              {candidate.image && (
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-control">
                  <Image src={candidate.image} alt={candidate.name} fill unoptimized sizes="48px" className="object-cover" />
                </div>
              )}
              <span className="flex flex-col">
                <span className="text-small font-medium text-ink">{candidate.name}</span>
                {candidate.rating > 0 && (
                  <span className="text-caption text-ink-muted">
                    ★ {candidate.rating.toFixed(1)} ({candidate.reviewCount})
                  </span>
                )}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              router.push(`/search?destination=${encodeURIComponent(candidateState.fallbackSearchQuery)}`)
            }
            className="text-left text-small font-medium text-ink-muted underline-offset-2 hover:underline"
          >
            목록에 없어요 — 이름으로 검색하기
          </button>
        </div>
      )}

      <LoginPromptSheet open={loginPromptOpen} onClose={() => setLoginPromptOpen(false)} next={pathname} />
    </div>
  );
}
