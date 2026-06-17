// Shared, dependency-free config for AI customer-info extraction.
// No OpenAI/Supabase imports, so it is safe to import from lightweight server
// modules (the settings page, API routes) without pulling heavy clients.

export type ExtractionFieldKey =
  | "first_name" | "last_name" | "nickname" | "diseases"
  | "symptoms" | "medications" | "consulted_doc" | "patient_type";

export const EXTRACTION_FIELDS: { key: ExtractionFieldKey; label: string }[] = [
  { key: "first_name", label: "ชื่อ" },
  { key: "last_name", label: "นามสกุล" },
  { key: "nickname", label: "ชื่อเล่น" },
  { key: "diseases", label: "โรคเป็นอยู่" },
  { key: "symptoms", label: "อาการตอนนี้" },
  { key: "medications", label: "ยาที่กำลังทานอยู่" },
  { key: "consulted_doc", label: "ปรึกษาหมอมั้ย" },
  { key: "patient_type", label: "คนที่ทาน" },
];

export const FIELD_LABELS: Record<string, string> = Object.fromEntries(
  EXTRACTION_FIELDS.map((f) => [f.key, f.label]),
);

// Default per-field extraction instructions. Supervisors may override any of
// these from the settings page; an empty/missing override falls back to these.
export const DEFAULT_FIELD_RULES: Record<ExtractionFieldKey, string> = {
  first_name:
    "ชื่อจริงของลูกค้าตามที่ได้ยิน ห้ามใช้คำสรรพนาม/คำเรียก (พี่ น้า ป้า ลุง คุณ หนู ผม) เป็นชื่อ",
  last_name:
    "นามสกุลของลูกค้าตามที่ได้ยิน (ถ้ามี)",
  nickname:
    "ชื่อเล่นของลูกค้าตามที่ได้ยิน ห้ามใช้คำสรรพนาม/คำเรียกเป็นชื่อเล่น",
  diseases: [
    "โรค/ภาวะสุขภาพที่ลูกค้าเป็น เช่น เบาหวาน ความดัน ไขมันในเลือดสูง เก๊าท์ โรคไต โรคหัวใจ ข้อเข่าเสื่อม — ดึงทุกภาวะที่ลูกค้าเอ่ยถึงแม้พูดทางอ้อม คั่นด้วยคอมมา",
    "ใช้ชื่อโรคมาตรฐาน แล้วตามด้วยคำที่ลูกค้าพูดในวงเล็บ เช่น \"น้ำตาลสูง\" → \"เบาหวาน (น้ำตาลสูง)\", \"ความดัน\" → \"ความดันโลหิตสูง (ความดัน)\"",
    "ถ้าลูกค้าพูดเป็นชื่อมาตรฐานอยู่แล้ว ไม่ต้องใส่วงเล็บซ้ำ",
  ].join("\n"),
  symptoms: [
    "อาการที่ลูกค้ารู้สึก \"ตอนนี้\" เท่านั้น เช่น เวียนหัว ปวดเข่า ชา นอนไม่หลับ คั่นด้วยคอมมา",
    "ใส่เฉพาะอาการที่ยังเป็นอยู่ปัจจุบัน ถ้าลูกค้าบอกว่าอาการนั้น \"หายแล้ว/ไม่มีแล้ว/ดีขึ้นจนหาย\" ห้ามใส่",
    "ตัวอย่าง: \"ตอนแรกปวดหัว เวียนหัว แต่ตอนนี้หายแล้ว\" → ไม่มีอาการปัจจุบัน (ตัดทิ้ง)",
    "ตัวอย่าง: \"เมื่อก่อนปวดเข่า หายแล้ว ตอนนี้เหลือแต่นอนไม่หลับ\" → \"นอนไม่หลับ\" เท่านั้น",
    "ไม่ใช่ชื่อโรค และไม่ใช่คำว่า \"ดีขึ้น\"",
  ].join("\n"),
  medications: [
    "ยา/อาหารเสริมที่ลูกค้ากำลังทานอยู่จริง — เก็บทั้งผลิตภัณฑ์ของบริษัทและยา/อาหารเสริมอื่นที่ลูกค้าทาน คั่นด้วยคอมมา",
    "ถ้าเป็นผลิตภัณฑ์ของบริษัท ให้เทียบกับ \"ข้อมูลสินค้า\" ด้านบน แล้วใช้ชื่อทางการ ตามด้วยคำที่ลูกค้าพูดในวงเล็บ เช่น \"เบต้าออย\" → \"Beta Oil (เบต้าออย)\", \"เบตาไลน์\" → \"Betaline (เบตาไลน์)\"",
    "ยา/อาหารเสริมอื่นที่ไม่มีในรายการสินค้า ให้เก็บตามที่ลูกค้าพูด",
    "อย่ารวมผลิตภัณฑ์ที่ลูกค้าปฏิเสธหรือยังไม่ได้ทาน",
  ].join("\n"),
  consulted_doc:
    "ลูกค้าเคยไปพบแพทย์ไหม ตอบสั้น ๆ รวมความถี่ถ้ามี (เช่น 'เคย — ทุก 3 เดือน')",
  patient_type:
    "ใครเป็นคนทานผลิตภัณฑ์ — 'ตัวเอง' หรือ 'คนในครอบครัว — [ความสัมพันธ์]' (อย่าสับสนกับคนสั่งของหรือคนส่งของ)",
};

export interface ExtractionRules {
  // Per-field instruction overrides; missing/blank keys fall back to defaults.
  fieldRules: Partial<Record<ExtractionFieldKey, string>>;
  // Global extra rules appended to the prompt for all fields.
  extraRules: string;
}

export const EMPTY_EXTRACTION_RULES: ExtractionRules = { fieldRules: {}, extraRules: "" };
