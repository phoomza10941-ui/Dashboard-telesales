import { getTalkTimeByAgentSafe } from "@/lib/oreka";
import { thaiTodayKey, thaiMonthKey } from "@/lib/oreka-format";
import { getOrekaLabels } from "@/lib/db";
import TalkTimeClient from "./TalkTimeClient";

export const dynamic = "force-dynamic";

export default async function TalkTimePage() {
  const dateKey = thaiTodayKey();
  const monthKey = thaiMonthKey();
  const [{ data: agents, error }, labels] = await Promise.all([
    getTalkTimeByAgentSafe(),
    getOrekaLabels(),
  ]);
  return (
    <TalkTimeClient
      agents={agents}
      error={error}
      todayKey={dateKey}
      currentMonthKey={monthKey}
      initialLabels={labels}
    />
  );
}
