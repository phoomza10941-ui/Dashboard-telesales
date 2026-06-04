-- Add Oreka (dtac OneCall) Local Party number to profiles for talk-time matching.
-- Run this in the Supabase SQL editor.
--
-- oreka_ext = the agent's full mobile number as it appears in Oreka's "Local Party"
--             column, in +66 format (e.g. '+66949998575').

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS oreka_ext TEXT;
-- Second product line (Hopeful) — separate Local Party number.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS oreka_ext_hopeful TEXT;

-- Optional: speed up the lookup join.
CREATE INDEX IF NOT EXISTS idx_profiles_oreka_ext ON profiles (oreka_ext);
CREATE INDEX IF NOT EXISTS idx_profiles_oreka_ext_hopeful ON profiles (oreka_ext_hopeful);

-- Then set each agent's number, e.g.:
--   UPDATE profiles SET oreka_ext = '+66949998575' WHERE nickname = 'ชื่อเล่น';
