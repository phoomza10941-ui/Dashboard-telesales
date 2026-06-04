export const MOCK_NAMES = ["สมชาย", "สุดา", "ปรีชา", "วิไล", "ธนา"];

export const MOCK_AGENT_STATS = [
  { name: "สมชาย", sales: 58000, orders: 9,  closeRate: 28, followupPct: 75  },
  { name: "สุดา",   sales: 72000, orders: 12, closeRate: 35, followupPct: 100 },
  { name: "ปรีชา",  sales: 34000, orders: 5,  closeRate: 15, followupPct: 47  },
  { name: "วิไล",   sales: 81000, orders: 14, closeRate: 40, followupPct: 100 },
  { name: "ธนา",    sales: 22000, orders: 4,  closeRate: 17, followupPct: 36  },
];

export const MOCK_FUNNEL: Record<string, { leads: number; called: number; contacted: number; interested: number; pending: number; closed: number; lost: number }> = {
  "สมชาย":  { leads: 42, called: 38, contacted: 28, interested: 18, pending: 8,  closed: 12, lost: 6 },
  "สุดา":   { leads: 35, called: 35, contacted: 30, interested: 22, pending: 6,  closed: 16, lost: 4 },
  "ปรีชา":  { leads: 40, called: 28, contacted: 20, interested: 10, pending: 4,  closed: 6,  lost: 10 },
  "วิไล":   { leads: 38, called: 36, contacted: 29, interested: 20, pending: 10, closed: 18, lost: 3 },
  "ธนา":    { leads: 30, called: 20, contacted: 15, interested: 8,  pending: 3,  closed: 5,  lost: 8 },
};

export const MOCK_OBJECTIONS: Record<string, Record<string, number>> = {
  "สมชาย":  { "แพง": 8,  "ขอคิดก่อน": 5, "ถามญาติ": 3, "ถามหมอ": 2, "กลัวไม่เห็นผล": 1 },
  "สุดา":   { "แพง": 3,  "ขอคิดก่อน": 7, "ถามญาติ": 6, "ถามหมอ": 1, "กลัวไม่เห็นผล": 2 },
  "ปรีชา":  { "แพง": 10, "ขอคิดก่อน": 8, "ถามญาติ": 2, "ถามหมอ": 4, "กลัวไม่เห็นผล": 3 },
  "วิไล":   { "แพง": 2,  "ขอคิดก่อน": 4, "ถามญาติ": 3, "ถามหมอ": 1, "กลัวไม่เห็นผล": 0 },
  "ธนา":    { "แพง": 7,  "ขอคิดก่อน": 6, "ถามญาติ": 4, "ถามหมอ": 3, "กลัวไม่เห็นผล": 5 },
};

export const MOCK_FOLLOWUP: Record<string, { due: number; done: number; recovered: number }> = {
  "สมชาย":  { due: 12, done: 9,  recovered: 2 },
  "สุดา":   { due: 10, done: 10, recovered: 4 },
  "ปรีชา":  { due: 15, done: 7,  recovered: 1 },
  "วิไล":   { due: 8,  done: 8,  recovered: 3 },
  "ธนา":    { due: 11, done: 4,  recovered: 0 },
};

