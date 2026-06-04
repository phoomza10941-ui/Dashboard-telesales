"use client";

interface UserBadgeProps {
  fullName: string;
  agentCode: string;
  team: string;
  avatarUrl?: string;
}

export default function UserBadge({ fullName, agentCode, team, avatarUrl }: UserBadgeProps) {
  const initials = fullName
    .split(" ")
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("");

  return (
    <div className="flex items-center gap-2.5">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={fullName}
          className="w-8 h-8 rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-[#022EE8]/20 flex items-center justify-center text-[#022EE8] text-xs font-bold shrink-0">
          {initials || "?"}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-[#3D3D3D] truncate">{fullName || "—"}</div>
        <div className="text-[10px] text-[#8B8E8F] truncate">
          {agentCode || "—"}{team ? ` · ${team}` : ""}
        </div>
      </div>
    </div>
  );
}
