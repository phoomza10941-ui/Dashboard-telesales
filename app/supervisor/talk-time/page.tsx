import { getTalkTimeByAgentSafe } from "@/lib/oreka";
import { thaiTodayKey, thaiMonthKey } from "@/lib/oreka-format";
import { getOrekaLabels, getClosedOrekaExts, getOrekaTeamOverrides } from "@/lib/db";
import TalkTimeClient from "./TalkTimeClient";

export const dynamic = "force-dynamic";

export default async function TalkTimePage() {
  const dateKey = thaiTodayKey();
  const monthKey = thaiMonthKey();
  const [{ data: agents, error }, labels, closed, teamOverrides] = await Promise.all([
    getTalkTimeByAgentSafe(),
    getOrekaLabels(),
    getClosedOrekaExts(),
    getOrekaTeamOverrides(),
  ]);
  return (
    <TalkTimeClient
      agents={agents}
      error={error}
      todayKey={dateKey}
      currentMonthKey={monthKey}
      initialLabels={labels}
      initialClosed={closed}
      initialTeamOverrides={teamOverrides}
    />
  );
}
