"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { FriendBoredom } from "@/lib/supabase";

interface FloatingBubble {
  id: string;
  name: string;
  color: string;
  isBored: boolean;
  turbo: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface BoredomScreensaverProps {
  friends: FriendBoredom[];
  myName?: string;
  myColor?: string;
  myBored?: boolean;
  myTurbo?: boolean;
}

const BASE_SPEED = 0.8;
const TURBO_SPEED = 5;
const NORMAL_MASS = 1;
const TURBO_MASS = 15;
const MOBILE_BREAKPOINT = 480;

// Desktop dimensions
const DESKTOP_TOGGLE_WIDTH = 140;
const DESKTOP_TOGGLE_HEIGHT = 56;
const DESKTOP_KNOB_SIZE = 44;
const DESKTOP_KNOB_PADDING = 6;

// Mobile dimensions — same proportions as toolbar toggle (60:34 ≈ 1.76:1)
const MOBILE_TOGGLE_WIDTH = 70;
const MOBILE_TOGGLE_HEIGHT = 40;
const MOBILE_KNOB_SIZE = 32;
const MOBILE_KNOB_PADDING = 4;

function useDimensions() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isMobile
    ? { toggleWidth: MOBILE_TOGGLE_WIDTH, toggleHeight: MOBILE_TOGGLE_HEIGHT, knobSize: MOBILE_KNOB_SIZE, knobPadding: MOBILE_KNOB_PADDING, isMobile: true }
    : { toggleWidth: DESKTOP_TOGGLE_WIDTH, toggleHeight: DESKTOP_TOGGLE_HEIGHT, knobSize: DESKTOP_KNOB_SIZE, knobPadding: DESKTOP_KNOB_PADDING, isMobile: false };
}

