// Product knowledge = a folder of Markdown files (an Obsidian vault) committed
// in the repo at content/product-knowledge/. This replaces the slow Notion
// fetch: local files are read instantly, with no API, rate limits, or caps.
//
// Vercel note: the folder is force-included into the relevant serverless
// functions via `outputFileTracingIncludes` in next.config.ts.
import { promises as fs } from "fs";
import path from "path";

const KNOWLEDGE_DIR = path.join(process.cwd(), "content", "product-knowledge");
const CACHE_TTL_MS = 5 * 60 * 1000;
// Per-file cap keeps EVERY product's name + summary in the prompt (so name
// normalization works for all of them) while keeping the prompt small enough to
// stay fast/cheap. Full detail still lives in the files for humans/Obsidian.
const MAX_CHARS_PER_FILE = 1800;

let cache: { text: string; at: number } | null = null;

async function readMarkdownDir(dir: string): Promise<string> {
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return ""; // folder missing/empty
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));

  let out = "";
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out += await readMarkdownDir(full);
    } else if (e.name.toLowerCase().endsWith(".md")) {
      try {
        let content = (await fs.readFile(full, "utf8")).trim();
        if (content) {
          if (content.length > MAX_CHARS_PER_FILE) {
            content = content.slice(0, MAX_CHARS_PER_FILE).trimEnd() + "\n…(ดูรายละเอียดเต็มในไฟล์)";
          }
          const title = e.name.replace(/\.md$/i, "");
          out += `\n=== ${title} ===\n${content}\n`;
        }
      } catch {
        /* skip unreadable file */
      }
    }
  }
  return out;
}

export async function getProductKnowledge(): Promise<string> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.text;
  const text = (await readMarkdownDir(KNOWLEDGE_DIR)).trim();
  cache = { text, at: now };
  return text;
}

export function clearProductKnowledgeCache(): void {
  cache = null;
}
