const NOTION_PAGE_ID = "32fb29d9a9fe815794cef7a6ae6dad39";
const NOTION_VERSION = "2022-06-28";
const CACHE_TTL_MS = 30 * 60 * 1000;

// Hard bounds so this can NEVER stall the analyze pipeline. The Notion page is
// large and deeply nested (hundreds of blocks); fetching it all sequentially
// took ~200s. We cap total time, depth, and size, fetch siblings' children in
// parallel, and return whatever we gathered (partial is fine — this is only
// optional product-name context for the extractor).
const FETCH_BUDGET_MS = 7000; // total wall-clock budget for the whole fetch
const MAX_CHARS = 24000;      // stop once we've gathered enough context
const MAX_DEPTH = 3;          // don't recurse into deeply nested blocks

let cache: { text: string; expiresAt: number } | null = null;

// Accumulate text into `acc` (mutated) within the shared deadline/size budget.
// Never throws — child fetch failures (rate limits, aborts) are swallowed so a
// partial result still comes back.
async function fetchBlocks(
  blockId: string,
  token: string,
  depth: number,
  deadline: number,
  acc: { text: string },
): Promise<void> {
  if (depth > MAX_DEPTH || acc.text.length >= MAX_CHARS || Date.now() >= deadline) return;

  const remaining = deadline - Date.now();
  const res = await fetch(
    `https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`,
    {
      headers: { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VERSION },
      signal: AbortSignal.timeout(Math.max(1000, remaining)),
    }
  );
  if (!res.ok) throw new Error(`Notion API ${res.status}`);
  const data = await res.json();

  const childIds: string[] = [];
  for (const block of data.results ?? []) {
    if (acc.text.length >= MAX_CHARS) break;
    const richText = extractRichText(block);
    if (richText) acc.text += richText + "\n";
    if (block.has_children) childIds.push(block.id);
  }

  // Recurse into children in parallel (bounded by the same deadline/size cap).
  if (childIds.length && depth < MAX_DEPTH && acc.text.length < MAX_CHARS && Date.now() < deadline) {
    await Promise.all(
      childIds.map((id) => fetchBlocks(id, token, depth + 1, deadline, acc).catch(() => {}))
    );
  }
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

  const acc = { text: "" };
  try {
    await fetchBlocks(NOTION_PAGE_ID, token, 0, now + FETCH_BUDGET_MS, acc);
  } catch {
    // keep whatever was gathered before the failure
  }
  const text = acc.text.trim();
  if (text) {
    cache = { text, expiresAt: now + CACHE_TTL_MS };
    return text;
  }
  return cache?.text ?? "";
}

export function clearProductKnowledgeCache(): void {
  cache = null;
}