export function BoredomScreensaver({
  friends,
  myName,
  myColor,
  myBored,
  myTurbo,
}: BoredomScreensaverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bubblesRef = useRef<FloatingBubble[]>([]);
  const animFrameRef = useRef<number>(0);
  const [renderTick, setRenderTick] = useState(0);
  const dims = useDimensions();
  const dimsRef = useRef(dims);
  dimsRef.current = dims;

  // Build bubble list from friends + self
  useEffect(() => {
    const { toggleWidth, toggleHeight } = dimsRef.current;
    const allPeople: FloatingBubble[] = [];

    // Add self
    if (myName) {
      const existing = bubblesRef.current.find((b) => b.id === "self");
      allPeople.push({
        id: "self",
        name: myName,
        color: myColor || "#FF6B6B",
        isBored: myBored || false,
        turbo: myTurbo || false,
        x: existing?.x ?? Math.random() * (window.innerWidth - toggleWidth),
        y: existing?.y ?? Math.random() * (window.innerHeight - toggleHeight),
        vx: existing?.vx ?? (Math.random() - 0.5) * 2,
        vy: existing?.vy ?? (Math.random() - 0.5) * 2,
      });
    }

    // Add friends
    for (const f of friends) {
      const existing = bubblesRef.current.find(
        (b) => b.id === f.profile.id
      );
      const isBored = !!(
        f.toggle?.is_bored &&
        new Date(f.toggle.expires_at) > new Date()
      );

      allPeople.push({
        id: f.profile.id,
        name: f.profile.display_name,
        color: f.profile.color,
        isBored,
        turbo: f.toggle?.turbo || false,
        x: existing?.x ?? Math.random() * (window.innerWidth - toggleWidth),
        y: existing?.y ?? Math.random() * (window.innerHeight - toggleHeight),
        vx: existing?.vx ?? (Math.random() - 0.5) * 2,
        vy: existing?.vy ?? (Math.random() - 0.5) * 2,
      });
    }

    bubblesRef.current = allPeople;
  }, [friends, myName, myColor, myBored, myTurbo]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      const container = containerRef.current;
      if (!container) return;

      const { width, height } = container.getBoundingClientRect();
      const { toggleWidth, toggleHeight } = dimsRef.current;

      const bubbles = bubblesRef.current;

      for (const bubble of bubbles) {
        const speed = bubble.turbo ? TURBO_SPEED : BASE_SPEED;
        const magnitude = Math.sqrt(bubble.vx ** 2 + bubble.vy ** 2);

        if (magnitude > 0) {
          bubble.vx = (bubble.vx / magnitude) * speed;
          bubble.vy = (bubble.vy / magnitude) * speed;
        }

        bubble.x += bubble.vx;
        bubble.y += bubble.vy;

        // Bounce off walls
        if (bubble.x <= 0 || bubble.x >= width - toggleWidth) {
          bubble.vx *= -1;
          bubble.x = Math.max(0, Math.min(width - toggleWidth, bubble.x));
        }
        if (bubble.y <= 0 || bubble.y >= height - toggleHeight) {
          bubble.vy *= -1;
          bubble.y = Math.max(0, Math.min(height - toggleHeight, bubble.y));
        }
      }

      // Bounce off each other — capsule (pill) collision
      const R = toggleHeight / 2;
      const HALF_INNER = (toggleWidth - toggleHeight) / 2;

      for (let i = 0; i < bubbles.length; i++) {
        for (let j = i + 1; j < bubbles.length; j++) {
          const a = bubbles[i];
          const b = bubbles[j];

          const acx = a.x + toggleWidth / 2;
          const acy = a.y + R;
          const bcx = b.x + toggleWidth / 2;
          const bcy = b.y + R;

          const clampAx = Math.max(acx - HALF_INNER, Math.min(acx + HALF_INNER, bcx));
          const clampBx = Math.max(bcx - HALF_INNER, Math.min(bcx + HALF_INNER, clampAx));

          const dx = clampBx - clampAx;
          const dy = bcy - acy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = 2 * R;

          if (dist < minDist && dist > 0.01) {
            const nx = dx / dist;
            const ny = dy / dist;

            const m1 = a.turbo ? TURBO_MASS : NORMAL_MASS;
            const m2 = b.turbo ? TURBO_MASS : NORMAL_MASS;

            const dvx = a.vx - b.vx;
            const dvy = a.vy - b.vy;
            const dvDotN = dvx * nx + dvy * ny;

            if (dvDotN > 0) {
              const j1 = (2 * m2 / (m1 + m2)) * dvDotN;
              const j2 = (2 * m1 / (m1 + m2)) * dvDotN;
              a.vx -= j1 * nx;
              a.vy -= j1 * ny;
              b.vx += j2 * nx;
              b.vy += j2 * ny;
            }

            const overlap = minDist - dist;
            a.x -= (overlap / 2 + 0.5) * nx;
            a.y -= (overlap / 2 + 0.5) * ny;
            b.x += (overlap / 2 + 0.5) * nx;
            b.y += (overlap / 2 + 0.5) * ny;
          }
        }
      }

      setRenderTick((t) => t + 1);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  const { toggleWidth, toggleHeight, knobSize, knobPadding, isMobile } = dims;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "transparent",
        zIndex: 1,
      }}
    >
      {bubblesRef.current.map((bubble) => (
        <div
          key={bubble.id}
          style={{
            position: "absolute",
            left: bubble.x,
            top: bubble.y,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: isMobile ? 3 : 0,
          }}
        >
          {/* Toggle pill */}
          <div
            style={{
              width: toggleWidth,
              height: toggleHeight,
              borderRadius: toggleHeight / 2,
              background: bubble.isBored
                ? `${bubble.color}cc`
                : "rgba(200, 200, 200, 0.6)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: `1px solid ${bubble.isBored ? `${bubble.color}88` : "rgba(0, 0, 0, 0.08)"}`,
              transition: "background 0.3s ease",
              boxShadow: bubble.isBored
                ? `0 4px 24px ${bubble.color}33, 0 1px 4px rgba(0, 0, 0, 0.08)`
                : "0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04)",
              cursor: "default",
              userSelect: "none",
              display: "flex",
              alignItems: "center",
              padding: knobPadding,
              position: "relative",
            }}
          >
            {/* Name label inside toggle (desktop only) */}
            {!isMobile && (
              <span
                style={{
                  position: "absolute",
                  left: bubble.isBored ? knobPadding + 2 : knobSize + knobPadding + 4,
                  right: bubble.isBored ? knobSize + knobPadding + 4 : knobPadding + 2,
                  textAlign: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: bubble.isBored ? "#fff" : "#999",
                  lineHeight: 1.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  transition: "left 0.3s ease, right 0.3s ease",
                }}
              >
                {bubble.name}
              </span>
            )}

            {/* Knob */}
            <div
              style={{
                width: knobSize,
                height: knobSize,
                borderRadius: "50%",
                background: bubble.isBored ? "#fff" : "#aaa",
                transition: "transform 0.3s ease, background 0.3s ease",
                transform: bubble.isBored
                  ? `translateX(${toggleWidth - knobSize - knobPadding * 2}px)`
                  : "translateX(0)",
                flexShrink: 0,
              }}
            />
          </div>

          {/* Name label below toggle (mobile only) */}
          {isMobile && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: bubble.isBored ? bubble.color : "#aaa",
                textAlign: "center",
                maxWidth: toggleWidth + 20,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                userSelect: "none",
                transition: "color 0.3s ease",
              }}
            >
              {bubble.name}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
