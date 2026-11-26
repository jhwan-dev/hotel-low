# HOTELow

호텔 가격이 내려가면 알려드리는 가격 추적 서비스입니다. 날짜·인원을 정해 호텔을 추적하면 매일 가격을 확인해 그래프로 보여주고, 떨어졌을 때 알림을 보냅니다.

## 기술 스택

- **Next.js 16** (App Router) + React + TypeScript
- **Supabase** — Postgres, Auth(카카오/이메일), Row Level Security
- **SerpApi** — 아고다 실시간 가격 조회 (Google Hotels 엔진)
- **Capacitor** — Android 앱 쉘, 푸시 수신
- **FCM (Firebase Cloud Messaging)** — 푸시 알림 발송
- **Vercel** — 호스팅 + Cron

## 아키텍처

```
Vercel Cron (매일 KST 09시)
  └─ /api/notifications/check
       ├─ 추적 중인 (호텔, 일정, 인원) 조합마다 SerpApi로 현재가 조회
       ├─ hotel_price_history 에 가격 기록 (append-only 로그)
       └─ 목표가 도달 / 가격 하락 / 30일 최저가 조건이면 price_alerts 생성 + FCM 푸시
```

- `hotel_price_history`가 가격 그래프의 유일한 데이터 소스입니다. 아고다 Search API는 "현재가"만 알려줄 뿐 과거 가격 이력을 제공하지 않으므로, 추적을 시작한 시점부터 직접 쌓은 로그가 곧 그래프입니다.
- SerpApi 호출은 일일 한도가 있어 크론과 추적 시작(tracking-start) 요청이 예산을 나눠 씁니다(`src/lib/serpapi/callBudget.ts`).
- 홈 화면·검색 결과는 SerpApi를 직접 호출하지 않고 `hotel_price_history`에 이미 쌓인 값만 읽습니다.

## 실행 방법

```bash
npm install
cp .env.example .env.local   # 값 채우기 (Supabase, SerpApi, FCM 등)
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 확인할 수 있습니다.

`.env.local`에 Supabase/SerpApi 키를 채우지 않으면 메모리 기반 목(mock) 호텔 데이터로 동작합니다 — 각 환경변수의 역할은 `.env.example`의 주석을 참고하세요.

### 주요 스크립트

```bash
npm run build        # 프로덕션 빌드
npm run lint          # ESLint
npm run verify:serpapi   # SerpApi 연동 점검 (.env.local 필요)
```

데이터베이스 스키마는 `supabase/migrations/`에 순서대로 정리되어 있습니다.
