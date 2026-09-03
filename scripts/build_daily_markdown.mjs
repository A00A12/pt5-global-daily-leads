import fs from "node:fs/promises";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, values) => {
  if (value.startsWith("--")) pairs.push([value.slice(2), values[index + 1]]);
  return pairs;
}, []));

if (!args.input || !args.output || !args["lead-id-start"]) {
  throw new Error("Usage: node scripts/build_daily_markdown.mjs --input <jsonl> --output <md> --lead-id-start <n> [--validation <json>]");
}

const start = Number(args["lead-id-start"]);
if (!Number.isInteger(start) || start < 1) throw new Error("--lead-id-start must be a positive integer.");

const rows = (await fs.readFile(args.input, "utf8"))
  .split(/\r?\n/)
  .filter(Boolean)
  .map(JSON.parse);
if (rows.length !== 100) throw new Error(`Expected 100 verified daily rows, found ${rows.length}.`);

const validation = args.validation
  ? JSON.parse(await fs.readFile(args.validation, "utf8"))
  : null;
if (validation && validation.status !== "PASS") throw new Error("Validation report is not PASS.");

const date = rows[0]["发现日期"];
if (!date || rows.some(row => row["发现日期"] !== date)) throw new Error("Rows must have the same non-empty discovery date.");

const pad = value => String(value ?? "")
  .replace(/\r?\n/g, "<br>")
  .replace(/\|/g, "\\|")
  .trim();
const leadId = (row, index) => `PT5-${date.replace(/-/g, "")}-${String(start + index).padStart(3, "0")}`;
const fieldOrder = [
  "名称", "类别", "国家", "地区/时区", "优先级", "建议当天是否联系", "目标客户",
  "公开收费/门槛", "推荐合作切入", "建议联系话术要点", "公开联系方式", "公开网址",
  "公开联系电话", "公开邮箱", "公开WhatsApp", "公开Slack/社群入口", "来源URL", "注意事项"
];

const categoryCount = Object.groupBy(rows, row => row["类别"]);
const countryCount = Object.groupBy(rows, row => row["国家"]);
const yesRows = rows.filter(row => row["建议当天是否联系"] === "Yes");
const validationRows = validation
  ? [
      ["状态", validation.status],
      ["正式新增", validation.today_rows],
      ["唯一名称", validation.unique_names],
      ["建议联系", validation.contact_today],
      ["飞书导入", validation.feishu_import || "已通过"]
    ]
  : [["状态", "已生成，未附验证报告"]];

const lines = [
  "---",
  `date: ${date}`,
  `record_count: ${rows.length}`,
  `lead_id_start: ${leadId(rows[0], 0)}`,
  `lead_id_end: ${leadId(rows.at(-1), rows.length - 1)}`,
  "source: PT5 Global public-partner discovery",
  "---",
  "",
  `# PT5 Global 每日线索 — ${date}`,
  "",
  "仅包含已完成公开信息核验、校验通过并成功入库的当日线索。系统请以 `lead_id` 作为新增或更新的唯一键。",
  "",
  "## 质量摘要",
  "",
  "| 项目 | 数值 |",
  "| --- | --- |",
  ...validationRows.map(([label, value]) => `| ${pad(label)} | ${pad(value)} |`),
  "",
  "## 分类统计",
  "",
  "| 类别 | 数量 |",
  "| --- | --- |",
  ...Object.entries(categoryCount).map(([label, items]) => `| ${pad(label)} | ${items.length} |`),
  "",
  "## 国家统计",
  "",
  "| 国家 | 数量 |",
  "| --- | --- |",
  ...Object.entries(countryCount).map(([label, items]) => `| ${pad(label)} | ${items.length} |`),
  "",
  `## 线索明细（${rows.length} 条）`,
  ""
];

for (const [index, row] of rows.entries()) {
  const id = leadId(row, index);
  lines.push(`### ${id} — ${pad(row["名称"])}`, "", "| 字段 | 内容 |", "| --- | --- |", `| lead_id | ${id} |`);
  for (const field of fieldOrder) lines.push(`| ${field} | ${pad(row[field])} |`);
  lines.push("");
}

await fs.mkdir(path.dirname(args.output), { recursive: true });
await fs.writeFile(args.output, `${lines.join("\n")}\n`, "utf8");
console.log(JSON.stringify({ status: "ok", date, rows: rows.length, output: args.output, lead_id_start: leadId(rows[0], 0), lead_id_end: leadId(rows.at(-1), rows.length - 1), contact_yes: yesRows.length }));
