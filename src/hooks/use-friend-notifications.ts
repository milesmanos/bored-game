"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, BOT_IDS } from "@/lib/supabase";
import type { Friendship } from "@/lib/supabase";

const LS_KEY = "fwend-notifs-seen-ts";

export interface FriendNotification {
  id: string;
  names: string[];
  createdAt: string;
}

export function useFriendNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<FriendNotification[]>([]);
  const realtimeBufferRef = useRef<{ name: string; createdAt: string }[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenTsRef = useRef<string | null>(null);

  // Flush buffered realtime names into a single notification
  const flushBuffer = useCallback(() => {
    const buf = realtimeBufferRef.current;
    if (buf.length === 0) return;

    const names = buf.map((b) => b.name);
    const newest = buf.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)).createdAt;

    setNotifications((prev) => [
      ...prev,
      { id: crypto.randomUUID(), names, createdAt: newest },
    ]);

    // Update seen timestamp
    localStorage.setItem(LS_KEY, newest);
    seenTsRef.current = newest;
    realtimeBufferRef.current = [];
  }, []);

  // Retroactive query on mount
  useEffect(() => {
    if (!userId) return;

    const lastSeen = localStorage.getItem(LS_KEY);
    seenTsRef.current = lastSeen;

    async function fetchUnseen() {
      let query = supabase
        .from("friendships")
        .select("created_at, requester_id")
        .eq("addressee_id", userId!)
        .eq("status", "accepted")
        .order("created_at", { ascending: true });

      if (lastSeen) {
        query = query.gt("created_at", lastSeen);
      }

      const { data: friendships } = await query;
      if (!friendships || friendships.length === 0) return;

      // Filter out bots
      const humanFriendships = friendships.filter(
        (f) => !BOT_IDS.has(f.requester_id)
      );
      if (humanFriendships.length === 0) return;

      // Fetch display names
      const requesterIds = humanFriendships.map((f) => f.requester_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", requesterIds);

      if (!profiles || profiles.length === 0) return;

      const nameMap = new Map(profiles.map((p) => [p.id, p.display_name]));
      const names = humanFriendships
        .map((f) => nameMap.get(f.requester_id))
        .filter(Boolean) as string[];

      if (names.length === 0) return;

      const newest = humanFriendships[humanFriendships.length - 1].created_at;

      setNotifications([{ id: crypto.randomUUID(), names, createdAt: newest }]);

      localStorage.setItem(LS_KEY, newest);
      seenTsRef.current = newest;
    }

    fetchUnseen();
  }, [userId]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("friend-additions")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "friendships",
          filter: `addressee_id=eq.${userId}`,
        },
        async (payload) => {
          const row = payload.new as Friendship;
          if (BOT_IDS.has(row.requester_id)) return;
          if (row.status !== "accepted") return;

          // Skip if already seen (race with retroactive query)
          if (seenTsRef.current && row.created_at <= seenTsRef.current) return;

          // Fetch the requester's display name
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", row.requester_id)
            .maybeSingle();

          if (!profile) return;

          realtimeBufferRef.current.push({
            name: profile.display_name,
            createdAt: row.created_at,
          });

          // Debounce: flush after 2s of silence
          if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
          flushTimerRef.current = setTimeout(flushBuffer, 2000);
        }
      )
      .subscribe();

    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [userId, flushBuffer]);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { notifications, dismiss };
}
