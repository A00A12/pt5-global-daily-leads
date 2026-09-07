import fs from "node:fs/promises";
import { parsePublishedMarkdown, assertMarkdownMatches } from "./daily-markdown-contract.mjs";

// 仅补齐已确认的四天公开档案。使用 wx 拒绝覆盖已有 JSON，防止误改已发布机器资料。
for (const date of ["2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07"]) {
  const markdown = await fs.readFile(new URL(`../daily/${date}.md`, import.meta.url), "utf8");
  const document = parsePublishedMarkdown(markdown);
  if (document.date !== date) throw new Error(`Date mismatch: ${date}`);
  assertMarkdownMatches(markdown, document);
  await fs.writeFile(new URL(`../daily/${date}.json`, import.meta.url), JSON.stringify(document, null, 2) + "\n", { flag: "wx" });
  console.log(`${date}: ${document.leads.length} verified records`);
}
