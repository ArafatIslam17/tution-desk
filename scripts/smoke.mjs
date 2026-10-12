#!/usr/bin/env node
/**
 * Smoke test of a built site. Usage:
 *   node scripts/smoke.mjs                 → serves ./dist with `vite preview` and checks it
 *   node scripts/smoke.mjs https://site    → checks a deployed site
 * Checks: the page loads over HTTP 200, references hashed JS/CSS that also load, and the
 * built bundle is not the browser-only preview build.
 */
import { spawn } from 'node:child_process';

const target = process.argv[2];
let server;
async function waitFor(url, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { const r = await fetch(url); if (r.ok) return; } catch {} await new Promise(r => setTimeout(r, 250)); }
  throw new Error('server did not start: ' + url);
}
const fail = m => { console.error('SMOKE FAIL: ' + m); server?.kill(); process.exit(1); };

const base = target || 'http://localhost:4318';
if (!target) { server = spawn('npx', ['vite', 'preview', '--port', '4318', '--strictPort'], { stdio: 'ignore' }); await waitFor(base); }

const res = await fetch(base + '/');
if (res.status !== 200) fail(`GET / returned ${res.status}`);
const html = await res.text();
if (!/<title>Tuition Desk<\/title>/.test(html)) fail('page title missing');
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1]);
if (!assets.some(a => a.endsWith('.js')) || !assets.some(a => a.endsWith('.css'))) fail('hashed JS/CSS references missing');
for (const a of assets) { const r = await fetch(base + a); if (r.status !== 200) fail(`${a} returned ${r.status}`); }
const js = await (await fetch(base + assets.find(a => a.endsWith('.js')))).text();
if (js.includes('tuition-desk-local-v1')) fail('bundle contains the browser-only preview backend');
console.log(`Smoke test passed: ${base} (${assets.length} assets)`);
server?.kill();
