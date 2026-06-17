// ONE-TIME: export the Notion product-knowledge page into Markdown files under
// content/product-knowledge/ (one file per product sub-page + an overview).
// After this, the app reads those .md files (lib/knowledge.ts) and Notion is no
// longer used at runtime. Edit the files in Obsidian going forward.
//
// Run: node scripts/migrate-notion-to-md.mjs
import { readFileSync, promises as fsp } from "node:fs";
import path from "node:path";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("="); let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[line.slice(0, i).trim()] = v;
}
const TOK = env.NOTION_TOKEN;
const PAGE = "32fb29d9a9fe815794cef7a6ae6dad39";
const OUT = path.join(process.cwd(), "content", "product-knowledge");

async function children(id) {
  const all = [];
  let cursor;
  do {
    const url = new URL(`https://api.notion.com/v1/blocks/${id}/children`);
    url.searchParams.set("page_size", "100");
    if (cursor) url.searchParams.set("start_cursor", cursor);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOK}`, "Notion-Version": "2022-06-28" } });
    if (!res.ok) break;
    const d = await res.json();
    all.push(...(d.results ?? []));
    cursor = d.has_more ? d.next_cursor : null;
  } while (cursor);
  return all;
}
const rt = (c) => (c?.rich_text ?? []).map((r) => r.plain_text).join("");

async function toMd(blocks, indent = "") {
  let md = "";
  for (const b of blocks) {
    const t = b.type, c = b[t] ?? {};
    let line = "";
    switch (t) {
      case "heading_1": line = `\n# ${rt(c)}`; break;
      case "heading_2": line = `\n## ${rt(c)}`; break;
      case "heading_3": line = `\n### ${rt(c)}`; break;
      case "bulleted_list_item": line = `${indent}- ${rt(c)}`; break;
      case "numbered_list_item": line = `${indent}1. ${rt(c)}`; break;
      case "to_do": line = `${indent}- [${c.checked ? "x" : " "}] ${rt(c)}`; break;
      case "quote": case "callout": line = `> ${rt(c)}`; break;
      case "toggle": line = `**${rt(c)}**`; break;
      case "code": line = "```\n" + rt(c) + "\n```"; break;
      case "divider": line = "\n---"; break;
      case "child_page": line = `\n## ${c.title}`; break;
      case "child_database": line = `\n## 🗄️ ${c.title} (database — ไม่ได้ย้ายอัตโนมัติ)`; break;
      case "table": {
        const rows = await children(b.id);
        const lines = rows.map((r) => "| " + (r.table_row?.cells ?? []).map((cell) => cell.map((x) => x.plain_text).join("")).join(" | ") + " |");
        if (lines.length) { const cols = (rows[0].table_row?.cells ?? []).length; lines.splice(1, 0, "|" + " --- |".repeat(cols)); }
        line = lines.join("\n");
        md += line + "\n";
        continue;
      }
      default: line = rt(c);
    }
    if (line || t === "paragraph") md += line + "\n";
    // Recurse into nested children (lists, toggles) — but NOT child_page (own file)
    if (b.has_children && t !== "child_page" && t !== "table") {
      md += await toMd(await children(b.id), indent + "  ");
    }
  }
  return md;
}

function safeName(s) {
  return s.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
}

const top = await children(PAGE);
await fsp.mkdir(OUT, { recursive: true });

let overview = "# Product Knowledge — Overview\n";
let n = 0, products = 0;
for (const b of top) {
  if (b.type === "child_page") {
    const title = b.child_page.title;
    const body = await toMd(await children(b.id));
    const file = path.join(OUT, `${String(++products).padStart(2, "0")}-${safeName(title)}.md`);
    await fsp.writeFile(file, `# ${title}\n${body}`, "utf8");
    console.log("wrote", path.basename(file));
  } else {
    overview += (await toMd([b]));
  }
}
await fsp.writeFile(path.join(OUT, "00-overview.md"), overview, "utf8");
console.log(`\nDONE: ${products} product files + 00-overview.md in content/product-knowledge/`);
