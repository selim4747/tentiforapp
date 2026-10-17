import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { sanitizePublicData } from '../scripts/visibility.mjs';

const root = process.cwd();
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const pkg = readJson('package.json');
const data = readJson('veri.json');
const manifest = readJson('manifest.webmanifest');
const shellPkg = readJson('uygulama/kabuk/package.json');
const apkPath = path.join(root, 'uygulama/indir/tentiforapp.apk');
const apkMetaPath = path.join(root, 'uygulama/indir/apk.json');
const apkMeta = fs.existsSync(apkMetaPath) && fs.existsSync(apkPath) ? readJson('uygulama/indir/apk.json') : null;
const apkMatchesCurrent = Boolean(apkMeta && apkMeta.version === pkg.version);
const androidGradle = fs.readFileSync(path.join(root, 'uygulama/kabuk/android/app/build.gradle'), 'utf8');
const androidVersionCode = Number(androidGradle.match(/versionCode\s+(\d+)/)?.[1]);
const androidVersionName = androidGradle.match(/versionName\s+"([^"]+)"/)?.[1];
const versionCompare = (left, right) => {
  const a = left.split('.').map(Number); const b = right.split('.').map(Number);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const na = a[i] ?? 0;
    const nb = b[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
};

assert.match(pkg.version, /^\d+\.\d+\.\d+(?:\.\d+)?$/);
assert.equal(data.surum, pkg.version, 'veri.json package.json ile aynı sürümü taşımalı');
assert.equal(manifest.version, pkg.version, 'manifest package.json ile aynı sürümü taşımalı');
assert.equal(versionCompare(shellPkg.version, pkg.version), 0, 'Android kabuğu web sürümüyle aynı olmalı');
assert.equal(shellPkg.version, androidVersionName, 'Android package sürümü Gradle native sürümüyle eşleşmeli');
if (apkMeta) {
  assert.equal(apkMeta.sizeBytes, fs.statSync(apkPath).size, 'APK metadata boyutu binary ile aynı olmalı');
  assert.equal(apkMeta.sha256, crypto.createHash('sha256').update(fs.readFileSync(apkPath)).digest('hex'), 'APK metadata hash’i binary ile aynı olmalı');
  if (apkMatchesCurrent) {
    assert.equal(versionCompare(apkMeta.version, pkg.version), 0, 'güncel Android APK’si web sürümüyle aynı olmalı');
    assert.equal(apkMeta.version, androidVersionName, 'güncel APK metadata sürümü Android native sürümüyle eşleşmeli');
    assert.equal(apkMeta.versionCode, androidVersionCode, 'güncel APK metadata versionCode’u Gradle native versionCode ile eşleşmeli');
    assert.equal(apkMeta.surum, apkMeta.version, 'indirme menüsü güncel APK sürümünü gösterebilmeli');
    assert.equal(Number(apkMeta.kod), Number(apkMeta.versionCode), 'indirme menüsü güncel APK build kodunu alabilmeli');
    assert.equal(Number(apkMeta.boyut), Number(apkMeta.sizeBytes), 'indirme menüsü APK boyutunu gösterebilmeli');
  }
}
const assetLinks = readJson('.well-known/assetlinks.json');
assert.ok(assetLinks.some((entry) => entry.target?.sha256_cert_fingerprints?.some((fp) => fp.replaceAll(':', '').toLowerCase() === '7dde5a8e4ab8e285fc5fae67987279c0da81f842ef6b37c9c9346c09991512de')), 'yeni release APK fingerprint’i App Links allowlistesinde olmalı');
assert.equal(manifest.name, 'TentiFor', 'PWA görünen adı TentiFor olmalı; sürüm version alanında korunur');
assert.match(fs.readFileSync(path.join(root, 'README.md'), 'utf8').split('\n')[0], new RegExp(`v${pkg.version.replaceAll('.', '\\.')}`));
assert.ok(fs.existsSync(path.join(root, 'supabase/migrations/20261003_629_security.sql')), '6.2.9 security migration eksik');
assert.match(fs.readFileSync(path.join(root, 'js/core/odeme.js'), 'utf8'), /TF4_PAYTR_HUKUK_GATED=true/);
assert.match(fs.readFileSync(path.join(root, 'supabase/kurulum.sql'), 'utf8'), /public_profiller/);
assert.ok(fs.existsSync(path.join(root, 'supabase/migrations/20261003_6210_offline_operations.sql')), '6.2.10 offline migration eksik');
assert.ok(fs.existsSync(path.join(root, 'js/core/95-offline-transport.js')), 'offline transport modülü eksik');
assert.ok(fs.existsSync(path.join(root, 'supabase/migrations/20261003_6212_audit_quality.sql')), '6.2.12 audit migration eksik');
const runBuild = () => execFileSync(process.execPath, ['scripts/paketle.mjs'], { cwd: root, encoding: 'utf8', env: { ...process.env, TF_SEO_STATIC_ONLY: '1' } });
runBuild();
const first = readJson('surum.json');
const firstHash = first.paket;
assert.equal(fs.existsSync(path.join(root, 'dist/uygulama/indir/apk.json')), apkMatchesCurrent, 'eski sürümlü APK metadata’sı web production çıktısına taşınmamalı');
assert.match(fs.readFileSync(path.join(root, 'dist/tomye/index.html'), 'utf8'), /Tömye — TentiFor/);
assert.match(fs.readFileSync(path.join(root, 'dist/harita/index.html'), 'utf8'), /Harita — TentiFor/, 'doğrudan harita adresi gerçek bir app-shell route olarak üretilmeli');
assert.ok(fs.existsSync(path.join(root, 'supabase/migrations/20261003_630_discovery.sql')), '6.3 discovery migration eksik');
assert.ok(fs.existsSync(path.join(root, 'supabase/migrations/20261003_631_archive_tools.sql')), '6.3.1 archive tools migration eksik');
assert.ok(fs.existsSync(path.join(root, 'supabase/migrations/20261003_632_social_feed.sql')), '6.3.2 social feed migration eksik');
assert.ok(fs.existsSync(path.join(root, 'js/engine/takip-akisi-topluluk.js')), '6.3.2 topluluk modülü eksik');
assert.ok(fs.existsSync(path.join(root, 'supabase/migrations/20261003_633_builder.sql')), '6.3.3 builder migration eksik');
assert.ok(fs.existsSync(path.join(root, 'js/engine/evren-kurucu-calisma-alani.js')), '6.3.3 kurucu modülü eksik');
assert.ok(fs.existsSync(path.join(root, 'supabase/migrations/20261003_634_discovery_feed.sql')), '6.3.4 discovery migration eksik');
assert.ok(fs.existsSync(path.join(root, 'js/engine/kesif-kisisellestirme.js')), '6.3.4 keşif modülü eksik');
assert.ok(fs.existsSync(path.join(root, 'supabase/migrations/20261003_635_quality_privacy.sql')), '6.3.5 privacy migration eksik');
assert.ok(fs.existsSync(path.join(root, 'js/engine/arsivci-analitik-gizlilik.js')), '6.3.5 kalite modülü eksik');
assert.ok(fs.existsSync(path.join(root, 'supabase/migrations/20261003_636_gamification.sql')), '6.3.6 gamification migration eksik');
assert.ok(fs.existsSync(path.join(root, 'js/engine/okuma-serisi-gorevler.js')), '6.3.6 görev modülü eksik');
assert.ok(fs.existsSync(path.join(root, 'supabase/migrations/20261003_637_moderation.sql')), '6.3.7 moderation migration eksik');
assert.ok(fs.existsSync(path.join(root, 'js/engine/moderasyon-karantina.js')), '6.3.7 moderasyon modülü eksik');
assert.ok(fs.existsSync(path.join(root, 'supabase/migrations/20261005_visual_universe_map_timeline.sql')), '6.3.8 görsel harita/zaman çizelgesi migration eksik');
assert.ok(fs.existsSync(path.join(root, 'js/engine/evren-harita-zaman-cizelgesi.js')), '6.3.8 harita/zaman çizelgesi modülü eksik');
assert.ok(fs.existsSync(path.join(root, 'supabase/migrations/20261005_visual_universe_map_timeline_639_seo_cards.sql')), '6.3.9 public SEO migration eksik');
assert.ok(fs.existsSync(path.join(root, 'scripts/public-seo.mjs')), '6.3.9 static SEO builder eksik');
assert.ok(fs.existsSync(path.join(root, 'js/engine/seo-meta.js')), '6.3.9 SPA SEO/paylaşım kartı modülü eksik');
assert.ok(fs.existsSync(path.join(root, 'js/arayuz/32-ux-642.js')), '6.4.2 kişisel merkez modülü eksik');
assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /js\/arayuz\/32-ux-642\.js/);
assert.ok(fs.existsSync(path.join(root, 'dist/evren/e126/index.html')), 'public evren SEO rotası eksik');
assert.ok(fs.existsSync(path.join(root, 'supabase/migrations/20261005_visual_universe_map_timeline_639_seo_cards_6310_secure_sharing.sql')), '6.3.10 güvenli paylaşım migration eksik');
assert.ok(fs.existsSync(path.join(root, 'supabase/migrations/20261005_release_6313.sql')), '6.3.13 profil paylaşım migration eksik');
assert.ok(fs.existsSync(path.join(root, 'js/engine/profile-sharing-6313.js')), '6.3.13 profil/alinti paylaşım modülü eksik');
assert.ok(fs.existsSync(path.join(root, 'js/engine/free-universe-cleanup-6313.js')), '6.3.13 boş evren silme modülü eksik');
assert.ok(fs.existsSync(path.join(root, 'js/engine/secure-sharing.js')), '6.3.10 güvenli paylaşım istemcisi eksik');
const webVersionRegex = pkg.version.replaceAll('.', '\\.');
assert.match(fs.readFileSync(path.join(root, 'js/core/78-uygulama-kabugu.js'), 'utf8'), new RegExp(`p_surum:"${webVersionRegex}"`));
const setupSqlForVersion = fs.readFileSync(path.join(root, 'supabase/kurulum.sql'), 'utf8');
const setupFn = setupSqlForVersion.match(/create or replace function public\.kurulum_surumu\b[\s\S]*?select '([^']+)'::text/);
const setupVersion = setupFn && setupFn[1];
const setupTarget = fs.readFileSync(path.join(root, 'js/paket-4.js'), 'utf8').match(/const KURULUM_BEKLENEN="([^"]+)"/)?.[1];
assert.ok(setupVersion && setupTarget, 'Supabase ve uygulama backend schema sürümü okunabilmeli');
assert.equal(setupTarget, setupVersion, 'Yönetim paneli beklenen schema sürümü Supabase kurulum sürümüyle aynı olmalı');
assert.ok(fs.existsSync(path.join(root, 'js/engine/kisisel-arsiv-araclari.js')), '6.3.1 arşiv modülü eksik');
assert.ok(fs.existsSync(path.join(root, 'js/engine/kesif-kullanici-profili.js')), '6.3 keşif modülü eksik');
assert.match(fs.readFileSync(path.join(root, 'supabase/migrations/20261003_630_discovery.sql'), 'utf8'), /public_kullanici_profili/);

