import { ImageResponse } from "next/og";
import { siteConfig } from "@/content/site-config";

export const alt = "Mars Laundromat";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#faf7f2",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: "#c1622d",
            marginBottom: 44,
          }}
        />
        <div
          style={{
            display: "flex",
            fontSize: 80,
            fontWeight: 700,
            color: "#2b2622",
            textAlign: "center",
          }}
        >
          {siteConfig.name}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 34,
            color: "#6b6255",
            marginTop: 28,
            textAlign: "center",
          }}
        >
          {siteConfig.tagline}
        </div>
      </div>
    ),
    { ...size }
  );
}
