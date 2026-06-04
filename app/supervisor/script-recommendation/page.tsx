import { getAllAgentsAnalysis } from "@/lib/db";
import { SCRIPT_RECS } from "../data";

const OBJ_KEYS = ["แพง", "ขอคิดก่อน", "ถามญาติ", "ถามหมอ", "กลัวไม่เห็นผล"];

const FULL_SCRIPTS: Record<string, { opening: string; body: string; closing: string }> = {
  "แพง": {
    opening: "ผมเข้าใจครับ ราคานี้ถือว่าลงทุนสักหน่อย",
    body: "แต่ลองคิดดูนะครับ 3,900 บาท หาร 90 วัน เหลือแค่วันละ 43 บาท ถูกกว่ากาแฟวันละแก้วเลยครับ แล้วยังได้สุขภาพที่ดีขึ้น ประหยัดค่าหมอในระยะยาวอีก",
    closing: "ถ้าคุณลองแล้วไม่เห็นผลใน 30 วัน ส่งคืนได้เลยครับ เราการันตีทุกกล่อง",
  },
  "ขอคิดก่อน": {
    opening: "ได้เลยครับ ผมเข้าใจ การตัดสินใจซื้อควรคิดให้รอบคอบ",
    body: "แต่อยากบอกว่าโปรนี้มีแค่วันนี้ครับ พรุ่งนี้ราคาจะกลับมาปกติ ถ้าคุณพร้อมตอนนี้ ผมจองไว้ให้เลยได้เลยครับ ไม่ต้องจ่ายก่อน",
    closing: "หรือถ้ายังลังเล บอกผมว่าติดเรื่องอะไร ผมจะตอบให้ครบเลยครับ",
  },
  "ถามญาติ": {
    opening: "ดีมากเลยครับที่ปรึกษาคนในครอบครัวก่อน",
    body: "ผมส่ง PDF สรุปสั้นๆ ให้คุณเอาไปให้ญาติดูได้เลยครับ มีข้อมูลสินค้า รีวิวจากลูกค้าจริง และราคาครบ แค่ส่งต่อให้ญาติเลยได้",
    closing: "ญาติดูเสร็จแล้วโทรกลับมาได้เลยนะครับ ผมรอรับสายตลอด",
  },
  "ถามหมอ": {
    opening: "ฉลาดมากเลยครับที่ถามหมอก่อน แสดงว่าดูแลสุขภาพจริงๆ",
    body: "สินค้าเรามีนักโภชนาการและเภสัชกรรับรอง ผมส่งเอกสารงานวิจัยให้ดูได้เลยครับ คุณสามารถเอาไปให้หมอดูก่อนตัดสินใจได้เลย",
    closing: "หมอดูแล้วมีคำถามอะไรเพิ่มเติม โทรมาถามผมได้เลยครับ",
  },
  "กลัวไม่เห็นผล": {
    opening: "เข้าใจครับ ความกังวลนี้เป็นเรื่องปกติมากๆ",
    body: "เราการันตี 90 วันครับ ถ้าทานครบตามที่กำหนดแล้วไม่เห็นผล ส่งคืนได้เต็มจำนวน มีลูกค้าใช้แล้วเกิน 2,000 คน รีวิวเฉลี่ย 4.8 ดาว",
    closing: "ผมส่ง screenshot รีวิวจริงให้ดูก่อนได้เลยครับ",
  },
};

export default async function ScriptRecommendationPage() {
  const agents = await getAllAgentsAnalysis();

  // Aggregate real objection counts from all agents
  const realCounts: Record<string, number> = {};
  OBJ_KEYS.forEach((k) => {
    realCounts[k] = agents.reduce((s, a) => s + (a.objections[k] ?? 0), 0);
  });

  // Sort by count desc, show all that have ≥1 instance
  const sorted = OBJ_KEYS
    .map((k) => ({ objection: k, count: realCounts[k], urgency: (realCounts[k] >= 5 ? "high" : "medium") as "high" | "medium" }))
    .sort((a, b) => b.count - a.count);

  // Fallback to static data if no real objections found
  const displayRecs = sorted.some((s) => s.count > 0) ? sorted : SCRIPT_RECS;

  return (
    <div className="h-full flex flex-col">
      <div className="mb-5">
        <h1 className="text-[16px] font-semibold text-[#3D3D3D]">Script Recommendation</h1>
        <p className="text-[12px] text-[#8B8E8F] mt-0.5">
          {sorted.some((s) => s.count > 0)
            ? "Objection ที่เกิดจริงในระบบวันนี้ → สคริปต์ที่ควรใช้"
            : "ยังไม่มีข้อมูล objection จริง — แสดงสคริปต์มาตรฐาน"}
        </p>
      </div>

      {/* Frequency bar chart */}
      <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5 mb-5">
        <div className="text-[12px] font-semibold text-[#3D3D3D] mb-4">ความถี่ Objection</div>
        <div className="space-y-2.5">
          {sorted.map((s) => {
            const maxCount = Math.max(...sorted.map((x) => x.count), 1);
            const w = Math.round((s.count / maxCount) * 100);
            return (
              <div key={s.objection} className="flex items-center gap-3">
                <span className="text-[12px] text-[#3D3D3D] w-28 shrink-0">{s.objection}</span>
                <div className="flex-1 h-2 bg-[#E8E8E8] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${s.urgency === "high" ? "bg-red-400" : s.count > 0 ? "bg-amber-400" : "bg-[#E8E8E8]"}`}
                    style={{ width: `${Math.max(w, s.count > 0 ? 5 : 0)}%` }}
                  />
                </div>
                <span className={`text-[12px] font-bold w-8 text-right ${s.urgency === "high" && s.count > 0 ? "text-red-500" : s.count > 0 ? "text-amber-600" : "text-[#C0C0C0]"}`}>
                  {s.count || "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scripts */}
      <div className="flex-1 space-y-4 overflow-auto pb-1">
        {displayRecs.map((s) => {
          const full = FULL_SCRIPTS[s.objection];
          const count = typeof s.count === "number" ? s.count : 0;
          return (
            <div key={s.objection} className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden">
              <div className={`px-5 py-3.5 border-b border-[#E8E8E8] flex items-center justify-between ${s.urgency === "high" ? "bg-red-50/50" : "bg-amber-50/30"}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${s.urgency === "high" && count > 0 ? "bg-red-400" : "bg-amber-400"}`} />
                  <span className="text-[14px] font-semibold text-[#3D3D3D]">ลูกค้าบอก &ldquo;{s.objection}&rdquo;</span>
                </div>
                <span className="text-[11px] text-[#8B8E8F]">{count > 0 ? `${count} ครั้งในระบบ` : "สคริปต์มาตรฐาน"}</span>
              </div>
              {full && (
                <div className="p-5 space-y-3">
                  <ScriptLine label="เปิด" text={full.opening} color="bg-[#022EE8]/10 text-[#2AAAC8]" />
                  <ScriptLine label="เนื้อหา" text={full.body} color="bg-[#87DE81]/10 text-[#3D9B3A]" />
                  <ScriptLine label="ปิด" text={full.closing} color="bg-amber-50 text-amber-700" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScriptLine({ label, text, color }: { label: string; text: string; color: string }) {
  return (
    <div>
      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1.5 ${color}`}>{label}</span>
      <p className="text-[12px] text-[#3D3D3D] leading-relaxed bg-[#F7F7F7] rounded-xl px-4 py-3">{text}</p>
    </div>
  );
}
