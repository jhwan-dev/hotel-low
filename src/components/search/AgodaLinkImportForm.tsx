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
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [candidateState, setCandidateState] = useState<AgodaImportCandidates | null>(null);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setError(null);
    setCandidateState(null);

    startTransition(async () => {
      const result = await importFromAgodaLink(url.trim());
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
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="아고다 호텔 링크를 붙여넣으세요"
          leftIcon={<LinkIcon width={18} height={18} />}
          autoComplete="off"
          disabled={isPending}
        />
        <Button type="submit" variant="outline" size="md" fullWidth disabled={isPending || !url.trim()}>
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
