const NOTION_PAGE_ID = "32fb29d9a9fe815794cef7a6ae6dad39";
const NOTION_VERSION = "2022-06-28";
const CACHE_TTL_MS = 30 * 60 * 1000;

let cache: { text: string; expiresAt: number } | null = null;

async function fetchBlocks(blockId: string, token: string): Promise<string> {
  const res = await fetch(
    `https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
      },
      signal: AbortSignal.timeout(8000),
    }
  );
  if (!res.ok) throw new Error(`Notion API ${res.status}`);
  const data = await res.json();

  let text = "";
  for (const block of data.results ?? []) {
    const richText: string = extractRichText(block);
    if (richText) text += richText + "\n";
    if (block.has_children) {
      const childText = await fetchBlocks(block.id, token);
      if (childText) text += childText;
    }
  }
  return text;
}

function extractRichText(block: Record<string, unknown>): string {
  const type = block.type as string;
  if (!type) return "";
  const content = block[type] as Record<string, unknown> | undefined;
  if (!content) return "";

  if (type === "heading_1" || type === "heading_2" || type === "heading_3") {
    const parts = (content.rich_text as Array<{ plain_text: string }> ?? [])
      .map((r) => r.plain_text)
      .join("");
    return `\n=== ${parts} ===`;
  }

  if (type === "divider") return "";
  if (type === "table_of_contents") return "";

  const rtArray = content.rich_text as Array<{ plain_text: string }> | undefined;
  if (!Array.isArray(rtArray)) return "";
  return rtArray.map((r) => r.plain_text).join("").trim();
}

export async function getProductKnowledge(): Promise<string> {
  const token = process.env.NOTION_TOKEN;
  if (!token) return "";

  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.text;

  try {
    const text = await fetchBlocks(NOTION_PAGE_ID, token);
    cache = { text, expiresAt: now + CACHE_TTL_MS };
    return text;
  } catch {
    return cache?.text ?? "";
  }
}

export function clearProductKnowledgeCache(): void {
  cache = null;
}
