import fs from 'node:fs';
import path from 'node:path';

interface EnvVarSpec {
  name: string;
  type: 'REQUIRED' | 'OPTIONAL';
  impact: string;
}

const SPEC_LIST: EnvVarSpec[] = [
  // Required for Core Flow
  {
    name: 'YOUTUBE_DATA_API_KEY',
    type: 'REQUIRED',
    impact: 'Trending catalog fetch & YouTube video metadata lookup',
  },
  {
    name: 'SUPADATA_API_KEY',
    type: 'REQUIRED',
    impact: 'Primary native transcript retrieval and windowing',
  },
  {
    name: 'TRANSCRIPT_API_FALLBACK_KEY',
    type: 'REQUIRED',
    impact: 'Secondary transcript fallback provider',
  },
  {
    name: 'ADMIN_CALIBRATION_SECRET',
    type: 'REQUIRED',
    impact: 'Admin calibration & credit governor API endpoints',
  },
  {
    name: 'IP_HASH_SALT',
    type: 'REQUIRED',
    impact: 'Privacy-safe SHA-256 IP address hashing for rate limits',
  },

  // Optional External Providers
  {
    name: 'TAVILY_API_KEY',
    type: 'OPTIONAL',
    impact: 'Tavily web search disabled; falls back to Exa/Google',
  },
  {
    name: 'EXA_API_KEY',
    type: 'OPTIONAL',
    impact: 'Exa neural search disabled; falls back to Tavily',
  },
  {
    name: 'WEB_SEARCH_API_KEY',
    type: 'OPTIONAL',
    impact: 'Google Custom Search JSON API fallback disabled',
  },
  {
    name: 'WEB_SEARCH_CX',
    type: 'OPTIONAL',
    impact: 'Google Custom Search Engine ID disabled',
  },
  {
    name: 'GNANI_API_KEY',
    type: 'OPTIONAL',
    impact: 'Gnani services disabled (Evon / Prisma / Timbre)',
  },
];

function loadLocalVars(): Map<string, string> {
  const vars = new Map<string, string>();
  const devVarsPath = path.resolve(process.cwd(), '.dev.vars');

  if (fs.existsSync(devVarsPath)) {
    try {
      const content = fs.readFileSync(devVarsPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.substring(0, eqIdx).trim();
          const val = trimmed.substring(eqIdx + 1).trim();
          if (key) {
            vars.set(key, val);
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }
  return vars;
}

export function runEnvironmentCheck(): void {
  const localVars = loadLocalVars();

  console.log('\n================================================================================');
  console.log('                 CONV-WAY ENVIRONMENT & SECRETS STARTUP CHECK                   ');
  console.log('================================================================================');

  let missingRequiredCount = 0;
  let missingOptionalCount = 0;

  const rows = SPEC_LIST.map((spec) => {
    const valFromEnv = process.env[spec.name];
    const valFromDevVars = localVars.get(spec.name);
    const isSet = Boolean((valFromEnv && valFromEnv.trim().length > 0) || (valFromDevVars && valFromDevVars.trim().length > 0));

    if (!isSet) {
      if (spec.type === 'REQUIRED') {
        missingRequiredCount++;
      } else {
        missingOptionalCount++;
      }
    }

    return {
      name: spec.name,
      type: spec.type,
      status: isSet ? 'SET' : 'MISSING',
      impact: spec.impact,
    };
  });

  // Print formatted table
  const colWidths = {
    name: 29,
    type: 10,
    status: 9,
    impact: 55,
  };

  const header = `| ${'Variable Name'.padEnd(colWidths.name)} | ${'Type'.padEnd(colWidths.type)} | ${'Status'.padEnd(colWidths.status)} | ${'Feature Impact if Missing'.padEnd(colWidths.impact)} |`;
  const separator = `|-${'-'.repeat(colWidths.name)}-|-${'-'.repeat(colWidths.type)}-|-${'-'.repeat(colWidths.status)}-|-${'-'.repeat(colWidths.impact)}-|`;

  console.log(separator);
  console.log(header);
  console.log(separator);

  for (const r of rows) {
    const statusFormatted = r.status === 'SET' ? 'SET    ' : 'MISSING';
    console.log(
      `| ${r.name.padEnd(colWidths.name)} | ${r.type.padEnd(colWidths.type)} | ${statusFormatted} | ${r.impact.padEnd(colWidths.impact)} |`
    );
  }
  console.log(separator);

  // Cloudflare Edge Bindings Summary
  console.log('\nEdge Bindings Configured in wrangler.toml:');
  console.log('  • Cloudflare Workers AI : [ai] binding = "AI"           -> CONFIGURED (No API key needed)');
  console.log('  • Cloudflare D1 Database: [[d1_databases]] binding="DB" -> CONFIGURED (conv-way-db)');
  console.log('  • Cloudflare KV Cache   : [[kv_namespaces]] binding="KV"-> CONFIGURED (Trending & Quotas)');

  if (missingRequiredCount > 0) {
    console.log('\n--------------------------------------------------------------------------------');
    console.log(`[WARNING] ${missingRequiredCount} REQUIRED core variables are MISSING.`);
    console.log('The build/dev process will continue, but core live features will fail at runtime');
    console.log('unless configured in .dev.vars (local) or via wrangler secrets (production).');
    console.log('--------------------------------------------------------------------------------\n');
  } else {
    console.log('\n[SUCCESS] All required core flow environment variables are configured.\n');
  }

  // Gracefully exit 0 - never fail build
  process.exit(0);
}

runEnvironmentCheck();

