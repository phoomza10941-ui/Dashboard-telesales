"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Channel = "gosell" | "hopeful";

function todayDMY() {
  const thai = new Date(Date.now() + 7 * 3600000);
  const d = String(thai.getUTCDate()).padStart(2, "0");
  const m = String(thai.getUTCMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${thai.getUTCFullYear()}`;
}

const inputCls =
  "w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors";

const CHANNELS: { key: Channel; label: string; sub: string; color: string }[] = [
  { key: "gosell",  label: "GoSell",  sub: "CRM System",     color: "#3D9B3A" },
  { key: "hopeful", label: "Hopeful", sub: "Upsell Channel", color: "#0E8FA8" },
];

export default function NewContactForm({ agentName }: { agentName: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState(searchParams.get("name") ?? "");
  const [phone, setPhone] = useState(searchParams.get("phone") ?? "");
  const [channel, setChannel] = useState<Channel>("gosell");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/sheets/add-row", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentName,
          date: todayDMY(),
          name: name.trim(),
          phone: phone.trim(),
          channel,
          quantity: 1,
          note: "",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "บันทึกไม่สำเร็จ");
      }
      // Notify other tabs (war room / supervisor) that data changed.
      const supabase = createClient();
      const ch = supabase.channel("sales-update");
      await ch.subscribe();
      await ch.send({ type: "broadcast", event: "sale_added", payload: {} });
      supabase.removeChannel(ch);

      router.push("/my-desk/add-customer");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
      {status === "error" && (
        <div className="flex items-center gap-3 bg-[#FF6B6B]/10 border border-[#FF6B6B]/30 rounded-xl px-4 py-3">
          <span className="text-lg">⚠️</span>
          <p className="text-[13px] text-[#FF6B6B]">{errorMsg}</p>
        </div>
      )}

      <div className="bg-white border border-[#E8E8E8] rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-[11px] font-medium text-[#8B8E8F] mb-1.5 uppercase tracking-wide">
            ชื่อ - สกุล<span className="text-[#FF6B6B] ml-0.5">*</span>
          </label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="สมหญิง ดีใจ" className={inputCls} required />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#8B8E8F] mb-1.5 uppercase tracking-wide">เบอร์โทร</label>
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0891234567" className={inputCls} />
          <p className="text-[10px] text-[#C0C0C0] mt-1">ใช้จับคู่ประวัติการโทรจาก Oreka</p>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#8B8E8F] mb-1.5 uppercase tracking-wide">ช่องทาง</label>
          <div className="grid grid-cols-2 gap-2">
            {CHANNELS.map((c) => {
              const selected = channel === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setChannel(c.key)}
                  className="flex flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-2.5 transition-all text-left"
                  style={{ borderColor: selected ? c.color : "#E8E8E8", backgroundColor: selected ? `${c.color}14` : "#F7F7F7" }}
                >
                  <span className="text-[13px] font-bold" style={{ color: selected ? c.color : "#3D3D3D" }}>{c.label}</span>
                  <span className="text-[10px]" style={{ color: selected ? c.color : "#8B8E8F" }}>{c.sub}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "loading" || !name.trim()}
          className="flex items-center gap-2 bg-[#87DE81] text-white font-semibold text-[13px] px-6 py-2.5 rounded-xl hover:bg-[#6BC965] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {status === "loading" ? (
            <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10"/></svg>กำลังบันทึก...</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>เพิ่มลูกค้า</>
          )}
        </button>
        <button
          type="button"
          onClick={() => router.push("/my-desk/add-customer")}
          className="text-[13px] text-[#8B8E8F] hover:text-[#3D3D3D] px-4 py-2.5 rounded-xl hover:bg-[#F7F7F7] transition-colors"
        >
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
