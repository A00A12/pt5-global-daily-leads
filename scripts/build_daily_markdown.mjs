import fs from "node:fs/promises";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, values) => {
    if (value.startsWith("--")) pairs.push([value.slice(2), values[index + 1]]);
    return pairs;
  }, []),
);

if (!args.input || !args.output || !args.validation || !args["lead-id-start"]) {
  throw new Error(
    "Usage: node scripts/build_daily_markdown.mjs --input <jsonl> --output <md> --lead-id-start <n> --validation <json> [--json-output <json>]",
  );
}

const start = Number(args["lead-id-start"]);
if (!Number.isInteger(start) || start < 1) {
  throw new Error("--lead-id-start must be a positive integer.");
}

const rows = (await fs.readFile(args.input, "utf8"))
  .split(/\r?\n/)
  .filter(Boolean)
  .map(JSON.parse);
if (rows.length !== 100) {
  throw new Error(`Expected 100 verified daily rows, found ${rows.length}.`);
}

const validation = JSON.parse(await fs.readFile(args.validation, "utf8"));
if (validation.status !== "PASS") {
  throw new Error("Validation report is not PASS.");
}

const date = rows[0]["发现日期"];
if (!date || rows.some((row) => row["发现日期"] !== date)) {
  throw new Error("Rows must have the same non-empty discovery date.");
}

const pad = (value) =>
  String(value ?? "")
    .replace(/\r?\n/g, "<br>")
    .replace(/\|/g, "\\|")
    .trim();
const clean = (value) => String(value ?? "").trim();
const leadId = (_row, index) =>
  `PT5-${date.replace(/-/g, "")}-${String(start + index).padStart(3, "0")}`;
const fieldOrder = [
  "名称", "类别", "国家", "地区/时区", "优先级", "建议当天是否联系", "目标客户",
  "公开收费/门槛", "推荐合作切入", "建议联系话术要点", "公开联系方式", "公开网址",
  "公开联系电话", "公开邮箱", "公开WhatsApp", "公开Slack/社群入口", "来源URL", "注意事项",
];

// JSON 字段使用稳定英文键，避免下游系统依赖 Markdown 标题或中文展示文案。
// Markdown 和 JSON 都由同一份已验证数据生成，因此两种格式不会出现内容漂移。
const leads = rows.map((row, index) => ({
  lead_id: leadId(row, index),
  name: clean(row["名称"]),
  category: clean(row["类别"]),
  country: clean(row["国家"]),
  region_timezone: clean(row["地区/时区"]),
  priority: clean(row["优先级"]),
  contact_today: clean(row["建议当天是否联系"]) === "Yes",
  target_customer: clean(row["目标客户"]),
  public_pricing: clean(row["公开收费/门槛"]),
  recommended_approach: clean(row["推荐合作切入"]),
  contact_talking_points: clean(row["建议联系话术要点"]),
  public_contact: clean(row["公开联系方式"]),
  website_url: clean(row["公开网址"]),
  phone: clean(row["公开联系电话"]),
  email: clean(row["公开邮箱"]),
  whatsapp: clean(row["公开WhatsApp"]),
  community_url: clean(row["公开Slack/社群入口"]),
  source_url: clean(row["来源URL"]),
  notes: clean(row["注意事项"]),
}));

for (const lead of leads) {
  if (!lead.name || !lead.category || !lead.country || !lead.source_url) {
    throw new Error(`Lead ${lead.lead_id} is missing a required public field.`);
  }
  if (!new Set(["A", "B", "C"]).has(lead.priority)) {
    throw new Error(`Lead ${lead.lead_id} has an invalid priority.`);
  }
}
if (new Set(leads.map((lead) => lead.lead_id)).size !== leads.length) {
  throw new Error("Generated lead_id values must be unique.");
}

const categoryCount = Object.groupBy(rows, (row) => row["类别"]);
const countryCount = Object.groupBy(rows, (row) => row["国家"]);
const yesRows = rows.filter((row) => row["建议当天是否联系"] === "Yes");
const validationRows = [
  ["状态", validation.status], ["正式新增", validation.today_rows], ["唯一名称", validation.unique_names],
  ["建议联系", validation.contact_today], ["飞书导入", validation.feishu_import || "已通过"],
];

const lines = [
  "---", `date: ${date}`, `record_count: ${rows.length}`, `lead_id_start: ${leadId(rows[0], 0)}`,
  `lead_id_end: ${leadId(rows.at(-1), rows.length - 1)}`, "source: PT5 Global public-partner discovery", "---", "",
  `# PT5 Global 每日线索 — ${date}`, "",
  "仅包含已完成公开信息核验、校验通过并成功入库的当日线索。系统请以 `lead_id` 作为新增或更新的唯一键。", "",
  "## 质量摘要", "", "| 项目 | 数值 |", "| --- | --- |",
  ...validationRows.map(([label, value]) => `| ${pad(label)} | ${pad(value)} |`), "",
  "## 分类统计", "", "| 类别 | 数量 |", "| --- | --- |",
  ...Object.entries(categoryCount).map(([label, items]) => `| ${pad(label)} | ${items.length} |`), "",
  "## 国家统计", "", "| 国家 | 数量 |", "| --- | --- |",
  ...Object.entries(countryCount).map(([label, items]) => `| ${pad(label)} | ${items.length} |`), "",
  `## 线索明细（${rows.length} 条）`, "",
];

for (const [index, row] of rows.entries()) {
  const id = leadId(row, index);
  lines.push(`### ${id} — ${pad(row["名称"])}`, "", "| 字段 | 内容 |", "| --- | --- |", `| lead_id | ${id} |`);
  for (const field of fieldOrder) lines.push(`| ${field} | ${pad(row[field])} |`);
  lines.push("");
}

const jsonOutput = args["json-output"] || args.output.replace(/\.[^.]+$/, ".json");
const machineDocument = {
  schema_version: 1,
  date,
  record_count: leads.length,
  source: "PT5 Global public-partner discovery",
  validation: {
    status: validation.status,
    today_rows: Number(validation.today_rows),
    unique_names: Number(validation.unique_names),
    contact_today: Number(validation.contact_today),
    feishu_import: clean(validation.feishu_import || "verified"),
  },
  leads,
};

await Promise.all([fs.mkdir(path.dirname(args.output), { recursive: true }), fs.mkdir(path.dirname(jsonOutput), { recursive: true })]);
await Promise.all([
  fs.writeFile(args.output, `${lines.join("\n")}\n`, "utf8"),
  fs.writeFile(jsonOutput, `${JSON.stringify(machineDocument, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({
  status: "ok", date, rows: rows.length, markdown_output: args.output, json_output: jsonOutput,
  lead_id_start: leadId(rows[0], 0), lead_id_end: leadId(rows.at(-1), rows.length - 1), contact_yes: yesRows.length,
}));
