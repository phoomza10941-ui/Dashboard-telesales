-- scripts/add-call-summaries-table.sql
CREATE TABLE IF NOT EXISTS call_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recording_id TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  duration INTEGER,
  called_at TIMESTAMPTZ,
  transcript TEXT,
  summary TEXT,
  coaching_tips JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE call_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_own_summaries" ON call_summaries
  FOR ALL USING (agent_id = auth.uid());

CREATE INDEX IF NOT EXISTS call_summaries_agent_phone_idx
  ON call_summaries(agent_id, phone);

CREATE INDEX IF NOT EXISTS call_summaries_recording_id_idx
  ON call_summaries(recording_id);
