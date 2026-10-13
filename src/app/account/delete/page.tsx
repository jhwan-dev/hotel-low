import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout";
import { LegalSection } from "@/components/legal/LegalSection";
import { CONTACT_EMAIL, SERVICE_NAME } from "@/lib/legal";

export const metadata: Metadata = {
  title: "계정 삭제",
};

/**
 * Public, no-login-required page — Google Play's account-deletion policy
 * requires a web URL reachable without the app installed, entered in Play
 * Console's Data Safety form. The actual deletion itself still happens
 * through the real (OTP-gated) flow at /me, which works from any browser,
 * not just the app — this page explains how to get there, plus a manual
 * fallback for anyone who can't log in.
 */
export default function AccountDeletePage() {
  return (
    <Container className="flex flex-col gap-6 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 text-ink">계정 삭제</h1>
        <p className="text-small text-ink-muted">{SERVICE_NAME}</p>
      </div>

      <div className="flex flex-col gap-6">
        <LegalSection title="삭제 방법">
          <ol className="list-decimal pl-5">
            <li>
              <Link href="/login" className="text-primary underline">
                로그인
              </Link>
              하세요. 계정 생성 때 쓴 이메일로 받는 인증 코드만 있으면 되고, 앱 설치는 필요 없어요.
            </li>
            <li>
              로그인 후 <Link href="/me" className="text-primary underline">마이</Link> 페이지
              맨 아래 &quot;계정 삭제&quot;를 눌러주세요.
            </li>
            <li>안내를 확인하고 삭제를 확정하면 즉시 처리돼요.</li>
          </ol>
          <p>
            이메일에 더 이상 접근할 수 없는 등 위 방법으로 로그인할 수 없다면, 아래 연락처로 삭제를
            요청해주세요.
          </p>
        </LegalSection>

        <LegalSection title="삭제되는 데이터">
          <ul className="list-disc pl-5">
            <li>계정 정보(이메일)</li>
            <li>추적 중인 호텔·여행 날짜·목표 가격 등 가격 추적 설정</li>
            <li>발송된 가격 알림 기록</li>
            <li>기기 푸시 알림 토큰</li>
          </ul>
          <p>삭제는 즉시 처리되며 복구할 수 없습니다.</p>
        </LegalSection>

        <LegalSection title="삭제되지 않는 데이터">
          <p>
            호텔 정보·가격 변동 이력은 특정 이용자가 아닌 호텔과 날짜 기준으로 공유되는 데이터라
            개인정보가 아니며, 계정 삭제와 무관하게 서비스에 남아있습니다.
          </p>
        </LegalSection>

        <LegalSection title="문의처">
          <p>이메일: {CONTACT_EMAIL}</p>
        </LegalSection>
      </div>
    </Container>
  );
}
