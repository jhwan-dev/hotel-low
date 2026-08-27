import Image from "next/image";
import { Container } from "@/components/layout";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardMedia,
  Input,
  PriceChangeIndicator,
} from "@/components/ui";
import { SearchIcon, StarIcon, HeartIcon } from "@/components/icons";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 py-8">
      <h2 className="text-h2 text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="h-16 w-full rounded-control border border-border"
        style={{ background: `var(${varName})` }}
      />
      <div className="text-small text-ink-muted">{name}</div>
    </div>
  );
}

export default function Home() {
  return (
    <Container className="divide-y divide-border">
      <Section title="Typography">
        <div className="flex flex-col gap-3">
          <p className="text-display text-ink">Display 32</p>
          <p className="text-h1 text-ink">Heading 1 · 24</p>
          <p className="text-h2 text-ink">Heading 2 · 20</p>
          <p className="text-h3 text-ink">Heading 3 · 17</p>
          <p className="text-body text-ink">
            Body 15 — 여행 날짜와 호텔을 선택하면 가격을 지속적으로 추적합니다.
          </p>
          <p className="text-small text-ink-muted">Small 13 — 보조 설명 텍스트</p>
          <p className="text-caption text-ink-muted">CAPTION 12</p>
          <p className="text-price-lg tabular-nums text-ink">₩128,400</p>
          <p className="text-price-md tabular-nums text-ink">₩128,400</p>
          <p className="text-price-sm tabular-nums text-ink">₩128,400</p>
        </div>
      </Section>

      <Section title="Color — Brand">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
          <Swatch name="primary" varName="--color-primary" />
          <Swatch name="primary-hover" varName="--color-primary-hover" />
          <Swatch name="primary-light" varName="--color-primary-light" />
          <Swatch name="primary-light-2" varName="--color-primary-light-2" />
          <Swatch name="ink" varName="--color-ink" />
        </div>
      </Section>

      <Section title="Color — Price semantic">
        <div className="grid grid-cols-3 gap-4">
          <Swatch name="price-down" varName="--color-price-down" />
          <Swatch name="price-up" varName="--color-price-up" />
          <Swatch name="price-neutral" varName="--color-price-neutral" />
        </div>
        <div className="flex flex-wrap gap-4">
          <PriceChangeIndicator trend="down" label="-12% · 8,000원 하락" />
          <PriceChangeIndicator trend="up" label="+5% · 3,000원 상승" />
          <PriceChangeIndicator trend="neutral" label="변동 없음" />
        </div>
      </Section>

      <Section title="Button">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">가격 추적 시작</Button>
          <Button variant="secondary">관심 호텔 저장</Button>
          <Button variant="outline">필터</Button>
          <Button variant="ghost">더보기</Button>
          <Button variant="primary" disabled>
            품절
          </Button>
        </div>
        <div className="flex flex-col gap-3 sm:max-w-xs">
          <Button variant="primary" size="lg" fullWidth>
            Booking Now
          </Button>
        </div>
      </Section>

      <Section title="Input">
        <div className="flex flex-col gap-4 sm:max-w-sm">
          <Input label="호텔 검색" placeholder="지역, 호텔명으로 검색" leftIcon={<SearchIcon width={18} height={18} />} />
          <Input
            label="이메일"
            placeholder="you@example.com"
            helperText="가격 하락 알림을 받을 이메일입니다."
          />
          <Input label="쿠폰 코드" placeholder="CODE" errorText="유효하지 않은 코드입니다." />
        </div>
      </Section>

      <Section title="Badge">
        <div className="flex flex-wrap gap-2">
          <Badge variant="default">기본</Badge>
          <Badge variant="primary">추천</Badge>
          <Badge variant="priceDown">가격 하락</Badge>
          <Badge variant="priceUp">가격 상승</Badge>
          <Badge variant="neutral">변동 없음</Badge>
          <Badge variant="outline">무료 취소</Badge>
        </div>
      </Section>

      <Section title="Card">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardMedia>
              <Image
                src="/window.svg"
                alt="샘플 호텔 이미지"
                fill
                className="object-cover"
              />
              <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 text-price-up">
                <HeartIcon width={16} height={16} />
              </span>
            </CardMedia>
            <CardBody>
              <div className="flex items-center justify-between">
                <h3 className="text-h3 text-ink">The Aston Vill Hotel</h3>
                <span className="flex items-center gap-1 text-small text-ink">
                  <StarIcon width={14} height={14} className="text-primary-light-2" />
                  5.0
                </span>
              </div>
              <p className="text-small text-ink-muted">Alice Springs NT 0870, Australia</p>
              <div className="flex items-baseline gap-2">
                <span className="text-price-md tabular-nums text-ink">₩268,900</span>
                <span className="text-small text-ink-muted">/박</span>
              </div>
              <PriceChangeIndicator trend="down" label="지난주보다 8% 하락" />
            </CardBody>
            <CardFooter>
              <Badge variant="outline">무료 취소</Badge>
              <Button size="sm">가격 추적</Button>
            </CardFooter>
          </Card>
        </div>
      </Section>
    </Container>
  );
}
