# Conv-way Cloudflare Worker Secret Provisioning Guide

This document lists all secrets required by the Conv-way Cloudflare Worker in deployment order.
Run these commands in your terminal to set each secret in your Cloudflare environment.

> **Note:** The owner executes these commands directly. Never print, share, or commit secret values.

---

## 1. Core Flow Secrets (Execute in this order)

These 5 secrets are required for core catalog browsing, native transcript indexing, admin calibration, and rate-limiting.

```bash
# 1. YouTube Data API v3 key (for trending podcasts and video metadata)
npx wrangler secret put YOUTUBE_DATA_API_KEY

# 2. Supadata API key (primary provider for native transcript retrieval and windowing)
npx wrangler secret put SUPADATA_API_KEY

# 3. Secondary transcript provider fallback key
npx wrangler secret put TRANSCRIPT_API_FALLBACK_KEY

# 4. Admin calibration secret (protects /api/admin/* and governor endpoints)
npx wrangler secret put ADMIN_CALIBRATION_SECRET

# 5. IP hash salt (used for irreversible SHA-256 hashing of client IP addresses)
npx wrangler secret put IP_HASH_SALT
```

---

## 2. Optional Feature Secrets (Execute as needed)

If omitted, the app will continue to run with the respective feature gracefully disabled, returning honest status messages:

```bash
# 6. Tavily API key (enables Tavily search for Pass 1 trusted sites and Pass 2 open web)
# Impact if missing: Tavily search disabled; queries fall back to Exa or Google CSE.
npx wrangler secret put TAVILY_API_KEY

# 7. Exa API key (enables Exa neural open web search fallback)
# Impact if missing: Exa search disabled; queries fall back to Tavily.
npx wrangler secret put EXA_API_KEY

# 8. Gnani API key (enables Evon rerank, Prisma ASR, and Timbre voice synthesis)
# Impact if missing: Speech input falls back to browser Web Speech API; Way questions use Workers AI.
npx wrangler secret put GNANI_API_KEY

# 9. Google Custom Search JSON API key (legacy trusted domain search)
# Impact if missing: Google CSE disabled; search falls back directly to Tavily/Exa.
npx wrangler secret put WEB_SEARCH_API_KEY

# 10. Google Custom Search Engine ID (paired with WEB_SEARCH_API_KEY)
npx wrangler secret put WEB_SEARCH_CX
```

---

## 3. Cloudflare Workers AI Binding (No Secret Needed)

Workers AI requires **no secret key**. It runs natively through the Cloudflare Workers runtime binding configured in `wrangler.toml`:

```toml
[ai]
binding = "AI"
```

---

## 4. Verification After Setting Secrets

List all configured secrets in Cloudflare without revealing their values:

```bash
npx wrangler secret list
```

