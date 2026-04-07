"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BoredomScreensaver } from "@/components/boredom-screensaver";
import { BoredomRegistry } from "@/components/boredom-registry";
import { SettingsModal } from "@/components/settings-modal";
import { useMorseToggle } from "@/hooks/use-morse-toggle";
import { useFriendBoredoms, useMyBoredom } from "@/hooks/use-boredom";
import { useFriendNotifications } from "@/hooks/use-friend-notifications";
import { FriendToasts } from "@/components/friend-toasts";
import { InstallPrompt } from "@/components/install-prompt";
import { BOT_PROFILES, BOT_IDS } from "@/lib/supabase";
import type { FriendBoredom, Profile, BoredBoardEntry } from "@/lib/supabase";
const SIDE_WIDTH = 130;

function makeBotFriend(
  id: string,
  name: string,
  color: string,
  isBored: boolean
): FriendBoredom {
  return {
    profile: { id, display_name: name, color, created_at: "", boredom_count: 0 },
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
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const removedBotsRef = useRef(new Set<string>());
  const [removedBotsLoaded, setRemovedBotsLoaded] = useState(false);
  useEffect(() => {
    removedBotsRef.current = new Set(JSON.parse(localStorage.getItem("removed-bots") || "[]"));
    setRemovedBotsLoaded(true);
  }, []);

  // UI state
  const [localTurbo, setLocalTurbo] = useState(false);
  const [turboExpiresAt, setTurboExpiresAt] = useState<string | null>(null);
  const [turboTimeLeft, setTurboTimeLeft] = useState("");
  const [boredoms, setBoredoms] = useState(0);
  const [timeLeft, setTimeLeft] = useState("");
  const [registryOpen, setRegistryOpen] = useState(false);
  const [registryTab, setRegistryTab] = useState<"registry" | "leaderbored">("registry");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState<BoredBoardEntry[]>([]);
  const [toggling, setToggling] = useState(false);
  const [toolbarInset, setToolbarInset] = useState(0);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Anchor for time-based boredom counting (avoids setInterval drift)
  const anchorCountRef = useRef(0);
  const anchorTimeRef = useRef(Date.now());
  const turboActivatedAtRef = useRef<number | null>(null);

  // Measure toolbar height so screensaver bubbles bounce off its top
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const val = window.innerHeight - rect.top;
      setToolbarInset((prev) => prev === val ? prev : val);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [authLoading]);

  // Real Supabase hooks
  const myBoredom = useMyBoredom(userId);
  const { friends: realFriends } = useFriendBoredoms(userId);

  // Friend notifications (toasts)
  const { notifications: friendNotifs, dismiss: dismissNotif } =
    useFriendNotifications(userId);

  // Morse toggles for bot characters
  const meursaultOn = useMorseToggle("today mother died", 500);
  const godotOn = useMorseToggle("nothing to be done", 600);

  const botStatesRef = useRef<Record<string, boolean>>({
    thing1: true,
    thing2: true,
    meursault: meursaultOn,
    godot: godotOn,
  });
  botStatesRef.current.meursault = meursaultOn;
  botStatesRef.current.godot = godotOn;

  // Check auth session on load
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        // Skip auth and render with mock data for preview testing
        if (process.env.NEXT_PUBLIC_PREVIEW_MODE === "true") {
          setUserId("preview");
          setUserProfile({ id: "preview", display_name: "preview", color: "#4A90D9", created_at: "", boredom_count: 0 });
          setAuthLoading(false);
          return;
        }
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

  // Sync boredom count to DB
  const syncBoredomCount = useCallback(async (count?: number) => {
    if (!userId) return;
    const val = count ?? boredomsRef.current;
    await supabase.rpc("sync_boredom_count", { count: val });
  }, [userId]);

  // Fetch leaderboard — sync our count first so the board is up to date
  const refreshLeaderboard = useCallback(async (period: string = "weekly") => {
    if (!userId) return;

    // Sync current count before fetching so our entry is accurate
    await syncBoredomCount();

    const { data: board } = await supabase.rpc("get_bored_board", { period });
    if (board) {
      setLeaderboard(
        (board as BoredBoardEntry[]).filter((e) => !e.user_id.startsWith("00000000-0000-4000-8000"))
      );
    }
  }, [userId, syncBoredomCount]);

  // Initialize boredom count from stored profile value + any active session elapsed
  useEffect(() => {
    if (!userProfile || !userId) return;

    const storedCount = userProfile.boredom_count || 0;

    // If currently bored, compute elapsed boredoms since toggled_at
    if (myBoredom.isBored && myBoredom.loading === false) {
      // We need the active toggle's toggled_at — fetch it
      supabase
        .from("boredom_toggles")
        .select("toggled_at, turbo_started_at")
        .eq("user_id", userId)
        .eq("is_bored", true)
        .gt("expires_at", new Date().toISOString())
        .order("toggled_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data: toggle }) => {
          if (!toggle) {
            setBoredoms(storedCount);
            anchorCountRef.current = storedCount;
            anchorTimeRef.current = Date.now();
            return;
          }

          const now = Date.now();
          const toggledAt = new Date(toggle.toggled_at).getTime();
          let elapsed = 0;

          if (toggle.turbo_started_at) {
            const turboAt = new Date(toggle.turbo_started_at).getTime();
            // Normal rate before turbo
            elapsed += Math.max(0, (turboAt - toggledAt) / 1000) * 5;
            // Turbo rate (up to 30 min)
            const turboEnd = Math.min(turboAt + 30 * 60 * 1000, now);
            elapsed += Math.max(0, (turboEnd - turboAt) / 1000) * 25;
            // Normal rate after turbo expires
            if (now > turboAt + 30 * 60 * 1000) {
              elapsed += ((now - turboAt - 30 * 60 * 1000) / 1000) * 5;
            }
          } else {
            elapsed = ((now - toggledAt) / 1000) * 5;
          }

          const resumedCount = storedCount + Math.floor(elapsed);
          setBoredoms(resumedCount);
          anchorCountRef.current = resumedCount;
          anchorTimeRef.current = now;

          // Sync the resumed count back to DB so it's current
          void supabase.rpc("sync_boredom_count", { count: resumedCount });
        });
    } else if (!myBoredom.loading) {
      setBoredoms(storedCount);
      anchorCountRef.current = storedCount;
      anchorTimeRef.current = Date.now();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile, userId, myBoredom.loading]);

  // Best-effort sync on page unload / visibility change
  const boredomsRef = useRef(boredoms);
  boredomsRef.current = boredoms;
  useEffect(() => {
    function handleUnload() {
      if (!userId) return;
      void supabase.rpc("sync_boredom_count", { count: boredomsRef.current });
    }
    function handleVisibility() {
      if (document.visibilityState === "hidden") handleUnload();
    }
    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [userId]);

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

      // Fetch friend IDs from DB
      const { data: friendships } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

      const ids = new Set<string>();
      // Add bots that haven't been explicitly removed
      for (const bot of BOT_PROFILES) {
        if (!removedBotsRef.current.has(bot.id)) {
          ids.add(bot.id);
        }
      }
      if (friendships) {
        for (const f of friendships) {
          ids.add(f.requester_id === userId ? f.addressee_id : f.requester_id);
        }
      }
      setFriendIds(ids);
    }

    fetchRegistryData();

    // Re-fetch friend IDs when friendships change (someone adds/removes you)
    const channel = supabase
      .channel("registry-friendships")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => fetchRegistryData()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, removedBotsLoaded]);

  // Build screensaver friends list: real Supabase friends + local bot friends
  // Note: botStatesRef is read at memo time — morse toggle changes don't trigger
  // a re-render here; the screensaver reads bot states via the ref prop instead.
  const allFriends: FriendBoredom[] = useMemo(() => {
    const combined = [...realFriends];
    const realFriendIds = new Set(realFriends.map((f) => f.profile.id));
    const botStates = botStatesRef.current;

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
  }, [realFriends, friendIds]);

  // Add/remove friend — instant, no approval
  async function handleToggleFriend(id: string) {
    if (!userId) return;

    const isBot = BOT_IDS.has(id);

    if (friendIds.has(id)) {
      // Remove friendship
      setFriendIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (isBot) {
        // Track bot removal in localStorage so it persists across reloads
        removedBotsRef.current.add(id);
        localStorage.setItem("removed-bots", JSON.stringify(Array.from(removedBotsRef.current)));
      } else {
        await supabase
          .from("friendships")
          .delete()
          .or(
            `and(requester_id.eq.${userId},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${userId})`
          );
      }
    } else {
      // Add friendship (instant accepted)
      setFriendIds((prev) => new Set(prev).add(id));
      if (isBot) {
        // Un-track bot removal
        removedBotsRef.current.delete(id);
        localStorage.setItem("removed-bots", JSON.stringify(Array.from(removedBotsRef.current)));
      } else {
        await supabase.from("friendships").insert({
          requester_id: userId,
          addressee_id: id,
          status: "accepted",
        });
      }
    }
  }

  // Toggle boredom via Supabase RPC
  async function handleToggleBoredom() {
    if (toggling) return;
    setToggling(true);
    try {
      // Sync count when turning boredom off — await to ensure it's saved
      if (myBoredom.isBored) {
        await syncBoredomCount();
      }
      clearTurbo();
      await myBoredom.toggleBoredom();
    } finally {
      setToggling(false);
    }
  }

  async function handleActivateTurbo() {
    setLocalTurbo(true);
    setTurboExpiresAt(new Date(Date.now() + 30 * 60 * 1000).toISOString());
    await supabase.rpc("set_turbo_started");
  }

  function clearTurbo() {
    // When turbo ends, re-anchor at the current count with normal rate
    if (localTurbo) {
      anchorCountRef.current = boredoms;
      anchorTimeRef.current = Date.now();
    }
    setLocalTurbo(false);
    setTurboExpiresAt(null);
    setTurboTimeLeft("");
    turboActivatedAtRef.current = null;
  }

  // Auto-bored on first load if not already bored (fire once)
  const autoBored = useRef(false);
  useEffect(() => {
    if (!myBoredom.loading && !myBoredom.isBored && userId && !autoBored.current) {
      autoBored.current = true;
      myBoredom.toggleBoredom().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myBoredom.loading, userId]);

  // Reset turbo when boredom ends
  useEffect(() => {
    if (!myBoredom.isBored) {
      setLocalTurbo(false);
      setTurboExpiresAt(null);
      setTurboTimeLeft("");
    }
  }, [myBoredom.isBored]);

  // Turbo countdown timer
  useEffect(() => {
    if (!localTurbo || !turboExpiresAt) return;

    const interval = setInterval(() => {
      const remaining = new Date(turboExpiresAt).getTime() - Date.now();
      if (remaining <= 0) {
        clearTurbo();
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setTurboTimeLeft(
        `${mins}:${secs.toString().padStart(2, "0")}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [localTurbo, turboExpiresAt]);

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

  // Re-anchor when boredom starts so we don't count idle time
  useEffect(() => {
    if (myBoredom.isBored) {
      anchorCountRef.current = boredoms;
      anchorTimeRef.current = Date.now();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myBoredom.isBored]);

  // Count boredoms while bored — computed from elapsed time to stay in sync with DB
  useEffect(() => {
    if (!myBoredom.isBored) return;

    // When turbo activates, snapshot the current count as a new anchor
    if (localTurbo && !turboActivatedAtRef.current) {
      anchorCountRef.current = boredoms;
      anchorTimeRef.current = Date.now();
      turboActivatedAtRef.current = Date.now();
    }

    const rate = localTurbo ? 25 : 5; // boredoms per second
    const interval = setInterval(() => {
      const elapsed = (Date.now() - anchorTimeRef.current) / 1000;
      setBoredoms(anchorCountRef.current + Math.floor(elapsed * rate));
    }, 200);

    return () => clearInterval(interval);
  }, [myBoredom.isBored, localTurbo]);

  // Loading screen
  if (authLoading) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100dvh",
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
    <div style={{ width: "100vw", height: "100dvh", overflow: "hidden" }}>
      <BoredomScreensaver
        friends={allFriends}
        myName={userName}
        myColor={userColor}
        myBored={myBoredom.isBored}
        myTurbo={localTurbo}
        bottomInset={toolbarInset}
        botStatesRef={botStatesRef}
      />

      {/* Boredom counter — engraved background */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
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
            color: "#c8c8c8",
            lineHeight: 1,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {boredoms.toLocaleString().split("").map((ch, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                textAlign: "center",
                width: ch === "," ? "0.35em" : "0.62em",
              }}
            >
              {ch}
            </span>
          ))}
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
          color: "#888",
          cursor: "pointer",
          fontFamily: "inherit",
          textTransform: "lowercase",
          textDecoration: "underline",
          zIndex: 10,
        }}
      >
        fwends
      </button>

      {/* Leaderbored button — top center */}
      <button
        className="link-hover"
        onClick={async () => {
          setRegistryTab("leaderbored");
          setRegistryOpen(true);
          await refreshLeaderboard();
        }}
        style={{
          position: "fixed",
          top: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: "none",
          border: "none",
          fontSize: 14,
          color: "#888",
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
          color: "#888",
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
        leaderboard={leaderboard}
        onRefreshLeaderboard={refreshLeaderboard}
        myBoredoms={boredoms}
      />
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentName={userName}
        currentColor={userColor}
        onNameChange={async (name) => {
          if (userProfile && userId) {
            setUserProfile({ ...userProfile, display_name: name });
            await supabase
              .from("profiles")
              .update({ display_name: name })
              .eq("id", userId);
          }
        }}
        onColorChange={async (color) => {
          if (userProfile && userId) {
            setUserProfile({ ...userProfile, color });
            await supabase
              .from("profiles")
              .update({ color })
              .eq("id", userId);
          }
        }}
      />

      {/* Friend toasts */}
      <FriendToasts notifications={friendNotifs} onDismiss={dismissNotif} />

      {/* Install PWA prompt for mobile users */}
      <InstallPrompt />

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
            alignItems: "center",
            gap: 8,
            opacity: myBoredom.isBored ? 1 : 0,
            transition: "opacity 0.3s ease",
            pointerEvents: myBoredom.isBored ? "auto" : "none",
          }}
        >
          {localTurbo ? (
            <>
              <span
                style={{
                  fontSize: 13,
                  color: "#888",
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                }}
              >
                {turboTimeLeft}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: "#888",
                  whiteSpace: "nowrap",
                }}
              >
                turbo
              </span>
            </>
          ) : (
            <button
              className="link-hover"
              onClick={handleActivateTurbo}
              style={{
                background: "none",
                border: "none",
                fontSize: 13,
                color: "#888",
                cursor: "pointer",
                fontFamily: "inherit",
                textDecoration: "underline",
                whiteSpace: "nowrap",
              }}
            >
              {"\u26a0 turbo boredom"}
            </button>
          )}
        </div>

        {/* Main toolbar */}
        <div
          ref={toolbarRef}
          className="toolbar-pill"
          style={{
            background: myBoredom.isBored
              ? `color-mix(in srgb, ${userColor} 15%, rgba(224, 224, 224, 0.6))`
              : "rgba(224, 224, 224, 0.6)",
            transition: "background 0.5s ease, box-shadow 0.5s ease, border 0.5s ease",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderRadius: 20,
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            border: myBoredom.isBored
              ? `1px solid ${userColor}33`
              : "1px solid rgba(0, 0, 0, 0.1)",
            boxShadow: myBoredom.isBored
              ? `0 4px 24px ${userColor}22, 0 0 16px ${userColor}15, 0 1px 4px rgba(0, 0, 0, 0.06)`
              : "0 4px 24px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.08)",
          }}
        >
          <span style={{ fontSize: 14, color: "#666", whiteSpace: "nowrap" }}>
            is {userName} bored?
          </span>

          <div style={{ flex: 1 }} />

          {/* Toggle */}
          <div
            onClick={handleToggleBoredom}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: toggling ? "not-allowed" : "pointer",
              opacity: toggling ? 0.6 : 1,
              transition: "opacity 0.2s ease",
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
                width: 60,
                height: 34,
                borderRadius: 17,
                background: myBoredom.isBored ? userColor : "#bbb",
                transition: "background 0.3s ease",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 3,
                  left: myBoredom.isBored ? 29 : 3,
                  width: 28,
                  height: 28,
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

        {/* Countdown — right of toolbar */}
        <div
          className="countdown-area"
          style={{
            width: SIDE_WIDTH,
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: myBoredom.isBored ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: "#888",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {timeLeft || "0:00:00"}
          </span>
        </div>
      </div>
    </div>
  );
}
