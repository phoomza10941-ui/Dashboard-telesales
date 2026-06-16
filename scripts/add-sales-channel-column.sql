-- Add a per-sale "channel" marker to the sales table.
-- Run this in the Supabase SQL editor.
--
-- channel = which product/company line this row belongs to: 'gosell' | 'hopeful'.
-- It is set explicitly when an agent creates a contact via "กรอกข้อมูล"
-- (name + phone + channel, zero amounts). For legacy rows it stays NULL and the
-- UI derives the badge from which sale-amount buckets are non-zero instead.

ALTER TABLE sales ADD COLUMN IF NOT EXISTS channel TEXT;

-- Optional: speed up channel filters.
CREATE INDEX IF NOT EXISTS idx_sales_channel ON sales (channel);
