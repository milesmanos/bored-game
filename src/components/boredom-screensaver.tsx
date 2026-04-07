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
  bottomInset?: number;
  botStatesRef?: React.RefObject<Record<string, boolean>>;
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
  bottomInset = 0,
  botStatesRef,
}: BoredomScreensaverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bubblesRef = useRef<FloatingBubble[]>([]);
  const animFrameRef = useRef<number>(0);
  const bubbleElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  // Only used to trigger a React re-render when the bubble *list* changes (add/remove)
  const [, setBubbleIds] = useState<string[]>([]);
  const dims = useDimensions();
  const dimsRef = useRef(dims);
  dimsRef.current = dims;
  const bottomInsetRef = useRef(bottomInset);
  bottomInsetRef.current = bottomInset;
  // Cached container size — updated on resize, not every frame
  const containerSizeRef = useRef({ width: 0, height: 0 });

  // Drag state — tracks which bubble is being held and pointer offset
  const dragRef = useRef<{
    bubbleId: string | null;
    offsetX: number;
    offsetY: number;
    lastX: number;
    lastY: number;
    lastTime: number;
  }>({ bubbleId: null, offsetX: 0, offsetY: 0, lastX: 0, lastY: 0, lastTime: 0 });

  const setBubbleElRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      bubbleElsRef.current.set(id, el);
    } else {
      bubbleElsRef.current.delete(id);
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent, bubbleId: string) => {
    const bubble = bubblesRef.current.find((b) => b.id === bubbleId);
    if (!bubble) return;
    const el = bubbleElsRef.current.get(bubbleId);
    if (el) {
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    }
    const containerRect = containerRef.current?.getBoundingClientRect();
    const pointerX = e.clientX - (containerRect?.left ?? 0);
    const pointerY = e.clientY - (containerRect?.top ?? 0);
    dragRef.current = {
      bubbleId,
      offsetX: pointerX - bubble.x,
      offsetY: pointerY - bubble.y,
      lastX: pointerX,
      lastY: pointerY,
      lastTime: performance.now(),
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag.bubbleId) return;
    const bubble = bubblesRef.current.find((b) => b.id === drag.bubbleId);
    if (!bubble) return;

    const containerRect = containerRef.current?.getBoundingClientRect();
    const pointerX = e.clientX - (containerRect?.left ?? 0);
    const pointerY = e.clientY - (containerRect?.top ?? 0);

    const { toggleWidth, toggleHeight, isMobile } = dimsRef.current;
    const { width, height } = containerSizeRef.current;
    const inset = isMobile ? bottomInsetRef.current : 0;

    bubble.x = Math.max(0, Math.min(width - toggleWidth, pointerX - drag.offsetX));
    bubble.y = Math.max(0, Math.min(height - toggleHeight - inset, pointerY - drag.offsetY));

    // Update DOM directly
    const el = bubbleElsRef.current.get(drag.bubbleId);
    if (el) {
      el.style.transform = `translate(${bubble.x}px, ${bubble.y}px)`;
    }

    // Track for release velocity
    const now = performance.now();
    drag.lastX = pointerX;
    drag.lastY = pointerY;
    drag.lastTime = now;
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag.bubbleId) return;
    const bubble = bubblesRef.current.find((b) => b.id === drag.bubbleId);

    const el = bubbleElsRef.current.get(drag.bubbleId);
    if (el) {
      el.releasePointerCapture(e.pointerId);
      el.style.cursor = "grab";
    }

    if (bubble) {
      const containerRect = containerRef.current?.getBoundingClientRect();
      const pointerX = e.clientX - (containerRect?.left ?? 0);
      const pointerY = e.clientY - (containerRect?.top ?? 0);
      const dt = Math.max(1, performance.now() - drag.lastTime);
      // Compute release velocity (px/frame at 60fps ≈ px/16.67ms)
      const scale = 16.67 / dt;
      const vx = (pointerX - drag.lastX) * scale;
      const vy = (pointerY - drag.lastY) * scale;
      // Clamp to reasonable speed so it doesn't fly off wildly
      const maxV = TURBO_SPEED * 2;
      bubble.vx = Math.max(-maxV, Math.min(maxV, vx));
      bubble.vy = Math.max(-maxV, Math.min(maxV, vy));
    }

    drag.bubbleId = null;
  }, []);

  // Measure container on resize instead of every frame
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const rect = container.getBoundingClientRect();
      containerSizeRef.current = { width: rect.width, height: rect.height };
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Build bubble list from friends + self
  useEffect(() => {
    const { toggleWidth, toggleHeight } = dimsRef.current;
    const isMob = window.innerWidth <= MOBILE_BREAKPOINT;
    const inset = isMob ? bottomInsetRef.current : 0;
    const maxSpawnY = window.innerHeight - toggleHeight - inset;
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
        y: existing?.y ?? Math.min(Math.random() * (window.innerHeight - toggleHeight), maxSpawnY),
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
        y: existing?.y ?? Math.min(Math.random() * (window.innerHeight - toggleHeight), maxSpawnY),
        vx: existing?.vx ?? (Math.random() - 0.5) * 2,
        vy: existing?.vy ?? (Math.random() - 0.5) * 2,
      });
    }

    bubblesRef.current = allPeople;
    // Only trigger React re-render when the list of IDs changes
    setBubbleIds((prev) => {
      const next = allPeople.map((b) => b.id);
      if (prev.length === next.length && prev.every((id, i) => id === next[i])) return prev;
      return next;
    });
  }, [friends, myName, myColor, myBored, myTurbo]);

  // Animation step — extracted so visibility handler can reuse it
  const animateFnRef = useRef<() => void>(() => {});
  animateFnRef.current = () => {
    const { width, height } = containerSizeRef.current;
    if (width === 0) {
      animFrameRef.current = requestAnimationFrame(animateFnRef.current);
      return;
    }

    const { toggleWidth, toggleHeight, isMobile } = dimsRef.current;
    const inset = isMobile ? bottomInsetRef.current : 0;

    const bubbles = bubblesRef.current;

    const draggedId = dragRef.current.bubbleId;

    for (const bubble of bubbles) {
      // Skip position/velocity updates for the bubble being dragged
      if (bubble.id === draggedId) continue;

      const speed = bubble.turbo ? TURBO_SPEED : BASE_SPEED;
      const magSq = bubble.vx * bubble.vx + bubble.vy * bubble.vy;

      if (magSq > 0) {
        const magnitude = Math.sqrt(magSq);
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
      const maxY = height - toggleHeight - inset;
      if (bubble.y <= 0 || bubble.y >= maxY) {
        bubble.vy *= -1;
        bubble.y = Math.max(0, Math.min(maxY, bubble.y));
      }
    }

    // Bounce off each other — capsule (pill) collision
    const R = toggleHeight / 2;
    const HALF_INNER = (toggleWidth - toggleHeight) / 2;
    const minDistSq = (2 * R) * (2 * R);

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
        const distSq = dx * dx + dy * dy;

        // Early exit with squared distance — skip sqrt unless actually colliding
        if (distSq >= minDistSq || distSq < 0.0001) continue;

        const dist = Math.sqrt(distSq);
        const minDist = 2 * R;
        const nx = dx / dist;
        const ny = dy / dist;

        const m1 = a.turbo ? TURBO_MASS : NORMAL_MASS;
        const m2 = b.turbo ? TURBO_MASS : NORMAL_MASS;

        const dvx = a.vx - b.vx;
        const dvy = a.vy - b.vy;
        const dvDotN = dvx * nx + dvy * ny;

        const aDragged = a.id === draggedId;
        const bDragged = b.id === draggedId;

        if (dvDotN > 0) {
          // Dragged bubble is immovable — transfer all momentum to the other
          if (aDragged) {
            b.vx += dvDotN * nx;
            b.vy += dvDotN * ny;
          } else if (bDragged) {
            a.vx -= dvDotN * nx;
            a.vy -= dvDotN * ny;
          } else {
            const j1 = (2 * m2 / (m1 + m2)) * dvDotN;
            const j2 = (2 * m1 / (m1 + m2)) * dvDotN;
            a.vx -= j1 * nx;
            a.vy -= j1 * ny;
            b.vx += j2 * nx;
            b.vy += j2 * ny;
          }
        }

        // Separate overlap — dragged bubble doesn't move
        const overlap = minDist - dist;
        if (aDragged) {
          b.x += (overlap + 0.5) * nx;
          b.y += (overlap + 0.5) * ny;
        } else if (bDragged) {
          a.x -= (overlap + 0.5) * nx;
          a.y -= (overlap + 0.5) * ny;
        } else {
          a.x -= (overlap / 2 + 0.5) * nx;
          a.y -= (overlap / 2 + 0.5) * ny;
          b.x += (overlap / 2 + 0.5) * nx;
          b.y += (overlap / 2 + 0.5) * ny;
        }
      }
    }

    // Re-clamp after collision separation to prevent bubbles escaping bounds
    // (skip dragged bubble — pointer handler already clamps it)
    const maxYPost = height - toggleHeight - inset;
    for (const bubble of bubbles) {
      if (bubble.id === draggedId) continue;
      bubble.x = Math.max(0, Math.min(width - toggleWidth, bubble.x));
      bubble.y = Math.max(0, Math.min(maxYPost, bubble.y));
    }

    // Sync bot bored states from ref (morse toggles update this without re-renders)
    if (botStatesRef?.current) {
      const botStates = botStatesRef.current;
      for (const bubble of bubbles) {
        if (bubble.id in botStates) {
          bubble.isBored = botStates[bubble.id];
        }
      }
    }

    // Write positions and bot toggle states directly to DOM — no React re-render needed
    const els = bubbleElsRef.current;
    const { knobSize: ks, knobPadding: kp } = dimsRef.current;
    for (const bubble of bubbles) {
      const el = els.get(bubble.id);
      if (!el) continue;
      el.style.transform = `translate(${bubble.x}px, ${bubble.y}px)`;

      // Update toggle appearance for bots whose isBored changed
      if (botStatesRef?.current && bubble.id in botStatesRef.current) {
        const pill = el.firstElementChild as HTMLDivElement | null;
        if (pill) {
          pill.style.background = bubble.isBored
            ? `${bubble.color}cc`
            : "rgba(200, 200, 200, 0.6)";
          pill.style.borderColor = bubble.isBored ? `${bubble.color}88` : "rgba(0, 0, 0, 0.08)";
          pill.style.boxShadow = bubble.isBored
            ? `0 4px 24px ${bubble.color}33, 0 1px 4px rgba(0, 0, 0, 0.08)`
            : "0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04)";
          // Update knob
          const knob = pill.querySelector<HTMLDivElement>(":scope > div");
          if (knob) {
            knob.style.background = bubble.isBored ? "#fff" : "#aaa";
            knob.style.transform = bubble.isBored
              ? `translateX(${toggleWidth - ks - kp * 2}px)`
              : "translateX(0)";
          }
          // Update name label (desktop: inside pill; mobile: sibling span)
          if (!isMobile) {
            const label = pill.querySelector<HTMLSpanElement>(":scope > span");
            if (label) {
              label.style.color = bubble.isBored ? "#fff" : "#999";
              label.style.left = bubble.isBored ? `${kp + 2}px` : `${ks + kp + 4}px`;
              label.style.right = bubble.isBored ? `${ks + kp + 4}px` : `${kp + 2}px`;
            }
          } else {
            const mobileLabel = el.querySelector<HTMLSpanElement>(":scope > span");
            if (mobileLabel) {
              mobileLabel.style.color = bubble.isBored ? bubble.color : "#aaa";
            }
          }
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(animateFnRef.current);
  };

  // Start animation loop
  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(animateFnRef.current);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  // Pause animation when tab is hidden, resume when visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        cancelAnimationFrame(animFrameRef.current);
      } else {
        // Re-measure container in case it changed while hidden
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          containerSizeRef.current = { width: rect.width, height: rect.height };
        }
        animFrameRef.current = requestAnimationFrame(animateFnRef.current);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
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
          ref={(el) => setBubbleElRef(bubble.id, el)}
          onPointerDown={(e) => handlePointerDown(e, bubble.id)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: `translate(${bubble.x}px, ${bubble.y}px)`,
            willChange: "transform",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: isMobile ? 3 : 0,
            cursor: "grab",
            touchAction: "none",
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
