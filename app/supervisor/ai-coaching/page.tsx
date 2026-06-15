import { getAllAgentsAnalysis, getDailyTarget } from "@/lib/db";
import { COACHING_SKILLS } from "../data";

async function getKimiCoachingSummary(recs: { agent: string; priority: string; issue: string; skill: string }[]): Promise<string> {
  try {
    const recap = recs
      .map((r) => `- ${r.agent}: ${r.priority} — ${r.issue} (skill: ${r.skill})`)
      .join("\n");

    const res = await fetch("https://api.kimi.com/coding/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.KIMI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "moonshot-v1-8k",
        messages: [
          { role: "system", content: "คุณคือ AI Supervisor Coach วิเคราะห์ข้อมูลทีม Telesales และให้คำแนะนำ Supervisor เป็นภาษาไทย กระชับ 2-3 ประโยค" },
          { role: "user", content: `ข้อมูลทีมวันนี้:\n${recap}\n\nสรุปให้ Supervisor ว่าควรทำอะไรก่อน และทำไม` },
        ],
        temperature: 0.7,
      }),
      cache: "no-store",
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  } catch {
    return "";
  }
}

function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

interface CoachRec {
  agent: string;
  priority: "urgent" | "medium" | "low" | "ok";
  issue: string;
  skill: string;
}

