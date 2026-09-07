import fs from "node:fs/promises";
import { assertPairedFiles, validateDocument } from "./daily-contract.mjs";
import { assertMarkdownMatches } from "./daily-markdown-contract.mjs";

// 发布前同时检查文件配对、业务合同和逐字段一致性；任一失败都会以非零状态结束。
const directory = new URL("../daily/", import.meta.url);
const names = await fs.readdir(directory);
assertPairedFiles(names);
for (const name of names.filter((name) => name.endsWith(".json"))) {
  const doc = validateDocument(JSON.parse(await fs.readFile(new URL(name, directory), "utf8")));
  if (name !== `${doc.date}.json`) throw new Error(`Date mismatch: ${name}`);
  assertMarkdownMatches(await fs.readFile(new URL(name.replace(".json", ".md"), directory), "utf8"), doc);
  console.log(`${name}: 100 leads, all public fields verified`);
}
