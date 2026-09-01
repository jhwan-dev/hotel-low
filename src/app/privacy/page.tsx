import type { Metadata } from "next";
import { Container } from "@/components/layout";
import { LegalSection } from "@/components/legal/LegalSection";
import { CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE, SERVICE_NAME } from "@/lib/legal";

export const metadata: Metadata = {
  title: "개인정보처리방침",
};

export default function PrivacyPolicyPage() {
  return (
    <Container className="flex flex-col gap-6 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 text-ink">개인정보처리방침</h1>
        <p className="text-small text-ink-muted">시행일: {LEGAL_EFFECTIVE_DATE}</p>
      </div>

      <p className="text-small text-ink-muted">
        {SERVICE_NAME}(이하 &quot;서비스&quot;)는 이용자의 개인정보를 소중히 다루며, 「개인정보 보호법」 등
        관련 법령을 준수합니다. 본 방침은 서비스가 어떤 개인정보를 수집하고, 어떻게 이용·보관하며, 이용자가
        어떤 권리를 행사할 수 있는지 안내합니다.
      </p>

      <div className="flex flex-col gap-6">
        <LegalSection title="1. 수집하는 개인정보 항목">
          <p>서비스는 다음과 같은 개인정보를 수집합니다.</p>
          <ul className="list-disc pl-5">
            <li>이메일 로그인 시: 이메일 주소</li>
            <li>카카오 로그인 이용 시(제공 예정): 카카오 계정 식별자, 이메일 주소</li>
            <li>
              서비스 이용 과정에서 자동 생성: 가격을 추적하는 호텔·여행 날짜·인원·객실 수 등 추적 조건,
              알림 설정 및 알림 발송 이력
            </li>
            <li>접속 시 자동 수집: 접속 로그, 쿠키(로그인 세션 유지 목적)</li>
          </ul>
          <p>비밀번호, 결제 수단, 주소, 전화번호 등은 수집하지 않습니다.</p>
        </LegalSection>

        <LegalSection title="2. 개인정보의 수집 및 이용 목적">
          <ul className="list-disc pl-5">
            <li>회원 식별 및 이메일·카카오 로그인을 통한 인증</li>
            <li>호텔 가격 추적 서비스 제공 및 가격 변동 알림 발송</li>
            <li>서비스 문의 응대 및 공지사항 전달</li>
          </ul>
        </LegalSection>

        <LegalSection title="3. 개인정보의 보유 및 이용 기간">
          <p>
            이용자의 개인정보는 회원 탈퇴 시 지체 없이 파기합니다. 다만 관계 법령에 따라 보존이 필요한
            경우 해당 법령에서 정한 기간 동안 보관합니다.
          </p>
        </LegalSection>

        <LegalSection title="4. 개인정보의 제3자 제공 및 처리 위탁">
          <p>
            서비스는 원활한 운영을 위해 아래와 같이 개인정보 처리를 위탁하고 있으며, 위탁받은 업체가 별도
            동의 없이 다른 목적으로 이용하지 않도록 관리하고 있습니다.
          </p>
          <ul className="list-disc pl-5">
            <li>Supabase(데이터베이스·인증 인프라) — 회원 인증 및 서비스 데이터 저장</li>
            <li>Resend(이메일 발송 인프라) — 로그인 인증 코드 및 가격 알림 메일 발송</li>
            <li>Kakao(카카오 로그인, 제공 예정) — 소셜 로그인 인증</li>
          </ul>
          <p>법령에 근거하거나 이용자의 별도 동의가 있는 경우를 제외하고 제3자에게 제공하지 않습니다.</p>
        </LegalSection>

        <LegalSection title="5. 쿠키의 운영">
          <p>
            서비스는 로그인 상태 유지를 위해 쿠키를 사용합니다. 브라우저 설정을 통해 쿠키 저장을 거부할
            수 있으나, 이 경우 로그인이 필요한 기능(가격 추적, 알림 등)을 이용하기 어려울 수 있습니다.
          </p>
        </LegalSection>

        <LegalSection title="6. 이용자의 권리와 행사 방법">
          <p>
            이용자는 언제든지 자신의 개인정보 열람·정정·삭제·처리정지를 요청할 수 있습니다. 아래 연락처로
            문의하시면 지체 없이 조치합니다.
          </p>
        </LegalSection>

        <LegalSection title="7. 개인정보 보호책임자 및 문의처">
          <p>이메일: {CONTACT_EMAIL}</p>
        </LegalSection>

        <LegalSection title="8. 고지의 의무">
          <p>
            본 방침의 내용이 추가·삭제·수정되는 경우 시행일 이전에 서비스 내 공지를 통해 안내합니다.
          </p>
        </LegalSection>
      </div>
    </Container>
  );
}
