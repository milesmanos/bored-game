"use client";

import { useState, useMemo, useEffect } from "react";
import type { Profile, BoredBoardEntry } from "@/lib/supabase";

interface BoredomRegistryProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: Profile[];
  friendIds: Set<string>;
  onToggleFriend: (id: string) => void;
  myId: string;
  initialTab?: "registry" | "leaderbored";
}

const FAKE_LEADERBOARD: BoredBoardEntry[] = [
  { user_id: "miles", display_name: "miles", color: "#4338ca", total_boredoms: 42069, currently_bored: true },
  { user_id: "hamlet", display_name: "hamlet", color: "#1e1b4b", total_boredoms: 31415, currently_bored: true },
  { user_id: "eeyore", display_name: "eeyore", color: "#7c8dab", total_boredoms: 27800, currently_bored: true },
  { user_id: "godot", display_name: "godot", color: "#888888", total_boredoms: 19999, currently_bored: false },
  { user_id: "meursault", display_name: "meursault", color: "#c4a882", total_boredoms: 14200, currently_bored: true },
  { user_id: "daria", display_name: "daria", color: "#92400e", total_boredoms: 11050, currently_bored: false },
  { user_id: "ishmael", display_name: "ishmael", color: "#1e6091", total_boredoms: 8700, currently_bored: true },
  { user_id: "thing1", display_name: "thing 1", color: "#ef4444", total_boredoms: 5500, currently_bored: true },
  { user_id: "thing2", display_name: "thing 2", color: "#38bdf8", total_boredoms: 3200, currently_bored: false },
  { user_id: "bartleby", display_name: "bartleby", color: "#6b7280", total_boredoms: 0, currently_bored: false },
];

type Tab = "registry" | "leaderbored";

export function BoredomRegistry({
  isOpen,
  onClose,
  profiles,
  friendIds,
  onToggleFriend,
  myId,
  initialTab = "registry",
}: BoredomRegistryProps) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = profiles.filter((p) => p.id !== myId);

    const matched = q
      ? list.filter((p) => p.display_name.toLowerCase().includes(q))
      : list;

    return matched.sort((a, b) => {
      const aFriend = friendIds.has(a.id) ? 0 : 1;
      const bFriend = friendIds.has(b.id) ? 0 : 1;
      if (aFriend !== bFriend) return aFriend - bFriend;
      return a.display_name.localeCompare(b.display_name);
    });
  }, [profiles, friendIds, search, myId]);

  if (!isOpen) return null;

  const tabStyle = (active: boolean): React.CSSProperties => ({
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
        padding: "48px 24px",
        overflow: "auto",
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
        }}
      >
        x
      </button>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 24,
          marginBottom: 24,
        }}
      >
        <button
          className="link-hover"
          onClick={() => setTab("registry")}
          style={tabStyle(tab === "registry")}
        >
          registry
        </button>
        <button
          className="link-hover"
          onClick={() => setTab("leaderbored")}
          style={tabStyle(tab === "leaderbored")}
        >
          leaderbored
        </button>
      </div>

      {tab === "registry" && (
        <>
          {/* Search */}
          <input
            type="text"
            placeholder="search names"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #ccc",
              background: "rgba(255, 255, 255, 0.4)",
              color: "#444",
              fontSize: 16,
              outline: "none",
              width: "100%",
              maxWidth: 400,
              fontFamily: "inherit",
              textTransform: "lowercase",
              marginBottom: 32,
            }}
          />

          {/* Registry list */}
          <div style={{ width: "100%", maxWidth: 400 }}>
            {filtered.length === 0 && (
              <p style={{ textAlign: "center", color: "#aaa", fontSize: 14 }}>
                nobody here
              </p>
            )}

            {filtered.map((profile) => {
              const isFriend = friendIds.has(profile.id);

              return (
                <div
                  key={profile.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 0",
                    borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: profile.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 16, color: "#555" }}>
                      {profile.display_name}
                    </span>
                    {isFriend && (
                      <span style={{ fontSize: 11, color: "#aaa" }}>friend</span>
                    )}
                  </div>

                  <button
                    className={isFriend ? "btn-outline-hover" : "btn-dark-hover"}
                    onClick={() => onToggleFriend(profile.id)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      border: isFriend ? "1px solid #ccc" : "1px solid #999",
                      background: isFriend ? "transparent" : "#222",
                      color: isFriend ? "#999" : "#e0e0e0",
                      fontSize: 12,
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    {isFriend ? "remove" : "add"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "leaderbored" && (
        <div style={{ width: "100%", maxWidth: 400 }}>
          {FAKE_LEADERBOARD.map((entry, i) => (
            <div
              key={entry.user_id}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 0",
                borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
                gap: 12,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  color: "#aaa",
                  width: 28,
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                #{i + 1}
              </span>

              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: entry.color,
                  flexShrink: 0,
                  boxShadow: entry.currently_bored
                    ? `0 0 6px ${entry.color}88`
                    : "none",
                }}
              />

              <span style={{ fontSize: 16, color: "#555", flex: 1 }}>
                {entry.display_name}
              </span>

              {entry.currently_bored && (
                <span style={{ fontSize: 10, color: "#aaa" }}>bored</span>
              )}

              <span
                style={{
                  fontSize: 14,
                  color: "#999",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {entry.total_boredoms.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
