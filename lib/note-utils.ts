export type NoteStatus = "closed" | "pending_transfer" | "follow_up" | "lost" | "in_progress";

export function parseNoteStatus(note: string): NoteStatus {
  const n = note.toLowerCase();
  if ((n.includes("ปิด") || n.includes("โอนแล้ว") || n.includes("ของแถม")) && !n.includes("ปิดไม่ได้")) return "closed";
  if (n.includes("รอโอน") || n.includes("รอสลิป") || n.includes("รอชำระ") || n.includes("รอยืนยัน")) return "pending_transfer";
  if (n.includes("ติดตาม") || n.includes("follow") || n.includes("โทรตาม") || n.includes("นัดตาม") || n.includes("นัด")) return "follow_up";
  if (n.includes("ไม่สนใจ") || n.includes("หลุด") || n.includes("ยกเลิก")) return "lost";
  return "in_progress";
}

export function parseNoteObjection(note: string): string | null {
  const n = note.toLowerCase();
  if (n.includes("แพง") || n.includes("ราคาสูง")) return "แพง";
  if (n.includes("คิดก่อน") || n.includes("คิดดู") || n.includes("ขอเวลา")) return "ขอคิดก่อน";
  if (n.includes("ถามญาติ") || n.includes("ปรึกษาญาติ") || n.includes("บอกสามี") || n.includes("บอกภรรยา") || n.includes("ถามแม่") || n.includes("ถามพ่อ")) return "ถามญาติ";
  if (n.includes("ถามหมอ") || n.includes("ปรึกษาหมอ")) return "ถามหมอ";
  if (n.includes("กลัว") || n.includes("ไม่เห็นผล") || n.includes("ผลข้างเคียง") || n.includes("ทานไม่ได้")) return "กลัวไม่เห็นผล";
  return null;
}
