-- ============================================
-- BORED GAME — Seed bot characters
-- ============================================
-- These are "NPC" profiles that every user can add as friends.
-- They don't have real auth accounts — they exist only in profiles.
-- Run this in the Supabase SQL Editor after the initial schema migration.

-- First, create placeholder auth users for each bot so the
-- foreign key to auth.users is satisfied.
-- We use fixed UUIDs so this is idempotent (safe to run multiple times).

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'thing1@bots.boredgame.app', '$2a$10$placeholder', now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000002', 'thing2@bots.boredgame.app', '$2a$10$placeholder', now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000003', 'meursault@bots.boredgame.app', '$2a$10$placeholder', now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000004', 'godot@bots.boredgame.app', '$2a$10$placeholder', now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000005', 'ishmael@bots.boredgame.app', '$2a$10$placeholder', now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000006', 'bartleby@bots.boredgame.app', '$2a$10$placeholder', now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000007', 'hamlet@bots.boredgame.app', '$2a$10$placeholder', now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000008', 'eeyore@bots.boredgame.app', '$2a$10$placeholder', now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000009', 'daria@bots.boredgame.app', '$2a$10$placeholder', now(), now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- Now create the profiles
INSERT INTO public.profiles (id, display_name, color)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'thing 1',    '#ef4444'),
  ('00000000-0000-4000-8000-000000000002', 'thing 2',    '#38bdf8'),
  ('00000000-0000-4000-8000-000000000003', 'meursault',  '#c4a882'),
  ('00000000-0000-4000-8000-000000000004', 'godot',      '#888888'),
  ('00000000-0000-4000-8000-000000000005', 'ishmael',    '#1e6091'),
  ('00000000-0000-4000-8000-000000000006', 'bartleby',   '#6b7280'),
  ('00000000-0000-4000-8000-000000000007', 'hamlet',     '#1e1b4b'),
  ('00000000-0000-4000-8000-000000000008', 'eeyore',     '#7c8dab'),
  ('00000000-0000-4000-8000-000000000009', 'daria',      '#92400e')
ON CONFLICT (id) DO NOTHING;
