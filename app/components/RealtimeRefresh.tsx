"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const POLL_MS = 20_000;

export default function RealtimeRefresh({ tables = ["sales"] }: { tables?: string[] }) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    const supabase = createClient();
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const refresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => routerRef.current.refresh(), 300);
    };

    // ── 1. Broadcast channel (instant, bypasses RLS) ───────────────────────
    //    fires when AddCustomerForm saves a sale
    const broadcastCh = supabase
      .channel("sales-update")
      .on("broadcast", { event: "sale_added" }, refresh)
      .subscribe();

    // ── 2. postgres_changes (fires when RLS allows) ────────────────────────
    const pgChannels = tables.map((table) =>
      supabase
        .channel(`rt-${table}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, refresh)
        .subscribe()
    );

    // ── 3. Polling fallback — catches anything missed above ────────────────
    const pollId = setInterval(refresh, POLL_MS);

    return () => {
      clearInterval(pollId);
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(broadcastCh);
      pgChannels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, []);

  return null;
}
