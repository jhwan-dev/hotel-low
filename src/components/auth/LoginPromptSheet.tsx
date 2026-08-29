import { BellIcon } from "@/components/icons";
import { BottomSheet } from "@/components/ui";
import { isKakaoLoginEnabled } from "@/lib/auth/featureFlags";
import { EmailMagicLinkForm } from "./EmailMagicLinkForm";
import { KakaoSignInButton } from "./KakaoSignInButton";
import { OrDivider } from "./OrDivider";

export interface LoginPromptSheetProps {
  open: boolean;
  onClose: () => void;
  /** Where to return to after login — typically the current hotel detail page. */
  next: string;
}

/** Shown in place of the tracking settings sheet when the user isn't signed in yet. */
export function LoginPromptSheet({ open, onClose, next }: LoginPromptSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="로그인이 필요해요">
      <div className="flex flex-col items-center gap-4 pb-2 pt-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
          <BellIcon width={26} height={26} />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-body font-semibold text-ink">가격 추적은 로그인 후 이용할 수 있어요.</p>
          <p className="text-small text-ink-muted">
            로그인하면 추적 목록이 저장되고, 가격이 내려가면 알려드려요.
          </p>
        </div>
        {isKakaoLoginEnabled() && (
          <>
            <KakaoSignInButton next={next} fullWidth />
            <OrDivider />
          </>
        )}
        <EmailMagicLinkForm next={next} />
      </div>
    </BottomSheet>
  );
}
