"use client";
import { useState } from "react";

interface AiFields {
  first_name: boolean; last_name: boolean; nickname: boolean;
  diseases: boolean; symptoms: boolean; medications: boolean;
  consulted_doc: boolean; patient_type: boolean;
}

const FIELD_LABELS: { key: keyof AiFields; thai: string }[] = [
  { key: "first_name", thai: "ชื่อ" },
  { key: "last_name", thai: "นามสกุล" },
  { key: "nickname", thai: "ชื่อเล่น" },
  { key: "diseases", thai: "โรคเป็นอยู่" },
  { key: "symptoms", thai: "อาการตอนนี้" },
  { key: "medications", thai: "ยาที่กำลังทานอยู่" },
  { key: "consulted_doc", thai: "ปรึกษาหมอมั้ย" },
  { key: "patient_type", thai: "คนที่ทาน" },
];

interface ExtractedFields {
  first_name?: string; last_name?: string; nickname?: string;
  diseases?: string; symptoms?: string; medications?: string;
  consulted_doc?: string; patient_type?: string;
}

export default function BotConfigClient({
  initialFields,
  initialCoachingOverride,
  notionConnected,
  initialNotionPreview,
}: {
  initialFields: AiFields;
  initialCoachingOverride: string;
  notionConnected: boolean;
  initialNotionPreview: string;
}) {
  const [fields, setFields] = useState<AiFields>(initialFields);
  const [coaching, setCoaching] = useState(initialCoachingOverride);
  const [notionPreview, setNotionPreview] = useState(initialNotionPreview);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [showNotion, setShowNotion] = useState(false);

  // Test panel
  const [testTranscript, setTestTranscript] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ExtractedFields | null>(null);
  const [testError, setTestError] = useState("");

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/supervisor/bot-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, coachingOverride: coaching }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleForceSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/supervisor/bot-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceSync: true }),
      });
      const d = await res.json();
      setNotionPreview(d.notionPreview ?? "");
      setSyncMsg("✓ ซิงค์สำเร็จ");
    } catch {
      setSyncMsg("ซิงค์ไม่สำเร็จ");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(""), 4000);
    }
  }

  async function handleTest() {
    if (!testTranscript.trim()) return;
    setTesting(true);
    setTestResult(null);
    setTestError("");
    try {
      const res = await fetch("/api/supervisor/bot-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: testTranscript }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "ทดสอบไม่สำเร็จ");
      setTestResult(d.extracted);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Section 1: Notion ── */}
      <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#f0f8ff] flex items-center justify-center text-[16px]">📖</div>
          <div>
            <div className="text-[13px] font-semibold text-[#3D3D3D]">Product Knowledge — Notion</div>
            <div className="text-[11px] text-[#8B8E8F]">AI จะใช้ข้อมูลนี้ในทุก call summary และ extraction</div>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-[#F7F7F7] rounded-xl">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${notionConnected ? "bg-[#87DE81]" : "bg-red-400"}`} />
            <span className="text-[12px] text-[#3D3D3D]">
              {notionConnected ? "เชื่อมต่อ Notion แล้ว" : "ไม่ได้เชื่อมต่อ — ตั้งค่า NOTION_TOKEN ใน .env.local"}
            </span>
          </div>
          {notionConnected && (
            <button
              onClick={handleForceSync}
              disabled={syncing}
              className="text-[11px] text-[#58CEE8] hover:underline disabled:opacity-50"
            >
              {syncing ? "กำลังซิงค์..." : "Force Sync"}
            </button>
          )}
        </div>
        {syncMsg && <p className="text-[11px] text-[#87DE81]">{syncMsg}</p>}

        {notionPreview && (
          <div>
            <button
              onClick={() => setShowNotion((v) => !v)}
              className="text-[11px] text-[#58CEE8] hover:underline"
            >
              {showNotion ? "ซ่อน" : "ดูตัวอย่างที่ AI เห็น"}
            </button>
            {showNotion && (
              <pre className="mt-2 text-[10px] text-[#8B8E8F] bg-[#F7F7F7] rounded-xl p-3 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {notionPreview}{notionPreview.length >= 600 ? "\n…(ตัดสั้น)" : ""}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* ── Section 2: Extraction fields ── */}
      <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#f0fdf4] flex items-center justify-center text-[16px]">🎙</div>
          <div>
            <div className="text-[13px] font-semibold text-[#3D3D3D]">ฟิลด์ที่ให้ AI ดึงจากสาย</div>
            <div className="text-[11px] text-[#8B8E8F]">Whisper + GPT จะดึงเฉพาะฟิลด์ที่เปิดอยู่</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          {FIELD_LABELS.map(({ key, thai }) => (
            <label key={key} className="flex items-center justify-between py-2 cursor-pointer">
              <span className="text-[13px] text-[#3D3D3D]">{thai}</span>
              <button
                role="switch"
                aria-checked={fields[key]}
                onClick={() => { setFields((p) => ({ ...p, [key]: !p[key] })); setSaved(false); }}
                className={`relative w-10 h-5 rounded-full transition-colors ${fields[key] ? "bg-[#87DE81]" : "bg-[#E8E8E8]"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${fields[key] ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </label>
          ))}
        </div>
      </div>

      {/* ── Section 3: Coaching override ── */}
      <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#fffbf0] flex items-center justify-center text-[16px]">✍️</div>
          <div>
            <div className="text-[13px] font-semibold text-[#3D3D3D]">คำแนะนำพิเศษจาก Supervisor</div>
            <div className="text-[11px] text-[#8B8E8F]">ต่อท้าย system prompt ของ AI ทุก coaching summary</div>
          </div>
        </div>
        <textarea
          value={coaching}
          onChange={(e) => { setCoaching(e.target.value); setSaved(false); }}
          rows={5}
          placeholder={`เช่น:\n- เน้น closing technique ของสินค้า HOPEFUL\n- ถ้าลูกค้าพูดถึงราคา ให้แนะนำ installment plan\n- โค้ชให้พนักงานพูดถึง Beta Life ในทุกสาย`}
          className="w-full text-[12px] text-[#3D3D3D] bg-[#F7F7F7] border border-[#E8E8E8] rounded-xl px-4 py-3 outline-none focus:border-[#87DE81] focus:bg-white transition-colors placeholder:text-[#C0C0C0] resize-none leading-relaxed"
        />
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-[#87DE81] hover:bg-[#76cc70] disabled:opacity-50 text-[#3D3D3D] text-[13px] font-semibold py-3 rounded-xl transition-colors"
      >
        {saving ? "กำลังบันทึก..." : saved ? "✓ บันทึกแล้ว" : "บันทึกการตั้งค่าทั้งหมด"}
      </button>

      {/* ── Section 4: Test panel ── */}
      <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#f5f0ff] flex items-center justify-center text-[16px]">🧪</div>
          <div>
            <div className="text-[13px] font-semibold text-[#3D3D3D]">ทดสอบ AI Extraction</div>
            <div className="text-[11px] text-[#8B8E8F]">วาง transcript แล้วดูว่า AI ดึงอะไรออกมา</div>
          </div>
        </div>
        <textarea
          value={testTranscript}
          onChange={(e) => { setTestTranscript(e.target.value); setTestResult(null); }}
          rows={6}
          placeholder="วาง transcript ที่นี่ เช่น: พนักงาน: สวัสดีครับ คุณสมหญิง โทรมาถามเรื่องยาอะไรครับ..."
          className="w-full text-[12px] text-[#3D3D3D] bg-[#F7F7F7] border border-[#E8E8E8] rounded-xl px-4 py-3 outline-none focus:border-[#87DE81] focus:bg-white transition-colors placeholder:text-[#C0C0C0] resize-none leading-relaxed"
        />
        <button
          onClick={handleTest}
          disabled={testing || !testTranscript.trim()}
          className="w-full bg-[#58CEE8] hover:bg-[#3DB8D4] disabled:opacity-40 text-white text-[13px] font-medium py-2.5 rounded-xl transition-colors"
        >
          {testing ? "กำลังวิเคราะห์..." : "ทดสอบ AI"}
        </button>
        {testError && <p className="text-[11px] text-red-500">{testError}</p>}

        {testResult && (
          <div className="space-y-2">
            <div className="text-[10px] font-semibold text-[#8B8E8F] uppercase tracking-wide">ผลที่ดึงได้</div>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(testResult) as [string, string][]).map(([key, value]) => (
                <div
                  key={key}
                  className={`bg-[#f0fdf4] border border-[#87DE81]/30 rounded-xl p-3 ${
                    ["diseases", "symptoms", "medications", "consulted_doc"].includes(key) ? "col-span-2" : ""
                  }`}
                >
                  <div className="text-[10px] text-[#8B8E8F] mb-1">{key}</div>
                  <div className="text-[12px] text-[#3D3D3D] font-medium">{value}</div>
                </div>
              ))}
            </div>
            {Object.keys(testResult).length === 0 && (
              <div className="text-[12px] text-[#8B8E8F] text-center py-3">AI ไม่พบข้อมูลใน transcript นี้</div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
