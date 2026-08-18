import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#15794f",
          color: "#ffffff",
          display: "flex",
          fontFamily: "serif",
          fontSize: 136,
          fontWeight: 700,
          height: "100%",
          justifyContent: "center",
          lineHeight: 1,
          width: "100%",
        }}
      >
        M
      </div>
    ),
    size
  );
}
