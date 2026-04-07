"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { hslToHex, hexToPickerPos } from "@/lib/color";


export default function SetupPage() {
  const router = useRouter();
  const [color, setColor] = useState("#888888");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | null>(null);
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
        setPickerPos(hexToPickerPos(profile.color));
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

    setPickerPos({ x, y });
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
        <h1 style={{ fontSize: 36, fontWeight: 400 }}>pick your color</h1>
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
          position: "relative",
        }}
      >
        {pickerPos && (
          <div
            style={{
              position: "absolute",
              left: `${pickerPos.x * 100}%`,
              top: `${pickerPos.y * 100}%`,
              width: 20,
              height: 20,
              borderRadius: "50%",
              border: "2px solid #fff",
              boxShadow: "0 0 4px rgba(0,0,0,0.4)",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

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
            color: "#fff",
            fontSize: 16,
            fontFamily: "inherit",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            transition: "background 0.1s ease, color 0.1s ease",
          }}
        >
          {loading ? "hold on..." : "great, i'm bored already"}
        </button>

        {error && (
          <p style={{ color: "#888", fontSize: 14, marginTop: 12 }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
