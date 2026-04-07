"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BoredomScreensaver } from "@/components/boredom-screensaver";
import { BoredomRegistry } from "@/components/boredom-registry";
import { SettingsModal } from "@/components/settings-modal";
import { useMorseToggle } from "@/hooks/use-morse-toggle";
import { useFriendBoredoms, useMyBoredom } from "@/hooks/use-boredom";
import type { FriendBoredom, Profile } from "@/lib/supabase";

// Bot profiles — always available in registry even if not seeded in DB
const BOT_PROFILES: Profile[] = [
  { id: "thing1", display_name: "thing 1", color: "#ef4444", created_at: "" },
  { id: "thing2", display_name: "thing 2", color: "#38bdf8", created_at: "" },
  { id: "meursault", display_name: "meursault", color: "#c4a882", created_at: "" },
  { id: "godot", display_name: "godot", color: "#888888", created_at: "" },
  { id: "bartleby", display_name: "bartleby", color: "#6b7280", created_at: "" },
  { id: "eeyore", display_name: "eeyore", color: "#7c8dab", created_at: "" },
];

const BOT_IDS = new Set(BOT_PROFILES.map((p) => p.id));
const SIDE_WIDTH = 130;

function makeBotFriend(
  id: string,
  name: string,
  color: string,
  isBored: boolean
): FriendBoredom {
  return {
    profile: { id, display_name: name, color, created_at: "" },
    toggle: isBored
      ? {
          id: `bot-${id}`,
          user_id: id,
          is_bored: true,
          turbo: false,
          toggled_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        }
      : null,
  };
}

