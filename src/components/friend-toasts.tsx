"use client";

import { useState, useEffect, useRef } from "react";
import type { FriendNotification } from "@/hooks/use-friend-notifications";

function formatMessage(names: string[]): string {
  if (names.length === 1) return `${names[0]} fwended you. happy boredom`;
  if (names.length === 2)
    return `${names[0]} and ${names[1]} fwended you. happy boredom`;
  const last = names[names.length - 1];
  const rest = names.slice(0, -1).join(", ");
  return `${rest}, and ${last} fwended you. happy boredom`;
}

function Toast({
  notification,
  onDismiss,
}: {
  notification: FriendNotification;
  onDismiss: () => void;
}) {
  const [phase, setPhase] = useState<"entering" | "visible" | "exiting">(
    "entering"
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Double rAF to ensure the entering styles are painted first
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPhase("visible");
      });
    });
  }, []);

  function handleDismiss() {
    setPhase("exiting");
    setTimeout(onDismiss, 300);
  }

  const isVisible = phase === "visible";
  const isExiting = phase === "exiting";

  return (
    <div
      ref={ref}
      onClick={handleDismiss}
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
        maxWidth: 360,
        fontSize: 14,
        color: "#555",
        fontFamily: "inherit",
        opacity: isVisible && !isExiting ? 1 : 0,
        transform:
          isVisible && !isExiting
            ? "translateY(0) scale(1)"
            : isExiting
              ? "translateY(10px) scale(0.95)"
              : "translateY(20px) scale(0.95)",
        transition: "opacity 0.3s ease, transform 0.3s ease",
      }}
    >
      <span style={{ flex: 1 }}>{formatMessage(notification.names)}</span>
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
        ×
      </span>
    </div>
  );
}

export function FriendToasts({
  notifications,
  onDismiss,
}: {
  notifications: FriendNotification[];
  onDismiss: (id: string) => void;
}) {
  if (notifications.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 100,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column-reverse",
        alignItems: "center",
        gap: 8,
        zIndex: 50,
        pointerEvents: "none",
      }}
    >
      {notifications.map((n) => (
        <Toast
          key={n.id}
          notification={n}
          onDismiss={() => onDismiss(n.id)}
        />
      ))}
    </div>
  );
}
