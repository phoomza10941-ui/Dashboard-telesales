"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useTransition, useEffect } from "react";
import { updateNickname, updateAvatarUrl, saveMyOrekaExt } from "@/app/actions/profile";

const navItems = [
  {
    href: "/my-desk/today-command",
    label: "Today Command",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    href: "/my-desk/customers-list",
    label: "Customers List",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <polyline points="16 11 18 13 22 9" />
      </svg>
    ),
  },
  {
    href: "/my-desk/priority-queue",
    label: "Priority Queue",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
  {
    href: "/my-desk/pending-payment",
    label: "Pending Payment",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    href: "/my-desk/follow-up",
    label: "Follow-up",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    href: "/my-desk/canceled",
    label: "Canceled",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
  {
    href: "/my-desk/lead-inbox",
    label: "Lead Inbox",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
    ),
  },
  {
    href: "/my-desk/add-customer",
    label: "Add Customer",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  {
    href: "/my-desk/script-helper",
    label: "Script Helper",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    href: "/my-desk/my-performance",
    label: "My Performance",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    href: "/my-desk/coaching",
    label: "Coaching",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

interface SideNavProps {
  fullName?: string;
  agentCode?: string;
  team?: string;
  avatarUrl?: string;
  nickname?: string;
  orekaExtGosell?: string;
  orekaExtHopeful?: string;
}

export default function SideNav({
  fullName = "—", agentCode = "—", team = "",
  avatarUrl = "", nickname = "",
  orekaExtGosell = "", orekaExtHopeful = "",
}: SideNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(avatarUrl);
  const [nicknameVal, setNicknameVal] = useState(nickname);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phone number (Oreka) state
  const [gosellExt, setGosellExt] = useState(orekaExtGosell);
  const [hopefulExt, setHopefulExt] = useState(orekaExtHopeful);
  const [extSaving, setExtSaving] = useState(false);
  const [extSaved, setExtSaved] = useState(false);
  const [extError, setExtError] = useState("");
  const [extOptions, setExtOptions] = useState<{ gosell: { ext: string; name: string }[]; hopeful: { ext: string; name: string }[] } | null>(null);
  const [extLoading, setExtLoading] = useState(false);

  useEffect(() => {
    if (!profileOpen || extOptions !== null) return;
    setExtLoading(true);
    fetch("/api/oreka-numbers")
      .then(r => r.json())
      .then(d => setExtOptions(d))
      .catch(() => setExtOptions({ gosell: [], hopeful: [] }))
      .finally(() => setExtLoading(false));
  }, [profileOpen, extOptions]);

  async function handleSaveExt() {
    setExtSaving(true);
    setExtSaved(false);
    setExtError("");
    try {
      await saveMyOrekaExt(gosellExt, hopefulExt);
      setExtSaved(true);
      router.refresh();
      setTimeout(() => setExtSaved(false), 3000);
    } catch (err) {
      setExtError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setExtSaving(false);
    }
  }

  const initials = fullName
    .split(" ")
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("") || "?";

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setUploading(true);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) {
        setPreviewUrl(data.url);
        startTransition(() => {
          updateAvatarUrl(data.url);
        });
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveNickname() {
    setSaving(true);
    try {
      await updateNickname(nicknameVal);
    } finally {
      setSaving(false);
      setProfileOpen(false);
      router.refresh();
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-[220px] shrink-0 flex flex-col border-r border-[#E8E8E8] bg-white h-full">
      {/* Logo area */}
      <div className="px-5 py-5 border-b border-[#E8E8E8]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#87DE81] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[#3D3D3D] leading-none">My Desk</div>
            <div className="text-[10px] text-[#8B8E8F] mt-0.5">Telesales Dashboard</div>
          </div>
        </div>
      </div>

      {/* Agent info — clickable to open profile panel */}
      <button
        onClick={() => setProfileOpen((v) => !v)}
        className="px-5 py-3.5 border-b border-[#E8E8E8] text-left hover:bg-[#F7F7F7] transition-colors group w-full"
      >
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={fullName}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#022EE8]/20 flex items-center justify-center text-[#022EE8] text-xs font-bold">
                {initials}
              </div>
            )}
            <span className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <svg className="opacity-0 group-hover:opacity-70 transition-opacity" width="10" height="10" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-[#3D3D3D] truncate">{fullName}</div>
            <div className="text-[10px] text-[#8B8E8F] truncate">{agentCode}{team ? ` · ${team}` : ""}</div>
          </div>
          <svg
            className={`shrink-0 text-[#8B8E8F] transition-transform ${profileOpen ? "rotate-180" : ""}`}
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Profile panel */}
      {profileOpen && (
        <div className="border-b border-[#E8E8E8] bg-[#F7F7F7] px-5 py-4 space-y-3">
          {/* Avatar upload */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="relative group"
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={fullName}
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-[#E8E8E8]"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#022EE8]/20 flex items-center justify-center text-[#022EE8] text-lg font-bold ring-2 ring-[#E8E8E8]">
                  {initials}
                </div>
              )}
              <span className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                {uploading ? (
                  <svg className="animate-spin text-white" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity=".25" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                ) : (
                  <svg className="opacity-0 group-hover:opacity-100 transition-opacity text-white" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                )}
              </span>
            </button>
            <span className="text-[10px] text-[#8B8E8F]">คลิกเพื่อเปลี่ยนรูป</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Nickname field */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-[#8B8E8F] font-medium uppercase tracking-wide">ชื่อที่แสดง</label>
            <input
              type="text"
              value={nicknameVal}
              onChange={(e) => setNicknameVal(e.target.value)}
              className="w-full bg-white border border-[#E8E8E8] rounded-lg px-3 py-2 text-[12px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] transition-colors"
              placeholder="ชื่อเล่น"
            />
          </div>

          <button
            onClick={handleSaveNickname}
            disabled={saving || !nicknameVal.trim()}
            className="w-full bg-[#87DE81] hover:bg-[#76cc70] disabled:opacity-50 text-[#3D3D3D] text-[12px] font-medium py-2 rounded-lg transition-colors"
          >
            {saving ? "กำลังบันทึก…" : "บันทึกชื่อ"}
          </button>

          {/* Oreka ext */}
          <div className="border-t border-[#E8E8E8] pt-3">
            <div className="flex items-center gap-1.5 mb-2">
              <svg className="w-3 h-3 text-[#8B8E8F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.72a16 16 0 0 0 6 6l.86-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span className="text-[10px] text-[#8B8E8F] font-medium uppercase tracking-wide">เบอร์ dtac ของฉัน</span>
            </div>

            {extLoading ? (
              <p className="text-[10px] text-[#C0C0C0] text-center py-2 animate-pulse">กำลังดึงเบอร์จาก Oreka…</p>
            ) : (
              <div className="space-y-2">
                <div>
                  <label className="text-[9px] text-amber-600 font-semibold uppercase tracking-wide mb-0.5 block">Gosell</label>
                  <select
                    value={gosellExt}
                    onChange={e => setGosellExt(e.target.value)}
                    className="w-full bg-white border border-[#E8E8E8] rounded-lg px-2 py-1.5 text-[11px] text-[#3D3D3D] focus:outline-none focus:border-[#87DE81] transition-colors"
                  >
                    <option value="">— ไม่มี / ยังไม่ได้เลือก —</option>
                    {(extOptions?.gosell ?? []).map(o => (
                      <option key={o.ext} value={o.ext}>{o.ext}{o.name && o.name !== o.ext ? ` (${o.name})` : ""}</option>
                    ))}
                    {gosellExt && !(extOptions?.gosell ?? []).find(o => o.ext === gosellExt) && (
                      <option value={gosellExt}>{gosellExt} (ปัจจุบัน)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] text-purple-600 font-semibold uppercase tracking-wide mb-0.5 block">Hopeful</label>
                  <select
                    value={hopefulExt}
                    onChange={e => setHopefulExt(e.target.value)}
                    className="w-full bg-white border border-[#E8E8E8] rounded-lg px-2 py-1.5 text-[11px] text-[#3D3D3D] focus:outline-none focus:border-[#87DE81] transition-colors"
                  >
                    <option value="">— ไม่มี / ยังไม่ได้เลือก —</option>
                    {(extOptions?.hopeful ?? []).map(o => (
                      <option key={o.ext} value={o.ext}>{o.ext}{o.name && o.name !== o.ext ? ` (${o.name})` : ""}</option>
                    ))}
                    {hopefulExt && !(extOptions?.hopeful ?? []).find(o => o.ext === hopefulExt) && (
                      <option value={hopefulExt}>{hopefulExt} (ปัจจุบัน)</option>
                    )}
                  </select>
                </div>

                <button
                  onClick={handleSaveExt}
                  disabled={extSaving}
                  className="w-full bg-[#58CEE8] hover:bg-[#3DB8D4] disabled:opacity-50 text-white text-[11px] font-medium py-1.5 rounded-lg transition-colors"
                >
                  {extSaving ? "กำลังบันทึก…" : extSaved ? "✓ บันทึกแล้ว" : "บันทึกเบอร์"}
                </button>
                {extError && (
                  <p className="text-[10px] text-red-500 text-center">{extError}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 px-5 py-2.5 text-[13px] transition-colors group ${isActive
                ? "text-[#3D3D3D] bg-[#87DE81]/8 font-medium"
                : "text-[#8B8E8F] hover:text-[#3D3D3D] hover:bg-[#F7F7F7]"
                }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-[#87DE81]" />
              )}
              <span className={isActive ? "text-[#87DE81]" : "text-[#8B8E8F] group-hover:text-[#3D3D3D]"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Status indicator + logout */}
      <div className="px-5 py-4 border-t border-[#E8E8E8] space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#87DE81] animate-pulse" />
          <span className="text-[11px] text-[#8B8E8F]">Online</span>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 text-[12px] text-[#8B8E8F] hover:text-[#FF6B6B] hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          ออกจากระบบ
        </button>
      </div>
    </aside>
  );
}
