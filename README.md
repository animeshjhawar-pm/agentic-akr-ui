# Agentic AKR UI

Hosted control plane for the Agentic Keyword Research pipeline.

## Architecture

This repository is the **control plane** (hosted on Railway). It does two things:

1. Triggers runs -- inserts a row into the `run_requests` table in Supabase.
2. Displays runs -- polls Supabase for `runs`, `run_events`, `run_clusters`, and `run_keywords`.

**It does NOT execute the pipeline.**

The **execution engine** lives in the `agentic-akr` repo. Run `npm run engine` there. The engine claims pending `run_requests` from the same Supabase instance, executes the keyword pipeline locally, and writes results back to Supabase.

Both the UI and the engine point at the **same `RUN_STORE_URL`**. The UI and engine are intentionally decoupled -- the engine runs on the operator's machine; the UI is always available in the cloud.

Artifacts (per-stage files) are local-only on the engine machine and are not surfaced in this UI. S3 integration is a future item.

## Required Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | gw_stormbreaker read-only Postgres -- used for lead/page/customer metrics |
| `RUN_STORE_URL` | Supabase Postgres shared run store -- must match the engine's `RUN_STORE_URL` |
| `APP_SHARED_SECRET` | Login password gate -- entered at `/login` to access the UI |

Optional:

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_POLL_INTERVAL_MS` | 2000 | Run status poll interval in milliseconds |

See `.env.example` for the full list with comments. **Never commit real values.**

## Local Development

```bash
cp .env.example .env.local
# Fill in DATABASE_URL, RUN_STORE_URL, APP_SHARED_SECRET in .env.local

npm install
npm run dev
# Start the execution engine separately (agentic-akr repo, npm run engine)
```

Visit `http://localhost:3000`. You will be redirected to `/login` -- enter your `APP_SHARED_SECRET` to proceed.

## Deploy to Railway

1. Push this repo to GitHub.
2. In Railway: create a new project, connect the GitHub repo.
3. Set the three required env vars (`DATABASE_URL`, `RUN_STORE_URL`, `APP_SHARED_SECRET`) in the Railway service settings.
4. Deploy. Railway uses the `standalone` Next.js build output for a slim container image.

Auth: visit `/login` and enter `APP_SHARED_SECRET`.

## Running Tests

```bash
npm test
```

## Linting

```bash
npm run lint
```
