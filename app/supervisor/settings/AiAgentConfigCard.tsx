"use client";
import { useState } from "react";

interface AiFields {
  first_name: boolean;
  last_name: boolean;
  nickname: boolean;
  diseases: boolean;
  symptoms: boolean;
  medications: boolean;
  consulted_doc: boolean;
  patient_type: boolean;
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

export default function AiAgentConfigCard({
  initialFields,
  notionConnected,
}: {
  initialFields: AiFields;
  notionConnected: boolean;
}) {
  const [fields, setFields] = useState<AiFields>(initialFields);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  function toggle(key: keyof AiFields) {
    setFields((p) => ({ ...p, [key]: !p[key] }));
    setSaved(false);
  }

  async function handleSaveFields() {
    setSaving(true);
    try {
      await fetch("/api/supervisor/ai-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
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
      await fetch("/api/notion/sync", { method: "POST" });
      setSyncMsg("✓ ซิงค์สำเร็จ");
    } catch {
      setSyncMsg("ซิงค์ไม่สำเร็จ");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(""), 4000);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#f0f8ff] flex items-center justify-center shrink-0">
          <span className="text-[18px]">🤖</span>
        </div>
        <div>
          <div className="text-[14px] font-semibold text-[#3D3D3D]">AI Agent — การดึงข้อมูล</div>
          <div className="text-[12px] text-[#8B8E8F] mt-0.5">
            ตั้งค่าการเชื่อมต่อ Notion และเลือกฟิลด์ที่ AI จะดึงจากสายโทร
          </div>
        </div>
      </div>

      {/* Section A: Notion */}
      <div>
        <div className="text-[11px] font-semibold text-[#8B8E8F] uppercase tracking-wide mb-3">
          Product Knowledge — Notion
        </div>
        <div className="flex items-center justify-between p-3 bg-[#F7F7F7] rounded-xl">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${notionConnected ? "bg-[#87DE81]" : "bg-red-400"}`} />
            <span className="text-[12px] text-[#3D3D3D]">
              {notionConnected
                ? "เชื่อมต่อ Notion แล้ว"
                : "ไม่ได้เชื่อมต่อ — ตั้งค่า NOTION_TOKEN ใน .env.local"}
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
        {syncMsg && <p className="text-[11px] text-[#87DE81] mt-1">{syncMsg}</p>}
      </div>

      {/* Section B: Field toggles */}
      <div>
        <div className="text-[11px] font-semibold text-[#8B8E8F] uppercase tracking-wide mb-3">
          ฟิลด์ที่ให้ AI ดึงจากสาย
        </div>
        <div className="space-y-2">
          {FIELD_LABELS.map(({ key, thai }) => (
            <label key={key} className="flex items-center justify-between py-2 cursor-pointer">
              <span className="text-[13px] text-[#3D3D3D]">{thai}</span>
              <button
                role="switch"
                aria-checked={fields[key]}
                onClick={() => toggle(key)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  fields[key] ? "bg-[#87DE81]" : "bg-[#E8E8E8]"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    fields[key] ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </label>
          ))}
        </div>
        <button
          onClick={handleSaveFields}
          disabled={saving}
          className="mt-4 w-full bg-[#87DE81] hover:bg-[#76cc70] disabled:opacity-50 text-[#3D3D3D] text-[13px] font-medium py-2.5 rounded-xl transition-colors"
        >
          {saving ? "กำลังบันทึก..." : saved ? "✓ บันทึกแล้ว" : "บันทึกการตั้งค่า"}
        </button>
      </div>
    </div>
  );
}
