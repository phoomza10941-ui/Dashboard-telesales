import { getDailyTarget, getAgentsWithTargets, getProducts, getAgentsWithMonthlyTargets, getAgentsWithOrekaExt, getCurrentUser } from "@/lib/db";
import { redirect } from "next/navigation";
import TargetConfigForm from "./TargetConfigForm";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import AgentTargetForm from "./AgentTargetForm";
import AgentMonthlyTargetForm from "./AgentMonthlyTargetForm";
import AgentOrekaExtForm from "./AgentOrekaExtForm";
import ProductsForm from "./ProductsForm";
import { Suspense } from "react";

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3 mt-2">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#C0C0C0]">{label}</span>
      <div className="flex-1 h-px bg-[#E8E8E8]" />
    </div>
  );
}

function currentThaiMonthKey() {
  const now = new Date(Date.now() + 7 * 3_600_000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const currentMonthKey = currentThaiMonthKey();
  const selectedMonth = month ?? currentMonthKey;

  const [currentUser, currentTarget, agents, products, monthlyAgents, orekaAgents] = await Promise.all([
    getCurrentUser(),
    getDailyTarget(),
    getAgentsWithTargets(),
    getProducts(),
    getAgentsWithMonthlyTargets(selectedMonth),
    getAgentsWithOrekaExt(),
  ]);
  if (!currentUser) redirect("/login");

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-[16px] font-semibold text-[#3D3D3D]">ตั้งค่า</h1>
          <p className="text-[12px] text-[#8B8E8F] mt-0.5">
            ตั้งค่าที่ Supervisor กำหนดได้ — จะมีผลกับทุก Dashboard ทันที
          </p>
        </div>

        {/* ─── บัญชีผู้ใช้ ─────────────────────── */}
        <SectionLabel label="บัญชีผู้ใช้" />
        <div className="mb-5">
          <ChangePasswordForm username={currentUser.username} />
        </div>

        {/* ─── เป้าหมาย ─────────────────────── */}
        <SectionLabel label="เป้าหมาย" />

        {/* Team target card */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 mb-5">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-[#87DE81]/20 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3D9B3A" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </div>
            <div>
              <div className="text-[14px] font-semibold text-[#3D3D3D]">เป้ารายวันทีม</div>
              <div className="text-[12px] text-[#8B8E8F] mt-0.5">
                เป้าทีมรวม — ใช้เป็น default สำหรับ agent ที่ยังไม่มีเป้าเฉพาะคน
              </div>
            </div>
            <div className="ml-auto shrink-0 text-right">
              <div className="text-[11px] text-[#8B8E8F]">เป้าทีมปัจจุบัน</div>
              <div className="text-[20px] font-bold text-[#3D9B3A]">฿{currentTarget.toLocaleString()}</div>
            </div>
          </div>
          <TargetConfigForm currentTarget={currentTarget} />
        </div>

        {/* Per-agent daily target card */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 mb-5">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-[#022EE8]/15 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2AAAC8" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <div className="text-[14px] font-semibold text-[#3D3D3D]">เป้ารายวันเฉพาะคน</div>
              <div className="text-[12px] text-[#8B8E8F] mt-0.5">
                กำหนดเป้ารายวันเฉพาะคน — จะแสดงในหน้า My Desk ของ agent นั้น
              </div>
            </div>
          </div>
          {agents.length === 0 ? (
            <p className="text-[12px] text-[#8B8E8F]">ยังไม่มี agent ในระบบ</p>
          ) : (
            <AgentTargetForm agents={agents} />
          )}
        </div>

        {/* Agent daily target overview */}
        {agents.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden mb-5">
            <div className="px-5 py-3.5 border-b border-[#E8E8E8]">
              <span className="text-[13px] font-semibold text-[#3D3D3D]">เป้ารายวันแต่ละคน</span>
            </div>
            <div className="divide-y divide-[#F7F7F7]">
              {agents.map((a) => (
                <div key={a.agentId} className="flex items-center px-5 py-3">
                  <div className="w-7 h-7 rounded-full bg-[#022EE8]/15 flex items-center justify-center text-[#022EE8] text-[11px] font-bold shrink-0">
                    {a.agentName.charAt(0)}
                  </div>
                  <span className="ml-2.5 text-[13px] font-medium text-[#3D3D3D] flex-1">{a.agentName}</span>
                  <span className={`text-[13px] font-semibold ${a.hasCustomTarget ? "text-[#2AAAC8]" : "text-[#8B8E8F]"}`}>
                    ฿{a.target.toLocaleString()}
                  </span>
                  <span className="ml-2 text-[10px] text-[#C0C0C0]">{a.hasCustomTarget ? "กำหนดเฉพาะคน" : "ใช้เป้าทีม"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-agent monthly target card */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 mb-5">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-[#87DE81]/15 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3D9B3A" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div>
              <div className="text-[14px] font-semibold text-[#3D3D3D]">เป้ารายเดือนเฉพาะคน</div>
              <div className="text-[12px] text-[#8B8E8F] mt-0.5">
                กำหนดเป้ารายเดือนเฉพาะคน — จะแสดงใน My Desk KPI Bar ของ agent นั้น
              </div>
            </div>
          </div>
          <Suspense fallback={null}>
            <AgentMonthlyTargetForm
              agents={monthlyAgents}
              monthKey={selectedMonth}
              currentMonthKey={currentMonthKey}
            />
          </Suspense>
        </div>

        {/* ─── สินค้า ─────────────────────── */}
        <SectionLabel label="สินค้า" />

        {/* Products card */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 mb-5">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-[#87DE81]/20 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3D9B3A" strokeWidth="2">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <div>
              <div className="text-[14px] font-semibold text-[#3D3D3D]">รายการสินค้า</div>
              <div className="text-[12px] text-[#8B8E8F] mt-0.5">
                สินค้าเหล่านี้จะแสดงเป็นตัวเลือกในฟอร์มกรอกข้อมูลลูกค้า
              </div>
            </div>
          </div>
          <ProductsForm products={products} />
        </div>

        {/* ─── การเชื่อมต่อ ─────────────────────── */}
        <SectionLabel label="การเชื่อมต่อ" />

        {/* Oreka Talk Time mapping card */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 mb-5">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-[#58CEE8]/20 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2AAAC8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <div>
              <div className="text-[14px] font-semibold text-[#3D3D3D]">Talk Time — จับคู่เบอร์ Oreka</div>
              <div className="text-[12px] text-[#8B8E8F] mt-0.5">
                ผูกเบอร์ dtac OneCall (Local Party) ของแต่ละคน เพื่อให้หน้า Talk Time แสดงชื่อ agent ถูกต้อง
              </div>
            </div>
          </div>
          {orekaAgents.length === 0 ? (
            <p className="text-[12px] text-[#8B8E8F]">ยังไม่มี agent ในระบบ</p>
          ) : (
            <AgentOrekaExtForm agents={orekaAgents} />
          )}
        </div>

        {/* How it works */}
        <div className="bg-[#F7F7F7] rounded-2xl border border-[#E8E8E8] p-5">
          <div className="text-[12px] font-semibold text-[#3D3D3D] mb-3">วิธีการทำงาน</div>
          <div className="space-y-2.5">
            {[
              { icon: "⚙️", label: "เป้าทีม (รายวัน)", desc: "เป้าทีมรวม — ใช้เป็น default ถ้า agent ไม่มีเป้าเฉพาะคน" },
              { icon: "🎯", label: "เป้าเฉพาะคน (รายวัน)", desc: "เป้าเฉพาะคนรายวัน — override เป้าทีมใน My Desk KPI Bar" },
              { icon: "📅", label: "เป้าเฉพาะคน (รายเดือน)", desc: "เป้าเฉพาะคนรายเดือน — แสดงความคืบหน้าเดือนนี้ใน My Desk" },
              { icon: "📊", label: "My Desk KPI Bar", desc: "แสดงทั้งเป้ารายวันและ % ความคืบหน้าเดือนนี้" },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <span className="text-[14px] shrink-0 mt-0.5">{item.icon}</span>
                <div>
                  <div className="text-[12px] font-medium text-[#3D3D3D]">{item.label}</div>
                  <div className="text-[11px] text-[#8B8E8F]">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
