"use client";

import { useEffect, useRef, useState } from "react";
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
const TURBO_SPEED = 4;
const NORMAL_MASS = 1;
const TURBO_MASS = 5;
const TOGGLE_WIDTH = 140;
const TOGGLE_HEIGHT = 56;
const KNOB_SIZE = 44;
const KNOB_PADDING = 6;

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

  // Build bubble list from friends + self
  useEffect(() => {
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
        x: existing?.x ?? Math.random() * (window.innerWidth - TOGGLE_WIDTH),
        y: existing?.y ?? Math.random() * (window.innerHeight - TOGGLE_HEIGHT),
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
        x: existing?.x ?? Math.random() * (window.innerWidth - TOGGLE_WIDTH),
        y: existing?.y ?? Math.random() * (window.innerHeight - TOGGLE_HEIGHT),
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
        if (bubble.x <= 0 || bubble.x >= width - TOGGLE_WIDTH) {
          bubble.vx *= -1;
          bubble.x = Math.max(0, Math.min(width - TOGGLE_WIDTH, bubble.x));
        }
        if (bubble.y <= 0 || bubble.y >= height - TOGGLE_HEIGHT) {
          bubble.vy *= -1;
          bubble.y = Math.max(0, Math.min(height - TOGGLE_HEIGHT, bubble.y));
        }
      }

      // Bounce off each other — capsule (pill) collision
      // Each pill = a horizontal line segment + radius R.
      // Find closest points between the two segments,
      // then do standard billiard-ball elastic collision at that contact.
      const R = TOGGLE_HEIGHT / 2;
      const HALF_INNER = (TOGGLE_WIDTH - TOGGLE_HEIGHT) / 2;

      for (let i = 0; i < bubbles.length; i++) {
        for (let j = i + 1; j < bubbles.length; j++) {
          const a = bubbles[i];
          const b = bubbles[j];

          // Center of each pill
          const acx = a.x + TOGGLE_WIDTH / 2;
          const acy = a.y + R;
          const bcx = b.x + TOGGLE_WIDTH / 2;
          const bcy = b.y + R;

          // Closest points on each pill's inner segment to the other.
          // Segments are horizontal, so only X varies.
          // Segment A: x in [acx - HALF_INNER, acx + HALF_INNER], y = acy
          // Segment B: x in [bcx - HALF_INNER, bcx + HALF_INNER], y = bcy
          // Closest pair: clamp each segment's x toward the other's closest x.
          const clampAx = Math.max(acx - HALF_INNER, Math.min(acx + HALF_INNER, bcx));
          const clampBx = Math.max(bcx - HALF_INNER, Math.min(bcx + HALF_INNER, clampAx));

          const dx = clampBx - clampAx;
          const dy = bcy - acy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = 2 * R;

          if (dist < minDist && dist > 0.01) {
            // Collision normal: from closest point on A to closest point on B
            const nx = dx / dist;
            const ny = dy / dist;

            // Elastic collision with unequal masses.
            // Turbo toggles have more mass → harder to deflect.
            const m1 = a.turbo ? TURBO_MASS : NORMAL_MASS;
            const m2 = b.turbo ? TURBO_MASS : NORMAL_MASS;

            const dvx = a.vx - b.vx;
            const dvy = a.vy - b.vy;
            const dvDotN = dvx * nx + dvy * ny;

            // Only resolve if approaching
            if (dvDotN > 0) {
              const j1 = (2 * m2 / (m1 + m2)) * dvDotN;
              const j2 = (2 * m1 / (m1 + m2)) * dvDotN;
              a.vx -= j1 * nx;
              a.vy -= j1 * ny;
              b.vx += j2 * nx;
              b.vy += j2 * ny;
            }

            // Separate so they don't overlap
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
            width: TOGGLE_WIDTH,
            height: TOGGLE_HEIGHT,
            borderRadius: TOGGLE_HEIGHT / 2,
            background: bubble.isBored
              ? bubble.color
              : "#ccc",
            border: `2px solid ${bubble.isBored ? bubble.color : "#bbb"}`,
            transition: "background 0.3s ease",
            boxShadow: bubble.isBored
              ? `0 0 20px ${bubble.color}66, 0 0 40px ${bubble.color}22`
              : "none",
            cursor: "default",
            userSelect: "none",
            display: "flex",
            alignItems: "center",
            padding: KNOB_PADDING,
          }}
        >
          {/* Name label */}
          <span
            style={{
              position: "absolute",
              left: bubble.isBored ? KNOB_PADDING + 2 : KNOB_SIZE + KNOB_PADDING + 4,
              right: bubble.isBored ? KNOB_SIZE + KNOB_PADDING + 4 : KNOB_PADDING + 2,
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

          {/* Knob */}
          <div
            style={{
              width: KNOB_SIZE,
              height: KNOB_SIZE,
              borderRadius: "50%",
              background: bubble.isBored ? "#fff" : "#aaa",
              transition: "transform 0.3s ease, background 0.3s ease",
              transform: bubble.isBored
                ? `translateX(${TOGGLE_WIDTH - KNOB_SIZE - KNOB_PADDING * 2 - 4}px)`
                : "translateX(0)",
              flexShrink: 0,
            }}
          />
        </div>
      ))}
    </div>
  );
}
