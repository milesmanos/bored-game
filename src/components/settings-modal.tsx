"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  onNameChange: (name: string) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  currentName,
  onNameChange,
}: SettingsModalProps) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [feedbackEmojis, setFeedbackEmojis] = useState<{ id: number; x: number; y: number }[]>([]);

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
    const id = Date.now();
    const x = e.clientX;
    const y = e.clientY;
    setFeedbackEmojis((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setFeedbackEmojis((prev) => prev.filter((em) => em.id !== id));
    }, 1500);
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
        justifyContent: "center",
        padding: 24,
        textTransform: "lowercase",
      }}
    >
      {/* Close button */}
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
        }}
      >
        x
      </button>

      <h1 style={{ fontSize: 36, fontWeight: 400, marginBottom: 40, color: "#666" }}>
        settings
      </h1>

      <div
        style={{
          width: "100%",
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Name field */}
        <label style={{ fontSize: 14, color: "#999" }}>name</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #ccc",
              background: "rgba(255, 255, 255, 0.4)",
              color: "#444",
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
            }}
          >
            {saving ? "..." : "save"}
          </button>
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: "rgba(0, 0, 0, 0.08)",
            marginTop: 24,
            marginBottom: 8,
          }}
        />

        {/* Logout */}
        <button
          className="btn-outline-hover"
          onClick={handleLogout}
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid #ccc",
            background: "transparent",
            color: "#999",
            fontSize: 14,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          log out
        </button>

        {/* Give feedback */}
        <button
          className="btn-outline-hover"
          onClick={handleFeedback}
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid #ccc",
            background: "transparent",
            color: "#999",
            fontSize: 14,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          give feedback
        </button>

        {/* Floating emojis */}
        {feedbackEmojis.map((em) => (
          <span
            key={em.id}
            style={{
              position: "fixed",
              left: em.x - 16,
              top: em.y - 16,
              fontSize: 32,
              pointerEvents: "none",
              zIndex: 200,
              animation: "float-up-fade 1.5s ease-out forwards",
            }}
          >
            🖕
          </span>
        ))}
      </div>
    </div>
  );
}
