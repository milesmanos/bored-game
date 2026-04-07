# 🎲 Bored Game

A social boredom toggle app. Declare your boredom. See your friends' boredom float across your screen like a screensaver.

## How It Works

1. Create an account (name + pick a color)
2. Toggle: **"[Name] feels bored. TRUE"**
3. Your boredom floats across your friends' screens for 6 hours
4. **Bored Board**: leaderboard of most bored people
5. **Turbo Boredom**: makes your bubble zoom across screens

## Tech Stack

- **Next.js 14** (App Router, React Server Components)
- **Supabase** (Auth, Postgres, Realtime subscriptions)
- **PWA** (installable on phones via "Add to Home Screen")
- **TypeScript**

## Getting Started

### 1. Create a Supabase Project

Go to [supabase.com](https://supabase.com) and create a new project. It's free.

### 2. Run the Schema Migration

Copy the contents of `supabase/migrations/001_initial_schema.sql` and run it
in the Supabase SQL Editor (Dashboard → SQL Editor → New Query → paste → Run).

### 3. Set Up Environment Variables

```bash
cp .env.example .env.local
```

Fill in your Supabase URL and anon key from Dashboard → Settings → API.

### 4. Install & Run

```bash
npm install
npm run dev
```

### 5. Enable Realtime

In Supabase Dashboard → Database → Replication, make sure `boredom_toggles`
and `friendships` tables have realtime enabled.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Home — the screensaver view
│   ├── login/page.tsx      # Auth flow
│   ├── setup/page.tsx      # Name + color picker (new users)
│   ├── board/page.tsx      # Bored Board leaderboard
│   └── friends/page.tsx    # Add/manage friends
├── components/
│   ├── boredom-screensaver.tsx   # The floating bubbles
│   ├── boredom-toggle.tsx        # The big toggle button
│   └── bored-board.tsx           # Leaderboard table
├── hooks/
│   └── use-boredom.ts      # Real-time hooks
└── lib/
    └── supabase.ts          # Client + types
```

## Pages to Build

Use Claude Code to build these one at a time:

### Priority 1: Core Loop
- [ ] `app/login/page.tsx` — Magic link auth via Supabase
- [ ] `app/setup/page.tsx` — Name + color picker, creates profile
- [ ] `app/page.tsx` — Main screen with screensaver + toggle button

### Priority 2: Social
- [ ] `app/friends/page.tsx` — Search users, send/accept friend requests
- [ ] Friend request notifications

### Priority 3: Fun Features
- [ ] `app/board/page.tsx` — Bored Board leaderboard
- [ ] Turbo boredom toggle
- [ ] PWA manifest + service worker

## Claude Code Tips

When building with Claude Code, try prompts like:

> "Build the login page at app/login/page.tsx. Use Supabase magic link auth.
> After login, redirect to /setup if no profile exists, otherwise go to /.
> Use the supabase client from @/lib/supabase."

> "Build the main home page at app/page.tsx. It should show the
> BoredomScreensaver component full-screen with a floating toggle button
> at the bottom. Use the useMyBoredom and useFriendBoredoms hooks."

> "Add PWA support — create a manifest.json and a basic service worker
> so the app can be installed to home screen."

## Making It a PWA

Add to `public/manifest.json`:
```json
{
  "name": "Bored Game",
  "short_name": "Bored",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#FF6B6B",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Then register a service worker in your layout for offline support.
