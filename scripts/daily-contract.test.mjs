import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { fields, assertPairedFiles, validateDocument } from "./daily-contract.mjs";
import { parsePublishedMarkdown, assertMarkdownMatches } from "./daily-markdown-contract.mjs";

const read = (date, ext) => fs.readFile(new URL(`../daily/${date}.${ext}`, import.meta.url), "utf8");
for (const date of ["2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07"]) {
  test(`${date}: every public field and quality summary matches`, async () => {
    const doc = validateDocument(JSON.parse(await read(date, "json")));
    assertMarkdownMatches(await read(date, "md"), doc);
    assert.equal(doc.leads.filter((lead) => lead.customer_profile).length, ["2026-09-03", "2026-09-05"].includes(date) ? 0 : 100);
  });
}
test("escaped pipes, line breaks, long profiles and missing fields", async () => {
  const markdown = await read("2026-09-04", "md");
  const profile = "画像".repeat(1000) + "\\|合作<br>https://example.com/contact";
  const changed = markdown.replace(/\| 客户画像 \|[^\n]*\n/, `| 客户画像 | ${profile} |\n`);
  assert.equal(parsePublishedMarkdown(changed).leads[0].customer_profile, profile.replace("\\|", "|").replace("<br>", "\n"));
  assert.throws(() => parsePublishedMarkdown(changed.replace("\\|合作", "|合作")), /Ambiguous/);
  assert.throws(() => parsePublishedMarkdown(markdown.replace(/\| 公开邮箱 \|[^\n]*\n/, "")), /Missing field/);
  assert.throws(() => parsePublishedMarkdown(markdown.replace("| 客户画像 |", "| 新增未接入字段 |")), /Unknown public field/);
});
test("rejects incomplete publication, failed validation, duplicate IDs and bad dates", async () => {
  assert.throws(() => assertPairedFiles(["2026-09-04.md"]), /Missing paired file/);
  const doc = JSON.parse(await read("2026-09-04", "json"));
  assert.throws(() => validateDocument({ ...doc, date: "2026-02-30" }), /date/);
  assert.throws(() => validateDocument({ ...doc, validation: { ...doc.validation, status: "FAIL" } }), /PASS/);
  assert.throws(() => validateDocument({ ...doc, leads: doc.leads.slice(1) }), /100/);
  doc.leads[1].lead_id = doc.leads[0].lead_id;
  assert.throws(() => validateDocument(doc), /duplicate/);
});

test("generator publishes both formats from verified JSONL before accepting a batch", async () => {
  const dir = await fs.mkdtemp(join(tmpdir(), "pt5-daily-contract-"));
  try {
    const doc = JSON.parse(await read("2026-09-04", "json"));
    const rows = doc.leads.map((lead) => ({ "发现日期": doc.date, ...Object.fromEntries(Object.entries(fields).map(([label, key]) =>
      [label, key === "contact_today" ? lead[key] ? "Yes" : "No" : lead[key]])) }));
    const input = join(dir, "verified.jsonl"); const validation = join(dir, "validation.json"); const output = join(dir, "daily.md");
    await fs.writeFile(input, rows.map((row) => JSON.stringify(row)).join("\n"));
    await fs.writeFile(validation, JSON.stringify(doc.validation));
    const args = [fileURLToPath(new URL("./build_daily_markdown.mjs", import.meta.url)), "--input", input, "--validation", validation, "--output", output, "--lead-id-start", "1"];
    execFileSync(process.execPath, args, { stdio: "pipe" });
    const generated = JSON.parse(await fs.readFile(join(dir, "daily.json"), "utf8"));
    assertMarkdownMatches(await fs.readFile(output, "utf8"), generated);
    assert.deepEqual(generated.leads, doc.leads);
    // 失败批次不得覆盖已成功生成的内容。
    const before = await fs.readFile(output, "utf8");
    rows[0]["建议当天是否联系"] = "unknown";
    await fs.writeFile(input, rows.map((row) => JSON.stringify(row)).join("\n"));
    assert.throws(() => execFileSync(process.execPath, args, { stdio: "pipe" }));
    assert.equal(await fs.readFile(output, "utf8"), before);
  } finally {
    // 这里只移除本次 mkdtemp 创建的测试目录，不接触来源仓库或用户资料。
    await fs.rm(dir, { recursive: true, force: true });
  }
});
