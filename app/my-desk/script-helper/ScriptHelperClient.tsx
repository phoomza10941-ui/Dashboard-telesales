"use client";
import { useState, useRef, useEffect } from "react";
import { scriptCategories, scriptContent } from "@/lib/mock-data";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `คุณคือ AI Script Helper สำหรับทีม Telesales
ช่วยเขียนสคริปต์การขาย/รับมือ objection เป็นภาษาไทย
ตอบกระชับ ตรงประเด็น พร้อมตัวอย่างประโยคพูดจริง`;

export default function ScriptHelperClient() {
  const [selected, setSelected] = useState("price");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const script = scriptContent[selected];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, system: SYSTEM_PROMPT }),
      });
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.reply || data.error || "เกิดข้อผิดพลาด" }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "ไม่สามารถเชื่อมต่อได้" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Static script section */}
      <div className="grid grid-cols-[240px_1fr] gap-5">
        {/* Category list */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E8E8E8]">
            <p className="text-[11px] font-semibold text-[#8B8E8F] uppercase tracking-wider">เลือกสถานการณ์</p>
          </div>
          <div className="py-1.5">
            {scriptCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelected(cat.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors relative ${
                  selected === cat.id
                    ? "bg-[#87DE81]/8 text-[#3D3D3D]"
                    : "text-[#8B8E8F] hover:bg-[#F7F7F7] hover:text-[#3D3D3D]"
                }`}
              >
                {selected === cat.id && (
                  <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-[#87DE81]" />
                )}
                <span className="text-base">{cat.emoji}</span>
                <span className="text-[13px] font-medium">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Script content */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
          <h2 className="text-[16px] font-semibold text-[#3D3D3D] mb-5">{script.title}</h2>

          <div className="space-y-3 mb-6">
            {script.steps.map((step, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-[#87DE81]/20 flex items-center justify-center text-[#3D9B3A] text-[11px] font-bold shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1 bg-[#F7F7F7] rounded-xl px-4 py-3">
                  <p className="text-[13px] text-[#3D3D3D] leading-relaxed">{step}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-3 bg-[#022EE8]/8 border border-[#022EE8]/20 rounded-xl px-4 py-3">
            <span className="text-base shrink-0 mt-0.5">💡</span>
            <div>
              <p className="text-[11px] font-semibold text-[#0E8FA8] mb-0.5 uppercase tracking-wide">Tips</p>
              <p className="text-[13px] text-[#3D3D3D]">{script.tip}</p>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-[#E8E8E8]">
            <p className="text-[11px] text-[#8B8E8F] mb-2.5 uppercase tracking-wider font-semibold">ข้อความด่วน</p>
            <div className="flex flex-wrap gap-2">
              {["คัดลอกทั้งหมด", "ส่งใน LINE", "บันทึกเป็น Note"].map((btn) => (
                <button
                  key={btn}
                  className="text-[12px] bg-[#F7F7F7] text-[#3D3D3D] px-3 py-1.5 rounded-lg hover:bg-[#E8E8E8] transition-colors"
                >
                  {btn}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AI Chat */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#E8E8E8]">
          <div className="w-5 h-5 rounded-md bg-[#87DE81] flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span className="text-[13px] font-semibold text-[#3D3D3D]">AI Script Chat</span>
          <span className="text-[11px] text-[#8B8E8F] ml-1">— ถามสถานการณ์ที่ไม่มีในรายการ</span>
        </div>

        {/* Messages */}
        <div className="h-64 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {messages.length === 0 && (
            <p className="text-[12px] text-[#C0C0C0] text-center mt-8">
              พิมพ์สถานการณ์ที่เจอ เช่น &quot;ลูกค้าบอกว่าแพงเกินไป จะรับมือยังไง?&quot;
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-[#87DE81] text-[#3D3D3D] rounded-br-sm"
                    : "bg-[#F7F7F7] text-[#3D3D3D] rounded-bl-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#F7F7F7] px-4 py-2.5 rounded-2xl rounded-bl-sm">
                <span className="text-[#8B8E8F] text-[12px]">กำลังคิด...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="px-5 py-3 border-t border-[#E8E8E8] flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="พิมพ์สถานการณ์ที่เจอ..."
            className="flex-1 bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-[#87DE81] text-[#3D3D3D] px-4 py-2.5 rounded-lg text-[13px] font-medium hover:bg-[#6FCE69] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ส่ง
          </button>
        </div>
      </div>
    </div>
  );
}
