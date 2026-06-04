"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function LiveClock() {
  const [hhmm, setHhmm] = useState("");
  const [ss, setSs] = useState("");
  const [colonVisible, setColonVisible] = useState(true);

  useEffect(() => {
    function tick() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      const s = String(now.getSeconds()).padStart(2, "0");
      setHhmm(`${h}:${m}`);
      setSs(s);
      setColonVisible((v) => !v);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-baseline gap-0.5 tabular-nums">
      <span className="text-[26px] font-black text-[#000000] leading-none">{hhmm}</span>
      <motion.span
        className="text-[16px] font-bold text-[#646768]"
        animate={{ opacity: colonVisible ? 1 : 0 }}
        transition={{ duration: 0.15 }}
      >
        :
      </motion.span>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={ss}
          className="text-[16px] font-bold text-[#646768] leading-none"
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 8, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {ss}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
