import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Site-wide default OG/Twitter card — route-specific pages (e.g. hotels/[id]) override this with their own. */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 24,
          background: "#4c4ddc",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 120, fontWeight: 700, letterSpacing: -2 }}>
          HOTELow
        </div>
        <div style={{ display: "flex", fontSize: 40, opacity: 0.9 }}>
          호텔 가격이 내려가면 알려드려요
        </div>
      </div>
    ),
    { ...size },
  );
}
