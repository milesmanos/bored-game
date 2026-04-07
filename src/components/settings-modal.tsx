"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { hslToHex, hexToPickerPos } from "@/lib/color";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  currentColor: string;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  currentName,
  currentColor,
  onNameChange,
  onColorChange,
}: SettingsModalProps) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [previewBored, setPreviewBored] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | null>(() => {
    return hexToPickerPos(currentColor);
  });
  const gradientRef = useRef<HTMLDivElement>(null);

  // Bouncing toggle state
  const togglePosRef = useRef({
    x: typeof window !== "undefined" ? window.innerWidth / 2 - 70 : 200,
    y: 80,
    vx: 0.7,
    vy: 0.5,
  });
  const [togglePos, setTogglePos] = useState({ x: togglePosRef.current.x, y: togglePosRef.current.y });

  useEffect(() => {
    if (!isOpen) return;
    let frame: number;
    const SPEED = 0.8;
    const W = 140;
    const H = 56;

    const animate = () => {
      const t = togglePosRef.current;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const mag = Math.sqrt(t.vx ** 2 + t.vy ** 2);
      if (mag > 0) {
        t.vx = (t.vx / mag) * SPEED;
        t.vy = (t.vy / mag) * SPEED;
      }

      t.x += t.vx;
      t.y += t.vy;

      if (t.x <= 0 || t.x >= vw - W) {
        t.vx *= -1;
        t.x = Math.max(0, Math.min(vw - W, t.x));
      }
      if (t.y <= 0 || t.y >= vh - H) {
        t.vy *= -1;
        t.y = Math.max(0, Math.min(vh - H, t.y));
      }

      // Animate floating middle finger emojis
      for (const em of feedbackRef.current) {
        em.x += em.vx;
        em.y += em.vy;
        if (em.x <= 0 || em.x >= vw - 32) { em.vx *= -1; em.x = Math.max(0, Math.min(vw - 32, em.x)); }
        if (em.y <= 0 || em.y >= vh - 32) { em.vy *= -1; em.y = Math.max(0, Math.min(vh - 32, em.y)); }
      }

      // Animate sad face drops — gravity, bounce, roll, settle
      const floor = vh - 56;
      for (const sf of sadFacesRef.current) {
        if (sf.settled) continue;
        sf.vy += 0.5; // accelerating gravity
        sf.y += sf.vy;
        sf.rotation += sf.rotationSpeed;
        if (sf.y >= floor) {
          sf.y = floor;
          sf.vy *= -0.35;
          sf.rotationSpeed *= 0.6;
          if (Math.abs(sf.vy) < 0.8) {
            sf.y = floor;
            sf.vy = 0;
            sf.rotationSpeed = 0;
            sf.settled = true;
          }
        }
      }

      setEmojiTick((t) => t + 1);

      setTogglePos({ x: t.x, y: t.y });
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  // Reposition settled emojis on resize
  useEffect(() => {
    const handleResize = () => {
      const floor = window.innerHeight - 56;
      for (const sf of sadFacesRef.current) {
        if (sf.settled) sf.y = floor;
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const feedbackRef = useRef<{ id: number; x: number; y: number; vx: number; vy: number }[]>([]);
  const sadFacesRef = useRef<{ id: number; emoji: string; x: number; y: number; vy: number; rotation: number; rotationSpeed: number; settled: boolean }[]>([]);
  const [emojiTick, setEmojiTick] = useState(0);

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
    onColorChange(hslToHex(hue, 80, lightness));
  }, [onColorChange]);

  useEffect(() => {
    if (!isOpen) {
      feedbackRef.current = [];
      sadFacesRef.current = [];
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSave() {
    if (!name.trim() || name.trim() === currentName) return;
    setSaving(true);
    onNameChange(name.trim().toLowerCase());
    setSaving(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function handleFeedback(e: React.MouseEvent) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI; // upward-ish, ±90°
    const speed = 2 + Math.random() * 2;
    feedbackRef.current = [...feedbackRef.current, {
      id: Date.now(),
      x: e.clientX - 16,
      y: e.clientY - 16,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    }];
  }

  function handleSadDrop() {
    const sadEmojis = ["😞", "😢", "😔", "🥺", "😿", "💔", "😩", "😮‍💨"];
    const emoji = sadEmojis[Math.floor(Math.random() * sadEmojis.length)];
    sadFacesRef.current = [...sadFacesRef.current, {
      id: Date.now(),
      emoji,
      x: 24 + Math.random() * 40,
      y: 60,
      vy: 0,
      rotation: 0,
      rotationSpeed: (Math.random() - 0.5) * 8,
      settled: false,
    }];
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(224, 224, 224, 0.7)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "80px 24px 0",
        textTransform: "lowercase",
      }}
    >
      <button
        className="close-hover"
        onClick={onClose}
        style={{
          position: "fixed",
          top: 20,
          right: 24,
          background: "none",
          border: "none",
          fontSize: 28,
          color: "#888",
          cursor: "pointer",
          fontFamily: "inherit",
          lineHeight: 1,
          zIndex: 20,
        }}
      >
        x
      </button>

      <button
        onClick={handleSadDrop}
        style={{
          position: "fixed",
          top: 20,
          left: 24,
          background: "none",
          border: "none",
          fontSize: 24,
          color: "#888",
          cursor: "pointer",
          fontFamily: "inherit",
          lineHeight: 1,
          zIndex: 20,
        }}
      >
        ?
      </button>

      <h1 style={{ fontSize: 36, fontWeight: 400, marginBottom: 24, color: "#555", zIndex: 0, position: "relative" }}>
        settings
      </h1>

      {/* Bouncing toggle preview */}
      <div
        onClick={() => setPreviewBored((b) => !b)}
        style={{
          position: "fixed",
          left: togglePos.x,
          top: togglePos.y,
          width: 140,
          height: 56,
          borderRadius: 28,
          background: previewBored
            ? `${currentColor}cc`
            : "rgba(200, 200, 200, 0.6)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: `1px solid ${previewBored ? `${currentColor}88` : "rgba(0, 0, 0, 0.08)"}`,
          transition: "background 0.3s ease, border 0.3s ease, box-shadow 0.3s ease",
          boxShadow: previewBored
            ? `0 4px 24px ${currentColor}33, 0 1px 4px rgba(0, 0, 0, 0.08)`
            : "0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04)",
          cursor: "pointer",
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          padding: 6,
          zIndex: 1,
        }}
      >
        <span
          style={{
            position: "absolute",
            left: previewBored ? 8 : 50,
            right: previewBored ? 50 : 8,
            textAlign: "center",
            fontSize: 11,
            fontWeight: 700,
            color: previewBored ? "#fff" : "#999",
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            transition: "left 0.3s ease, right 0.3s ease, color 0.3s ease",
          }}
        >
          {name.trim() || currentName}
        </span>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: previewBored ? "#fff" : "#aaa",
            transition: "transform 0.3s ease, background 0.3s ease",
            transform: previewBored
              ? "translateX(78px)"
              : "translateX(0)",
            flexShrink: 0,
          }}
        />
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          zIndex: 0,
          position: "relative",
        }}
      >
        {/* Name field */}
        <label style={{ fontSize: 14, color: "#888" }}>name</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 12,
              border: "none",
              background: "rgba(0, 0, 0, 0.04)",
              boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.08)",
              color: "#555",
              fontSize: 16,
              outline: "none",
              fontFamily: "inherit",
              textTransform: "lowercase",
            }}
          />
          <button
            className="btn-dark-hover"
            onClick={handleSave}
            disabled={saving || !name.trim() || name.trim().toLowerCase() === currentName}
            style={{
              padding: "12px 20px",
              borderRadius: 12,
              border: "none",
              background:
                name.trim().toLowerCase() !== currentName ? "#222" : "#ccc",
              color:
                name.trim().toLowerCase() !== currentName ? "#e0e0e0" : "#999",
              fontSize: 14,
              fontFamily: "inherit",
              cursor:
                name.trim().toLowerCase() !== currentName
                  ? "pointer"
                  : "default",
              position: "relative",
              zIndex: 2,
            }}
          >
            {saving ? "..." : "save"}
          </button>
        </div>

        {/* Color picker */}
        <label style={{ fontSize: 14, color: "#888", marginTop: 8 }}>color</label>
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
            width: "100%",
            height: 120,
            borderRadius: 12,
            cursor: "crosshair",
            background:
              "linear-gradient(to bottom, #fff 0%, transparent 50%, #000 100%), " +
              "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
            boxShadow: "inset 0 2px 6px rgba(0, 0, 0, 0.15)",
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
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: "2px solid #fff",
                boxShadow: "0 0 4px rgba(0,0,0,0.4)",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
              }}
            />
          )}
        </div>
      </div>

      {/* Spacer to push buttons down */}
      <div style={{ flex: 1, zIndex: 1 }} />

      {/* Bottom buttons */}
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          zIndex: 2,
          position: "relative",
          paddingBottom: 40,
        }}
      >
        <button
          className="btn-outline-hover"
          onClick={handleFeedback}
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid rgba(0, 0, 0, 0.08)",
            background: "rgba(224, 224, 224, 0.5)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: "0 2px 12px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)",
            color: "#888",
            fontSize: 14,
            fontFamily: "inherit",
            cursor: "pointer",
            width: "100%",
          }}
        >
          give feedback
        </button>
        <button
          className="link-hover"
          onClick={handleLogout}
          style={{
            background: "none",
            border: "none",
            color: "#d4777a",
            fontSize: 14,
            fontFamily: "inherit",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          log out
        </button>
      </div>

      {/* Floating middle fingers */}
      {feedbackRef.current.map((em) => (
        <span
          key={em.id}
          style={{
            position: "fixed",
            left: em.x,
            top: em.y,
            fontSize: 32,
            pointerEvents: "none",
            zIndex: 200,
          }}
        >
          🖕
        </span>
      ))}

      {/* Sad face drops */}
      {sadFacesRef.current.map((sf) => (
        <span
          key={sf.id}
          style={{
            position: "fixed",
            left: sf.x,
            top: sf.y,
            fontSize: 32,
            pointerEvents: "none",
            zIndex: 200,
            transform: `rotate(${sf.rotation}deg)`,
          }}
        >
          {sf.emoji}
        </span>
      ))}
    </div>
  );
}
