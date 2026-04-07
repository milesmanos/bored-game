"use client";

import { useState, useEffect, useRef } from "react";

export type Platform = "ios" | "android" | null;

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return null;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallModal({
  platform,
  onClose,
}: {
  platform: Platform;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 150,
        background: "rgba(224, 224, 224, 0.85)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        textTransform: "lowercase",
        fontFamily: "inherit",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 320,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        {/* Close button */}
        <button
          className="close-hover"
          onClick={onClose}
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            background: "none",
            border: "none",
            fontSize: 24,
            color: "#888",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          x
        </button>

        <div style={{ fontSize: 18, color: "#555", textAlign: "center" }}>
          add bored game to your home screen
        </div>

        {platform === "ios" ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 20,
              width: "100%",
            }}
          >
            <Step number={1}>
              tap the{" "}
              <span style={{ fontSize: 18, verticalAlign: "middle" }}>
                {/* iOS share icon approximation */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#4A90D9"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ verticalAlign: "middle", marginBottom: 2 }}
                >
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </span>{" "}
              share button
            </Step>
            <Step number={2}>scroll down and tap "add to home screen"</Step>
            <Step number={3}>tap "add"</Step>
          </div>
        ) : platform === "android" ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 20,
              width: "100%",
            }}
          >
            <Step number={1}>
              tap the{" "}
              <span style={{ fontWeight: 700, letterSpacing: 2 }}>...</span>{" "}
              menu button
            </Step>
            <Step number={2}>tap "install app" or "add to home screen"</Step>
            <Step number={3}>tap "install"</Step>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Step({
  number,
  children,
}: {
  number: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "#4A90D9",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {number}
      </div>
      <div style={{ fontSize: 15, color: "#555", flex: 1 }}>{children}</div>
    </div>
  );
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [phase, setPhase] = useState<"entering" | "visible" | "exiting">(
    "entering"
  );
  const platform = useRef<Platform>(null);

  useEffect(() => {
    // Don't show on desktop, in standalone mode, or if dismissed
    platform.current = detectPlatform();
    if (!platform.current) return;
    if (isStandalone()) return;
    if (localStorage.getItem("install-prompt-dismissed")) return;

    // Show after a short delay
    const timer = setTimeout(() => {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPhase("visible");
        });
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  function handleDismiss() {
    localStorage.setItem("install-prompt-dismissed", "1");
    setPhase("exiting");
    setTimeout(() => setVisible(false), 300);
  }

  function handleTap() {
    setModalOpen(true);
    handleDismiss();
  }

  if (!visible && !modalOpen) return null;

  const isActive = phase === "visible";
  const isExiting = phase === "exiting";

  return (
    <>
      {visible && (
        <div
          style={{
            position: "fixed",
            top: 54,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            pointerEvents: "none",
          }}
        >
          <div
            onClick={handleTap}
            style={{
              background: "rgba(224, 224, 224, 0.85)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              borderRadius: 16,
              padding: "10px 14px",
              border: "1px solid rgba(0, 0, 0, 0.08)",
              boxShadow:
                "0 4px 24px rgba(0, 0, 0, 0.1), 0 1px 4px rgba(0, 0, 0, 0.06)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              pointerEvents: "auto",
              cursor: "pointer",
              textTransform: "lowercase",
              maxWidth: 300,
              fontSize: 14,
              color: "#555",
              fontFamily: "inherit",
              opacity: isActive && !isExiting ? 1 : 0,
              transform:
                isActive && !isExiting
                  ? "translateY(0) scale(1)"
                  : isExiting
                    ? "translateY(-10px) scale(0.95)"
                    : "translateY(-20px) scale(0.95)",
              transition: "opacity 0.3s ease, transform 0.3s ease",
            }}
          >
            <span style={{ flex: 1 }}>tap to be bored on your home screen</span>
            <span
              className="close-hover"
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              style={{
                fontSize: 16,
                color: "#999",
                lineHeight: 1,
                flexShrink: 0,
                padding: "0 2px",
              }}
            >
              x
            </span>
          </div>
        </div>
      )}
      {modalOpen && (
        <InstallModal
          platform={platform.current}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
