import type { SaleRow } from "@/lib/db";
import type { Channel, CustomerGroup, View } from "./types";

export function rowTotal(r: SaleRow): number {
  return r.phoneClose + r.upsell + r.crm + r.hopefulPhoneClose + r.hopefulCrm + r.hopefulUpsell;
}

export function rowViewTotal(r: SaleRow, view: View): number {
  if (view === "gosell")  return r.phoneClose + r.upsell + r.crm;
  if (view === "hopeful") return r.hopefulPhoneClose + r.hopefulCrm + r.hopefulUpsell;
  return rowTotal(r);
}

export function parseStatus(note: string): string {
  const n = note.toLowerCase();
  if (n.includes("โอนแล้ว")) return "closed";
  if (n.includes("รอโอน") || n.includes("รอสลิป")) return "pending_transfer";
  if (n.includes("ติดตาม") || n.includes("นัด")) return "follow_up";
  if (n.includes("หลุด")) return "lost";
  return "in_progress";
}

// Channels a row belongs to: explicit `channel` (set at contact creation) plus any
// inferred from non-zero amount buckets (legacy rows have no explicit channel).
export function rowChannels(r: SaleRow): Channel[] {
  const set = new Set<Channel>();
  if (r.channel === "gosell" || r.channel === "hopeful") set.add(r.channel);
  if (r.phoneClose + r.upsell + r.crm > 0) set.add("gosell");
  if (r.hopefulPhoneClose + r.hopefulCrm + r.hopefulUpsell > 0) set.add("hopeful");
  return [...set];
}

// Group sale rows into customer cards (by phone, falling back to name).
// In gosell/hopeful views, rows with no amount in that channel are excluded.
export function groupRows(rows: SaleRow[], view: View): CustomerGroup[] {
  const map = new Map<string, CustomerGroup>();
  const chans = new Map<string, Set<Channel>>();

  for (const r of rows) {
    if (view === "gosell"  && r.phoneClose + r.upsell + r.crm <= 0) continue;
    if (view === "hopeful" && r.hopefulPhoneClose + r.hopefulCrm + r.hopefulUpsell <= 0) continue;

    const key = r.phone?.trim() || r.name;
    if (!map.has(key)) {
      map.set(key, {
        key, name: r.name, phone: r.phone ?? "",
        address: r.address ?? "", purchases: [], totalValue: 0,
        isReturning: false, channels: [],
      });
      chans.set(key, new Set());
    }
    const g = map.get(key)!;
    g.purchases.push(r);
    g.totalValue += rowViewTotal(r, view);
    if (r.address && !g.address) g.address = r.address;
    for (const c of rowChannels(r)) chans.get(key)!.add(c);
  }

  for (const [key, g] of map) {
    g.isReturning = g.purchases.length > 1;
    g.channels = [...chans.get(key)!];
  }
  return [...map.values()];
}
