import { getTalkTimeByAgentSafe } from "@/lib/oreka";
import { getOrekaLabels } from "@/lib/db";
import TalkTimeClient from "./TalkTimeClient";

export const dynamic = "force-dynamic";

function thaiKeys() {
  const now = new Date();
  const thai = new Date(now.getTime() + 7 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateKey = `${thai.getUTCFullYear()}-${pad(thai.getUTCMonth() + 1)}-${pad(thai.getUTCDate())}`;
  const monthKey = `${thai.getUTCFullYear()}-${pad(thai.getUTCMonth() + 1)}`;
  return { dateKey, monthKey };
}

export default async function TalkTimePage() {
  const { dateKey, monthKey } = thaiKeys();
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
