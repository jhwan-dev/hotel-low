"use client";

import { BellIcon } from "@/components/icons";
import { BottomSheet, Button } from "@/components/ui";

export interface PushPermissionPromptProps {
  open: boolean;
  onClose: () => void;
  /** Called when the user taps "알림 받기" — the caller triggers the actual OS permission dialog. */
  onConfirm: () => void;
}

/**
 * Shown once, right after a user's first successful "가격 추적 시작" — never
 * on app launch. src/lib/push/permission.ts's getPushPermissionState() is
 * what actually decides whether this renders at all: PriceTrackingCta only
 * opens it when the OS permission is still undecided ("prompt"), so a user
 * who already granted or denied never sees it again.
 */
export function PushPermissionPrompt({ open, onClose, onConfirm }: PushPermissionPromptProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="알림을 켜둘까요?">
      <div className="flex flex-col items-center gap-4 pb-2 pt-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
          <BellIcon width={26} height={26} />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-body font-semibold text-ink">가격이 떨어지면 알려드릴게요.</p>
          <p className="text-small text-ink-muted">
            지금 추적을 시작한 호텔의 가격이 내려가면 알림으로 바로 알려드려요.
          </p>
        </div>
        <Button size="lg" fullWidth onClick={onConfirm}>
          알림 받기
        </Button>
        <button type="button" onClick={onClose} className="text-small font-medium text-ink-muted">
          나중에
        </button>
      </div>
    </BottomSheet>
  );
}
