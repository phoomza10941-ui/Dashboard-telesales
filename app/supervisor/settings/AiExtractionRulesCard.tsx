"use client";
import { useState } from "react";
import {
  EXTRACTION_FIELDS,
  DEFAULT_FIELD_RULES,
  type ExtractionRules,
  type ExtractionFieldKey,
} from "@/lib/extraction-config";

export default function AiExtractionRulesCard({
  initialRules,
}: {
  initialRules: ExtractionRules;
}) {
  // Per-field text: saved override if present, else the default rule.
  const [texts, setTexts] = useState<Record<string, string>>(() => {
    const t: Record<string, string> = {};
    for (const { key } of EXTRACTION_FIELDS) {
      t[key] = initialRules.fieldRules[key] ?? DEFAULT_FIELD_RULES[key];
    }
    return t;
  });
  const [extra, setExtra] = useState(initialRules.extraRules ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [testTranscript, setTestTranscript] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, string> | null>(null);
  const [testError, setTestError] = useState("");

  function setField(key: string, value: string) {
    setTexts((p) => ({ ...p, [key]: value }));
    setSaved(false);
  }

  function resetField(key: ExtractionFieldKey) {
    setField(key, DEFAULT_FIELD_RULES[key]);
  }

  // Only store fields the supervisor actually changed from the default, so future
  // default improvements still apply to untouched fields.
  function buildRules(): ExtractionRules {
    const fieldRules: Partial<Record<ExtractionFieldKey, string>> = {};
    for (const { key } of EXTRACTION_FIELDS) {
      const v = (texts[key] ?? "").trim();
      if (v && v !== DEFAULT_FIELD_RULES[key].trim()) fieldRules[key] = v;
    }
    return { fieldRules, extraRules: extra.trim() };
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/supervisor/extraction-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRules()),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!testTranscript.trim()) {
      setTestError("กรุณาวางบทสนทนาก่อนทดสอบ");
      return;
    }
    setTesting(true);
    setTestError("");
    setTestResult(null);
    try {
      const res = await fetch("/api/supervisor/extraction-rules/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: testTranscript, rules: buildRules() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestError(data.error ?? "ทดสอบไม่สำเร็จ");
        return;
      }
      setTestResult(data.fields ?? {});
    } catch {
      setTestError("ทดสอบไม่สำเร็จ");
    } finally {
      setTesting(false);
    }
  }

  const ta =
    "w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2 text-[12px] text-[#3D3D3D] leading-relaxed placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors resize-y";

  return (
    <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#fff8ed] flex items-center justify-center shrink-0">
          <span className="text-[18px]">📝</span>
        </div>
        <div>
          <div className="text-[14px] font-semibold text-[#3D3D3D]">กฎการดึงข้อมูลของ AI</div>
          <div className="text-[12px] text-[#8B8E8F] mt-0.5">
            ปรับวิธีที่ AI ดึงข้อมูลแต่ละฟิลด์จากสายโทร — แก้แล้วมีผลกับการวิเคราะห์ครั้งต่อไปทันที
          </div>
        </div>
      </div>

      {/* Per-field rules */}
      <div className="space-y-4">
        {EXTRACTION_FIELDS.map(({ key, label }) => {
          const isCustom = (texts[key] ?? "").trim() !== DEFAULT_FIELD_RULES[key].trim();
          const rows = key === "symptoms" ? 5 : 2;
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] font-medium text-[#3D3D3D]">
                  {label}
                  <span className="ml-1.5 text-[10px] text-[#C0C0C0] font-normal">({key})</span>
                  {isCustom && (
                    <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded-full bg-[#fff8ed] text-[#d08700]">
                      แก้ไขแล้ว
                    </span>
                  )}
                </span>
                {isCustom && (
                  <button
                    onClick={() => resetField(key)}
                    className="text-[10px] text-[#58CEE8] hover:underline"
                  >
                    คืนค่าเริ่มต้น
                  </button>
                )}
              </div>
              <textarea
                value={texts[key] ?? ""}
                onChange={(e) => setField(key, e.target.value)}
                rows={rows}
                className={ta}
              />
            </div>
          );
        })}
      </div>

      {/* Global extra rules */}
      <div>
        <div className="text-[12px] font-medium text-[#3D3D3D] mb-1.5">
          กฎเพิ่มเติม (ใช้กับทุกฟิลด์)
          <span className="ml-1.5 text-[10px] text-[#C0C0C0] font-normal">ไม่บังคับ</span>
        </div>
        <textarea
          value={extra}
          onChange={(e) => { setExtra(e.target.value); setSaved(false); }}
          rows={3}
          placeholder="เช่น ระวังสายที่ลูกค้าซื้อให้คนอื่น, ไม่ต้องดึงข้อมูลถ้าสายไม่ถึง 1 นาที ฯลฯ"
          className={ta}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-[#87DE81] hover:bg-[#76cc70] disabled:opacity-50 text-[#3D3D3D] text-[13px] font-medium py-2.5 rounded-xl transition-colors"
      >
        {saving ? "กำลังบันทึก..." : saved ? "✓ บันทึกแล้ว" : "บันทึกกฎ"}
      </button>

      {/* Live test */}
      <div className="border-t border-[#E8E8E8] pt-5">
        <div className="text-[12px] font-semibold text-[#3D3D3D] mb-1">🧪 ทดสอบกฎ</div>
        <div className="text-[11px] text-[#8B8E8F] mb-2.5">
          วางบทสนทนาตัวอย่าง แล้วกดทดสอบ เพื่อดูว่า AI จะดึงข้อมูลออกมาเป็นอะไร (ใช้กฎด้านบนที่ยังไม่ต้องบันทึก)
        </div>
        <textarea
          value={testTranscript}
          onChange={(e) => setTestTranscript(e.target.value)}
          rows={4}
          placeholder="วางบทสนทนาที่ถอดเสียงมาที่นี่..."
          className={ta}
        />
        <button
          onClick={handleTest}
          disabled={testing}
          className="mt-2 w-full border border-[#58CEE8] text-[#0E8FA8] disabled:opacity-50 text-[13px] font-medium py-2.5 rounded-xl hover:bg-[#f0fbff] transition-colors"
        >
          {testing ? "กำลังทดสอบ..." : "ทดสอบ"}
        </button>
        {testError && <p className="text-[11px] text-red-500 mt-2">{testError}</p>}
        {testResult && (
          <div className="mt-3 bg-[#F7F7F7] border border-[#E8E8E8] rounded-xl p-3">
            <div className="text-[10px] font-semibold text-[#8B8E8F] uppercase tracking-wide mb-2">
              ผลที่ดึงได้
            </div>
            {Object.keys(testResult).length === 0 ? (
              <p className="text-[11px] text-[#C0C0C0]">— ไม่ได้ดึงข้อมูลใด ๆ —</p>
            ) : (
              <div className="space-y-1.5">
                {EXTRACTION_FIELDS.filter((f) => testResult[f.key]).map((f) => (
                  <div key={f.key} className="flex gap-2 text-[12px]">
                    <span className="text-[#8B8E8F] w-[110px] shrink-0">{f.label}</span>
                    <span className="text-[#3D3D3D] font-medium">{testResult[f.key]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
