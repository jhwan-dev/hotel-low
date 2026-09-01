import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { EmailMagicLinkForm } from "@/components/auth/EmailMagicLinkForm";
import { KakaoSignInButton } from "@/components/auth/KakaoSignInButton";
import { OrDivider } from "@/components/auth/OrDivider";
import { Container } from "@/components/layout";
import { LegalConsentNotice } from "@/components/legal/LegalConsentNotice";
import { isKakaoLoginEnabled } from "@/lib/auth/featureFlags";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { safeNextPath } from "@/lib/auth/safeNextPath";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "로그인",
  robots: { index: false, follow: false },
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = safeNextPath(firstParam(sp.next));

  const user = await getCurrentUser();
  if (user && !user.isMock) {
    redirect(next);
  }

  return (
    <Container className="flex flex-1 flex-col items-center justify-center gap-6 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-h1 font-bold text-primary">HOTELow</span>
        <p className="text-body text-ink-muted">
          로그인하고 관심 있는 호텔의 가격 변화를 추적해보세요.
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col items-center gap-4">
        {isSupabaseConfigured() ? (
          <>
            {isKakaoLoginEnabled() && (
              <>
                <KakaoSignInButton next={next} fullWidth />
                <OrDivider />
              </>
            )}
            <EmailMagicLinkForm next={next} />
            <LegalConsentNotice />
          </>
        ) : (
          <p className="rounded-control bg-surface-muted p-4 text-center text-small text-ink-muted">
            로그인 기능은 아직 준비 중이에요.
          </p>
        )}
      </div>
    </Container>
  );
}
