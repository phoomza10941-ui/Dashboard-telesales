"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useTransition } from "react";
import { updateNickname, updateAvatarUrl } from "@/app/actions/profile";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "OVERVIEW",
    items: [
      {
        href: "/supervisor/team-performance",
        label: "ผลงานทีม",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        ),
      },
      {
        href: "/supervisor/talk-time",
        label: "Talk Time",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        ),
      },
    ],
  },
  {
    label: "ANALYSIS",
    items: [
      {
        href: "/supervisor/funnel-diagnosis",
        label: "วิเคราะห์ Funnel",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
        ),
      },
      {
        href: "/supervisor/hot-cases",
        label: "เคสร้อน",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
          </svg>
        ),
      },
      {
        href: "/supervisor/drop-off-risk",
        label: "เสี่ยงหลุด",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        ),
      },
      {
        href: "/supervisor/follow-up-compliance",
        label: "ติดตาม Follow-up",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
        ),
      },
      {
        href: "/supervisor/objection-by-person",
        label: "ข้อโต้แย้งรายคน",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        ),
      },
    ],
  },
  {
    label: "REPORTS",
    items: [
      {
        href: "/supervisor/report",
        label: "รายงาน",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        ),
      },
      {
        href: "/supervisor/lead-quality",
        label: "คุณภาพ Lead",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        ),
      },
    ],
  },
  {
    label: "TOOLS",
    items: [
      {
        href: "/supervisor/ai-coaching",
        label: "AI Coaching",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
        ),
      },
      {
        href: "/supervisor/script-recommendation",
        label: "แนะนำ Script",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
        ),
      },
      {
        href: "/supervisor/coaching-log",
        label: "บันทึก Coaching",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        ),
      },
    ],
  },
  {
    label: "CONFIG",
    items: [
      {
        href: "/supervisor/settings",
        label: "ตั้งค่า",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        ),
      },
    ],
  },
];

interface SupervisorNavProps {
  fullName?: string;
  avatarUrl?: string;
  nickname?: string;
}

export default function SupervisorNav({ fullName = "Supervisor", avatarUrl = "", nickname = "" }: SupervisorNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(avatarUrl);
  const [nicknameVal, setNicknameVal] = useState(nickname);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = fullName.split(" ").slice(0, 2).map((w) => w.charAt(0)).join("") || "S";

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) {
        setPreviewUrl(data.url);
        startTransition(() => { updateAvatarUrl(data.url); });
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
    <aside className="relative w-[220px] shrink-0 flex flex-col border-r border-[#E8E8E8] bg-white h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#E8E8E8] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#022EE8] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[#3D3D3D] leading-none">Supervisor</div>
            <div className="text-[10px] text-[#8B8E8F] mt-0.5">แดชบอร์ดทีม</div>
          </div>
        </div>
      </div>

      {/* Profile — clickable to open overlay */}
      <button
        onClick={() => setProfileOpen((v) => !v)}
        className="px-5 py-3.5 border-b border-[#E8E8E8] text-left hover:bg-[#F7F7F7] transition-colors group w-full shrink-0"
      >
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            {previewUrl ? (
              <img src={previewUrl} alt={fullName} className="w-8 h-8 rounded-full object-cover" />
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
            <div className="text-[10px] text-[#8B8E8F] truncate">มุมมอง Supervisor</div>
          </div>
          <svg
            className={`shrink-0 text-[#8B8E8F] transition-transform ${profileOpen ? "rotate-90" : ""}`}
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </button>

      {/* Profile overlay panel */}
      {profileOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
          <div className="absolute left-full top-0 w-[260px] bg-white border border-[#E8E8E8] shadow-xl rounded-r-xl z-50 max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E8E8]">
              <span className="text-[12px] font-semibold text-[#3D3D3D]">โปรไฟล์ Supervisor</span>
              <button
                onClick={() => setProfileOpen(false)}
                className="w-6 h-6 rounded-full hover:bg-[#F7F7F7] flex items-center justify-center transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="flex flex-col items-center gap-2">
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="relative group">
                  {previewUrl ? (
                    <img src={previewUrl} alt={fullName} className="w-16 h-16 rounded-full object-cover ring-2 ring-[#E8E8E8]" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[#022EE8]/20 flex items-center justify-center text-[#022EE8] text-xl font-bold ring-2 ring-[#E8E8E8]">
                      {initials}
                    </div>
                  )}
                  <span className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                    {uploading ? (
                      <svg className="animate-spin text-white" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" strokeOpacity=".25" /><path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                    ) : (
                      <svg className="opacity-0 group-hover:opacity-100 transition-opacity text-white" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                      </svg>
                    )}
                  </span>
                </button>
                <span className="text-[10px] text-[#8B8E8F]">คลิกเพื่อเปลี่ยนรูป</span>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-[#8B8E8F] font-medium uppercase tracking-wide">ชื่อที่แสดง</label>
                <input
                  type="text"
                  value={nicknameVal}
                  onChange={(e) => setNicknameVal(e.target.value)}
                  className="w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#022EE8] transition-colors"
                  placeholder="ชื่อเล่น"
                />
              </div>

              <button
                onClick={handleSaveNickname}
                disabled={saving || !nicknameVal.trim()}
                className="w-full bg-[#022EE8] hover:bg-[#0124c7] disabled:opacity-50 text-white text-[13px] font-medium py-2 rounded-lg transition-colors"
              >
                {saving ? "กำลังบันทึก…" : "บันทึก"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Grouped navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="px-4 pt-3 pb-1.5">
              <span className="text-[9px] uppercase tracking-widest text-[#C0C0C0]">{group.label}</span>
            </div>
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-3 px-5 py-2.5 text-[12px] transition-colors group ${
                    isActive
                      ? "text-[#3D3D3D] bg-[#022EE8]/8 font-medium"
                      : "text-[#8B8E8F] hover:text-[#3D3D3D] hover:bg-[#F7F7F7]"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-[#022EE8]" />
                  )}
                  <span className={isActive ? "text-[#022EE8]" : "text-[#8B8E8F] group-hover:text-[#3D3D3D] transition-colors"}>
                    {item.icon}
                  </span>
                  <span className="leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[#E8E8E8] space-y-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#87DE81] animate-pulse" />
          <span className="text-[11px] text-[#8B8E8F]">ออนไลน์</span>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 text-[12px] text-[#8B8E8F] hover:text-[#FF6B6B] hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          ออกจากระบบ
        </button>
      </div>
    </aside>
  );
}
