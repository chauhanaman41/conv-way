# Deployment & Environment Configuration Guide: Conv-way

## 1. Prerequisites

* **Node.js:** `v20.11.0+`

* **Package Manager:** `npm` (`v10+`) or `pnpm` (`v9+`)

* **Cloudflare Account:** Free Plan (Pages, Workers, D1, KV, Cron Triggers enabled)

* **Wrangler CLI:** `npm install -g wrangler@^3.80.0` authenticated via `wrangler login`

## 2. Infrastructure Provisioning (Cloudflare Free Tier)

### Step 1: Create the Cloudflare D1 Database

```
wrangler d1 create conv-way-db

```

Copy the returned `database_id` into `wrangler.toml` under `[[d1_databases]]`.

### Step 2: Create the Cloudflare KV Namespace

```
wrangler kv namespace create CONV_WAY_KV
wrangler kv namespace create CONV_WAY_KV --preview

```

Copy the returned `id` and `preview_id` into `wrangler.toml` under `[[kv_namespaces]]`.

### Step 3: Configure `wrangler.toml`

```
name = "conv-way"
main = "src/worker/index.ts"
compatibility_date = "2026-11-01"
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB"
database_name = "conv-way-db"
database_id = "<YOUR_D1_DATABASE_ID>"
migrations_dir = "migrations"

[[kv_namespaces]]
binding = "KV"
id = "<YOUR_KV_NAMESPACE_ID>"
preview_id = "<YOUR_PREVIEW_KV_NAMESPACE_ID>"

[triggers]
# Daily at 02:00 UTC: Refresh Top 20 Trending Podcasts & recalculate daily credit cap
crons = ["0 2 * * *"]

[vars]
ENVIRONMENT = "production"
GNANI_TOTAL_CREDIT_BUDGET = "3000"
GNANI_BUDGET_END_DATE = "2026-12-15"
GNANI_RESERVE_RATIO = "0.10"
YOUTUBE_DAILY_SEARCH_BUDGET = "90"
DAILY_TRANSCRIPT_FETCH_BUDGET = "5"

```

## 3. Environment Secrets Configuration

Set all sensitive API credentials in Cloudflare Worker Secrets (never in `wrangler.toml` or `.env` committed to git):

```
# 1. Dedicated Google Cloud Project API Key (YouTube Data API v3 enabled)
wrangler secret put YOUTUBE_DATA_API_KEY

# 2. Managed Transcript Providers (Primary & Fallback)
wrangler secret put SUPADATA_API_KEY
wrangler secret put TRANSCRIPT_API_FALLBACK_KEY

# 3. Gnani AI Credentials (Prisma v3.0, Evon v3.3, Timbre)
wrangler secret put GNANI_API_KEY
wrangler secret put GNANI_ACCESS_TOKEN
wrangler secret put GNANI_EVON_ENDPOINT_URL
wrangler secret put GNANI_PRISMA_ENDPOINT_URL
wrangler secret put GNANI_TIMBRE_ENDPOINT_URL

# 4. Grounded Web Search Providers (Trusted Sites First & Open Web Fallback)
# Note: Google's Custom Search JSON API is closed to new customers (20 Jan 2026) and ends on 1 Jan 2027, so the Google engine is optional and auto-disables. Bing's API was retired in Aug 2025. Tavily and Exa handle trusted domain filtering and open web fallback.
wrangler secret put TAVILY_API_KEY
wrangler secret put EXA_API_KEY
wrangler secret put WEB_SEARCH_API_KEY
wrangler secret put WEB_SEARCH_CX

# 5. Admin Secret for Running the Pre-Submission Credit Calibration Batch
wrangler secret put ADMIN_CALIBRATION_SECRET

```

For local development, create a `.dev.vars` file (gitignored) containing the key-value pairs above.

## 4. Database Migrations (Local & Production)

### Apply Migrations Locally

```
wrangler d1 migrations apply conv-way-db --local

```

### Apply Migrations to Production

```
wrangler d1 migrations apply conv-way-db --remote

```

## 5. Pre-Submission Credit Calibration Batch (Mandatory Before Launch)

Before opening traffic for the November 10, 2026 submission, run the calibration batch to measure exact empirical credit consumption for Prisma v3.0 and Evon v3.3 (automatically capped at $\le 60$ credits / $2\%$ of the 3,000-credit pool):

```
curl -X POST https://conv-way.pages.dev/api/admin/calibrate \
  -H "X-Admin-Calibration-Key: <YOUR_ADMIN_CALIBRATION_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{
    "startingPoolBalance": 3000,
    "prismaTestClipsCount": 10,
    "evonTestCallsCount": 20,
    "maxCreditSpendCap": 60
  }'

```

## 6. Build, Verification & Deployment Commands

```
# 1. Install dependencies
npm install

# 2. Run typecheck and unit/integration tests
npm run typecheck
npm run test

# 3. Build frontend and worker bundle
npm run build

# 4. Preview full-stack locally with Wrangler (Pages + Workers + local D1/KV)
npx wrangler pages dev dist --local

# 5. Deploy to Cloudflare Production
npx wrangler pages deploy dist --project-name conv-way

```