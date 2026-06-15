-- Appointment Calendar for telesales agents.
-- Run once in the Supabase SQL Editor before deploying the appointment feature.

CREATE TABLE IF NOT EXISTS appointments (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id         UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  customer_name    TEXT        NOT NULL,
  customer_phone   TEXT,
  appointment_date DATE        NOT NULL,
  pre_suggestion   TEXT,
  status           TEXT        DEFAULT 'pending'
                   CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_own_appointments"
  ON appointments FOR ALL
  USING (agent_id = auth.uid());

-- Speed up "today's appointments" and per-month calendar queries
CREATE INDEX IF NOT EXISTS idx_appointments_agent_date
  ON appointments (agent_id, appointment_date);