export default async function AiCoachingPage() {
  const [agents, dailyTarget] = await Promise.all([getAllAgentsAnalysis(), getDailyTarget()]);

  const recs: CoachRec[] = agents.map((a) => {
    const targetPct   = pct(a.todaySales, dailyTarget);
    const totalObj    = Object.values(a.objections).reduce((s, v) => s + v, 0);
    const topObjKey   = Object.entries(a.objections).sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
    const followUp    = a.followUpRows.length;
    const pending     = a.pendingTransferRows.length;

    let priority: CoachRec["priority"] = "ok";
    let issue = "Performance ดีทุกด้าน — ให้ mentor คนอื่น";
    let skill = "ไม่ต้องโค้ชเร่งด่วน";

    if (targetPct < 30 && a.todayOrders === 0) {
      priority = "urgent";
      issue    = `ยังไม่มียอดวันนี้เลย — ต้องรีบลุย`;
      skill    = "เปิดสาย / ความรวดเร็ว";
    } else if (targetPct < 50) {
      priority = "urgent";
      issue    = `ยอดวันนี้ ${targetPct}% ของเป้า — ต่ำมาก`;
      skill    = "ปิดการขาย / เร่งตัดสินใจ";
    } else if (totalObj >= 5 && topObjKey) {
      priority = "medium";
      issue    = `Objection "${topObjKey}" เจอ ${a.objections[topObjKey]} ครั้ง — สูงสุดในทีม`;
      skill    = `Handle ${topObjKey}`;
    } else if (followUp > 3) {
      priority = "medium";
      issue    = `Follow-up ค้างอยู่ ${followUp} เคส — ต้องตามให้ครบ`;
      skill    = "Follow-up / Discipline";
    } else if (pending > 2) {
      priority = "low";
      issue    = `รอโอน ${pending} เคส — ช่วยเร่งปิดโอน`;
      skill    = "เร่งโอน / Closing";
    } else if (targetPct >= 80) {
      priority = "ok";
      issue    = `ยอด ${targetPct}% ของเป้า — ทำได้ดี`;
      skill    = "ไม่ต้องโค้ชเร่งด่วน";
    }

    return { agent: a.agentName, priority, issue, skill };
  });

  recs.sort((a, b) => {
    const order = { urgent: 0, medium: 1, low: 2, ok: 3 };
    return order[a.priority] - order[b.priority];
  });

  const PRIORITY_CONFIG = {
    urgent: { label: "ด่วน",   bg: "bg-red-50 border-red-200",    badge: "bg-red-100 text-red-600",     dot: "bg-red-500 animate-pulse" },
    medium: { label: "ควรทำ",  bg: "bg-amber-50 border-amber-200", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
    low:    { label: "แนะนำ",  bg: "bg-blue-50 border-blue-100",   badge: "bg-blue-100 text-blue-600",   dot: "bg-blue-400" },
    ok:     { label: "ดีแล้ว", bg: "bg-green-50 border-green-100", badge: "bg-green-100 text-green-700", dot: "bg-green-400" },
  };

  const urgentCount = recs.filter((r) => r.priority === "urgent").length;
  const kimiSummary = await getKimiCoachingSummary(recs);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-5">
        <h1 className="text-[16px] font-semibold text-[#3D3D3D]">คำแนะนำ AI Coaching</h1>
        <p className="text-[12px] text-[#8B8E8F] mt-0.5">วิเคราะห์จากยอดจริง + note field — วันนี้ควรโค้ชใคร เรื่องอะไร</p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5 overflow-auto pb-1">
        {/* Left: Agent recs */}
        <div className="flex flex-col gap-4">
          <div className="text-[11px] font-semibold text-[#8B8E8F] uppercase tracking-wide">คำแนะนำรายคน</div>
          {recs.map((c) => {
            const cfg = PRIORITY_CONFIG[c.priority];
            return (
              <div key={c.agent} className={`border rounded-2xl p-4 ${cfg.bg}`}>
                <div className="flex items-start gap-3 mb-2">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#022EE8] text-[14px] font-bold border border-[#E8E8E8]">
                      {c.agent.charAt(0)}
                    </div>
                    <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${cfg.dot}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] font-semibold text-[#3D3D3D]">{c.agent}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                        {cfg.label} — {c.skill}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#8B8E8F] leading-relaxed">{c.issue}</p>
                  </div>
                </div>
                {c.priority !== "ok" && (
                  <button className="text-[11px] font-medium text-[#022EE8] border border-[#022EE8]/40 hover:bg-[#022EE8]/10 px-3 py-1.5 rounded-lg transition-colors">
                    เริ่มโค้ชเลย →
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Skill library + AI summary */}
        <div className="flex flex-col gap-4">
          <div className="text-[11px] font-semibold text-[#8B8E8F] uppercase tracking-wide">คลัง Coaching Skills</div>
          <div className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden">
            {COACHING_SKILLS.map((s: { skill: string; desc: string; duration: string }, i: number) => (
              <div key={s.skill} className={`px-5 py-4 hover:bg-[#F7F7F7] transition-colors cursor-pointer ${i < COACHING_SKILLS.length - 1 ? "border-b border-[#F7F7F7]" : ""}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-medium text-[#3D3D3D]">{s.skill}</div>
                    <div className="text-[11px] text-[#8B8E8F] mt-0.5">{s.desc}</div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="text-[10px] text-[#8B8E8F]">{s.duration}</div>
                    <div className="text-[11px] text-[#022EE8] font-medium mt-0.5">ใช้ →</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* AI summary */}
          <div className="bg-[#3D3D3D] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-md bg-[#87DE81] flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <span className="text-[11px] font-semibold text-white">AI สรุป</span>
              <span className="text-[10px] text-[#87DE81] ml-1">powered by Kimi</span>
            </div>
            <p className="text-[12px] text-[#C0C0C0] leading-relaxed whitespace-pre-wrap">
              {kimiSummary || (
                urgentCount > 0
                  ? `วันนี้มี ${urgentCount} คนที่ต้องโค้ชด่วน: ${recs.filter((r) => r.priority === "urgent").map((r) => r.agent).join(", ")}. ควรเริ่มโค้ชก่อนบ่าย 2 โมง`
                  : "วันนี้ทีมอยู่ในเกณฑ์ดี ไม่มีเคสด่วน — ให้ Supervisor focus ที่การ coach เชิงรุก เช่น Upsell และ AOV"
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
