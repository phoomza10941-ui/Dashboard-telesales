"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  saleId: string;
  currentNote: string;
  presets: string[];
}

export default function UpdateNotePanel({ saleId, currentNote, presets }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(currentNote);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/sales/update-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: saleId, note }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setOpen(false);
        router.refresh();
      }, 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[11px] text-[#8B8E8F] border border-[#E8E8E8] bg-white px-3 py-1.5 rounded-lg hover:border-[#87DE81] hover:text-[#3D9B3A] transition-colors"
      >
        อัปเดตสถานะ
      </button>
    );
  }

  return (
    <div className="mt-3 border border-[#E8E8E8] rounded-xl bg-[#F7F7F7] p-3 space-y-2">
      <p className="text-[11px] text-[#8B8E8F] font-medium">อัปเดตหมายเหตุ</p>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => setNote(p)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
              note === p
                ? "bg-[#87DE81] border-[#87DE81] text-white font-medium"
                : "bg-white border-[#E8E8E8] text-[#3D3D3D] hover:border-[#87DE81]"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="หรือพิมพ์หมายเหตุเอง..."
        className="w-full bg-white border border-[#E8E8E8] rounded-lg px-3 py-2 text-[12px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] resize-none transition-colors"
      />
      {error && (
        <p className="text-[11px] text-[#FF6B6B]">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || saved}
          className="flex-1 bg-[#87DE81] text-white text-[12px] font-medium py-1.5 rounded-lg hover:bg-[#6BC965] disabled:opacity-60 transition-colors"
        >
          {saved ? "บันทึกแล้ว ✓" : saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        <button
          onClick={() => { setOpen(false); setNote(currentNote); }}
          className="text-[12px] text-[#8B8E8F] px-4 py-1.5 rounded-lg hover:bg-[#E8E8E8] transition-colors"
        >
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
