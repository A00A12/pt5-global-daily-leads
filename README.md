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

`customer_profile` stores the separately published 客户画像, distinct from
`target_customer`. An absent profile is an empty string; no text is inferred.
The shared field mapping is in `scripts/daily-contract.mjs`. Extend it whenever
the source adds a public field, then update the receiving system's import and UI.

```bash
node scripts/build_daily_markdown.mjs \
  --input verified-leads.jsonl \
  --validation validation.json \
  --lead-id-start 1 \
  --output daily/YYYY-MM-DD.md
```

The generator rejects batches that are not marked `PASS`, do not contain 100
records, contain invalid priorities, or are missing required public fields.
It also checks calendar dates, contact choices, quality-summary counts and exact
Markdown/JSON agreement before writing. Run `node scripts/check-daily.mjs` and
`node --test scripts/daily-contract.test.mjs` before publication; GitHub Actions
runs the same checks and rejects unpaired daily files or differing fields.

The four Markdown-only batches from September 4–7 were reconstructed with
`node scripts/backfill-published-json.mjs`, which retains published IDs and
verifies every public value and quality summary. This scoped reconstruction
refuses to overwrite existing JSON. Markdown parsing is only for archive checks
and this reconstruction, never for the receiving system's hourly imports.
The receiving system may update its private database from these public files,
but claim ownership and contact notes must never be written back here.

This is a public repository. Do not add application credentials, tokens,
private contact data, or any material that is not intended for public access.
