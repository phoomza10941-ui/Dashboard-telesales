import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAiExtractionFields, getCoachingPromptOverride, getExtractionRules } from "@/lib/db";
import BotConfigClient from "./BotConfigClient";
import AiExtractionRulesCard from "@/app/supervisor/settings/AiExtractionRulesCard";

export default async function BotConfigPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Note: product knowledge (slow Notion fetch) is NOT loaded here — the page
  // would block on it. BotConfigClient lazy-loads the preview on demand.
  const [fields, coachingOverride, extractionRules] = await Promise.all([
    getAiExtractionFields(),
    getCoachingPromptOverride(),
    getExtractionRules(),
  ]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold text-[#3D3D3D]">Bot Config</h1>
        <p className="text-[13px] text-[#8B8E8F] mt-1">
          ตั้งค่า AI Agent — Notion product knowledge, ฟิลด์ที่ดึง, คำแนะนำ Supervisor และทดสอบ
        </p>
      </div>

      <BotConfigClient
        initialFields={fields}
        initialCoachingOverride={coachingOverride}
        notionConnected={!!process.env.NOTION_TOKEN}
        initialNotionPreview=""
      />

      <AiExtractionRulesCard initialRules={extractionRules} />
    </div>
  );
}
