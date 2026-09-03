# PT5 Global Daily Leads

This repository publishes daily, verified public-partner lead files for the
downstream system.

## Files

- `daily/YYYY-MM-DD.md` — one validated daily batch of 100 leads.

Each file is produced only after the daily validation and Feishu-import checks
have passed. Every lead is identified by `lead_id`, which the receiving system
should use as its upsert key.

## Reading from a system

Use GitHub's Contents API or the raw file URL to fetch the required date file.
For example, the raw URL pattern is:

```text
https://raw.githubusercontent.com/A00A12/pt5-global-daily-leads/main/daily/YYYY-MM-DD.md
```

This is a public repository. Do not add application credentials, tokens,
private contact data, or any material that is not intended for public access.
