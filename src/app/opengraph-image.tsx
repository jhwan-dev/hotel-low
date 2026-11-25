import { ImageResponse } from "next/og";

export const alt = "HOTELow — 호텔 가격이 내려가면 알려드려요";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Link-preview card (og:image / twitter:image), generated at build time.
 *
 * Same brand pieces as the app's header — the green "H" mark and the indigo
 * "HOTELow" wordmark — set on a light card with a sample price-drop panel.
 * Copy stays English/Latin-only on purpose: the image is drawn by Satori with
 * its built-in Latin font, and Hangul would need a Korean font file bundled
 * into the route (the whole bundle has to stay small). Korean copy still
 * reaches share sheets through og:title/og:description, which are metadata
 * strings, not pixels.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          backgroundColor: "#f7f7fb",
          padding: "72px 80px 64px",
          color: "#101010",
        }}
      >
        {/* Soft brand glow, clipped by the frame */}
        <div
          style={{
            position: "absolute",
            top: -220,
            right: -160,
            width: 620,
            height: 620,
            borderRadius: 9999,
            background: "linear-gradient(135deg, #e4e4fa 0%, #f7f7fb 70%)",
            display: "flex",
          }}
        />

        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="52" height="52" viewBox="0 0 100 100" fill="#19B89A">
            <rect x="24" y="7" width="16" height="86" />
            <rect x="60" y="7" width="16" height="86" />
            <polygon points="39,44 61,53.5 61,62.5 39,53" />
          </svg>
          <div style={{ fontSize: 42, letterSpacing: -1.5, color: "#4c4ddc" }}>HOTELow</div>
        </div>

        {/* Headline + sample price panel */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 22, width: 640 }}>
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                padding: "8px 18px",
                borderRadius: 9999,
                backgroundColor: "#e4e4fa",
                color: "#4c4ddc",
                fontSize: 22,
                letterSpacing: 2,
              }}
            >
              PRICE TRACKING
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 76,
                lineHeight: 1.12,
                letterSpacing: -2,
              }}
            >
              <div style={{ display: "flex" }}>Hotel prices drop.</div>
              <div style={{ display: "flex" }}>We tell you when.</div>
            </div>
            <div style={{ fontSize: 28, lineHeight: 1.4, color: "#5b5d6b" }}>
              Pick your dates, track your stay, and get a heads-up the moment the rate falls.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              width: 340,
              padding: "28px 30px",
              borderRadius: 32,
              backgroundColor: "#ffffff",
              border: "1px solid #e1e1e1",
              boxShadow: "0 18px 40px rgba(16, 16, 16, 0.08)",
            }}
          >
            <div style={{ display: "flex", fontSize: 22, color: "#5b5d6b" }}>Osaka · 3 nights</div>
            <div
              style={{
                display: "flex",
                fontSize: 26,
                color: "#5b5d6b",
                textDecoration: "line-through",
              }}
            >
              182,000 KRW
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: 46, letterSpacing: -1 }}>149,000</div>
              <div
                style={{
                  display: "flex",
                  padding: "6px 14px",
                  borderRadius: 9999,
                  backgroundColor: "#e7f8ed",
                  color: "#16a34a",
                  fontSize: 24,
                }}
              >
                -18%
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 22, color: "#5b5d6b" }}>KRW · total stay</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 24, color: "#5b5d6b" }}>hotel-low.vercel.app</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 160, height: 6, borderRadius: 9999, backgroundColor: "#19B89A", display: "flex" }} />
            <div style={{ fontSize: 24, color: "#5b5d6b" }}>Hotel price alerts</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