export default function HomePage() {
  const router = useRouter();

  // Auth state
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Friend state — declared BEFORE anything that references it
  const [allProfiles, setAllProfiles] = useState<Profile[]>(BOT_PROFILES);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set(["godot"]));

  // UI state
  const [localTurbo, setLocalTurbo] = useState(false);
  const [boredoms, setBoredoms] = useState(0);
  const [timeLeft, setTimeLeft] = useState("");
  const [registryOpen, setRegistryOpen] = useState(false);
  const [registryTab, setRegistryTab] = useState<"registry" | "leaderbored">("registry");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Real Supabase hooks
  const myBoredom = useMyBoredom(userId);
  const { friends: realFriends } = useFriendBoredoms(userId);

  // Morse toggles for bot characters
  const meursaultOn = useMorseToggle("today mother died", 500);
  const godotOn = useMorseToggle("nothing to be done", 600);

  const botStates: Record<string, boolean> = {
    thing1: true,
    thing2: false,
    meursault: meursaultOn,
    godot: godotOn,
    bartleby: false,
    eeyore: true,
  };

  // Check auth session on load
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      setUserId(session.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!profile) {
        router.push("/setup");
        return;
      }

      setUserProfile(profile);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Fetch registry data (all profiles + friend IDs) from Supabase
  useEffect(() => {
    if (!userId) return;

    async function fetchRegistryData() {
      const { data: profiles } = await supabase.from("profiles").select("*");

      // Merge real profiles with bots (avoid duplicates)
      const realIds = new Set((profiles || []).map((p) => p.id));
      const merged = [
        ...(profiles || []),
        ...BOT_PROFILES.filter((b) => !realIds.has(b.id)),
      ];
      setAllProfiles(merged);

      // Fetch real friend IDs
      const { data: friendships } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

      const ids = new Set(["godot"]); // godot is always default
      if (friendships) {
        for (const f of friendships) {
          ids.add(f.requester_id === userId ? f.addressee_id : f.requester_id);
        }
      }
      setFriendIds(ids);
    }

    fetchRegistryData();
  }, [userId]);

  // Build screensaver friends list: real Supabase friends + local bot friends
  const allFriends: FriendBoredom[] = useMemo(() => {
    const combined = [...realFriends];
    const realFriendIds = new Set(realFriends.map((f) => f.profile.id));

    // Add any bot from friendIds that isn't already a real Supabase friend
    for (const bot of BOT_PROFILES) {
      if (friendIds.has(bot.id) && !realFriendIds.has(bot.id)) {
        combined.push(
          makeBotFriend(bot.id, bot.display_name, bot.color, botStates[bot.id] ?? false)
        );
      }
    }

    // Override bored state for bots with Morse code animations
    return combined.map((f) => {
      if (BOT_IDS.has(f.profile.id) && botStates[f.profile.id] !== undefined) {
        return makeBotFriend(
          f.profile.id,
          f.profile.display_name,
          f.profile.color,
          botStates[f.profile.id]
        );
      }
      return f;
    });
  }, [realFriends, friendIds, meursaultOn, godotOn]);

  // Add/remove friend — instant, no approval
  async function handleToggleFriend(id: string) {
    if (!userId) return;

    if (friendIds.has(id)) {
      // Remove friendship
      setFriendIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await supabase
        .from("friendships")
        .delete()
        .or(
          `and(requester_id.eq.${userId},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${userId})`
        );
    } else {
      // Add friendship (instant accepted)
      setFriendIds((prev) => new Set(prev).add(id));
      await supabase.from("friendships").insert({
        requester_id: userId,
        addressee_id: id,
        status: "accepted",
      });
    }
  }

  // Toggle boredom via Supabase RPC
  async function handleToggleBoredom() {
    setLocalTurbo(false);
    await myBoredom.toggleBoredom();
  }

  function handleActivateTurbo() {
    setLocalTurbo(true);
  }

  async function handleRenew() {
    // Optimistically show 2:00:00 while the DB catches up
    setTimeLeft("2:00:00");
    setLocalTurbo(false);
    await myBoredom.toggleBoredom(); // turns off
    await myBoredom.toggleBoredom(); // turns on
  }

  // Reset turbo when boredom ends
  useEffect(() => {
    if (!myBoredom.isBored) setLocalTurbo(false);
  }, [myBoredom.isBored]);

  // Countdown timer
  useEffect(() => {
    if (!myBoredom.isBored || !myBoredom.expiresAt) return;

    const interval = setInterval(() => {
      const remaining = new Date(myBoredom.expiresAt!).getTime() - Date.now();
      if (remaining <= 0) {
        setTimeLeft("0:00:00");
        return;
      }
      const hours = Math.floor(remaining / 3600000);
      const mins = Math.floor((remaining % 3600000) / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(
        `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [myBoredom.isBored, myBoredom.expiresAt]);

  // Count boredoms while bored
  useEffect(() => {
    if (!myBoredom.isBored) return;

    const tickMs = localTurbo ? 40 : 200;
    const interval = setInterval(() => {
      setBoredoms((prev) => prev + 1);
    }, tickMs);

    return () => clearInterval(interval);
  }, [myBoredom.isBored, localTurbo]);

  // Loading screen
  if (authLoading) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textTransform: "lowercase",
          color: "#aaa",
        }}
      >
        loading...
      </div>
    );
  }

  const userName = userProfile?.display_name || "you";
  const userColor = userProfile?.color || "#888";

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <BoredomScreensaver
        friends={allFriends}
        myName={userName}
        myColor={userColor}
        myBored={myBoredom.isBored}
        myTurbo={localTurbo}
      />

      {/* Boredom counter — engraved background */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          textTransform: "lowercase",
          userSelect: "none",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <div
          style={{
            fontSize: "20vw",
            fontWeight: 400,
            color: "#d4d4d4",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {boredoms.toLocaleString()}
        </div>
        <div style={{ fontSize: "3vw", color: "#ccc", marginTop: 8 }}>
          boredoms
        </div>
      </div>

      {/* Registry button */}
      <button
        className="link-hover"
        onClick={() => {
          setRegistryOpen(true);
          setRegistryTab("registry");
        }}
        style={{
          position: "fixed",
          top: 24,
          left: 24,
          background: "none",
          border: "none",
          fontSize: 14,
          color: "#999",
          cursor: "pointer",
          fontFamily: "inherit",
          textTransform: "lowercase",
          textDecoration: "underline",
          zIndex: 10,
        }}
      >
        registry
      </button>

      {/* Leaderbored button — top center */}
      <button
        className="link-hover"
        onClick={() => {
          setRegistryOpen(true);
          setRegistryTab("leaderbored");
        }}
        style={{
          position: "fixed",
          top: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: "none",
          border: "none",
          fontSize: 14,
          color: "#999",
          cursor: "pointer",
          fontFamily: "inherit",
          textTransform: "lowercase",
          textDecoration: "underline",
          zIndex: 10,
        }}
      >
        leaderbored
      </button>

      {/* Settings button */}
      <button
        className="link-hover"
        onClick={() => setSettingsOpen(true)}
        style={{
          position: "fixed",
          top: 24,
          right: 24,
          background: "none",
          border: "none",
          fontSize: 14,
          color: "#999",
          cursor: "pointer",
          fontFamily: "inherit",
          textTransform: "lowercase",
          textDecoration: "underline",
          zIndex: 10,
        }}
      >
        settings
      </button>

      {/* Modals */}
      <BoredomRegistry
        isOpen={registryOpen}
        onClose={() => setRegistryOpen(false)}
        profiles={allProfiles}
        friendIds={friendIds}
        onToggleFriend={handleToggleFriend}
        myId={userId || ""}
        initialTab={registryTab}
      />
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentName={userName}
        onNameChange={async (name) => {
          if (userProfile && userId) {
            setUserProfile({ ...userProfile, display_name: name });
            await supabase
              .from("profiles")
              .update({ display_name: name })
              .eq("id", userId);
          }
        }}
      />

      {/* Bottom toolbar area */}
      <div
        className="bottom-toolbar-area"
        style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          textTransform: "lowercase",
          userSelect: "none",
          zIndex: 10,
        }}
      >
        {/* Turbo — left of toolbar */}
        <div
          className="turbo-btn"
          style={{
            width: SIDE_WIDTH,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            className="link-hover"
            onClick={handleActivateTurbo}
            disabled={localTurbo || !myBoredom.isBored}
            style={{
              background: "none",
              border: "none",
              fontSize: 13,
              color: localTurbo ? "#666" : "#999",
              cursor: myBoredom.isBored && !localTurbo ? "pointer" : "default",
              fontFamily: "inherit",
              textDecoration: "underline",
              opacity: myBoredom.isBored ? 1 : 0,
              transition: "opacity 0.3s ease",
              pointerEvents: myBoredom.isBored ? "auto" : "none",
              whiteSpace: "nowrap",
            }}
          >
            {localTurbo ? "turbo active" : "\u26a0 turbo boredom"}
          </button>
        </div>

        {/* Main toolbar */}
        <div
          className="toolbar-pill"
          style={{
            background: "rgba(224, 224, 224, 0.6)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderRadius: 20,
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            border: "1px solid rgba(0, 0, 0, 0.1)",
            boxShadow:
              "0 4px 24px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.08)",
          }}
        >
          <span style={{ fontSize: 14, color: "#666", whiteSpace: "nowrap" }}>
            {userName} is bored
          </span>

          {/* Toggle */}
          <div
            onClick={handleToggleBoredom}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: myBoredom.isBored ? "#aaa" : "#666",
                transition: "color 0.3s ease",
              }}
            >
              nah
            </span>

            <div
              style={{
                position: "relative",
                width: 48,
                height: 28,
                borderRadius: 14,
                background: myBoredom.isBored ? userColor : "#bbb",
                transition: "background 0.3s ease",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 3,
                  left: myBoredom.isBored ? 23 : 3,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left 0.3s ease",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </div>

            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: myBoredom.isBored ? "#666" : "#aaa",
                transition: "color 0.3s ease",
              }}
            >
              yah
            </span>
          </div>
        </div>

        {/* Countdown + renew — right of toolbar */}
        <div
          className="countdown-area"
          style={{
            width: SIDE_WIDTH,
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: myBoredom.isBored ? 1 : 0,
            transition: "opacity 0.3s ease",
            pointerEvents: myBoredom.isBored ? "auto" : "none",
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: "#999",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {timeLeft || "0:00:00"}
          </span>
          <button
            className="link-hover"
            onClick={handleRenew}
            style={{
              background: "none",
              border: "none",
              fontSize: 13,
              color: "#999",
              cursor: "pointer",
              fontFamily: "inherit",
              textDecoration: "underline",
            }}
          >
            renew
          </button>
        </div>
      </div>
    </div>
  );
}
