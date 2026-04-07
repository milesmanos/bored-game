import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================
// Type definitions matching our schema
// ============================================

export interface Profile {
  id: string;
  display_name: string;
  color: string;
  created_at: string;
  boredom_count: number;
}

export interface BoredomToggle {
  id: string;
  user_id: string;
  is_bored: boolean;
  turbo: boolean;
  toggled_at: string;
  expires_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
  created_at: string;
}

export interface BoredBoardEntry {
  user_id: string;
  display_name: string;
  color: string;
  total_boredoms: number;
  currently_bored: boolean;
}

// ============================================
// A friend's boredom state (what you see floating)
// ============================================
export interface FriendBoredom {
  profile: Profile;
  toggle: BoredomToggle | null;
}

// ============================================
// Bot profiles — always available in registry
// ============================================
export const BOT_PROFILES: Profile[] = [
  { id: "thing1", display_name: "thing 1", color: "#dc5858", created_at: "", boredom_count: 0 },
  { id: "thing2", display_name: "thing 2", color: "#5bb8d4", created_at: "", boredom_count: 0 },
  { id: "meursault", display_name: "meursault", color: "#c4a882", created_at: "", boredom_count: 0 },
  { id: "godot", display_name: "godot", color: "#22c55e", created_at: "", boredom_count: 0 },
];

export const BOT_IDS = new Set(BOT_PROFILES.map((p) => p.id));
