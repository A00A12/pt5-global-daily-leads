# PT5 Global Daily Leads

This repository publishes daily, verified public-partner lead files for the
downstream system.

## Files

- `daily/YYYY-MM-DD.md` — one validated daily batch of 100 leads for people to read.
- `daily/YYYY-MM-DD.json` — the same batch with stable English field names for system imports.

Each file is produced only after the daily validation and Feishu-import checks
have passed. Every lead is identified by `lead_id`, which the receiving system
should use as its upsert key.

## Reading from a system

Use GitHub's Contents API to list published JSON files, then fetch the required
raw file. The JSON document uses `schema_version: 1`, contains a `PASS`
validation summary and exactly 100 records in `leads`. For example:

```text
https://raw.githubusercontent.com/A00A12/pt5-global-daily-leads/main/daily/YYYY-MM-DD.json
```

Generate both formats from the same validated JSONL input:

```bash
node scripts/build_daily_markdown.mjs \
  --input verified-leads.jsonl \
  --validation validation.json \
  --lead-id-start 1 \
  --output daily/YYYY-MM-DD.md
```

The generator rejects batches that are not marked `PASS`, do not contain 100
records, contain invalid priorities, or are missing required public fields.
The receiving system may update its private database from these public files,
but claim ownership and contact notes must never be written back here.

This is a public repository. Do not add application credentials, tokens,
private contact data, or any material that is not intended for public access.
