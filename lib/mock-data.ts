export const agentKpi = {
  name: "สมชาย ใจดี",
  id: "TS-042",
  team: "Team Alpha",
  salesToday: 47500,
  target: 80000,
  orders: 6,
  aov: 7917,
  gap: 32500,
  billsNeeded: 4,
  urgentAlerts: 2,
  percent: 59,
};

export const priorityCases = [
  {
    id: "C-001", name: "วิภา รักสวย", caseId: "CS-2841",
    status: "รอโอน", urgency: "critical" as const,
    reason: "รอโอนนาน 28 นาที", product: "Beta Life 3 กล่อง",
    value: 5900, lastContact: "10:32", channel: "LINE",
  },
  {
    id: "C-002", name: "ประภา สุขใจ", caseId: "CS-2856",
    status: "Lead ร้อน", urgency: "high" as const,
    reason: "ถามราคา + อาการชัดเจน", product: "BioActive+",
    value: 3900, lastContact: "11:05", channel: "Facebook",
  },
  {
    id: "C-003", name: "สุรีย์ มีสุข", caseId: "CS-2863",
    status: "ถามราคา", urgency: "high" as const,
    reason: "ถามราคาแล้วเงียบ 15 นาที", product: "Beta Oil",
    value: 2900, lastContact: "11:18", channel: "LINE",
  },
  {
    id: "C-004", name: "มาลี สดชื่น", caseId: "CS-2871",
    status: "Follow-up", urgency: "medium" as const,
    reason: "นัดตามวันนี้ 13:00", product: "Beta Life",
    value: 5900, lastContact: "เมื่อวาน", channel: "LINE",
  },
  {
    id: "C-005", name: "นิภา ใจงาม", caseId: "CS-2879",
    status: "Lead ใหม่", urgency: "normal" as const,
    reason: "Lead เข้ามา 20 นาทีที่แล้ว", product: "Lab Farm",
    value: 0, lastContact: "11:35", channel: "TikTok",
  },
  {
    id: "C-006", name: "ดวงใจ แจ่มใส", caseId: "CS-2882",
    status: "ลูกค้าเก่า", urgency: "normal" as const,
    reason: "ซื้อครั้งล่าสุด 45 วันที่แล้ว", product: "Beta Life",
    value: 0, lastContact: "45 วันที่แล้ว", channel: "LINE",
  },
];

export const pendingCases = [
  {
    id: "P-001", name: "วิภา รักสวย", caseId: "CS-2841",
    product: "Beta Life 3 กล่อง", amount: 5900,
    waitMinutes: 28, status: "รอสลิป",
    lastMsg: "โอนแล้วนะคะ รอเช็กด้วยนะ", orderId: "ORD-8842",
  },
  {
    id: "P-002", name: "กมลา รุ่งเรือง", caseId: "CS-2798",
    product: "BioActive+ 2 กล่อง", amount: 7800,
    waitMinutes: 12, status: "รอยืนยัน",
    lastMsg: "จ่ายผ่านบัตรแล้วค่ะ", orderId: "ORD-8836",
  },
  {
    id: "P-003", name: "ศิริ บุญมี", caseId: "CS-2812",
    product: "Beta Life 1 กล่อง", amount: 1990,
    waitMinutes: 5, status: "รอโอน",
    lastMsg: "โอนได้เลยนะคะ", orderId: "ORD-8851",
  },
];

