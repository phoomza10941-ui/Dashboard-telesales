import type { SaleRow } from "@/lib/db";

export type Channel = "gosell" | "hopeful";
export type View = "overall" | "gosell" | "hopeful";

export interface CustomerGroup {
  key: string;
  name: string;
  phone: string;
  address: string;
  purchases: SaleRow[];
  totalValue: number;
  isReturning: boolean;
  channels: Channel[]; // which product lines this customer has (explicit + inferred)
}

export const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  closed:           { label: "โอนแล้ว",        color: "#3D9B3A" },
  pending_transfer: { label: "รอโอน",          color: "#C48A00" },
  follow_up:        { label: "ติดตาม",         color: "#0E8FA8" },
  in_progress:      { label: "กำลังดำเนินการ", color: "#7B5EA7" },
  lost:             { label: "หลุด",           color: "#CC3333" },
};

export type { SaleRow };
