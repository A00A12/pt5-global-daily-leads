import assert from "node:assert/strict";
import { fields, validateDocument } from "./daily-contract.mjs";

// 此解析器仅用于公开档案的一次性补齐和发布时比对；业务系统的日常同步只接收 JSON。
function readCells(line) {
  if (!line.startsWith("| ") || !line.endsWith(" |")) throw new Error("Unsupported table row");
  const cells = []; let cell = "";
  for (let i = 1; i < line.length - 1; i++) {
    if (line[i] === "\\" && line[i + 1] === "|") { cell += "|"; i++; }
    else if (line[i] === "|") { cells.push(cell.trim()); cell = ""; }
    else cell += line[i];
  }
  cells.push(cell.trim());
  if (cells.length !== 2) throw new Error("Ambiguous table cells");
  return cells.map((value) => value.replace(/<br\s*\/?\s*>/gi, "\n"));
}

export function parsePublishedMarkdown(text) {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  const meta = {}; const quality = {}; const leads = [];
  let section = ""; let row = null; let headingId = ""; let headingName = "";
  const finish = () => {
    if (!row) return;
    assert.equal(row.lead_id, headingId, "Heading ID differs from row");
    assert.equal(row["名称"], headingName, "Heading name differs from row");
    const lead = { lead_id: row.lead_id };
    for (const [label, key] of Object.entries(fields)) {
      if (!(label in row) && label !== "客户画像") throw new Error(`Missing field: ${label}`);
      if (key === "contact_today") {
        if (!["Yes", "No"].includes(row[label])) throw new Error("Invalid contact choice");
        lead[key] = row[label] === "Yes";
      } else lead[key] = row[label] ?? "";
    }
    leads.push(lead);
  };
  for (const line of lines) {
    if (!section && /^\w+: /.test(line)) { const split = line.indexOf(": "); meta[line.slice(0, split)] = line.slice(split + 2); }
    if (line.startsWith("## ")) { section = line; continue; }
    if (line.startsWith("### ")) {
      finish(); row = {};
      const match = line.match(/^### (PT5-\d{8}-\d{3,}) — (.+)$/);
      if (!match) throw new Error("Unsupported lead heading");
      headingId = match[1]; headingName = match[2].replaceAll("\\|", "|").replaceAll("<br>", "\n");
      continue;
    }
    if (!line.startsWith("|")) {
      if (row && line.trim()) throw new Error("Unexpected content inside lead");
      continue;
    }
    const [label, value] = readCells(line);
    if (["字段", "项目", "---", "类别", "国家"].includes(label) && !row) {
      if (label !== "---" && section === "## 质量摘要" && label !== "项目") quality[label] = value;
      continue;
    }
    if (label === "---" || label === "字段") continue;
    if (row) {
      if (label !== "lead_id" && !(label in fields)) throw new Error(`Unknown public field: ${label}`);
      if (label in row) throw new Error(`Duplicate field: ${label}`);
      row[label] = value;
    } else if (section === "## 质量摘要") quality[label] = value;
  }
  finish();
  assert.equal(meta.lead_id_start, leads[0]?.lead_id);
  assert.equal(meta.lead_id_end, leads.at(-1)?.lead_id);
  return validateDocument({ schema_version: 1, date: meta.date, record_count: Number(meta.record_count), source: meta.source,
    validation: { status: quality["状态"], today_rows: Number(quality["正式新增"]), unique_names: Number(quality["唯一名称"]),
      contact_today: Number(quality["建议联系"]), feishu_import: quality["飞书导入"] }, leads });
}

export function assertMarkdownMatches(markdown, doc) {
  const parsed = parsePublishedMarkdown(markdown);
  // 逐项比较所有公开字段和质量摘要；缺失画像统一按“来源未提供”比较。
  const normalized = { ...doc, leads: doc.leads.map((lead) => ({ ...lead, customer_profile: lead.customer_profile ?? "" })) };
  assert.deepEqual(parsed, normalized);
}