export const followUpCases = [
  {
    id: "F-001", name: "อรุณี สว่าง", caseId: "CS-2750",
    reason: "ขอคิดก่อน", scheduledTime: "13:00",
    isOverdue: false, product: "Beta Life",
    note: "สนใจแต่บอกว่าราคาแพง ใช้สคริปต์คุ้มค่า", value: 3900,
  },
  {
    id: "F-002", name: "สมหญิง ดีใจ", caseId: "CS-2731",
    reason: "ขอถามญาติ", scheduledTime: "10:00",
    isOverdue: true, product: "BioActive+",
    note: "ส่งสรุปให้แล้วเมื่อวาน ยังไม่ตอบ", value: 5800,
  },
  {
    id: "F-003", name: "ปิยะ สุขสันต์", caseId: "CS-2719",
    reason: "โทรไม่ติด", scheduledTime: "11:00",
    isOverdue: true, product: "Beta Oil",
    note: "โทรไม่ติด 2 ครั้ง", value: 2900,
  },
  {
    id: "F-004", name: "นวลจันทร์ มีชัย", caseId: "CS-2768",
    reason: "ขอถามหมอ", scheduledTime: "14:00",
    isOverdue: false, product: "Lab Farm",
    note: "มีโรคประจำตัว ให้ถามหมอก่อน", value: 2490,
  },
  {
    id: "F-005", name: "รัตนา บุญเลิศ", caseId: "CS-2755",
    reason: "อ่านไม่ตอบ", scheduledTime: "เมื่อวาน 15:00",
    isOverdue: true, product: "Beta Life",
    note: "ส่งรูปสินค้าแล้ว อ่านแล้วไม่ตอบ", value: 1990,
  },
];

export const leadInbox = [
  {
    id: "L-001", name: "ชนากานต์ ทองใส",
    channel: "Facebook", ageMin: 3, hotScore: 92,
    message: "สนใจอยากลองกินค่ะ อยากทราบราคา",
    product: "Beta Life", assignedAt: "11:52", isNew: true,
  },
  {
    id: "L-002", name: "พิมพ์ใจ สดใส",
    channel: "TikTok", ageMin: 8, hotScore: 78,
    message: "น้ำหนักขึ้นมาก สนใจตัวลดน้ำหนัก",
    product: "Beta Oil", assignedAt: "11:47", isNew: true,
  },
  {
    id: "L-003", name: "วันเพ็ญ ชื่นใจ",
    channel: "LINE", ageMin: 15, hotScore: 65,
    message: "เพื่อนแนะนำมาค่ะ อยากถามก่อน",
    product: "BioActive+", assignedAt: "11:40", isNew: false,
  },
  {
    id: "L-004", name: "กาญจนา สุขสบาย",
    channel: "Google", ageMin: 22, hotScore: 55,
    message: "หาข้อมูลอาหารเสริมสำหรับผู้สูงอายุ",
    product: "Lab Farm", assignedAt: "11:33", isNew: false,
  },
];

export const scriptCategories = [
  { id: "price",    label: "ลูกค้าบอกแพง",        emoji: "💰" },
  { id: "think",    label: "ขอคิดก่อน",             emoji: "🤔" },
  { id: "family",   label: "ขอถามญาติ",             emoji: "👨‍👩‍👧" },
  { id: "doctor",   label: "ขอถามหมอ",              emoji: "👨‍⚕️" },
  { id: "noeffect", label: "กลัวไม่เห็นผล",          emoji: "😟" },
  { id: "transfer", label: "ลูกค้ารอโอน",            emoji: "💳" },
  { id: "noread",   label: "อ่านไม่ตอบ",             emoji: "👻" },
  { id: "safety",   label: "กังวลความปลอดภัย",       emoji: "🛡️" },
];

