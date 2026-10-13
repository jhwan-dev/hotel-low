"use client";

import { useState, useTransition } from "react";
import { BottomSheet, Button } from "@/components/ui";
import { deleteAccount } from "@/lib/auth/actions";

export function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      // Success redirects server-side (see deleteAccount), so this only
      // ever resolves with a value on failure.
      const result = await deleteAccount();
      if (result && "error" in result) {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-center text-small font-medium text-price-up"
      >
        계정 삭제
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="계정을 삭제할까요?">
        <div className="flex flex-col gap-4 pb-2 pt-2">
          <p className="text-small text-ink-muted">
            추적 중인 호텔, 알림 기록, 기기 알림 설정을 포함한 모든 데이터가 즉시 삭제되고 복구할 수
            없어요.
          </p>
          {error && <p className="text-small text-price-up">{error}</p>}
          <Button variant="outline" fullWidth disabled={isPending} onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button variant="danger" fullWidth disabled={isPending} onClick={confirm}>
            {isPending ? "삭제 중..." : "삭제"}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