export const HOT_CASES = [
  { id: "C-0482", customer: "คุณมาลี วงศ์สุข",    agent: "สมชาย",  reason: "รอโอนนาน 45 นาที",        value: 9800,  urgency: "critical", product: "Beta Life 3 กล่อง" },
  { id: "C-0391", customer: "คุณสุรศักดิ์ ทองดี",  agent: "ปรีชา",  reason: "ถามซื้อ 5 กล่อง",          value: 15000, urgency: "high",     product: "Beta Oil + BioActive+" },
  { id: "C-0445", customer: "คุณรัตนา พรหมมา",    agent: "สมชาย",  reason: "ลูกค้าเก่ากลับมา",          value: 6800,  urgency: "high",     product: "Beta Life 2 กล่อง" },
  { id: "C-0511", customer: "คุณประทีป เจริญ",     agent: "ธนา",    reason: "อาการชัด ยังไม่ปิด",        value: 4900,  urgency: "medium",   product: "BioActive+ 1 กล่อง" },
  { id: "C-0388", customer: "คุณนิภา สมบูรณ์",     agent: "ปรีชา",  reason: "กังวลเรื่องความน่าเชื่อถือ", value: 7200,  urgency: "medium",   product: "Lab Farm 2 กล่อง" },
  { id: "C-0499", customer: "คุณอรุณ สุขใจ",       agent: "วิไล",   reason: "ลูกค้ามีอาการชัด ถามมาก",   value: 5400,  urgency: "medium",   product: "Beta Oil 1 กล่อง" },
  { id: "C-0503", customer: "คุณพิมพ์ใจ แสนดี",    agent: "สุดา",   reason: "ถามซื้อฝากให้ญาติ",         value: 12000, urgency: "high",     product: "Beta Life 4 กล่อง" },
];

export const DROP_OFF_RISKS = [
  { id: "C-0402", customer: "คุณจันทร์ แก้วมณี",   agent: "ปรีชา",  issue: "แจ้งราคาแล้วเงียบ 2 ชม.",    elapsed: "2h 15m", risk: "high" },
  { id: "C-0367", customer: "คุณสำรวย ภูมิใจ",     agent: "ธนา",    issue: "รอโอนเกิน 1 ชั่วโมง",         elapsed: "1h 08m", risk: "high" },
  { id: "C-0455", customer: "คุณพัชรี เพชรดี",     agent: "สมชาย",  issue: "ขอคิดก่อน ยังไม่ตาม 3 วัน",  elapsed: "3 days", risk: "medium" },
  { id: "C-0471", customer: "คุณวรรณา ลิ้มสกุล",   agent: "ปรีชา",  issue: "อ่านไม่ตอบหลังสนใจ",           elapsed: "5h 30m", risk: "medium" },
  { id: "C-0489", customer: "คุณกัญญา สุดสวย",     agent: "ธนา",    issue: "Lead ร้อน ยังไม่มีคนดู",        elapsed: "12m",    risk: "low" },
  { id: "C-0512", customer: "คุณวินัย โกศล",        agent: "สมชาย",  issue: "ขอถามหมอ แต่ไม่มี follow-up",  elapsed: "2 days", risk: "medium" },
];

export const LEAD_SOURCES = [
  { source: "Facebook",    leads: 120, contactRate: 68, closeRate: 22, sales: 184000, aov: 6200, lost: 78 },
  { source: "TikTok",      leads: 85,  contactRate: 72, closeRate: 18, sales: 98000,  aov: 5800, lost: 62 },
  { source: "Google",      leads: 40,  contactRate: 80, closeRate: 32, sales: 86000,  aov: 7200, lost: 28 },
  { source: "LINE",        leads: 55,  contactRate: 85, closeRate: 28, sales: 72000,  aov: 5400, lost: 40 },
  { source: "Broadcast",   leads: 30,  contactRate: 55, closeRate: 14, sales: 28000,  aov: 4900, lost: 26 },
  { source: "Retargeting", leads: 25,  contactRate: 88, closeRate: 40, sales: 52000,  aov: 8200, lost: 15 },
];

export const AI_COACHING = [
  { agent: "ปรีชา",  priority: "urgent", issue: "Lead 40 ราย โทรแล้วแค่ 28 — ยังค้างอีก 12 ราย", skill: "เปิดสาย / ความรวดเร็ว",    color: "red" },
  { agent: "ธนา",    priority: "urgent", issue: "Close Rate 17% ต่ำกว่าทีม 8% — คุยติดแต่ปิดไม่ได้", skill: "ปิดการขาย / เร่งตัดสินใจ", color: "red" },
  { agent: "สมชาย",  priority: "medium", issue: "Objection 'แพง' เจอ 8 ครั้ง — สูงสุดในทีม", skill: "Handle แพง / ความคุ้มค่า",    color: "amber" },
  { agent: "วิไล",   priority: "low",    issue: "Follow-up ครบ 100% แต่ AOV ต่ำกว่าเป้า 12%", skill: "Upsell / เพิ่มจำนวนกล่อง",   color: "blue" },
  { agent: "สุดา",   priority: "ok",     issue: "Performance ดีทุกด้าน — ให้ mentor คนอื่น", skill: "ไม่ต้องโค้ชเร่งด่วน",          color: "green" },
];