export const scriptContent: Record<string, { title: string; steps: string[]; tip: string }> = {
  price: {
    title: "สคริปต์: ลูกค้าบอกแพง",
    steps: [
      "รับรู้ความรู้สึก: 'เข้าใจเลยค่ะ ลูกค้าหลายท่านก็รู้สึกแบบนี้ตอนแรก'",
      "เปลี่ยน Frame เป็นต้นทุนต่อวัน: 'วันละแค่ 65 บาทค่ะ น้อยกว่ากาแฟ 1 แก้ว'",
      "เชื่อม Pain: 'ถ้าไม่แก้ปัญหาตอนนี้ ค่าใช้จ่ายที่ตามมาอาจมากกว่านี้มากค่ะ'",
      "ปิดด้วยข้อเสนอ: 'วันนี้มีโปรเริ่มต้นได้ที่ 1,990 บาทค่ะ ลองเริ่ม 1 กล่องดูก่อนได้เลย'",
    ],
    tip: "อย่าลดราคาก่อน ให้ justify คุณค่าก่อนเสมอ",
  },
  think: {
    title: "สคริปต์: ขอคิดก่อน",
    steps: [
      "ถามหา Reason: 'ยังมีข้อสงสัยตรงไหนไหมคะ ช่วยตอบได้เลย'",
      "ถ้าไม่มี — เร่งด้วย Deadline: 'โปรนี้หมดคืนนี้นะคะ ไม่อยากให้เสียโอกาส'",
      "ถ้ายังลัง — เสนอเริ่มน้อย: 'ลองเริ่ม 1 กล่องก่อนก็ได้นะคะ ถ้าไม่ดีคืนเงิน'",
      "ปิด: 'ให้ลูกค้าตัดสินใจสบายใจเลยค่ะ แต่ถ้ามีคำถามโทรหานูได้ตลอดเลย'",
    ],
    tip: "อย่าปล่อยให้ลูกค้าไปคิดคนเดียว ให้อยู่ในการสนทนาต่อ",
  },
  family: {
    title: "สคริปต์: ขอถามญาติ",
    steps: [
      "เข้าใจ: 'ดีมากเลยค่ะ แสดงว่าครอบครัวดูแลกัน'",
      "ส่งสรุปทันที: 'ขอส่งข้อมูลสั้น ๆ ให้ลูกค้าเอาไปให้ญาติดูได้เลยไหมคะ'",
      "ระบุ Timeline: 'ถ้าได้คุยกับญาติแล้ว พรุ่งนี้เช้าเพื่อนโทรตามได้นะคะ'",
      "ถ้าญาติห้าม — หา Pain ของญาติแล้วแก้ตรง ๆ",
    ],
    tip: "ส่งสรุปทันทีก่อนลูกค้าหยุดคุย อย่าปล่อยให้ไปเปล่า ๆ",
  },
  doctor: {
    title: "สคริปต์: ขอถามหมอ",
    steps: [
      "รับรู้: 'ฉลาดมากเลยค่ะ ดูแลสุขภาพดี'",
      "เตรียมคำตอบล่วงหน้า: 'สินค้าเราผ่าน อย. และทำจากธรรมชาติค่ะ'",
      "ส่งเอกสาร: 'ขอส่ง Certificate ให้ลูกค้าเอาไปให้หมอดูได้เลยไหมคะ'",
      "นัด Follow-up: 'ถ้าหมออนุญาตแล้ว นัดคุยอีกทีได้เลยนะคะ'",
    ],
    tip: "ถ้าลูกค้ามีโรคประจำตัว อย่ากดดัน ให้ support ด้วยข้อมูลจริง",
  },
  noeffect: {
    title: "สคริปต์: กลัวไม่เห็นผล",
    steps: [
      "ยืนยันด้วยหลักฐาน: 'มี Review จริงจากลูกค้าที่ใช้แล้วเห็นผลค่ะ ขอส่งให้ดูได้เลย'",
      "ระบุ Timeline จริง: 'ปกติเห็นผลใน 2-4 สัปดาห์ค่ะ ขึ้นอยู่กับร่างกายแต่ละคน'",
      "ลด Risk: 'เรามีนโยบายคืนเงินถ้าไม่เห็นผลใน 30 วันค่ะ'",
      "เชื่อม Pain: 'ถ้าไม่ลองก็ไม่รู้ค่ะ แต่คนที่กลัวแล้วไม่ลองส่วนใหญ่เสียดายทีหลัง'",
    ],
    tip: "ใช้ Social Proof จริงเสมอ หลีกเลี่ยงตัวเลขที่ไม่มีหลักฐาน",
  },
  transfer: {
    title: "สคริปต์: ลูกค้ารอโอน",
    steps: [
      "กระตุ้นด้วยความห่วงใย: 'อยากให้ได้ของเร็ว ๆ นะคะ โอนได้เลยไหมคะ'",
      "ระบุเวลาจัดส่ง: 'โอนก่อนบ่าย 2 ได้ของพรุ่งนี้เช้าเลยค่ะ'",
      "แจ้ง Deadline: 'วันนี้ยังทันรอบส่งค่ะ'",
      "ถ้าเงียบ — ส่งเลขบัญชีอีกครั้ง + สอบถามว่าติดปัญหาอะไร",
    ],
    tip: "อย่าปล่อยให้รอโอนเกิน 15 นาทีโดยไม่ Follow-up",
  },
  noread: {
    title: "สคริปต์: อ่านไม่ตอบ",
    steps: [
      "ส่งข้อความสั้น มี Hook: 'มีเรื่องอยากบอกเรื่องสุขภาพค่ะ [ชื่อ] 🌿'",
      "เปลี่ยนสื่อ: ถ้า LINE ไม่ตอบ — โทรหา",
      "สูงสุด 3 ครั้ง: ถ้า 3 ครั้งแล้วยังไม่ตอบ ให้ย้ายไป Re-engage Pool",
      "Re-engage ด้วย Content ใหม่: 'มีโปรใหม่เดือนนี้ค่ะ เผื่อสนใจ'",
    ],
    tip: "อย่า Spam เกิน 3 ครั้ง ทำให้ลูกค้า Block",
  },
  safety: {
    title: "สคริปต์: กังวลความปลอดภัย",
    steps: [
      "รับรู้และยืนยัน: 'ถูกต้องเลยค่ะ ควรถามก่อนเสมอ'",
      "แสดง Credentials: 'สินค้าเราผ่าน อย. เลขที่ 13-1-XXXXX ค่ะ'",
      "ส่งหลักฐาน: ส่ง Certificate + รูปสินค้าจริง",
      "เชื่อมกับ Pain: 'ลูกค้ามีอาการที่ตรงกับสูตรของเราพอดีค่ะ'",
    ],
    tip: "มีเอกสาร อย. พร้อมส่งเสมอ ไม่ต้องรอให้ลูกค้าถาม",
  },
};

