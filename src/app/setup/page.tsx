"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function complementaryColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `#${(255 - r).toString(16).padStart(2, "0")}${(255 - g).toString(16).padStart(2, "0")}${(255 - b).toString(16).padStart(2, "0")}`;
}

export default function SetupPage() {
  const router = useRouter();
  const [color, setColor] = useState("#888888");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const gradientRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      setUserId(session.user.id);
      const email = session.user.email || "";
      setDisplayName(email.split("@")[0]);

      // Load existing color if profile exists
      const { data: profile } = await supabase
        .from("profiles")
        .select("color")
        .eq("id", session.user.id)
        .single();

      if (profile?.color) {
        setColor(profile.color);
      }
    });
  }, [router]);

  const pickColor = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const el = gradientRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    const hue = x * 360;
    const lightness = 90 - y * 80;

    setColor(hslToHex(hue, 80, lightness));
  }, []);

  async function handleSubmit() {
    if (!userId || loading) return;
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.from("profiles").upsert({
      id: userId,
      display_name: displayName,
      color,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    router.push("/");
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        textTransform: "lowercase",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: 24, textAlign: "center" }}>
        <h1 style={{ fontSize: 36, fontWeight: 400 }}>pick a color</h1>
      </div>

      <div
        ref={gradientRef}
        onMouseDown={(e) => {
          setDragging(true);
          pickColor(e);
        }}
        onMouseMove={(e) => dragging && pickColor(e)}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
        onTouchStart={pickColor}
        onTouchMove={pickColor}
        style={{
          flex: 1,
          cursor: "crosshair",
          background:
            "linear-gradient(to bottom, #fff 0%, transparent 50%, #000 100%), " +
            "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
          userSelect: "none",
          WebkitUserSelect: "none",
          touchAction: "none",
        }}
      />

      <div style={{ padding: 16, textAlign: "center" }}>
        <button
          className="btn-hover"
          onClick={handleSubmit}
          disabled={loading}
          style={{
            padding: "14px 32px",
            borderRadius: 12,
            border: "none",
            background: color,
            color: complementaryColor(color),
            fontSize: 16,
            fontFamily: "inherit",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            transition: "background 0.1s ease, color 0.1s ease",
          }}
        >
          {loading ? "hold on..." : "this is good"}
        </button>

        {error && (
          <p style={{ color: "#999", fontSize: 14, marginTop: 12 }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
