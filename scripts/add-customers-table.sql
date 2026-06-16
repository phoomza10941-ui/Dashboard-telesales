-- customers table: one profile per customer, scoped to agent
CREATE TABLE IF NOT EXISTS customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone         TEXT,
  first_name    TEXT,
  last_name     TEXT,
  nickname      TEXT,
  diseases      TEXT,
  symptoms      TEXT,
  medications   TEXT,
  consulted_doc TEXT,
  patient_type  TEXT,
  oreka_rec_id  TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents see own customers" ON customers
  FOR ALL
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- Allow admin/service role to bypass RLS
CREATE POLICY "service role bypass" ON customers
  FOR ALL TO service_role USING (true);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_customers_agent_id ON customers (agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_agent_phone ON customers (agent_id, phone) WHERE phone IS NOT NULL;

-- AI extraction fields config (stored in team_config)
INSERT INTO team_config (key, value)
VALUES ('ai_extraction_fields', '{"first_name":true,"last_name":true,"nickname":true,"diseases":true,"symptoms":true,"medications":true,"consulted_doc":true,"patient_type":true}')
ON CONFLICT (key) DO NOTHING;
