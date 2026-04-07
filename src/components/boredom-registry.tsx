"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import type { Profile, BoredBoardEntry } from "@/lib/supabase";
import { tabStyle } from "@/lib/styles";

interface BoredomRegistryProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: Profile[];
  friendIds: Set<string>;
  onToggleFriend: (id: string) => void;
  myId: string;
  initialTab?: "registry" | "leaderbored";
  leaderboard: BoredBoardEntry[];
  onRefreshLeaderboard: (period?: string) => Promise<void>;
  myBoredoms: number;
}

type Tab = "registry" | "leaderbored";

export function BoredomRegistry(props: BoredomRegistryProps) {
  const {
    isOpen, onClose, profiles, friendIds, onToggleFriend,
    myId, initialTab = "registry", leaderboard, onRefreshLeaderboard, myBoredoms,
  } = props;

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [period, setPeriod] = useState("weekly");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [sadFaces, setSadFaces] = useState<{ id: number; emoji: string; x: number; y: number; vy: number; rotation: number; rotationSpeed: number; settled: boolean }[]>([]);

  useEffect(() => {
    if (isOpen) setTab(initialTab);
    if (!isOpen) setSadFaces([]);
  }, [initialTab, isOpen]);

  useEffect(() => {
    const handleResize = () => {
      const floor = window.innerHeight - 56;
      setSadFaces((prev) => prev.map((sf) => sf.settled ? { ...sf, y: floor } : sf));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isOpen || sadFaces.length === 0 || sadFaces.every((sf) => sf.settled)) return;
    let frame: number;
    const animate = () => {
      const vh = window.innerHeight;
      setSadFaces((prev) => prev.map((sf) => {
        if (sf.settled) return sf;
        let { y, vy, rotation, rotationSpeed } = sf;
        vy += 0.3;
        y += vy;
        rotation += rotationSpeed;
        const floor = vh - 56;
        if (y >= floor) {
          y = floor;
          vy *= -0.4;
          rotationSpeed *= 0.7;
          if (Math.abs(vy) < 0.5) {
            return { ...sf, y: floor, vy: 0, rotation, rotationSpeed: 0, settled: true };
          }
        }
        return { ...sf, y, vy, rotation, rotationSpeed };
      }));
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isOpen, sadFaces.length]);

  function handleSadDrop() {
    const sadEmojis = ["\u{1F61E}", "\u{1F622}", "\u{1F614}", "\u{1F97A}", "\u{1F63F}", "\u{1F494}", "\u{1F629}", "\u{1F62E}\u200D\u{1F4A8}"];
    const emoji = sadEmojis[Math.floor(Math.random() * sadEmojis.length)];
    setSadFaces((prev) => [...prev, {
      id: Date.now(), emoji, x: 24 + Math.random() * 40, y: 60, vy: 0,
      rotation: 0, rotationSpeed: (Math.random() - 0.5) * 8, settled: false,
    }]);
  }

  const fetchTimeRef = useRef(Date.now());
  const [tick, setTick] = useState(0);

  useEffect(() => { fetchTimeRef.current = Date.now(); }, [leaderboard]);

  useEffect(() => {
    if (!isOpen || tab !== "leaderbored") return;
    const interval = setInterval(() => setTick((t) => t + 1), 200);
    return () => clearInterval(interval);
  }, [isOpen, tab]);

  const liveLeaderboard = useMemo(() => {
    const elapsed = (Date.now() - fetchTimeRef.current) / 1000;
    return leaderboard.map((entry) => ({
      ...entry,
      total_boredoms:
        entry.user_id === myId
          ? myBoredoms
          : entry.currently_bored
            ? entry.total_boredoms + Math.floor(elapsed * 5)
            : entry.total_boredoms,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaderboard, myId, myBoredoms, tick]);

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

  return (
    <>
      {/* Scrollable blurred modal */}
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
          padding: "48px 24px 24px",
          overflow: "auto",
          textTransform: "lowercase",
        }}
      >
        <div style={{ display: "flex", gap: 24, marginBottom: 24 }}>
          <button className="link-hover" onClick={() => setTab("registry")} style={tabStyle(tab === "registry")}>
            fwends
          </button>
          <button
            className="link-hover"
            onClick={() => { setTab("leaderbored"); onRefreshLeaderboard(period); }}
            style={tabStyle(tab === "leaderbored")}
          >
            leaderbored
          </button>
        </div>

        {tab === "registry" && (
          <input
            type="text"
            placeholder="type a name bla"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: "none",
              background: "rgba(0, 0, 0, 0.04)",
              boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.08)",
              color: "#555",
              fontSize: 16,
              outline: "none",
              width: "100%",
              maxWidth: 400,
              fontFamily: "inherit",
              textTransform: "lowercase",
              marginBottom: 24,
            }}
          />
        )}

        {tab === "registry" && (
          <div style={{ width: "100%", maxWidth: 400 }}>
            {filtered.length === 0 && (
              <p style={{ textAlign: "center", color: "#999", fontSize: 14 }}>nobody here</p>
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
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: profile.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 16, color: "#555" }}>{profile.display_name}</span>
                    {isFriend && <span style={{ fontSize: 11, color: "#999" }}>friend</span>}
                  </div>
                  <button
                    className={isFriend ? "btn-outline-hover" : "btn-dark-hover"}
                    onClick={() => onToggleFriend(profile.id)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      border: isFriend ? "1px solid #ccc" : "1px solid #888",
                      background: isFriend ? "transparent" : "#222",
                      color: isFriend ? "#888" : "#e0e0e0",
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
        )}

        {tab === "leaderbored" && (
          <div style={{ width: "100%", maxWidth: 400 }}>
            <div style={{ position: "relative", marginBottom: 24, width: "100%" }}>
              <button
                className="btn-outline-hover"
                onClick={() => setPeriodOpen((o) => !o)}
                style={{
                  padding: "14px 16px", borderRadius: 12, border: "1px solid #ccc",
                  background: "transparent", color: "#888", fontSize: 14,
                  fontFamily: "inherit", cursor: "pointer", width: "100%",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {period === "all" ? "all time" : period}
                <span style={{ fontSize: 10, color: "#bbb" }}>{periodOpen ? "\u25B2" : "\u25BC"}</span>
              </button>
              {periodOpen && (
                <div
                  style={{
                    position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
                    borderRadius: 12, border: "1px solid #ccc",
                    background: "rgba(240, 240, 240, 0.95)",
                    backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
                    overflow: "hidden", zIndex: 10,
                  }}
                >
                  {[
                    { value: "daily", label: "daily" },
                    { value: "weekly", label: "weekly" },
                    { value: "monthly", label: "monthly" },
                    { value: "yearly", label: "yearly" },
                    { value: "all", label: "all time" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      className="link-hover"
                      onClick={() => { setPeriod(opt.value); setPeriodOpen(false); onRefreshLeaderboard(opt.value); }}
                      style={{
                        display: "block", width: "100%", padding: "12px 16px",
                        background: opt.value === period ? "rgba(0, 0, 0, 0.04)" : "transparent",
                        border: "none", color: opt.value === period ? "#666" : "#888",
                        fontSize: 14, fontFamily: "inherit", cursor: "pointer",
                        textAlign: "center", textTransform: "lowercase",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {liveLeaderboard.length === 0 && (
              <p style={{ textAlign: "center", color: "#999", fontSize: 14 }}>nobody yet</p>
            )}
            {liveLeaderboard.map((entry, i) => (
              <div
                key={entry.user_id}
                style={{
                  display: "flex", alignItems: "center", padding: "12px 0",
                  borderBottom: "1px solid rgba(0, 0, 0, 0.06)", gap: 12,
                }}
              >
                <span style={{ fontSize: 14, color: "#999", width: 28, textAlign: "right", flexShrink: 0 }}>
                  #{i + 1}
                </span>
                <div
                  style={{
                    width: 12, height: 12, borderRadius: "50%", background: entry.color, flexShrink: 0,
                    boxShadow: entry.currently_bored ? `0 0 6px ${entry.color}88` : "none",
                  }}
                />
                <span style={{ fontSize: 16, color: "#555", flex: 1 }}>{entry.display_name}</span>
                <span style={{ fontSize: 14, color: "#888", fontVariantNumeric: "tabular-nums" }}>
                  {entry.total_boredoms.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed buttons — rendered AFTER the blurred div so they paint on top */}
      <button
        className="close-hover"
        onClick={onClose}
        style={{
          position: "fixed", top: 20, right: 24, background: "none", border: "none",
          fontSize: 28, color: "#888", cursor: "pointer", fontFamily: "inherit",
          lineHeight: 1, zIndex: 110,
        }}
      >
        x
      </button>
      <button
        onClick={handleSadDrop}
        style={{
          position: "fixed", top: 20, left: 24, background: "none", border: "none",
          fontSize: 24, color: "#888", cursor: "pointer", fontFamily: "inherit",
          lineHeight: 1, zIndex: 110,
        }}
      >
        ?
      </button>

      {/* Sad face drops */}
      {sadFaces.map((sf) => (
        <span
          key={sf.id}
          style={{
            position: "fixed", left: sf.x, top: sf.y, fontSize: 32,
            pointerEvents: "none", zIndex: 200, transform: `rotate(${sf.rotation}deg)`,
          }}
        >
          {sf.emoji}
        </span>
      ))}
    </>
  );
}