export const SCRIPT_RECS = [
  { objection: "แพง",       count: 30, script: "ความคุ้มค่าต่อวัน: '3,900 บาท หาร 90 วัน เหลือวันละ 43 บาท ถูกกว่ากาแฟหนึ่งแก้ว'", urgency: "high" },
  { objection: "ขอคิดก่อน", count: 25, script: "เร่งตัดสินใจ: 'โปรนี้มีแค่วันนี้ ถ้าคุณพร้อมเดี๋ยวนี้ ผมจองไว้ให้เลยนะครับ'",      urgency: "high" },
  { objection: "ถามญาติ",   count: 18, script: "ส่งสรุปให้ญาติ: 'ผมส่ง PDF สรุปสั้นๆ ให้คุณเอาไปให้ญาติดูได้เลยครับ'",             urgency: "medium" },
  { objection: "ถามหมอ",    count: 12, script: "อ้างอิงผู้เชี่ยวชาญ: 'มีนักโภชนาการรับรอง ผมส่งเอกสารงานวิจัยให้ดูได้เลยครับ'",    urgency: "medium" },
];

export const COACHING_LOG = [
  { date: "30/05", agent: "ปรีชา",  topic: "เปิดสาย + ทักทาย",     action: "ฝึกสคริปต์เปิดสาย 3 แบบ", followUp: "01/06", result: "pending" },
  { date: "29/05", agent: "ธนา",    topic: "ปิดการขาย",             action: "Role-play ปิดแบบ ABC",     followUp: "30/05", result: "improved" },
  { date: "28/05", agent: "สมชาย",  topic: "Handle Objection แพง",  action: "ท่อง script 5 รอบ",       followUp: "30/05", result: "ok" },
  { date: "27/05", agent: "วิไล",   topic: "Upsell technique",       action: "ลอง offer bundle pack",    followUp: "29/05", result: "improved" },
  { date: "26/05", agent: "ปรีชา",  topic: "Follow-up discipline",  action: "ตั้ง reminder ทุกเคส",     followUp: "28/05", result: "ok" },
  { date: "25/05", agent: "ธนา",    topic: "ถามอาการลูกค้า",         action: "ใช้ checklist 5 ข้อ",      followUp: "27/05", result: "improved" },
];

export const OBJECTION_KEYS = ["แพง", "ขอคิดก่อน", "ถามญาติ", "ถามหมอ", "กลัวไม่เห็นผล"];
export const DAILY_TARGET = 80000;

export const COACHING_SKILLS = [
  { skill: "เปิดสาย", desc: "ทักทาย แนะนำตัว สร้าง rapport ใน 30 วิแรก", duration: "15 นาที" },
  { skill: "ถามอาการ", desc: "ถามให้ลูกค้าเปิดใจ พูดถึง Pain ที่แท้จริง", duration: "20 นาที" },
  { skill: "ขยี้ Pain", desc: "เชื่อมอาการกับผลิตภัณฑ์ ให้ลูกค้ารู้สึก urgent", duration: "25 นาที" },
  { skill: "ปิดการขาย", desc: "เทคนิค ABC — Always Be Closing", duration: "30 นาที" },
  { skill: "Upsell", desc: "เพิ่มจำนวนกล่อง หรือ bundle product", duration: "15 นาที" },
  { skill: "Handle แพง", desc: "เปลี่ยน frame จากราคาเป็นความคุ้มค่า", duration: "20 นาที" },
];
