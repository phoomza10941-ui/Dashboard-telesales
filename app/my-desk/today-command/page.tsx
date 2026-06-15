import { getMyData, filterToday, filterPending, filterFollowUp, getCurrentUser, getAgentTarget } from "@/lib/db";
import Link from "next/link";

export default async function TodayCommandPage() {
  const user = await getCurrentUser();
  const [data, DAILY_TARGET] = await Promise.all([
    user ? getMyData(user.id) : Promise.resolve(null),
    user ? getAgentTarget(user.id) : Promise.resolve(80000),
  ]);
  const allRows = data?.rows ?? [];
  const todayRows = filterToday(allRows);
  const pendingRows = filterPending(allRows);
  const followUpRows = filterFollowUp(allRows);

  const todaySales = todayRows.reduce((s, r) => s + r.phoneClose + r.upsell + r.crm + r.hopefulPhoneClose + r.hopefulCrm + r.hopefulUpsell, 0);
  const pct = Math.min(Math.round((todaySales / DAILY_TARGET) * 100), 100);
  const gap = Math.max(DAILY_TARGET - todaySales, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-[#3D3D3D]">สรุปวันนี้</h1>
          <p className="text-[12px] text-[#8B8E8F] mt-0.5">
            {new Date().toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Today's Sales */}
        <Card title="ยอดขายวันนี้" badge={`${todayRows.length} รายการ`} badgeColor="green" href="/my-desk/customers-list">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Stat label="ยอดรวม" value={`฿${todaySales.toLocaleString()}`} />
            <Stat label="% ถึงเป้า" value={`${pct}%`} />
            <Stat label="เหลืออีก" value={`฿${gap.toLocaleString()}`} danger={gap > 0} />
            <Stat label="รายการวันนี้" value={`${todayRows.length}`} />
          </div>
          <div className="w-full h-1.5 bg-[#E8E8E8] rounded-full overflow-hidden">
            <div className="h-full bg-[#87DE81] rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </Card>

        {/* Pending Payment */}
        <Card
          title="Pending Payment"
          badge={pendingRows.length > 0 ? `${pendingRows.length} เคส` : "ไม่มี"}
          badgeColor={pendingRows.length > 0 ? "red" : "grey"}
          href="/my-desk/pending-payment"
        >
          {pendingRows.length === 0 ? (
            <EmptyState text="ไม่มีรายการรอโอน" />
          ) : (
            <div className="space-y-2">
              {pendingRows.slice(0, 3).map((r, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-[#E8E8E8] last:border-0">
                  <span className="w-2 h-2 rounded-full bg-[#FF6B6B] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-[#3D3D3D] truncate">{r.name}</div>
                    <div className="text-[11px] text-[#8B8E8F] truncate">{r.note}</div>
                  </div>
                  <span className="text-[12px] font-semibold text-[#3D9B3A] shrink-0">
                    ฿{(r.phoneClose + r.upsell + r.crm + r.hopefulPhoneClose + r.hopefulCrm + r.hopefulUpsell).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Follow-up */}
        <Card
          title="Follow-up วันนี้"
          badge={`${followUpRows.length} เคส`}
          badgeColor={followUpRows.length > 0 ? "cyan" : "grey"}
          href="/my-desk/follow-up"
        >
          {followUpRows.length === 0 ? (
            <EmptyState text="ไม่มีรายการ Follow-up" />
          ) : (
            <div className="space-y-2">
              {followUpRows.slice(0, 3).map((r, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-[#E8E8E8] last:border-0">
                  <span className="w-2 h-2 rounded-full bg-[#022EE8] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-[#3D3D3D] truncate">{r.name}</div>
                    <div className="text-[11px] text-[#8B8E8F] truncate">{r.note}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent sales today */}
        <Card title="รายการล่าสุดวันนี้" badge={`${todayRows.length} รายการ`} badgeColor="green" href="/my-desk/priority-queue">
          {todayRows.length === 0 ? (
            <EmptyState text="ยังไม่มีรายการวันนี้" />
          ) : (
            <div className="space-y-2">
              {todayRows.slice(-3).reverse().map((r, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-[#E8E8E8] last:border-0">
                  <span className="w-2 h-2 rounded-full bg-[#87DE81] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-[#3D3D3D] truncate">{r.name}</div>
                    <div className="text-[11px] text-[#8B8E8F] truncate">{r.product}</div>
                  </div>
                  <span className="text-[12px] font-semibold text-[#3D9B3A] shrink-0">
                    ฿{(r.phoneClose + r.upsell + r.crm + r.hopefulPhoneClose + r.hopefulCrm + r.hopefulUpsell).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* AI Next Best Action */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#87DE81] to-[#022EE8] flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className="text-[13px] font-semibold text-[#3D3D3D]">AI Next Best Action</h3>
            </div>
            {gap > 0 ? (
              <p className="text-[13px] text-[#8B8E8F] leading-relaxed">
                ตอนนี้คุณทำยอดได้{" "}
                <span className="text-[#3D3D3D] font-semibold">{pct}%</span> ของเป้า เหลืออีก{" "}
                <span className="text-[#3D3D3D] font-semibold">฿{gap.toLocaleString()}</span>
                {pendingRows.length > 0 && (
                  <> — มี Pending Payment <span className="text-[#FF6B6B] font-medium">{pendingRows.length} เคส</span> ควรปิดก่อน</>
                )}
                {followUpRows.length > 0 && (
                  <> และ Follow-up อีก <span className="text-[#022EE8] font-medium">{followUpRows.length} เคส</span></>
                )}
              </p>
            ) : (
              <p className="text-[13px] text-[#3D9B3A] font-medium">🎉 ถึงเป้าแล้ว! ยอดเกินเป้า ฿{Math.abs(gap).toLocaleString()}</p>
            )}
            <div className="flex gap-2 mt-3">
              {pendingRows.length > 0 && (
                <ActionChip label="ปิด Pending" href="/my-desk/pending-payment" primary />
              )}
              {followUpRows.length > 0 && (
                <ActionChip label="ตาม Follow-up" href="/my-desk/follow-up" />
              )}
              <ActionChip label="ดูยอดขาย" href="/my-desk/my-performance" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, badge, badgeColor, href, children }: {
  title: string; badge: string; badgeColor: "green" | "cyan" | "red" | "grey";
  href?: string; children: React.ReactNode;
}) {
  const badgeClass = {
    green: "bg-[#87DE81]/15 text-[#3D9B3A]",
    cyan: "bg-[#022EE8]/15 text-[#0E8FA8]",
    red: "bg-[#FF6B6B]/10 text-[#FF6B6B]",
    grey: "bg-[#F7F7F7] text-[#8B8E8F]",
  }[badgeColor];
  return (
    <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[13px] font-semibold text-[#3D3D3D]">{title}</h2>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badgeClass}`}>{badge}</span>
          {href && <Link href={href} className="text-[11px] text-[#022EE8] hover:underline">ดูทั้งหมด →</Link>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="bg-[#F7F7F7] rounded-lg px-3 py-2.5">
      <div className="text-[10px] text-[#8B8E8F] mb-0.5">{label}</div>
      <div className={`text-[16px] font-bold leading-none ${danger ? "text-[#FF6B6B]" : "text-[#3D3D3D]"}`}>{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-[12px] text-[#8B8E8F] text-center py-4">{text}</p>;
}

function ActionChip({ label, href, primary }: { label: string; href: string; primary?: boolean }) {
  return (
    <Link href={href} className={`text-[12px] px-3 py-1.5 rounded-lg font-medium transition-colors ${primary ? "bg-[#87DE81] text-white hover:bg-[#6BC965]" : "bg-[#F7F7F7] text-[#3D3D3D] hover:bg-[#E8E8E8]"
      }`}>{label}</Link>
  );
}
