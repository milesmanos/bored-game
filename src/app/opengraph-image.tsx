import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "are you bored";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  const words = Array(80).fill("boredom");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#e0e0e0",
          display: "flex",
          flexWrap: "wrap",
          alignContent: "center",
          justifyContent: "center",
          padding: 40,
          gap: 12,
          fontFamily: "sans-serif",
        }}
      >
        {words.map((word, i) => (
          <span
            key={i}
            style={{
              fontSize: 28,
              color: i % 7 === 0 ? "#bbb" : "#ccc",
              fontWeight: 400,
            }}
          >
            {word}
          </span>
        ))}
      </div>
    ),
    { ...size }
  );
}
