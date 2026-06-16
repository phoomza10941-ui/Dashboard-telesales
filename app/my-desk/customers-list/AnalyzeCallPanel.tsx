"use client";
import { useState, useTransition, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface OrekaRecording {
  id: string;
  timestamp: string;
  duration: number;
  direction: "IN" | "OUT";
  localParty: string;
  remoteParty: string;
}

interface ExtractedFields {
  first_name?: string;
  last_name?: string;
  nickname?: string;
  diseases?: string;
  symptoms?: string;
  medications?: string;
  consulted_doc?: string;
  patient_type?: string;
}

const FIELD_META: { key: keyof ExtractedFields; label: string; wide?: boolean }[] = [
  { key: "first_name", label: "ชื่อ" },
  { key: "last_name", label: "นามสกุล" },
  { key: "nickname", label: "ชื่อเล่น" },
  { key: "patient_type", label: "คนที่ทาน" },
  { key: "diseases", label: "โรคเป็นอยู่", wide: true },
  { key: "symptoms", label: "อาการตอนนี้", wide: true },
  { key: "medications", label: "ยาที่กำลังทานอยู่", wide: true },
  { key: "consulted_doc", label: "ปรึกษาหมอมั้ย", wide: true },
];

// Calls under this duration (seconds) are considered likely empty
const MIN_USEFUL_DURATION = 60;

export default function AnalyzeCallPanel({
  agentId,
  customerId,
  prefillPhone,
  prefillName,
  orekaExtGosell,
  orekaExtHopeful,
  initialRecordings,
  trigger,
}: {
  agentId: string;
  customerId?: string;
  prefillPhone?: string;
  prefillName?: string;
  orekaExtGosell: string;
  orekaExtHopeful: string;
  initialRecordings: OrekaRecording[];
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"pick" | "loading" | "results">("pick");
  const [selectedRec, setSelectedRec] = useState<OrekaRecording | null>(null);
  const [extracted, setExtracted] = useState<ExtractedFields>({});
  const [editedFields, setEditedFields] = useState<ExtractedFields>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showShort, setShowShort] = useState(false);
  const [loadingPct, setLoadingPct] = useState(0);
  const [, startTransition] = useTransition();
  const router = useRouter();

  // Animate a fake progress bar while waiting for the API
  useEffect(() => {
    if (step !== "loading") return;
    setLoadingPct(3);
    const id = setInterval(() => {
      setLoadingPct((p) => {
        const gap = 90 - p;
        return p + Math.max(0.4, gap * 0.025);
      });
    }, 500);
    return () => clearInterval(id);
  }, [step]);

  function loadingPhase(pct: number) {
    if (pct < 25) return "⬇️ ดาวน์โหลดเสียง...";
    if (pct < 78) return "📝 ถอดเสียงด้วย Whisper...";
    return "🧠 วิเคราะห์ด้วย AI...";
  }

  function handleOpen() {
    setOpen(true);
    setStep("pick");
    setSelectedRec(null);
    setExtracted({});
    setEditedFields({});
    setError("");
    // Pre-fill search with customer phone so matching calls show immediately
    setSearch(prefillPhone ? prefillPhone.replace(/[-\s+]/g, "").slice(-9) : "");
    setShowShort(false);
  }

  // Filter recordings: by search + by duration
  const filtered = initialRecordings.filter((r) => {
    if (!showShort && r.duration < MIN_USEFUL_DURATION) return false;
    if (search) {
      const q = search.replace(/[-\s]/g, "");
      const phone = r.remoteParty.replace(/[-\s]/g, "");
      return phone.includes(q);
    }
    return true;
  });

  const hiddenShortCount = !showShort
    ? initialRecordings.filter((r) => r.duration < MIN_USEFUL_DURATION).length
    : 0;

  async function handleAnalyze() {
    if (!selectedRec) return;
    setStep("loading");
    setError("");
    try {
      const account =
        orekaExtGosell && selectedRec.localParty === orekaExtGosell ? "gosell" : "hopeful";
      const res = await fetch("/api/customer/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orekaRecordingId: selectedRec.id, account }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "วิเคราะห์ไม่สำเร็จ");
      setLoadingPct(100);
      await new Promise((r) => setTimeout(r, 300));
      setExtracted(data.fields ?? {});
      setEditedFields(data.fields ?? {});
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setStep("pick");
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/customer/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: customerId,
          agentId,
          orekaRecId: selectedRec?.id,
          phone: selectedRec?.remoteParty ?? prefillPhone,
          // For sales-derived contacts, seed name from sales record if AI didn't extract it
          ...(prefillName && !editedFields.first_name ? { nickname: prefillName } : {}),
          ...editedFields,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "บันทึกไม่สำเร็จ");
      }
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  function formatDuration(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Bangkok",
    });
  }

  return (
    <>
      <span onClick={handleOpen} className="cursor-pointer">
        {trigger}
      </span>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-[420px] bg-white border-l border-[#E8E8E8] shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E8E8]">
              <div className="text-[13px] font-semibold text-[#3D3D3D]">🎙 วิเคราะห์สายโทร</div>
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 rounded-full hover:bg-[#F7F7F7] flex items-center justify-center"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {step === "pick" && (
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold text-[#8B8E8F] uppercase tracking-wide">
                    เลือกการโทรวันนี้
                    <span className="ml-2 font-normal normal-case text-[#C0C0C0]">
                      ({initialRecordings.length} สาย)
                    </span>
                  </div>

                  {/* Search bar */}
                  {initialRecordings.length > 0 && (
                    <div className="relative">
                      <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C0C0C0]"
                        width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <input
                        type="text"
                        placeholder="ค้นหาเบอร์โทร..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-[12px] bg-[#F7F7F7] border border-[#E8E8E8] rounded-xl outline-none focus:border-[#87DE81] focus:bg-white transition-colors placeholder:text-[#C0C0C0]"
                      />
                    </div>
                  )}

                  {initialRecordings.length === 0 ? (
                    <div className="text-[12px] text-[#8B8E8F] text-center py-8">
                      ไม่พบการโทรวันนี้
                      <div className="text-[11px] text-[#C0C0C0] mt-1">
                        ตรวจสอบเบอร์ dtac ของคุณในโปรไฟล์
                      </div>
                    </div>
                  ) : filtered.length === 0 && search ? (
                    <div className="text-[12px] text-[#8B8E8F] text-center py-6">
                      ไม่พบเบอร์ &ldquo;{search}&rdquo;
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filtered.map((rec) => (
                        <button
                          key={rec.id}
                          onClick={() => setSelectedRec(rec)}
                          className={`w-full text-left p-3 rounded-xl border transition-colors ${
                            selectedRec?.id === rec.id
                              ? "border-[#87DE81] bg-[#f0fdf4]"
                              : "border-[#E8E8E8] hover:border-[#87DE81] hover:bg-[#f0fdf4]"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="font-medium text-[#3D3D3D]">
                              {rec.direction === "IN" ? "📞 สายเข้า" : "📲 สายออก"} —{" "}
                              {formatTime(rec.timestamp)}
                            </span>
                            <span className={`font-medium ${rec.duration < MIN_USEFUL_DURATION ? "text-[#C0C0C0]" : "text-[#8B8E8F]"}`}>
                              {formatDuration(rec.duration)}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#8B8E8F] mt-0.5">{rec.remoteParty}</div>
                        </button>
                      ))}

                      {/* Show short calls toggle */}
                      {hiddenShortCount > 0 && (
                        <button
                          onClick={() => setShowShort(true)}
                          className="w-full text-center text-[11px] text-[#C0C0C0] hover:text-[#8B8E8F] py-2 transition-colors"
                        >
                          + แสดงสายสั้น {hiddenShortCount} สาย (น้อยกว่า 1 นาที — อาจไม่มีข้อมูล)
                        </button>
                      )}
                      {showShort && (
                        <button
                          onClick={() => setShowShort(false)}
                          className="w-full text-center text-[11px] text-[#C0C0C0] hover:text-[#8B8E8F] py-2 transition-colors"
                        >
                          ซ่อนสายสั้น
                        </button>
                      )}
                    </div>
                  )}

                  {error && <p className="text-[11px] text-red-500">{error}</p>}
                </div>
              )}

              {step === "loading" && (
                <div className="flex flex-col items-center justify-center py-16 gap-5 px-6">
                  <div className="w-full space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] text-[#8B8E8F]">{loadingPhase(loadingPct)}</span>
                      <span className="text-[13px] font-semibold text-[#3D3D3D] tabular-nums">
                        {Math.round(loadingPct)}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-[#E8E8E8] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#87DE81] rounded-full transition-all duration-500"
                        style={{ width: `${loadingPct}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-[#C0C0C0] text-center">ใช้เวลาประมาณ 30–60 วินาที</div>
                  </div>
                </div>
              )}

              {step === "results" && (
                <div className="space-y-4">
                  <div className="text-[11px] font-semibold text-[#8B8E8F] uppercase tracking-wide">
                    ข้อมูลที่ดึงได้ — แก้ไขได้ก่อนบันทึก
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {FIELD_META.map(({ key, label, wide }) => {
                      const found = extracted[key] !== undefined;
                      return (
                        <div
                          key={key}
                          className={`rounded-xl p-3 ${
                            found ? "bg-[#F7F7F7]" : "bg-[#fffbf0] border border-[#f0c040]"
                          } ${wide ? "col-span-2" : ""}`}
                        >
                          <div className="text-[10px] text-[#8B8E8F] mb-1">{label}</div>
                          {found ? (
                            <input
                              type="text"
                              value={editedFields[key] ?? ""}
                              onChange={(e) =>
                                setEditedFields((p) => ({ ...p, [key]: e.target.value }))
                              }
                              className="w-full text-[12px] text-[#3D3D3D] bg-transparent outline-none border-b border-transparent focus:border-[#87DE81] transition-colors"
                            />
                          ) : (
                            <div className="text-[11px] text-[#856404] italic">
                              ไม่ได้พูดถึงในสาย
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {error && <p className="text-[11px] text-red-500">{error}</p>}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[#E8E8E8] flex gap-2">
              {step === "pick" && (
                <button
                  onClick={handleAnalyze}
                  disabled={!selectedRec}
                  className="flex-1 bg-[#87DE81] hover:bg-[#76cc70] disabled:opacity-40 text-[#3D3D3D] text-[13px] font-medium py-2.5 rounded-xl transition-colors"
                >
                  วิเคราะห์สายนี้
                </button>
              )}
              {step === "results" && (
                <>
                  <button
                    onClick={() => setStep("pick")}
                    className="px-4 py-2.5 text-[13px] text-[#8B8E8F] border border-[#E8E8E8] rounded-xl hover:bg-[#F7F7F7] transition-colors"
                  >
                    เลือกสายใหม่
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 bg-[#87DE81] hover:bg-[#76cc70] disabled:opacity-40 text-[#3D3D3D] text-[13px] font-medium py-2.5 rounded-xl transition-colors"
                  >
                    {saving ? "กำลังบันทึก..." : "✓ บันทึกข้อมูลลูกค้า"}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
