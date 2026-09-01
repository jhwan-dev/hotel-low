import type { Metadata } from "next";
import { Container } from "@/components/layout";
import { LegalSection } from "@/components/legal/LegalSection";
import { CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE, SERVICE_NAME } from "@/lib/legal";

export const metadata: Metadata = {
  title: "이용약관",
};

export default function TermsOfServicePage() {
  return (
    <Container className="flex flex-col gap-6 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 text-ink">이용약관</h1>
        <p className="text-small text-ink-muted">시행일: {LEGAL_EFFECTIVE_DATE}</p>
      </div>

      <div className="flex flex-col gap-6">
        <LegalSection title="제1조 (목적)">
          <p>
            본 약관은 {SERVICE_NAME}(이하 &quot;서비스&quot;)가 제공하는 호텔 가격 추적 및 알림 서비스의
            이용과 관련하여 서비스와 이용자 간의 권리, 의무 및 책임사항을 정함을 목적으로 합니다.
          </p>
        </LegalSection>

        <LegalSection title="제2조 (서비스의 내용)">
          <p>서비스는 다음과 같은 기능을 제공합니다.</p>
          <ul className="list-disc pl-5">
            <li>여행 날짜·인원·객실 조건에 따른 호텔 가격 정보 제공</li>
            <li>이용자가 지정한 조건의 가격 변동 추적 및 알림</li>
          </ul>
          <p>
            서비스가 제공하는 가격 정보는 제휴 예약 플랫폼(Agoda 등)의 정보를 참고용으로 가공한 것으로,
            실제 예약 가능 여부와 최종 결제 금액은 반드시 해당 예약 플랫폼에서 다시 확인해야 합니다. 서비스는
            예약을 직접 대행하거나 결제를 처리하지 않습니다.
          </p>
        </LegalSection>

        <LegalSection title="제3조 (약관의 효력 및 변경)">
          <p>
            본 약관은 서비스 화면에 게시함으로써 효력이 발생합니다. 서비스는 관련 법령을 위반하지 않는
            범위에서 약관을 변경할 수 있으며, 변경 시 적용일자 및 변경 사유를 명시하여 사전에 공지합니다.
          </p>
        </LegalSection>

        <LegalSection title="제4조 (회원가입 및 계정 관리)">
          <ul className="list-disc pl-5">
            <li>이용자는 이메일 인증 코드 또는 카카오 로그인을 통해 서비스에 가입할 수 있습니다.</li>
            <li>이용자는 본인의 계정 및 인증 수단을 안전하게 관리할 책임이 있습니다.</li>
            <li>
              타인의 이메일 또는 계정을 무단으로 사용하거나, 허위 정보로 가입하는 행위는 금지됩니다.
            </li>
          </ul>
        </LegalSection>

        <LegalSection title="제5조 (이용자의 의무)">
          <p>이용자는 다음 각 호의 행위를 해서는 안 됩니다.</p>
          <ul className="list-disc pl-5">
            <li>서비스의 정상적인 운영을 방해하는 행위(비정상적인 반복 요청, 자동화된 접근 등)</li>
            <li>서비스에서 얻은 정보를 서비스가 허용한 목적 외로 상업적으로 이용하는 행위</li>
            <li>관련 법령 및 공서양속에 반하는 행위</li>
          </ul>
        </LegalSection>

        <LegalSection title="제6조 (서비스의 변경 및 중단)">
          <p>
            서비스는 운영상·기술상 필요에 따라 제공하는 기능의 전부 또는 일부를 변경하거나 중단할 수
            있으며, 이 경우 사전에 공지합니다. 다만 긴급한 장애 대응 등 부득이한 경우 사후에 공지할 수
            있습니다.
          </p>
        </LegalSection>

        <LegalSection title="제7조 (면책조항)">
          <ul className="list-disc pl-5">
            <li>
              서비스가 제공하는 가격·재고 정보는 제휴 플랫폼의 데이터를 기반으로 하며, 실시간 변동, 제휴
              플랫폼의 사정 등으로 실제 예약 시점의 가격과 다를 수 있습니다. 서비스는 정보의 정확성을
              보증하지 않습니다.
            </li>
            <li>
              이용자가 제휴 예약 플랫폼에서 진행한 예약·결제·취소 등과 관련한 분쟁은 해당 플랫폼과
              이용자 간에 해결하여야 하며, 서비스는 이에 대해 책임을 지지 않습니다.
            </li>
            <li>
              천재지변, 통신 장애 등 서비스의 책임 없는 사유로 서비스를 제공할 수 없는 경우 책임이
              면제됩니다.
            </li>
          </ul>
        </LegalSection>

        <LegalSection title="제8조 (지적재산권)">
          <p>
            서비스에서 제공하는 콘텐츠(디자인, 로고, 텍스트 등)에 대한 저작권 및 지적재산권은 서비스에
            귀속되며, 이용자는 서비스의 사전 동의 없이 이를 복제·배포·상업적으로 이용할 수 없습니다.
          </p>
        </LegalSection>

        <LegalSection title="제9조 (준거법 및 관할)">
          <p>
            본 약관은 대한민국 법령에 따라 해석되며, 서비스와 이용자 간 분쟁에 관한 소송은 관련 법령이
            정한 절차에 따릅니다.
          </p>
        </LegalSection>

        <LegalSection title="제10조 (문의처)">
          <p>서비스 이용 관련 문의: {CONTACT_EMAIL}</p>
        </LegalSection>
      </div>
    </Container>
  );
}
