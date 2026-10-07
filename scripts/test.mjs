import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const tests = [
  'tests/calistir.mjs',
  'tests/5.1-dashboard.mjs',
  'tests/5.2-membership.mjs',
  'tests/5.3-regressions.mjs',
  'tests/5.3.2-vitrin.mjs',
  'tests/5.3.3-profile-badges.mjs',
  'tests/5.3.4-layout-notifications.mjs',
  'tests/5.3.4-gifting.mjs',
  'tests/5.4.0-store.mjs',
  'tests/5.4-complete.mjs',
  'tests/offline-yavas.mjs',
  'tests/kullanici-simulasyonu.mjs',
  'tests/release-hygiene.mjs',
  'tests/offline-queue.mjs',
  'tests/cakisma.mjs',
  'tests/ortak-evren.mjs',
  'tests/android-native.mjs',
  'tests/6.1-universe-center.mjs',
  'tests/mobile-menu-regression.mjs',
  'tests/6.3-discovery.mjs',
  'tests/6.3.1-archive-tools.mjs',
  'tests/6.3.2-social-feed.mjs',
  'tests/6.3.3-builder.mjs',
  'tests/6.3.4-discovery-feed.mjs',
  'tests/6.3.5-quality-privacy.mjs',
  'tests/6.3.6-gamification.mjs',
  'tests/6.3.7-moderation.mjs',
  'tests/6.3.8-visual-universe.mjs',
  'tests/6.3.9-public-seo.mjs',
  'tests/6.3.10-secure-sharing.mjs',
  'tests/6.2-platform.mjs',
  'tests/termux-library.mjs',
  'tests/tentifor-terminal.mjs',
  'tests/terminal-integration-regression.mjs',
  'tests/test-runner-exit-code.mjs',
  'tests/domain-brand-regression.mjs'
];

const server = spawn(process.execPath, ['server.js'], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk; });
server.stderr.on('data', (chunk) => { serverOutput += chunk; });

async function serverReady() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:3000/');
      if (response.ok) return;
    } catch {}
    await wait(100);
  }
  throw new Error(`Yerel sunucu başlatılamadı. ${serverOutput}`);
}

function run(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${file} başarısız oldu (code=${code}, signal=${signal || 'yok'})`));
    });
  });
}

try {
  await serverReady();
  for (const test of tests) await run(test);
  console.log('\nTüm uygulama regression testleri başarılı.');
} finally {
  try { server.kill('SIGKILL'); } catch {}
}
