"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputCls =
  "w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setStatus("loading");

    const supabase = createClient();

    // Sign in via browser client to get tokens
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: `${username.toLowerCase().trim()}@telesales.internal`,
      password,
    });

    if (signInError || !data.session) {
      setError("Username หรือ Password ไม่ถูกต้อง");
      setStatus("error");
      return;
    }

    // Send tokens to server so it can store the session as proper cookies
    const res = await fetch("/api/auth/set-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      }),
    });

    if (!res.ok) {
      setError("เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
      setStatus("error");
      return;
    }

    const { role } = await res.json();
    router.push(role === "supervisor" ? "/supervisor/team-performance" : "/my-desk/today-command");
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        <div className="bg-white rounded-2xl shadow-sm border border-[#E8E8E8] p-8">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-[#87DE81] flex items-center justify-center mb-3 shadow-sm">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <h1 className="text-[18px] font-bold text-[#3D3D3D]">Dashboard for Telesales</h1>
            <p className="text-[12px] text-[#8B8E8F] mt-0.5">My Desk</p>
          </div>

          <h2 className="text-[15px] font-semibold text-[#3D3D3D] mb-1">เข้าสู่ระบบ</h2>
          <p className="text-[12px] text-[#8B8E8F] mb-6">ใส่ Username และ Password ของคุณ</p>

          {status === "error" && error && (
            <div className="mb-4 flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-[12px] text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-[#8B8E8F] mb-1.5 uppercase tracking-wide">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                placeholder="your_username"
                className={inputCls}
                autoComplete="username"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#8B8E8F] mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputCls}
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-[13px] py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 mt-2 bg-[#87DE81] hover:bg-[#6BC965]"
            >
              {status === "loading" ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                  </svg>
                  กำลังเข้าสู่ระบบ...
                </>
              ) : (
                "เข้าสู่ระบบ"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-[#C0C0C0] mt-6">
          © 2026 Telesales Dashboard · Powered by My Desk
        </p>
      </div>
    </div>
  );
}
