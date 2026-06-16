-- Add real `status` and `objection` columns to the sales table, and backfill
-- existing rows. Run this whole file in the Supabase SQL editor.
--
-- WHY: status ("closed" | "pending_transfer" | "follow_up" | "lost" |
-- "in_progress") and objection were previously DERIVED on every read by
-- substring-matching the free-text `note` (lib/note-utils.ts). That made
-- revenue depend on Thai keyword heuristics and impossible to query in SQL.
--
-- HOW: these columns are now written from the note at save time (addSale /
-- updateSaleNote / updateSale in lib/db.ts). Reads prefer the column and fall
-- back to parsing the note only for legacy rows where it is still NULL
-- (rowStatus / rowObjection helpers). This migration adds the columns and seeds
-- existing rows so reads stop re-parsing.
--
-- The CASE expressions below MIRROR lib/note-utils.ts parseNoteStatus /
-- parseNoteObjection as of 2026-06-16. If you change the parser, this backfill
-- does not need re-running (it only seeds historical rows once).

-- 1. Columns (nullable, additive — legacy rows stay NULL until backfilled below)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS objection TEXT;

-- 2. Indexes for status/objection filters and aggregates
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales (status);
CREATE INDEX IF NOT EXISTS idx_sales_objection ON sales (objection);

-- 3. Backfill status (precedence matches parseNoteStatus — first match wins).
--    Thai has no letter case, so ILIKE behaves like a case-insensitive contains.
UPDATE sales SET status = CASE
  WHEN (note ILIKE '%ปิด%' OR note ILIKE '%โอนแล้ว%' OR note ILIKE '%ของแถม%')
       AND note NOT ILIKE '%ปิดไม่ได้%' THEN 'closed'
  WHEN note ILIKE '%รอโอน%' OR note ILIKE '%รอสลิป%' OR note ILIKE '%รอชำระ%'
       OR note ILIKE '%รอยืนยัน%' THEN 'pending_transfer'
  WHEN note ILIKE '%ติดตาม%' OR note ILIKE '%follow%' OR note ILIKE '%โทรตาม%'
       OR note ILIKE '%นัดตาม%' OR note ILIKE '%นัด%' THEN 'follow_up'
  WHEN note ILIKE '%ไม่สนใจ%' OR note ILIKE '%หลุด%' OR note ILIKE '%ยกเลิก%' THEN 'lost'
  ELSE 'in_progress'
END
WHERE status IS NULL;

-- 4. Backfill objection (precedence matches parseNoteObjection; ELSE NULL = none).
UPDATE sales SET objection = CASE
  WHEN note ILIKE '%แพง%' OR note ILIKE '%ราคาสูง%' THEN 'แพง'
  WHEN note ILIKE '%คิดก่อน%' OR note ILIKE '%คิดดู%' OR note ILIKE '%ขอเวลา%' THEN 'ขอคิดก่อน'
  WHEN note ILIKE '%ถามญาติ%' OR note ILIKE '%ปรึกษาญาติ%' OR note ILIKE '%บอกสามี%'
       OR note ILIKE '%บอกภรรยา%' OR note ILIKE '%ถามแม่%' OR note ILIKE '%ถามพ่อ%' THEN 'ถามญาติ'
  WHEN note ILIKE '%ถามหมอ%' OR note ILIKE '%ปรึกษาหมอ%' THEN 'ถามหมอ'
  WHEN note ILIKE '%กลัว%' OR note ILIKE '%ไม่เห็นผล%' OR note ILIKE '%ผลข้างเคียง%'
       OR note ILIKE '%ทานไม่ได้%' THEN 'กลัวไม่เห็นผล'
  ELSE NULL
END
WHERE objection IS NULL;
