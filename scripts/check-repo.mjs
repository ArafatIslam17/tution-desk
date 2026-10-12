#!/usr/bin/env node
/**
 * Repository safety check (runs in CI and via `npm run check:repo`).
 * Fails if tracked files contain secrets or anything that looks like private tuition data.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' }).split('\n').filter(Boolean);
const problems = [];

// Files that must never be committed: environment files, backups/exports, database dumps.
const forbiddenName = [
  /(^|\/)\.env(\..*)?$/i, /(^|\/)\.vercel\//, /backup.*\.json$/i, /tuition-backup.*\.json$/i,
  /\.(sql\.gz|dump|backup|bak|sqlite3?|db)$/i, /(^|\/)supabase\/(?!schema\.sql$).*\.sql$/i,
];
const allowName = [/^\.env\.example$/];

// Content that looks like a credential. The publishable/anon key is public by design but still belongs in Vercel, not git.
const secretContent = [
  [/eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/, 'JSON Web Token (Supabase key or session)'],
  [/\bsb_secret_[A-Za-z0-9_-]{10,}/, 'Supabase secret key'],
  [/\bsb_publishable_[A-Za-z0-9_-]{10,}/, 'Supabase publishable key (configure it in Vercel instead)'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub token'],
  [/\bvercel_[A-Za-z0-9]{20,}|\bVERCEL_TOKEN\s*=\s*\S{10,}/, 'Vercel token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/postgres(ql)?:\/\/[^:\s]+:[^@\s]{6,}@/, 'database connection string with password'],
  [/https:\/\/[a-z0-9]{20}\.supabase\.co/, 'real Supabase project URL (configure it in Vercel instead)'],
];

for (const f of files) {
  if (forbiddenName.some(r => r.test(f)) && !allowName.some(r => r.test(f))) problems.push(`${f}: file type must not be committed`);
  if (/\.(png|jpe?g|webp|gif|ico|woff2?)$/i.test(f) || f === 'package-lock.json') continue;
  let text; try { text = readFileSync(f, 'utf8'); } catch { continue; }
  for (const [re, label] of secretContent) if (re.test(text)) problems.push(`${f}: looks like a ${label}`);
}

if (problems.length) { console.error('Repository safety check FAILED:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log(`Repository safety check passed (${files.length} files).`);
