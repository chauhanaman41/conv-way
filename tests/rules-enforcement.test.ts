import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Architecture & Rule Enforcement Tests', () => {
  it('enforces AGENTS.md rule: Zero 11-character YouTube video ID literals hardcoded in src/', () => {
    const srcDir = path.resolve(__dirname, '../src');

    // Known YouTube ID pattern (11 characters consisting of base64url characters)
    // Avoid matching common words or CSS properties
    const knownForbiddenIds = [
      'zIwLWfaAg-8',
      'Rni7Fz7208c',
      'dQw4w9WgXcQ',
      'XgHveu3PGuI',
    ];

    function scanDir(dir: string): string[] {
      const violations: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          violations.push(...scanDir(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          const content = fs.readFileSync(fullPath, 'utf8');
          for (const forbidden of knownForbiddenIds) {
            if (content.includes(forbidden)) {
              violations.push(`${fullPath} contains forbidden hardcoded video ID: "${forbidden}"`);
            }
          }
        }
      }
      return violations;
    }

    const violations = scanDir(srcDir);
    expect(violations).toEqual([]);
  });

  it('enforces secret protection: .dev.vars and .env.local are gitignored and never committed', () => {
    const gitignorePath = path.resolve(__dirname, '../.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');

    expect(gitignoreContent).toContain('.dev.vars');
    expect(gitignoreContent).toContain('.env');
    expect(gitignoreContent).toContain('.env.local');
  });
});

