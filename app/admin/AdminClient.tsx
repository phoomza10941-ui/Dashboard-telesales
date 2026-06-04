"use client";
import { useState, useCallback } from "react";

const inputCls =
  "w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors";

interface User {
  id: string;
  nickname: string;
  full_name: string;
  role: "agent" | "supervisor";
  team: string;
  agent_code: string;
  banned: boolean;
}

function CreateUserModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ fullName: "", nickname: "", username: "", password: "", team: "", role: "agent" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) { setError("Password ต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    setLoading(true);
    const res = await fetch("/api/admin/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) { onDone(); onClose(); }
    else { const d = await res.json(); setError(d.error ?? "เกิดข้อผิดพลาด"); }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 w-full max-w-sm shadow-lg">
        <h3 className="text-[14px] font-semibold text-[#3D3D3D] mb-1">สร้างผู้ใช้ใหม่</h3>
        <p className="text-[12px] text-[#8B8E8F] mb-4">กรอกข้อมูลสำหรับบัญชีใหม่</p>
        {error && <p className="text-[12px] text-red-600 mb-3 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-[#8B8E8F] mb-1 uppercase tracking-wide">ชื่อ-สกุล *</label>
            <input type="text" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="สมชาย ใจดี" className={inputCls} required autoFocus />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#8B8E8F] mb-1 uppercase tracking-wide">Nickname *</label>
            <input type="text" value={form.nickname} onChange={(e) => set("nickname", e.target.value.toLowerCase().replace(/\s/g, ""))} placeholder="somchai" className={inputCls} required />
            {form.nickname && <p className="text-[11px] text-[#8B8E8F] mt-1">Agent Code: tele-{form.nickname}</p>}
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#8B8E8F] mb-1 uppercase tracking-wide">Username *</label>
            <input type="text" value={form.username} onChange={(e) => set("username", e.target.value.toLowerCase().replace(/\s/g, ""))} placeholder="somchai42" className={inputCls} required />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#8B8E8F] mb-1 uppercase tracking-wide">Password *</label>
            <input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร" className={inputCls} required />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#8B8E8F] mb-1 uppercase tracking-wide">ทีม</label>
            <input type="text" value={form.team} onChange={(e) => set("team", e.target.value)} placeholder="Team Alpha (ไม่บังคับ)" className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#8B8E8F] mb-1 uppercase tracking-wide">Role</label>
            <select value={form.role} onChange={(e) => set("role", e.target.value)} className={inputCls}>
              <option value="agent">Agent</option>
              <option value="supervisor">Supervisor</option>
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-[#E8E8E8] text-[#8B8E8F] text-[13px] py-2 rounded-lg hover:bg-[#F7F7F7] transition-colors">
              ยกเลิก
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-[#87DE81] hover:bg-[#6BC965] disabled:opacity-60 text-white text-[13px] font-semibold py-2 rounded-lg transition-colors">
              {loading ? "กำลังสร้าง..." : "สร้างบัญชี"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose, onDone }: { user: User; onClose: () => void; onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pw.length < 6) { setError("Password ต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    setLoading(true);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset-password", value: pw }),
    });
    setLoading(false);
    if (res.ok) { onDone(); onClose(); }
    else { const d = await res.json(); setError(d.error ?? "เกิดข้อผิดพลาด"); }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 w-full max-w-sm shadow-lg">
        <h3 className="text-[14px] font-semibold text-[#3D3D3D] mb-1">Reset Password</h3>
        <p className="text-[12px] text-[#8B8E8F] mb-4">สำหรับ <span className="font-semibold text-[#3D3D3D]">{user.nickname}</span></p>
        {error && <p className="text-[12px] text-red-600 mb-3 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <form onSubmit={submit} className="space-y-3">
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password ใหม่ (อย่างน้อย 6 ตัวอักษร)" className={inputCls} autoFocus />
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-[#E8E8E8] text-[#8B8E8F] text-[13px] py-2 rounded-lg hover:bg-[#F7F7F7] transition-colors">
              ยกเลิก
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-[#87DE81] hover:bg-[#6BC965] disabled:opacity-60 text-white text-[13px] font-semibold py-2 rounded-lg transition-colors">
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserRow({ user, onRefresh }: { user: User; onRefresh: () => void }) {
  const [showReset, setShowReset] = useState(false);
  const [acting, setActing] = useState(false);

  async function changeRole() {
    if (!confirm(`เปลี่ยน ${user.nickname} เป็น ${user.role === "agent" ? "supervisor" : "agent"}?`)) return;
    setActing(true);
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "change-role", value: user.role === "agent" ? "supervisor" : "agent" }),
    });
    setActing(false);
    onRefresh();
  }

  async function toggleBan() {
    const action = user.banned ? "reactivate" : "deactivate";
    const label = user.banned ? "เปิดใช้งาน" : "ปิดใช้งาน";
    if (!confirm(`${label} บัญชี ${user.nickname}?`)) return;
    setActing(true);
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setActing(false);
    onRefresh();
  }

  const roleBadge = user.role === "supervisor"
    ? "bg-[#58CEE8]/20 text-[#1A8FAA]"
    : "bg-[#87DE81]/20 text-[#3D9B3A]";

  return (
    <>
      {showReset && <ResetPasswordModal user={user} onClose={() => setShowReset(false)} onDone={onRefresh} />}
      <div className={`flex items-center gap-3 px-5 py-3.5 ${user.banned ? "opacity-50" : ""}`}>
        <div className="w-8 h-8 rounded-full bg-[#F7F7F7] border border-[#E8E8E8] flex items-center justify-center text-[12px] font-bold text-[#8B8E8F] shrink-0">
          {user.nickname.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-[#3D3D3D]">{user.nickname}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${roleBadge}`}>{user.role}</span>
            {user.banned && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-500">banned</span>}
          </div>
          <div className="text-[11px] text-[#8B8E8F] truncate">{user.full_name}{user.team ? ` · ${user.team}` : ""}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => setShowReset(true)} disabled={acting} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[#F7F7F7] hover:bg-[#E8E8E8] text-[#3D3D3D] transition-colors disabled:opacity-50">
            Reset PW
          </button>
          <button onClick={changeRole} disabled={acting} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[#F7F7F7] hover:bg-[#E8E8E8] text-[#3D3D3D] transition-colors disabled:opacity-50">
            {user.role === "agent" ? "→ Supervisor" : "→ Agent"}
          </button>
          <button onClick={toggleBan} disabled={acting} className={`text-[11px] px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${user.banned ? "bg-[#87DE81]/20 hover:bg-[#87DE81]/40 text-[#3D9B3A]" : "bg-red-50 hover:bg-red-100 text-red-500"}`}>
            {user.banned ? "Reactivate" : "Deactivate"}
          </button>
        </div>
      </div>
    </>
  );
}

export default function AdminClient({ initialUsers }: { initialUsers: User[] }) {
  const [tab, setTab] = useState<"users" | "system">("users");
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const d = await res.json();
      setUsers(d.users);
    }
    setRefreshing(false);
  }, []);

  const tabs = [
    { key: "users" as const, label: "Manage Users" },
    { key: "system" as const, label: "System Settings" },
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F7] p-6">
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onDone={refresh} />}

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#3D3D3D] flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-[16px] font-bold text-[#3D3D3D]">Admin Panel</h1>
            <p className="text-[12px] text-[#8B8E8F]">จัดการระบบและผู้ใช้งาน</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-[#E8E8E8] rounded-xl p-1 mb-5 w-fit">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                tab === t.key ? "bg-[#3D3D3D] text-white" : "text-[#8B8E8F] hover:text-[#3D3D3D]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "users" && (
          <div className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E8E8]">
              <div>
                <div className="text-[14px] font-semibold text-[#3D3D3D]">All Users</div>
                <div className="text-[11px] text-[#8B8E8F] mt-0.5">{users.length} accounts</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={refresh}
                  disabled={refreshing}
                  className="text-[12px] text-[#8B8E8F] hover:text-[#3D3D3D] flex items-center gap-1.5 transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={refreshing ? "animate-spin" : ""}>
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                    <path d="M8 16H3v5"/>
                  </svg>
                  Refresh
                </button>
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-1.5 bg-[#87DE81] hover:bg-[#6BC965] text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  New User
                </button>
              </div>
            </div>
            <div className="divide-y divide-[#F7F7F7]">
              {users.length === 0 ? (
                <p className="px-5 py-4 text-[12px] text-[#8B8E8F]">ไม่มีผู้ใช้ในระบบ</p>
              ) : (
                users.map((u) => <UserRow key={u.id} user={u} onRefresh={refresh} />)
              )}
            </div>
          </div>
        )}

        {tab === "system" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5">
              <div className="text-[14px] font-semibold text-[#3D3D3D] mb-1">Supervisor Settings</div>
              <p className="text-[12px] text-[#8B8E8F] mb-4">ตั้งค่าเป้าหมาย, สินค้า, Oreka mapping และอื่นๆ</p>
              <a href="/supervisor/settings" className="inline-flex items-center gap-2 text-[13px] font-medium text-white bg-[#3D3D3D] hover:bg-[#2D2D2D] px-4 py-2 rounded-lg transition-colors">
                ไปที่ Supervisor Settings
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>
            </div>

            <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5">
              <div className="text-[14px] font-semibold text-[#3D3D3D] mb-3">Quick Links</div>
              <div className="space-y-2">
                {[
                  { href: "/war-room", label: "War Room" },
                  { href: "/supervisor/team-performance", label: "Team Performance" },
                  { href: "/supervisor/talk-time", label: "Talk Time" },
                  { href: "/my-desk/today-command", label: "My Desk" },
                ].map((link) => (
                  <a key={link.href} href={link.href} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#F7F7F7] hover:bg-[#E8E8E8] transition-colors group">
                    <span className="text-[13px] text-[#3D3D3D]">{link.label}</span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8B8E8F" strokeWidth="2" className="group-hover:stroke-[#3D3D3D] transition-colors"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
