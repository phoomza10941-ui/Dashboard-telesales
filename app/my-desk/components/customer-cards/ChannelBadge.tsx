import type { Channel } from "./types";

const META: Record<Channel, { label: string; text: string; tint: string; border: string }> = {
  gosell:  { label: "GoSell",  text: "#3D9B3A", tint: "#87DE81", border: "#87DE81" },
  hopeful: { label: "Hopeful", text: "#0E8FA8", tint: "#022EE8", border: "#022EE8" },
};

// One or two small pills showing the customer's product line(s).
export function ChannelBadge({ channels }: { channels: Channel[] }) {
  if (!channels.length) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {channels.map((c) => {
        const m = META[c];
        return (
          <span
            key={c}
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
            style={{ color: m.text, backgroundColor: `${m.tint}1A`, border: `1px solid ${m.border}33` }}
          >
            {m.label}
          </span>
        );
      })}
    </span>
  );
}