export const performanceTrend = [
  62000, 45000, 78000, 55000, 91000, 38000, 67000, 82000,
  49000, 73000, 61000, 88000, 52000, 79000, 44000, 68000,
  93000, 57000, 76000, 41000, 85000, 63000, 72000, 48000,
  87000, 55000, 69000, 47500,
];

export const topObjections = [
  { label: "แพง", count: 12 },
  { label: "ขอคิดก่อน", count: 8 },
  { label: "ขอถามญาติ", count: 5 },
  { label: "ขอถามหมอ", count: 3 },
  { label: "กลัวไม่เห็นผล", count: 2 },
];

export const coachingData = {
  strengths: [
    "เปิดสายเร็ว ภายใน 3 นาที",
    "ถามอาการได้ครบถ้วน",
    "AOV สูงกว่าค่าเฉลี่ยทีม 12%",
  ],
  improvements: [
    "Close Rate ยังต่ำกว่าเป้า 5%",
    "Follow-up เลยเวลา 3 เคส",
    "ควรเร่งปิด Pending Payment ก่อนรับ Lead ใหม่",
  ],
  supervisorNote:
    "สมชายทำได้ดีมากในช่วงเช้า แต่ช่วงบ่ายมักหยุดยาวเกิน ลองจัด Priority Queue ใหม่หลังพักจะช่วยให้กลับมา Focus ได้เร็วขึ้น",
  actionItems: [
    "ฝึกสคริปต์ 'ขอคิดก่อน' เพิ่มอีก 1 รอบ",
    "ปิด Pending Payment 3 เคสภายใน 14:00",
    "โทรตาม Follow-up ที่เลยเวลาให้ครบก่อน 16:00",
  ],
  history: [
    { date: "29 พ.ค.", topic: "ปิดการขาย", result: "Close Rate ขึ้น 8%" },
    { date: "27 พ.ค.", topic: "สคริปต์แพง", result: "ปิดได้เพิ่ม 2 เคส" },
    { date: "22 พ.ค.", topic: "Follow-up", result: "Recovery +18,000 บาท" },
  ],
};
