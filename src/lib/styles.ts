import type React from "react";

export const tabStyle = (active: boolean): React.CSSProperties => ({
  background: "none",
  border: "none",
  fontSize: 36,
  fontWeight: 400,
  color: active ? "#666" : "#bbb",
  cursor: "pointer",
  fontFamily: "inherit",
  textDecoration: "none",
  padding: "4px 0",
  transition: "color 0.2s ease",
});

export const inputStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  border: "none",
  background: "rgba(0, 0, 0, 0.04)",
  boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.08)",
  color: "#555",
  fontSize: 16,
  outline: "none",
  width: "100%",
  fontFamily: "inherit",
  textTransform: "lowercase" as const,
};
