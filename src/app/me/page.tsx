import Link from "next/link";
import type { Metadata } from "next";
import { DeleteAccountButton } from "@/components/account/DeleteAccountButton";
import { EmailMagicLinkForm } from "@/components/auth/EmailMagicLinkForm";
import { Container } from "@/components/layout";
import { PushPermissionStatus } from "@/components/push/PushPermissionStatus";
import { Button, Card, CardBody } from "@/components/ui";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export const metadata: Metadata = {
  title: "마이",
};

export const dynamic = "force-dynamic";

export default async function MePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Container className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <h1 className="text-h1 text-ink">마이</h1>
        <p className="text-body text-ink-muted">로그인하면 계정 정보를 볼 수 있어요.</p>
        <div className="flex w-full max-w-xs flex-col items-center gap-4 pt-2">
          <EmailMagicLinkForm next="/me" />
        </div>
      </Container>
    );
  }

  if (user.isMock) {
    return (
      <Container className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <h1 className="text-h1 text-ink">마이</h1>
        <p className="text-body text-ink-muted">
          데모 모드로 실행 중이에요. Supabase를 연결하면 실제 계정 기능을 쓸 수 있어요.
        </p>
      </Container>
    );
  }

  return (
    <Container className="flex flex-col gap-5 py-6">
      <h1 className="text-h1 text-ink">마이</h1>

      <Card>
        <CardBody>
          <span className="text-caption text-ink-muted">로그인 계정</span>
          <span className="text-body font-medium text-ink">{user.email}</span>
        </CardBody>
      </Card>

      <PushPermissionStatus />

      <Card>
        <CardBody className="gap-3">
          <Link href="/privacy" className="text-small text-ink">
            개인정보처리방침
          </Link>
          <Link href="/terms" className="text-small text-ink">
            이용약관
          </Link>
        </CardBody>
      </Card>

      <form action={signOut.bind(null, "/")}>
        <Button type="submit" variant="outline" fullWidth>
          로그아웃
        </Button>
      </form>

      <div className="pt-4">
        <DeleteAccountButton />
      </div>
    </Container>
  );
}
