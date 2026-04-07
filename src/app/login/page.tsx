"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) redirectAfterLogin(session.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) redirectAfterLogin(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function redirectAfterLogin(userId: string) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (profile) {
      router.push("/");
    } else {
      router.push("/setup");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const safeName = name.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    const fakeEmail = `${safeName}@users.boredgame.app`;
    const paddedPassword = password + "_bored_game_padding";

    const { error } = await supabase.auth.signUp({
      email: fakeEmail,
      password: paddedPassword,
    });

    if (error) setError(error.message);
    setLoading(false);
  }

  const inputStyle: React.CSSProperties = {
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid #ccc",
    background: "#d5d5d5",
    color: "#444",
    fontSize: 16,
    outline: "none",
    width: "100%",
    fontFamily: "inherit",
    textTransform: "lowercase",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textTransform: "lowercase",
      }}
    >
      <h1 style={{ fontSize: 48, fontWeight: 400, marginBottom: 48 }}>
        bored game
      </h1>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: "100%",
          maxWidth: 360,
        }}
      >
        <input
          type="text"
          placeholder="my name feels like"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={inputStyle}
        />

        <div>
          <input
            type="password"
            placeholder="my password could be"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={1}
            style={inputStyle}
          />

          {password.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: "#ccc",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(40 + password.length * 8, 100)}%`,
                    borderRadius: 3,
                    background: "#999",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <p style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                good enoug
              </p>
            </div>
          )}
        </div>

        <button
          className="btn-dark-hover"
          type="submit"
          disabled={loading}
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            border: "none",
            background: "#222",
            color: "#e0e0e0",
            fontSize: 16,
            fontFamily: "inherit",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "hold on..." : "sign up"}
        </button>

        {error && (
          <p style={{ color: "#999", fontSize: 14, textAlign: "center" }}>
            {error}
          </p>
        )}
      </form>

      <Link
        className="link-hover"
        href="/login/returning"
        style={{
          marginTop: 24,
          color: "#888",
          fontSize: 14,
          fontFamily: "inherit",
          textDecoration: "underline",
        }}
      >
        already here? log in
      </Link>
    </div>
  );
}
