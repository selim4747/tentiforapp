import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const roots = ['server.js', 'scripts', 'tests', 'js'];
const skip = new Set(['js/vendor']);
const files = [];

function collect(relative) {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) return;
  const stat = fs.statSync(full);
  if (stat.isFile()) {
    if (/\.(?:js|mjs)$/.test(full) && !/^js\/paket-\d+\.js$/.test(relative)) files.push(full);
    return;
  }
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const child = path.join(relative, entry.name);
    if ([...skip].some((item) => child === item || child.startsWith(`${item}/`))) continue;
    collect(child);
  }
}

roots.forEach(collect);
files.sort();
for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
execFileSync(process.execPath, [path.join(root, 'node_modules/eslint/bin/eslint.js'), ...files], { stdio: 'inherit' });
console.log(`Lint passed: ${files.length} JavaScript dosyası syntax ve ESLint kontrolünden geçti.`);