assert.match(fs.readFileSync(path.join(root, 'js/engine/91-v473-uyelik.js'), 'utf8'), new RegExp(`SURUM = '${pkg.version.replaceAll('.', '\\.')}'`));
assert.ok(fs.existsSync(path.join(root, 'package-lock.json')), 'bağımlılık lock dosyası eksik');
const retiredPattern = ['cl' + 'aude', 'et' + 'erya', 'fornek-' + 'et' + 'erya'].join('|');
const retiredSearch = spawnSync('git', ['grep', '-il', '-E', retiredPattern, '--', ':!node_modules', ':!tests/**'], { cwd: root, encoding: 'utf8' });
const retiredFiles = (retiredSearch.stdout || '').trim();
assert.equal(retiredFiles, '', 'emekli evren içerikleri kaynakta veya izlenen çıktıda kalmamalı');

runBuild();
const second = readJson('surum.json');
assert.equal(second.paket, firstHash, 'aynı girdiler deterministik paket hash üretmeli');
assert.equal(second.kuruldu, first.kuruldu, 'aynı hash yeniden build edilince kurulum tarihi değişmemeli');
for (const file of ['dist/evren/e25/index.html', 'dist/evren/e99/index.html', 'dist/tomye/index.html', 'dist/fan/index.html', 'dist/oyunlar/index.html', 'dist/atolye/index.html', 'dist/okuma/index.html', 'dist/harita/index.html', 'dist/404.html']) {
  assert.ok(fs.existsSync(path.join(root, file)), `${file} public SEO fallback çıktısı eksik`);
}
assert.ok(fs.existsSync(path.join(root, 'favicon.ico')) && fs.existsSync(path.join(root, 'dist/favicon.ico')) && fs.existsSync(path.join(root, 'uygulama/kabuk/www/favicon.ico')), 'favicon web ve APK çıktılarında bulunmalı');
assert.ok(fs.readFileSync(path.join(root, 'favicon.ico')).equals(fs.readFileSync(path.join(root, 'dist/favicon.ico'))), 'favicon dist ile aynı olmalı');
assert.ok(fs.readFileSync(path.join(root, 'favicon.ico')).equals(fs.readFileSync(path.join(root, 'uygulama/kabuk/www/favicon.ico'))), 'favicon Capacitor www ile aynı olmalı');
const seoPage = fs.readFileSync(path.join(root, 'dist/evren/e25/index.html'), 'utf8');
assert.match(seoPage, /property="og:title"/);
assert.match(seoPage, /twitter:card/);
assert.match(seoPage, /data-tf639-card/);
assert.match(fs.readFileSync(path.join(root, 'dist/404.html'), 'utf8'), /noindex, follow/);
const sitemap = fs.readFileSync(path.join(root, 'dist/sitemap.xml'), 'utf8');
assert.match(sitemap, /https:\/\/tentifor\.com\/evren\/e25\//);
assert.doesNotMatch(sitemap, /\/u\/|okuma-yolu\//, 'static-only build must not invent/private-list user routes');

const compare = (a, b) => {
  assert.equal(fs.readFileSync(path.join(root, a), 'utf8'), fs.readFileSync(path.join(root, b), 'utf8'), `${a} ve ${b} senkron olmalı`);
};
for (const file of ['index.html', 'surum.json', 'manifest.webmanifest', 'sw.js']) {
  compare(file, path.join('uygulama/kabuk/www', file));
  compare(file, path.join('dist', file));
}
// Kaynak veri korunur; web/APK paketleri geçici görünürlük filtresinden geçmiş kopyayı taşır.
for (const file of ['veri.json']) {
  const expected = JSON.stringify(sanitizePublicData(readJson(file)));
  for (const target of [path.join('uygulama/kabuk/www', file), path.join('dist', file)]) {
    assert.equal(JSON.stringify(readJson(target)), expected, `${file} yayın filtresiyle senkron olmalı`);
  }
}
assert.ok(fs.readFileSync(path.join(root, 'index.html'), 'utf8').includes('href="/favicon.ico"'), 'index favicon URL must use the root icon');
assert.equal(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/const ONBELLEK = "tentiforapp-([^"]+)"/)[1], second.paket);
const indexText = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const swText = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const cssHash = crypto.createHash('md5').update(fs.readFileSync(path.join(root, 'css/style.css'))).digest('hex').slice(0, 12);
for (const [name, text] of [['index.html', indexText], ['sw.js', swText]]) {
  assert.ok(text.includes(`css/style.css?v=${cssHash}`), `${name} CSS cache-buster must match the current stylesheet`);
}
assert.ok(swText.includes('"favicon.ico"'), 'service worker must precache the favicon');
assert.match(indexText, new RegExp(`js/arayuz/34-ux-645\\.js\\?v=${second.paket}`), '6.4.5 UX script cache sürümü güncel olmalı');
assert.match(swText, new RegExp(`js/arayuz/33-ux-644\\.js\\?v=${second.paket}`), '6.4.4 UX script Service Worker’da sürümlü olmalı');
assert.match(swText, new RegExp(`js/arayuz/34-ux-645\\.js\\?v=${second.paket}`), '6.4.5 UX script Service Worker’da sürümlü olmalı');
const headersText = fs.readFileSync(path.join(root, '_headers'), 'utf8');
assert.doesNotMatch(headersText, /Access-Control-Allow-Origin:\s*\*/i, 'global wildcard CORS başlığı bulunmamalı');
assert.match(headersText, /Content-Security-Policy-Report-Only:/, 'CSP raporlama politikası bulunmalı');
const setupSql = fs.readFileSync(path.join(root, 'supabase/kurulum.sql'), 'utf8');
for (const fn of ['kurulum_surumu', 'abonelik_hediye', 'kullaniciya_bildir', 'bildirimlerim']) {
  const count = (setupSql.match(new RegExp(`create or replace function public\\.${fn}\\b`, 'g')) || []).length;
  assert.equal(count, 1, `kurulum.sql içinde ${fn} tek kez tanımlı olmalı`);
}
assert.match(swText, /yedekKopya\(istek, true\)/, 'sürümlü asset eski query kopyasına düşmemeli');
assert.match(fs.readFileSync(path.join(root, 'supabase/kurulum.sql'), 'utf8'), /where endpoint = p_endpoint and kullanici = auth\.uid\(\)/, 'push unsubscribe must be owner-scoped');
assert.match(fs.readFileSync(path.join(root, 'js/topluluk/41-bildirim.js'), 'utf8'), /bildirimYerelMi\(\).*bildirimYerelAcikMi/, 'APK notifications must not depend on VAPID');
assert.match(fs.readFileSync(path.join(root, 'js/core/46-guncelleme.js'), 'utf8'), /getRegistration\("\/"\)/, 'güncelleme worker kaydını kökten almalı');
assert.ok(fs.existsSync(path.join(root, 'supabase/migrations/20261012_645_device_sessions.sql')), '6.4.5 cihaz oturum migration’ı eksik');
assert.match(fs.readFileSync(path.join(root, 'supabase/migrations/20261012_645_device_sessions.sql'), 'utf8'), /nullif\(btrim\(coalesce\(p_ad,''\)\), ''\)/, 'boş cihaz adı normalize edilmeli');
for (const asset of ['js/paket-2.js', 'js/engine/92-v51-dashboard.js', 'js/engine/evren-harita-zaman-cizelgesi.js', 'js/engine/seo-meta.js', 'js/engine/secure-sharing.js', 'js/engine/profile-sharing-6313.js', 'js/engine/free-universe-cleanup-6313.js']) {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(indexText, new RegExp(`${escaped}\\?v=${second.paket}`), `${asset} index cache sürümü güncel olmalı`);
  assert.match(swText, new RegExp(`${escaped}\\?v=${second.paket}`), `${asset} service worker cache sürümü güncel olmalı`);
}
console.log('Release hygiene: PASS (web/native version separation, deterministic hash, APK/dist sync)');

process.exit(0);
