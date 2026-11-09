import { execSync } from 'child_process';

interface Rule {
  name: string;
  pattern: RegExp;
}

const RULES: Rule[] = [
  { name: 'Google (GCP / YouTube / CSE) API Key', pattern: /AIza[0-9A-Za-z\-_]{35}/g },
  { name: 'Tavily API Key', pattern: /tvly-[0-9A-Za-z\-_]{20,}/g },
  { name: 'Exa API Key (UUID format)', pattern: /(?:exaApiKey|EXA_API_KEY)\s*[:=]\s*['"]?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})['"]?/gi },
  { name: 'Generic Secret in Assignment (e.g. KEY=..., SECRET=...)', pattern: /(?:KEY|SECRET|TOKEN|SALT)\s*[:=]\s*['"]?([a-zA-Z0-9\-_]{16,})['"]?/gi },
];

function runScan() {
  const commitsRaw = execSync('git log --all --pretty=format:"%H"', { encoding: 'utf8' });
  const commits = commitsRaw.split('\n').map((c) => c.trim()).filter(Boolean);

  const ruleCounts: Record<string, number> = {};
  const commitFileMatches: Record<string, { commit: string; file: string; rule: string }[]> = {};

  for (const rule of RULES) {
    ruleCounts[rule.name] = 0;
  }

  for (const commit of commits) {
    // Get diff of commit
    const diff = execSync(`git show ${commit}`, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
    const fileChunks = diff.split(/^diff --git a\/(.*?) b\/(.*?)$/gm);

    for (let i = 1; i < fileChunks.length; i += 3) {
      const filePath = fileChunks[i];
      const content = fileChunks[i + 2] || '';

      // Scan added lines only
      const addedLines = content
        .split('\n')
        .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
        .join('\n');

      for (const rule of RULES) {
        const matches = addedLines.match(rule.pattern);
        if (matches && matches.length > 0) {
          // Exclude known non-secret UUIDs like D1 database_id or KV namespace id
          const filtered = matches.filter((m) => {
            if (m.includes('da3713e6-2633-4a94-8302-2c9ce69f13a7')) return false; // D1 DB ID
            if (m.includes('b120d3e40511405aa6c900052222849f')) return false; // KV namespace ID
            if (m.includes('feeaa401eda844a2af7d1e0019bd6782')) return false; // KV preview ID
            if (m.includes('tvly-test') || m.includes('tvly-key')) return false; // mock strings in orchestrator test
            return true;
          });

          if (filtered.length > 0) {
            ruleCounts[rule.name] = (ruleCounts[rule.name] || 0) + filtered.length;
            if (!commitFileMatches[commit]) commitFileMatches[commit] = [];
            commitFileMatches[commit].push({ commit, file: filePath, rule: rule.name });
          }
        }
      }
    }
  }

  console.log('=== SECRET SCAN SUMMARY (FULL GIT HISTORY) ===');
  for (const [ruleName, count] of Object.entries(ruleCounts)) {
    console.log(`Rule: "${ruleName}" -> Findings: ${count}`);
  }

  console.log('\n=== COMMITS & FILES WITH EXPOSURES ===');
  for (const [commit, items] of Object.entries(commitFileMatches)) {
    console.log(`Commit: ${commit}`);
    const uniqueFiles = Array.from(new Set(items.map((it) => `${it.file} [${it.rule}]`)));
    for (const f of uniqueFiles) {
      console.log(`  - ${f}`);
    }
  }
}

runScan();

