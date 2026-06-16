-- Add starred_recordings table for per-agent call bookmarks.
-- Run this in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS starred_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recording_id TEXT NOT NULL,
  phone TEXT,
  duration INT,
  direction TEXT,
  called_at TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (agent_id, recording_id)
);

CREATE INDEX IF NOT EXISTS idx_starred_agent_phone ON starred_recordings (agent_id, phone);
