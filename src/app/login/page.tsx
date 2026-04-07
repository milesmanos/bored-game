"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { tabStyle, inputStyle } from "@/lib/styles";

const TITLE = "bored game";
const LETTER_COLORS = [
  "#4338ca", "#e11d48", "#f59e0b", "#16a34a", "#8b5cf6",
  "", // space
  "#ea580c", "#2563eb", "#d946ef", "#0d9488",
];

const LETTER_SIZE = 48;
const LETTER_SPEED = 0.6;
const FADE_DURATION = 1200;
const DRIFT_DELAY = 2000;
const OPACITY_FADE_DURATION = 10000;

interface FloatingLetter {
  char: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
}

function useFloatingLetters(containerRef: React.RefObject<HTMLDivElement | null>, drifting: boolean) {
  const lettersRef = useRef<FloatingLetter[]>([]);
  const [tick, setTick] = useState(0);
  const startTimeRef = useRef(0);

  const initLetters = useCallback((origins: { x: number; y: number; width: number }[]) => {
    startTimeRef.current = Date.now();
    lettersRef.current = TITLE.split("").map((char, i) => ({
      char,
      color: LETTER_COLORS[i] || "",
      x: origins[i]?.x ?? 0,
      y: origins[i]?.y ?? 0,
      vx: 0,
      vy: 0,
      width: origins[i]?.width ?? 30,
    }));
    // After a brief pause, give each letter a velocity pointing away from the group center
    setTimeout(() => {
      const nonSpace = lettersRef.current.filter((l) => l.char !== " ");
      const cx = nonSpace.reduce((s, l) => s + l.x, 0) / nonSpace.length;
      const cy = nonSpace.reduce((s, l) => s + l.y, 0) / nonSpace.length;
      const count = nonSpace.length;
      nonSpace.forEach((letter, idx) => {
        // Fan out in an arc from left (~180°) to down-right (~330°)
        // so adjacent letters diverge cleanly
        const startAngle = Math.PI * 7 / 6;  // 210° — down-left
        const endAngle = Math.PI * 11 / 6;  // 330° — down-right
        const angle = startAngle + (endAngle - startAngle) * (idx / (count - 1));
        letter.vx = Math.cos(angle) * 3;
        letter.vy = Math.sin(angle) * 3;
      });
    }, 400);
  }, []);

  useEffect(() => {
    if (!drifting) return;

    let frame: number;
    const animate = () => {
      const container = containerRef.current;
      if (!container) { frame = requestAnimationFrame(animate); return; }

      const { width, height } = container.getBoundingClientRect();
      const letters = lettersRef.current;
      const R = LETTER_SIZE / 2;

      // Ramp speed from 0 to full over 4 seconds
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const ramp = Math.min(elapsed / 4, 1);
      const currentSpeed = LETTER_SPEED * ramp;

      for (const letter of letters) {
        if (letter.char === " ") continue;

        const mag = Math.sqrt(letter.vx ** 2 + letter.vy ** 2);
        if (mag > 0) {
          letter.vx = (letter.vx / mag) * currentSpeed;
          letter.vy = (letter.vy / mag) * currentSpeed;
        }

        letter.x += letter.vx;
        letter.y += letter.vy;

        if (letter.x <= 0 || letter.x >= width - letter.width) {
          letter.vx *= -1;
          letter.x = Math.max(0, Math.min(width - letter.width, letter.x));
        }
        if (letter.y <= 0 || letter.y >= height - LETTER_SIZE) {
          letter.vy *= -1;
          letter.y = Math.max(0, Math.min(height - LETTER_SIZE, letter.y));
        }
      }

      // Simple circle collision between letters (skip during ramp-up to avoid pushing apart)
      if (ramp < 0.9) { setTick((t) => t + 1); frame = requestAnimationFrame(animate); return; }
      for (let i = 0; i < letters.length; i++) {
        if (letters[i].char === " ") continue;
        for (let j = i + 1; j < letters.length; j++) {
          if (letters[j].char === " ") continue;
          const a = letters[i];
          const b = letters[j];
          const dx = (b.x + b.width / 2) - (a.x + a.width / 2);
          const dy = (b.y + R) - (a.y + R);
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = (a.width + b.width) / 2;

          if (dist < minDist && dist > 0.01) {
            const nx = dx / dist;
            const ny = dy / dist;
            // Always separate overlapping letters
            const overlap = minDist - dist;
            a.x -= (overlap / 2 + 0.5) * nx;
            a.y -= (overlap / 2 + 0.5) * ny;
            b.x += (overlap / 2 + 0.5) * nx;
            b.y += (overlap / 2 + 0.5) * ny;
            // Elastic bounce
            const dvx = a.vx - b.vx;
            const dvy = a.vy - b.vy;
            const dvDotN = dvx * nx + dvy * ny;
            if (dvDotN > 0) {
              a.vx -= dvDotN * nx;
              a.vy -= dvDotN * ny;
              b.vx += dvDotN * nx;
              b.vy += dvDotN * ny;
            }
          }
        }
      }

      setTick((t) => t + 1);
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [drifting, containerRef]);

  return { letters: lettersRef.current, initLetters, tick };
}

type Tab = "signup" | "login";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(
    searchParams.get("tab") === "login" ? "login" : "signup"
  );
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [colorFaded, setColorFaded] = useState(false);
  const [drifting, setDrifting] = useState(false);
  const [driftStartTime, setDriftStartTime] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { letters, initLetters, tick } = useFloatingLetters(containerRef, drifting);

  // Fade in colors, then start drifting
  useEffect(() => {
    const fadeTimer = setTimeout(() => setColorFaded(true), 100);
    const driftTimer = setTimeout(() => {
      // Capture letter positions from the DOM before they start floating
      if (titleRef.current && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const spans = titleRef.current.querySelectorAll("span");
        const origins: { x: number; y: number; width: number }[] = [];
        spans.forEach((span) => {
          const rect = span.getBoundingClientRect();
          origins.push({
            x: rect.left - containerRect.left,
            y: rect.top - containerRect.top,
            width: rect.width,
          });
        });
        initLetters(origins);
      }
      setDriftStartTime(Date.now());
      setDrifting(true);
    }, DRIFT_DELAY);

    return () => { clearTimeout(fadeTimer); clearTimeout(driftTimer); };
  }, [initLetters]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) redirectAfterLogin(session.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) redirectAfterLogin(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function redirectAfterLogin(userId: string) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (profile) {
      router.push("/");
    } else {
      router.push("/setup");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const safeName = name.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const fakeEmail = `${safeName}@users.boredgame.app`;
    const paddedPassword = password + "_bored_game_padding";

    const { error } =
      tab === "signup"
        ? await supabase.auth.signUp({ email: fakeEmail, password: paddedPassword })
        : await supabase.auth.signInWithPassword({ email: fakeEmail, password: paddedPassword });

    if (error) setError(error.message);
    setLoading(false);
  }

  void tick;

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: "100vh",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textTransform: "lowercase",
        overflow: "hidden",
      }}
    >
      {/* Floating letters (behind everything) */}
      {drifting && (() => {
        const driftElapsed = Date.now() - driftStartTime;
        const opacityProgress = Math.min(driftElapsed / OPACITY_FADE_DURATION, 1);
        const currentOpacity = 1 - opacityProgress * 0.75; // 1.0 → 0.25
        return letters.map((letter, i) => (
          letter.char !== " " && (
            <span
              key={i}
              style={{
                position: "absolute",
                left: letter.x,
                top: letter.y,
                fontSize: LETTER_SIZE,
                fontWeight: 400,
                color: letter.color,
                opacity: currentOpacity,
                pointerEvents: "none",
                userSelect: "none",
                zIndex: 1,
              }}
            >
              {letter.char}
            </span>
          )
        ));
      })()}

      {/* Static title — hidden when drifting starts */}
      <h1
        ref={titleRef}
        style={{
          fontSize: LETTER_SIZE,
          fontWeight: 400,
          marginBottom: 48,
          visibility: drifting ? "hidden" : "visible",
          zIndex: 0,
          position: "relative",
        }}
      >
        {TITLE.split("").map((char, i) => (
          <span
            key={i}
            style={{
              color: char === " " ? "transparent" : (colorFaded ? LETTER_COLORS[i] : "#bbb"),
              transition: `color ${FADE_DURATION}ms ease`,
            }}
          >
            {char}
          </span>
        ))}
      </h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 24, marginBottom: 32, zIndex: 2, position: "relative" }}>
        <button
          className="link-hover"
          onClick={() => { setTab("signup"); setError(null); }}
          style={tabStyle(tab === "signup")}
        >
          sign up
        </button>
        <button
          className="link-hover"
          onClick={() => { setTab("login"); setError(null); }}
          style={tabStyle(tab === "login")}
        >
          log in
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: "100%",
          maxWidth: 360,
          zIndex: 0,
          position: "relative",
        }}
      >
        <input
          type="text"
          placeholder="my name feels like"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={inputStyle}
        />

        <div>
          <input
            type="password"
            placeholder="my password could be"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={1}
            style={inputStyle}
          />

          {tab === "signup" && password.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: "#ccc",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(40 + password.length * 8, 100)}%`,
                    borderRadius: 3,
                    background: "#999",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <p style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                good enoug
              </p>
            </div>
          )}
        </div>

        <button
          className="btn-dark-hover"
          type="submit"
          disabled={loading}
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            border: "none",
            background: "#222",
            color: "#e0e0e0",
            fontSize: 16,
            fontFamily: "inherit",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            position: "relative",
            zIndex: 2,
          }}
        >
          {loading ? "hold on..." : tab === "signup" ? "sign up" : "log in"}
        </button>

        {error && (
          <p style={{ color: "#999", fontSize: 14, textAlign: "center" }}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
