import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';

const probe = http.createServer();
await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-test-runner-'));
try {
  fs.writeFileSync(path.join(temp, 'package.json'), '{"type":"module"}');
  fs.writeFileSync(path.join(temp, 'server.js'), `import http from 'node:http';http.createServer((q,r)=>{r.end('ok')}).listen(${port},'127.0.0.1');`);
  fs.writeFileSync(path.join(temp, 'failure.mjs'), "console.error('INTENTIONAL TEST FAILURE');process.exit(7);\n");
  const runner = fs.readFileSync('scripts/test.mjs', 'utf8')
    .replace(/const tests = \[[\s\S]*?\];/, "const tests = ['failure.mjs'];")
    .replace('http://127.0.0.1:3000/', `http://127.0.0.1:${port}/`);
  fs.writeFileSync(path.join(temp, 'runner.mjs'), runner);
  const result = spawnSync(process.execPath, ['runner.mjs'], { cwd: temp, encoding: 'utf8', timeout: 15000 });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0, 'Başarısız alt test runner tarafından exit 0 ile gizlenmemeli');
  assert.match(result.stderr, /INTENTIONAL TEST FAILURE/);
  assert.doesNotMatch(result.stdout, /Tüm uygulama regression testleri başarılı/);
  console.log('Test runner negative regression: PASS (intentional failure propagates nonzero exit).');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
