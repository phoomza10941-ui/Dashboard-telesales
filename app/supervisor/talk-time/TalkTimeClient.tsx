"use client";

import { useState, useRef, useCallback } from "react";
import { saveOrekaLabel } from "@/app/actions/config";
import type { AgentTalkTime, AccountId } from "@/lib/oreka";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Tab = "overall" | AccountId;
type ViewMode = "day" | "month";

const TABS: { id: Tab; label: string }[] = [
  { id: "overall", label: "Overall" },
  { id: "gosell", label: "Gosell" },
  { id: "hopeful", label: "Hopeful" },
];

const THAI_MONTHS = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function formatTalkTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function displayDate(k: string) {
  const [y, m, d] = k.split("-").map(Number);
  return `${d} ${THAI_MONTHS[m]} ${y + 543}`;
}
function displayMonth(k: string) {
  const [y, m] = k.split("-").map(Number);
  return `${THAI_MONTHS[m]} ${y + 543}`;
}
function addDays(k: string, n: number) {
  const d = new Date(`${k}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function addMonths(k: string, n: number) {
  const [y, m] = k.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// ── SSE streaming fetch ───────────────────────────────────────────────────────
async function streamFetch(
  url: string,
  onChunk: (agents: AgentTalkTime[], pages: number, labels: Record<string, string>) => void,
  onDone: (error?: string) => void,
  signal: AbortSignal
) {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok || !res.body) { onDone("fetch failed"); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        if (!part.startsWith("data: ")) continue;
        try {
          const json = JSON.parse(part.slice(6));
          if (json.done) { onDone(json.error); return; }
          if (json.agents) onChunk(json.agents, json.pages ?? 0, json.labels ?? {});
        } catch { /* malformed chunk, skip */ }
      }
    }
    onDone();
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") return;
    onDone(e instanceof Error ? e.message : "unknown error");
  }
}

// ── Inline label editor ───────────────────────────────────────────────────────
function InlineLabel({ ext, initial, onSaved }: { ext: string; initial: string; onSaved: (l: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  function startEdit() { setEditing(true); setTimeout(() => ref.current?.focus(), 0); }

  async function commit() {
    if (!editing) return;
    setEditing(false); setSaving(true);
    try { await saveOrekaLabel(ext, value); onSaved(value); } finally { setSaving(false); }
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") { setValue(initial); setEditing(false); }
  }

  if (editing)
    return <input ref={ref} value={value} onChange={e => setValue(e.target.value)} onBlur={commit} onKeyDown={onKey}
      placeholder="ตั้งชื่อเบอร์นี้…" className="w-36 bg-white border border-[#87DE81] rounded-lg px-2 py-1 text-[12px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none" />;

  if (value)
    return (
      <button onClick={startEdit} className="flex items-center gap-1 group">
        <span className="font-medium text-[#3D3D3D]">{value}</span>
        <svg className="w-3 h-3 text-[#C0C0C0] group-hover:text-[#8B8E8F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        {saving && <span className="text-[10px] text-[#8B8E8F] animate-pulse">…</span>}
      </button>
    );

  return (
    <button onClick={startEdit} className="flex items-center gap-1 text-[11px] text-[#C0C0C0] hover:text-[#87DE81] transition-colors">
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
      </svg>
      ตั้งชื่อ
    </button>
  );
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────
function SkeletonRows({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="border-b border-[#F7F7F7]">
          <td className="py-4 px-5"><div className="h-3 w-4 bg-[#F0F0F0] rounded animate-pulse" /></td>
          <td className="py-4 px-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#F0F0F0] animate-pulse shrink-0" style={{ animationDelay: `${i * 60}ms` }} />
              <div className="h-3 rounded bg-[#F0F0F0] animate-pulse" style={{ width: `${60 + (i % 3) * 20}px`, animationDelay: `${i * 60}ms` }} />
            </div>
          </td>
          <td className="py-4 px-5"><div className="h-5 w-14 rounded-full bg-[#F0F0F0] animate-pulse" style={{ animationDelay: `${i * 60}ms` }} /></td>
          <td className="py-4 px-5"><div className="h-3 w-28 rounded bg-[#F0F0F0] animate-pulse" style={{ animationDelay: `${i * 60}ms` }} /></td>
          <td className="py-4 px-5">
            <div className="flex flex-col gap-1.5">
              <div className="h-3 w-16 rounded bg-[#F0F0F0] animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
              <div className="h-1.5 w-28 rounded-full bg-[#F0F0F0] animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
            </div>
          </td>
          {[...Array(4)].map((_, j) => (
            <td key={j} className="py-4 px-5"><div className="h-3 w-6 rounded bg-[#F0F0F0] animate-pulse" style={{ animationDelay: `${(i + j) * 60}ms` }} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TalkTimeClient({
  agents: initialAgents,
  error: initialError,
  todayKey,
  currentMonthKey,
  initialLabels,
}: {
  agents: AgentTalkTime[];
  error: string | null;
  todayKey: string;
  currentMonthKey: string;
  initialLabels: Record<string, string>;
}) {
  const [mode, setMode] = useState<ViewMode>("day");
  const [tab, setTab] = useState<Tab>("overall");
  const [dateKey, setDateKey] = useState(todayKey);
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [agents, setAgents] = useState(initialAgents);
  const [error, setError] = useState(initialError);
  const [labels, setLabels] = useState(initialLabels);
  const [loading, setLoading] = useState(false);
  const [pagesLoaded, setPagesLoaded] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const isToday = mode === "day" && dateKey === todayKey;
  const isCurrentMonth = mode === "month" && monthKey === currentMonthKey;

  const startStream = useCallback((url: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setAgents([]);
    setError(null);
    setPagesLoaded(0);

    streamFetch(
      url,
      (a, pages, lbl) => { setAgents(a); setPagesLoaded(pages); setLabels(lbl); },
      (err) => { setLoading(false); setPagesLoaded(null); if (err) setError(err); },
      ctrl.signal,
    );
  }, []);

  function loadDay(newDate: string) {
    setDateKey(newDate);
    setMode("day");
    startStream(`/api/talk-time/stream?date=${newDate}`);
  }
  function loadMonth(newMonth: string) {
    setMonthKey(newMonth);
    setMode("month");
    startStream(`/api/talk-time/stream?month=${newMonth}`);
  }
  function switchMode(newMode: ViewMode) {
    if (newMode === mode) return;
    setMode(newMode);
    if (newMode === "day") startStream(`/api/talk-time/stream?date=${dateKey}`);
    else startStream(`/api/talk-time/stream?month=${monthKey}`);
  }

  const tabFiltered = tab === "overall" ? agents : agents.filter(a => a.account === tab);
  const searchQ = search.trim().toLowerCase();
  const visible = searchQ
    ? tabFiltered.filter(a => {
        const name = (a.nickname ?? labels[a.orekaExt] ?? a.orekaName ?? "").toLowerCase();
        const ext = a.orekaExt.toLowerCase().replace(/\D/g, "");
        const q = searchQ.replace(/\D/g, "") || searchQ;
        return name.includes(searchQ) || ext.includes(q) || a.orekaExt.toLowerCase().includes(searchQ);
      })
    : tabFiltered;
  const teamSeconds = visible.reduce((s, a) => s + a.totalSeconds, 0);
  const teamCalls = visible.reduce((s, a) => s + a.callCount, 0);
  const teamOut = visible.reduce((s, a) => s + a.outCount, 0);
  const teamIn = visible.reduce((s, a) => s + a.inCount, 0);
  const activeAgents = visible.filter(a => a.callCount > 0).length;
  const avgPerCall = teamCalls > 0 ? Math.round(teamSeconds / teamCalls) : 0;
  const maxSeconds = Math.max(...visible.map(a => a.totalSeconds), 1);
  const countFor = (t: Tab) => t === "overall" ? agents.length : agents.filter(a => a.account === t).length;
  const periodLabel = mode === "day" ? (isToday ? "วันนี้" : displayDate(dateKey)) : (isCurrentMonth ? "เดือนนี้" : displayMonth(monthKey));

  function exportPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    // English-only period label (Thai chars break the default jsPDF font)
    const periodEn = mode === "day"
      ? (isToday ? "Today" : dateKey)
      : (isCurrentMonth ? "This Month" : monthKey);
    const tabEn = tab === "overall" ? "" : ` (${tab})`;

    doc.setFontSize(14);
    doc.setTextColor(61, 61, 61);
    doc.text(`Talk Time Report - ${periodEn}${tabEn}`, 14, 16);

    doc.setFontSize(9);
    doc.setTextColor(139, 142, 143);
    doc.text(
      `Total: ${formatTalkTime(teamSeconds)}  |  Calls: ${teamCalls.toLocaleString()}  |  Agents: ${activeAgents}/${visible.length}  |  Avg/Call: ${formatTalkTime(avgPerCall)}`,
      14, 23
    );

    const rows = visible.map((a, i) => {
      const displayName = a.nickname ?? labels[a.orekaExt] ?? a.orekaName ?? a.orekaExt;
      const avg = a.callCount > 0 ? Math.round(a.totalSeconds / a.callCount) : 0;
      return [
        i + 1,
        displayName,
        a.accountLabel,
        a.orekaExt,
        formatTalkTime(a.totalSeconds),
        a.callCount,
        a.inCount,
        a.outCount,
        avg > 0 ? formatTalkTime(avg) : "-",
      ];
    });

    autoTable(doc, {
      startY: 28,
      head: [["#", "Agent", "Team", "Extension (Local Party)", "Talk Time", "Calls", "In", "Out", "Avg/Call"]],
      body: rows,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [135, 222, 129], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [247, 247, 247] },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        4: { halign: "right" },
        5: { halign: "center" },
        6: { halign: "center" },
        7: { halign: "center" },
        8: { halign: "right" },
      },
    });

    const tabLabel = tab === "overall" ? "overall" : tab;
    const dateLabel = mode === "day" ? dateKey : monthKey;
    doc.save(`talktime_${dateLabel}_${tabLabel}.pdf`);
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[16px] font-semibold text-[#3D3D3D]">Talk Time {periodLabel}</h1>
          <p className="text-[12px] text-[#8B8E8F] mt-0.5">เวลาคุยสายรายคน — ดึงสดจาก dtac OneCall (Oreka) · เวลาไทย</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode toggle */}
          <div className="inline-flex rounded-lg border border-[#E8E8E8] bg-white p-0.5">
            {(["day", "month"] as ViewMode[]).map(m => (
              <button key={m} onClick={() => switchMode(m)}
                className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${mode === m ? "bg-[#3D3D3D] text-white" : "text-[#8B8E8F] hover:bg-[#F7F7F7]"}`}>
                {m === "day" ? "รายวัน" : "รายเดือน"}
              </button>
            ))}
          </div>

          {/* Day nav */}
          {mode === "day" && <>
            <button onClick={() => loadDay(addDays(dateKey, -1))} disabled={loading}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E8E8E8] bg-white text-[#8B8E8F] hover:bg-[#F7F7F7] disabled:opacity-40 text-[14px]">‹</button>
            <input type="date" value={dateKey} max={todayKey} onChange={e => e.target.value && loadDay(e.target.value)}
              className="h-8 px-3 rounded-lg border border-[#E8E8E8] bg-white text-[12px] text-[#3D3D3D] focus:outline-none focus:border-[#87DE81] cursor-pointer" />
            <button onClick={() => loadDay(addDays(dateKey, 1))} disabled={loading || isToday}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E8E8E8] bg-white text-[#8B8E8F] hover:bg-[#F7F7F7] disabled:opacity-40 text-[14px]">›</button>
            {!isToday && <button onClick={() => loadDay(todayKey)} disabled={loading}
              className="h-8 px-3 rounded-lg border border-[#87DE81] bg-[#87DE81]/10 text-[11px] text-[#3D9B3A] font-medium hover:bg-[#87DE81]/20 disabled:opacity-40">วันนี้</button>}
          </>}

          {/* Month nav */}
          {mode === "month" && <>
            <button onClick={() => loadMonth(addMonths(monthKey, -1))} disabled={loading}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E8E8E8] bg-white text-[#8B8E8F] hover:bg-[#F7F7F7] disabled:opacity-40 text-[14px]">‹</button>
            <input type="month" value={monthKey} max={currentMonthKey} onChange={e => e.target.value && loadMonth(e.target.value)}
              className="h-8 px-3 rounded-lg border border-[#E8E8E8] bg-white text-[12px] text-[#3D3D3D] focus:outline-none focus:border-[#87DE81] cursor-pointer" />
            <button onClick={() => loadMonth(addMonths(monthKey, 1))} disabled={loading || isCurrentMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E8E8E8] bg-white text-[#8B8E8F] hover:bg-[#F7F7F7] disabled:opacity-40 text-[14px]">›</button>
            {!isCurrentMonth && <button onClick={() => loadMonth(currentMonthKey)} disabled={loading}
              className="h-8 px-3 rounded-lg border border-[#87DE81] bg-[#87DE81]/10 text-[11px] text-[#3D9B3A] font-medium hover:bg-[#87DE81]/20 disabled:opacity-40">เดือนนี้</button>}
          </>}

          {/* Export PDF */}
          <button
            onClick={exportPDF}
            disabled={loading || visible.length === 0}
            className="h-8 px-3 flex items-center gap-1.5 rounded-lg border border-[#E8E8E8] bg-white text-[12px] text-[#3D3D3D] hover:bg-[#F7F7F7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-[#8B8E8F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <polyline points="9 14 12 17 15 14" />
            </svg>
            Export PDF
          </button>

          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#8B8E8F]">
              <svg className="animate-spin w-3.5 h-3.5 text-[#58CEE8]" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
              </svg>
              {pagesLoaded !== null && pagesLoaded > 0
                ? `โหลดแล้ว ${pagesLoaded} หน้า…`
                : "กำลังเชื่อมต่อ…"}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-700">
          ⚠️ ดึงข้อมูล talk time ไม่ได้ ({error}) — ลองรีเฟรชอีกครั้ง
        </div>
      )}

      {/* Account toggle */}
      <div className="inline-flex self-start mb-5 rounded-xl border border-[#E8E8E8] bg-white p-1 gap-1">
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${active ? "bg-[#87DE81] text-white" : "text-[#8B8E8F] hover:bg-[#F7F7F7]"}`}>
              {t.label}
              <span className={`ml-1.5 text-[10px] ${active ? "text-white/80" : "text-[#C0C0C0]"}`}>{countFor(t.id)}</span>
            </button>
          );
        })}
      </div>

      {/* KPI cards — skeleton while loading with no data yet */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {loading && agents.length === 0 ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[#E8E8E8] px-4 py-3.5">
              <div className="h-2.5 w-24 rounded bg-[#F0F0F0] animate-pulse mb-2" style={{ animationDelay: `${i * 80}ms` }} />
              <div className="h-6 w-20 rounded bg-[#F0F0F0] animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
            </div>
          ))
        ) : (
          <>
            <KpiCard label={`Talk Time รวมทีม${mode === "month" ? ` (${periodLabel})` : ""}`} value={formatTalkTime(teamSeconds)} accent="green" />
            <KpiCard label="จำนวนสายรวม" value={`${teamCalls.toLocaleString()} สาย`} sub={`เข้า ${teamIn} · ออก ${teamOut}`} />
            <KpiCard label="เฉลี่ย/สาย" value={formatTalkTime(avgPerCall)} />
            <KpiCard label="Agents มีสาย" value={`${activeAgents}/${visible.length} คน`} />
          </>
        )}
      </div>

      {/* Search / filter */}
      <div className="mb-3 relative w-72">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C0C0C0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อ หรือเบอร์โทร…"
          className="w-full pl-8 pr-8 py-2 rounded-lg border border-[#E8E8E8] bg-white text-[12px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#C0C0C0] hover:text-[#8B8E8F]">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden flex flex-col">
        <div className="overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-[#E8E8E8]">
                {["#", "Agent", "ทีม", "เบอร์ (Local Party)", "Talk Time", "สาย", "เข้า", "ออก", "เฉลี่ย/สาย"].map(h => (
                  <th key={h} className="text-left text-[11px] text-[#8B8E8F] font-medium py-3.5 px-5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && agents.length === 0 ? (
                <SkeletonRows count={8} />
              ) : visible.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-[12px] text-[#8B8E8F]">
                  {error ? "ไม่สามารถโหลดข้อมูลได้" : `ไม่มีข้อมูล${mode === "day" ? `วัน${isToday ? "นี้" : `ที่ ${displayDate(dateKey)}`}` : `เดือน${periodLabel}`}`}
                </td></tr>
              ) : (
                visible.map((a, i) => {
                  const isMatched = !!a.nickname;
                  const customLabel = labels[a.orekaExt] ?? "";
                  const displayName = a.nickname ?? (customLabel || a.orekaName || a.orekaExt);
                  const avg = a.callCount > 0 ? Math.round(a.totalSeconds / a.callCount) : 0;
                  const barPct = Math.round((a.totalSeconds / maxSeconds) * 100);
                  const theme = a.account === "gosell"
                    ? { row: "hover:bg-amber-50/40", avatar: "bg-amber-100 text-amber-700", bar: "bg-[#58CEE8]", badge: "bg-amber-50 text-amber-600 border border-amber-200" }
                    : { row: "hover:bg-purple-50/40", avatar: "bg-purple-100 text-purple-700", bar: "bg-purple-400", badge: "bg-purple-50 text-purple-600 border border-purple-200" };

                  return (
                    <tr key={`${a.account}:${a.orekaExt}`} className={`border-b border-[#F7F7F7] transition-colors ${theme.row}`}>
                      <td className="py-4 px-5 text-[#8B8E8F] font-medium">{i + 1}</td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${isMatched || customLabel ? theme.avatar : "bg-[#F7F7F7] text-[#C0C0C0]"}`}>
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          {isMatched ? <span className="font-medium text-[#3D3D3D]">{a.nickname}</span> : (
                            <InlineLabel ext={a.orekaExt} initial={customLabel}
                              onSaved={label => setLabels(prev => ({ ...prev, [a.orekaExt]: label }))} />
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${theme.badge}`}>{a.accountLabel}</span>
                      </td>
                      <td className="py-4 px-5 text-[#8B8E8F] font-mono text-[12px]">{a.orekaExt}</td>
                      <td className="py-4 px-5">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-[#3D3D3D]">{formatTalkTime(a.totalSeconds)}</span>
                          <div className="w-28 h-1.5 bg-[#E8E8E8] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${theme.bar}`} style={{ width: `${barPct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-[#3D3D3D]">{a.callCount}</td>
                      <td className="py-4 px-5 text-[#8B8E8F]">{a.inCount}</td>
                      <td className="py-4 px-5 text-[#8B8E8F]">{a.outCount}</td>
                      <td className="py-4 px-5 text-[#3D3D3D]">{avg > 0 ? formatTalkTime(avg) : "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-[#E8E8E8] flex items-center justify-between flex-wrap gap-2">
          <p className="text-[11px] text-[#8B8E8F]">
            {loading && agents.length > 0
              ? <span className="animate-pulse">กำลังโหลด… {pagesLoaded} หน้าแล้ว</span>
              : `รวม ${teamCalls.toLocaleString()} สาย · Talk Time ${formatTalkTime(teamSeconds)}`}
          </p>
          <p className="text-[11px] text-[#C0C0C0]">
            {mode === "day"
              ? (isToday ? "ข้อมูล cache ~90 วินาที" : `ข้อมูลวันที่ ${displayDate(dateKey)}`)
              : `ข้อมูลรวม${isCurrentMonth ? "เดือนนี้" : displayMonth(monthKey)}`}
          </p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, accent, sub }: { label: string; value: string; accent?: "green" | "red"; sub?: string }) {
  const color = accent === "green" ? "text-[#3D9B3A]" : accent === "red" ? "text-red-500" : "text-[#3D3D3D]";
  return (
    <div className="bg-white rounded-xl border border-[#E8E8E8] px-4 py-3.5">
      <div className="text-[10px] text-[#8B8E8F] mb-1">{label}</div>
      <div className={`text-[18px] font-bold ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-[#C0C0C0] mt-0.5">{sub}</div>}
    </div>
  );
}
