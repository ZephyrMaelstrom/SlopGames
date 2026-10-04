#!/usr/bin/env node
// SlopGames build: re-inline the kernel into every game file, validate, and sync games/registry.json.
//
//   node tools/build.mjs                 # rebuild all games with their pinned kernel version
//   node tools/build.mjs --upgrade       # move every game to the latest kernel
//   node tools/build.mjs --kernel=1.1.0  # pin every game to a specific kernel
//   node tools/build.mjs pop-rush        # only these game ids
//   node tools/build.mjs --check         # validate only, write nothing
//
// No dependencies. Exit code 1 if any game has validation errors.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
vm.runInThisContext(readFileSync(join(ROOT, 'platform/validate.js'), 'utf8'));
const SG = globalThis.SG;

const args = process.argv.slice(2);
const flag = n => args.find(a => a === '--' + n || a.startsWith('--' + n + '='));
const val = n => { const f = flag(n); return f && f.includes('=') ? f.split('=')[1] : null; };
const only = args.filter(a => !a.startsWith('--'));
const check = !!flag('check');

const versions = JSON.parse(readFileSync(join(ROOT, 'kernel/versions.json'), 'utf8'));
const latest = versions.latest;
const kernelSrc = v => { const p = join(ROOT, `kernel/kernel-${v}.js`); if (!existsSync(p)) throw new Error(`kernel ${v} not found`); return readFileSync(p, 'utf8'); };

const regPath = join(ROOT, 'games/registry.json');
const registry = JSON.parse(readFileSync(regPath, 'utf8'));
const byId = Object.fromEntries(registry.games.map(g => [g.id, g]));

let failed = 0;
const rows = [];
for (const dir of readdirSync(join(ROOT, 'games')).sort()) {
  const file = join(ROOT, 'games', dir, 'index.html');
  if (!statSync(join(ROOT, 'games', dir)).isDirectory() || !existsSync(file)) continue;
  if (only.length && !only.includes(dir)) continue;
  let html = readFileSync(file, 'utf8');
  const pinned = SG.kernelVersion(html);
  const target = val('kernel') || (flag('upgrade') ? latest : pinned || latest);
  if (!check) html = SG.assemble(html, kernelSrc(target));
  const v = SG.validate(html);
  if (v.info.id && v.info.id !== dir) v.errors.push(`MANIFEST.id "${v.info.id}" does not match folder "${dir}"`);
  if (!byId[dir]) v.warnings.push('not listed in games/registry.json');
  if (v.errors.length) failed++;
  if (!check) {
    writeFileSync(file, html);
    if (byId[dir]) { byId[dir].kernel = SG.kernelVersion(html); byId[dir].sizeKB = v.info.sizeKB; }
  }
  rows.push({ id: dir, kernel: SG.kernelVersion(html), kb: v.info.sizeKB, scenes: v.info.scenes.length, errors: v.errors, warnings: v.warnings });
}
if (!check) { registry.updated = new Date().toISOString().slice(0, 10); writeFileSync(regPath, JSON.stringify(registry, null, 2) + '\n'); }

for (const r of rows) {
  console.log(`${r.errors.length ? '✘' : '✔'} ${r.id.padEnd(22)} kernel ${String(r.kernel).padEnd(7)} ${String(r.kb).padStart(5)} KB  ${r.scenes} scenes`);
  r.errors.forEach(e => console.log('    error:   ' + e));
  r.warnings.forEach(w => console.log('    warning: ' + w));
}
console.log(`\n${rows.length} game(s), ${failed} with errors${check ? ' (check only)' : ''}.`);
process.exit(failed ? 1 : 0);
