# Conv-way Security & Secret Management Guide

## 1. Local Pre-Commit Secret Scanner Hook

To prevent accidental commits of private API keys (such as Google Cloud, Tavily, or Exa credentials), install the local git pre-commit hook:

### Installation Command

**Linux / macOS (Bash):**
```bash
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

**Windows (PowerShell):**
```powershell
Copy-Item scripts/pre-commit-hook.sh .git/hooks/pre-commit
```

> **Important:** Git hooks reside strictly inside your local `.git/hooks/` directory and are not shared or executed on remote machines automatically. Every developer must install the hook locally to run pre-commit secret checks on their machine.

---

## 2. GitHub Push Protection

In addition to local hooks, enable automated server-side Push Protection on GitHub:
1. Open GitHub repository: `https://github.com/chauhanaman41/conv-way/settings`
2. Navigate to **Code security and analysis**.
3. Under **Secret scanning**, enable **Push protection**.
4. Once enabled, any git push containing a detected secret will be rejected by GitHub before the commit is accepted.

---

## 3. Secret Management Rules

1. **Never Commit Secrets:**
   - `.dev.vars` is strictly ignored by git and is only for local Worker development.
   - Production secrets are set solely through Cloudflare CLI: `npx wrangler secret put NAME`.
   - `.env.local` is for frontend client variables only and must only hold non-sensitive public variables prefixed with `VITE_`.
2. **Automated Enforcement:**
   - Automated rule tests in `tests/rules-enforcement.test.ts` scan `src/`, `tests/`, `scripts/`, `docs/`, and `wrangler.toml` for key patterns and fail the build if any are detected.

