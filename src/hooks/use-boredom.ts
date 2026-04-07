import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { FriendBoredom, BoredomToggle, Profile } from "@/lib/supabase";

/**
 * Subscribes to real-time boredom updates from your friends.
 * Returns an array of FriendBoredom objects that update live.
 */
export function useFriendBoredoms(userId: string | null) {
  const [friends, setFriends] = useState<FriendBoredom[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFriends = useCallback(async () => {
    if (!userId) return;

    // Get accepted friendships
    const { data: friendships } = await supabase
      .from("friendships")
      .select("requester_id, addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    if (!friendships) return;

    // Extract friend IDs
    const friendIds = friendships.map((f) =>
      f.requester_id === userId ? f.addressee_id : f.requester_id
    );

    if (friendIds.length === 0) {
      setFriends([]);
      setLoading(false);
      return;
    }

    // Get profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", friendIds);

    // Get active boredom toggles
    const { data: toggles } = await supabase
      .from("boredom_toggles")
      .select("*")
      .in("user_id", friendIds)
      .eq("is_bored", true)
      .gt("expires_at", new Date().toISOString());

    // Combine
    const friendBoredoms: FriendBoredom[] = (profiles || []).map((profile) => ({
      profile,
      toggle:
        (toggles || []).find((t: BoredomToggle) => t.user_id === profile.id) ||
        null,
    }));

    setFriends(friendBoredoms);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchFriends();

    // Subscribe to real-time changes on boredom_toggles
    const channel = supabase
      .channel("boredom-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "boredom_toggles",
        },
        () => {
          // Re-fetch when any toggle changes
          // (Supabase RLS ensures we only see friends' data)
          fetchFriends();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFriends]);

  return { friends, loading, refetch: fetchFriends };
}

/**
 * Hook for the current user's own boredom state + toggle action.
 */
export function useMyBoredom(userId: string | null) {
  const [currentToggle, setCurrentToggle] = useState<BoredomToggle | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const fetchMyBoredom = useCallback(async () => {
    if (!userId) return;

    const { data } = await supabase
      .from("boredom_toggles")
      .select("*")
      .eq("user_id", userId)
      .eq("is_bored", true)
      .gt("expires_at", new Date().toISOString())
      .order("toggled_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setCurrentToggle(data);
    setLoading(false);
  }, [userId]);

  const toggleBoredom = useCallback(
    async (turbo: boolean = false) => {
      if (!userId) return;

      const { data, error } = await supabase.rpc("toggle_boredom", {
        turbo_mode: turbo,
      });

      if (!error && data) {
        setCurrentToggle(data.is_bored ? data : null);
      }

      return { data, error };
    },
    [userId]
  );

  useEffect(() => {
    fetchMyBoredom();
  }, [fetchMyBoredom]);

  return {
    isBored: !!currentToggle,
    isTurbo: currentToggle?.turbo || false,
    expiresAt: currentToggle?.expires_at || null,
    toggleBoredom,
    loading,
  };
}
