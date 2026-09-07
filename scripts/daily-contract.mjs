// 中英文键只在此维护；生成、补齐和发布检查共享映射，避免新增字段只进入其中一种文件。
export const fields = {
  名称: "name", 类别: "category", 国家: "country", "地区/时区": "region_timezone",
  优先级: "priority", 建议当天是否联系: "contact_today", 目标客户: "target_customer",
  客户画像: "customer_profile", "公开收费/门槛": "public_pricing", 推荐合作切入: "recommended_approach",
  建议联系话术要点: "contact_talking_points", 公开联系方式: "public_contact", 公开网址: "website_url",
  公开联系电话: "phone", 公开邮箱: "email", 公开WhatsApp: "whatsapp",
  "公开Slack/社群入口": "community_url", 来源URL: "source_url", 注意事项: "notes",
};

export function validateDocument(doc) {
  const fail = (message) => { throw new Error(message); };
  if (doc.schema_version !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(doc.date) ||
      new Date(doc.date).toISOString().slice(0, 10) !== doc.date) fail("Invalid schema or date");
  if (doc.validation?.status !== "PASS" || doc.record_count !== 100 || doc.leads?.length !== 100) fail("Expected PASS and 100 leads");
  const ids = new Set();
  for (const lead of doc.leads) {
    if (!new RegExp(`^PT5-${doc.date.replaceAll("-", "")}-\\d{3,}$`).test(lead.lead_id) || ids.has(lead.lead_id)) fail("Invalid or duplicate lead ID");
    ids.add(lead.lead_id);
    for (const key of Object.values(fields)) {
      if (key === "contact_today") {
        if (typeof lead[key] !== "boolean") fail("Invalid contact_today");
      } else if (key === "customer_profile" && lead[key] === undefined) {
        // 公开来源确实没有提供画像时，资料为空；不使用目标客户或建议代替。
        continue;
      } else if (typeof lead[key] !== "string") fail(`Invalid field: ${key}`);
    }
    if (!["name", "category", "country", "source_url"].every((key) => lead[key].trim())) fail("Required field is empty");
    if (!["A", "B", "C"].includes(lead.priority)) fail("Invalid priority");
  }
  if (doc.validation.today_rows !== 100 || doc.validation.unique_names !== new Set(doc.leads.map((x) => x.name)).size ||
      doc.validation.contact_today !== doc.leads.filter((x) => x.contact_today).length) fail("Quality summary mismatch");
  return doc;
}

export function assertPairedFiles(names) {
  const files = new Set(names);
  for (const name of files) {
    if (/^\d{4}-\d{2}-\d{2}\.(md|json)$/.test(name)) {
      const paired = name.replace(/\.(md|json)$/, name.endsWith(".md") ? ".json" : ".md");
      if (!files.has(paired)) throw new Error(`Missing paired file: ${paired}`);
    }
  }
}
