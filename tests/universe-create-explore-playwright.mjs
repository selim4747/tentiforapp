import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const port = Number(process.env.TF_CREATE_EXPLORE_PORT || 3199);
const baseURL = process.env.TF_CREATE_EXPLORE_URL || `http://127.0.0.1:${port}`;
let server;
let browser;
let output = '';

async function ready() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseURL}/`);
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Yerel uygulama sunucusu başlamadı: ${output}`);
}

try {
  server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', (chunk) => { output += chunk; });
  server.stderr.on('data', (chunk) => { output += chunk; });
  server.on('error', (error) => { output += `spawn error: ${error.message}\n`; });
  await ready();

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true
  });
  await context.route('https://static.cloudflareinsights.com/beacon.min.js*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript; charset=utf-8',
    body: ''
  }));
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const response = await page.goto(`${baseURL}/#/arsiv`, { waitUntil: 'domcontentloaded' });
  assert.equal(response.status(), 200, 'uygulama kabuğu başarılı yanıt vermeli');
  await page.waitForFunction(() => typeof window.evrenSeciciAc === 'function' && document.querySelector('#evrenSecBtn'));

  for (const width of [320, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const trigger = page.locator('#evrenSecBtn');
    assert.ok(await trigger.isVisible(), `${width}px genişlikte evren değiştir düğmesi görünür olmalı`);
    const box = await trigger.boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= width, `${width}px genişlikte seçici düğmesi ekran içinde kalmalı`);
    await trigger.click();
    await page.waitForSelector('#evrenSecici .es-panel');
    const search = page.locator('#esAra');
    assert.ok(await search.isVisible(), `${width}px genişlikte evren araması görünür olmalı`);
    await search.fill('Ax-24');
    const ax24 = page.locator('#evrenSecici .es-oge:not([hidden])').filter({ hasText: 'Ax-24' });
    assert.equal(await ax24.count(), 1, `${width}px genişlikte arama tek Ax-24 sonucunu bulmalı`);
    assert.equal(await page.locator('#evrenSecici .es-bulunamadi').isVisible(), false, 'eşleşme bulunduğunda boş durum gizli kalmalı');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#evrenSecici', { state: 'detached' });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#evrenSecBtn').click();
  await page.locator('#esAra').fill('E25');
  const e25 = page.locator('#evrenSecici .es-oge:not([hidden])').filter({ hasText: 'E25' });
  assert.equal(await e25.count(), 1, 'evren araması E25 için tek seçim sunmalı');
  await e25.click();
  await page.waitForFunction(() => location.pathname.includes('/evren/e25') || location.hash.includes('/e25'));
  await page.keyboard.press('Escape');
  await page.waitForSelector('#evrenSayfa', { state: 'detached' });

  await page.locator('#evrenSecBtn').click();
  await page.locator('#evrenSecici [data-es-yeni]').click();
  await page.waitForSelector('#tf61-wizard-form');
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('.tf61-extra').getAttribute('open'), null, 'başlangıç seçenekleri ilk görünümde isteğe bağlı ve kapalı olmalı');
  assert.ok(await page.locator('#tf61-ad').isVisible(), 'evren adı hemen düzenlenebilir olmalı');
  assert.ok(await page.locator('#tf61-ozet').isVisible(), 'temel fikir hemen düzenlenebilir olmalı');
  assert.equal(await page.locator('#tf61-profil').isVisible(), false, 'profil seçicisi ilk görünümü büyütmemek için kapalı bölümde kalmalı');

  const submitBox = await page.locator('#tf61-wizard-form button[type="submit"]').boundingBox();
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  assert.ok(submitBox && submitBox.y >= 0 && submitBox.y + submitBox.height <= viewportHeight,
    `390px mobilde ana oluşturma eylemi ilk ekranda görünmeli (buton=${JSON.stringify(submitBox)}, yükseklik=${viewportHeight})`);
  await page.setViewportSize({ width: 320, height: 844 });
  const compactSubmit = await page.locator('#tf61-wizard-form button[type="submit"]').boundingBox();
  assert.ok(compactSubmit && compactSubmit.y >= 0 && compactSubmit.y + compactSubmit.height <= 844, `320px mobilde oluşturma eylemi ilk ekranda görünmeli: ${JSON.stringify(compactSubmit)}`);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.locator('.tf61-extra > summary').click();
  assert.equal(await page.locator('.tf61-extra').getAttribute('open'), '', 'isteğe bağlı başlangıç içeriği dokunmayla açılmalı');
  const profilePicker = page.locator('#tf61-profil');
  assert.ok(await profilePicker.isVisible(), 'profil seçimi başlangıç seçeneklerinde bulunmalı');
  assert.equal(await profilePicker.locator('option').count(), 8, 'boş başlangıç ve yedi profil sunulmalı');
  await profilePicker.selectOption('fantastik');
  await page.locator('#tf61-profile-note').waitFor();
  assert.match(await page.locator('#tf61-profile-note').textContent(), /Yalnızca boş bölümler doldurulur/);
  for (const field of ['#tf61-kisiler', '#tf61-yerler', '#tf61-kurallar', '#tf61-sozluk']) {
    assert.ok(await page.locator(field).isVisible(), `${field} isteğe bağlı bölüm açılınca erişilebilir olmalı`);
  }
  await page.locator('#tf61-ad').fill('P3 profile test');
  await page.locator('#tf61-tur').fill('Fantastik deney');
  await page.locator('#tf61-ozet').fill('Sihirli bir evren.');
  await page.locator('#tf61-kisiler').fill('Ada');
  await page.locator('#tf61-kurallar').fill('İlk kural');
  await page.locator('#tf61-wizard-form button[type="submit"]').click();
  await page.waitForFunction(() => location.hash.startsWith('#/ev/benim/'));
  await page.waitForSelector('#evrenSayfa');
  const starterState = await page.evaluate(() => {
    const id = decodeURIComponent(location.hash.split('/').pop());
    const item = window.fanEserlerim().find((x) => x.id === id);
    return { people: item.kisiler.map((x) => x.ad), rules: item.kurallar.map((x) => x.ad), customFields: item.ozelAlanlar.map((x) => x.ad), mapPlaces: item.harita.yerler.length };
  });
  assert.deepEqual(starterState.people, ['Ada'], 'şablon seçimi kullanıcının ilk karakterini korumalı');
  assert.deepEqual(starterState.rules, ['İlk kural'], 'şablon seçimi kullanıcının ilk kuralını korumalı');
  assert.ok(starterState.customFields.includes('Mevsimler'), 'şablon boş özel alanlara başlangıç içeriği eklemeli');
  assert.equal(starterState.mapPlaces, 5, 'şablon boş ana haritayı doldurmalı');

  await page.locator('#evrenSayfa [data-evs-sekme="kurucu"]').click();
  await page.waitForSelector('#evrenSayfa .evr-kurucu');
  assert.equal(await page.locator('#evrenSayfa [data-evt-tur]').count(), 7, 'kurucu profilleri ilk içerik girildikten sonra da görünür kalmalı');
  assert.ok(await page.locator('#evrenSayfa').getByText(/mevcut içerik korunur/).count(), 'profil kartları koruma davranışını açıklamalı');
  const profileOrder = await page.evaluate(() => {
    const profile = document.querySelector('#evrenSayfa [data-evt-tur]');
    const steps = document.querySelector('#evrenSayfa .evk-adimlar');
    return !!(profile && (!steps || (profile.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING)));
  });
  assert.ok(profileOrder, 'profil kartları adım listesinden önce gelmeli');
  await page.locator('#evrenSayfa .evr-kurucu button.evr-adim[data-evr-adim="dunya"]').click();
  await page.waitForSelector('#evrenSayfa .evr-kurucu [data-fan-ekle="ozelAlanlar"]');
  assert.ok(await page.locator('#evrenSayfa .evr-kurucu fieldset').filter({ hasText: 'Özel alanlar' }).count(), 'kodsuz özel alan grubu belirgin etiket taşımalı');
  await page.locator('#evrenSayfa .evr-kurucu [data-fan-ekle="ozelAlanlar"]').click();
  await page.waitForSelector('#evrenSayfa .evr-kurucu [data-fan-alan="ozelAlanlar.1.ad"]');
  await page.locator('#evrenSayfa .evr-kurucu [data-fan-alan="ozelAlanlar.1.ad"]').fill('Işık düzeni');
  await page.locator('#evrenSayfa .evr-kurucu [data-fan-alan="ozelAlanlar.1.deger"]').fill('Geceleyin gökyüzü yeşil parlar.');
  await page.locator('#evrenSayfa .evr-kurucu [data-fan-alan="kurallar.0.tur"]').fill('anı-zamanı');
  await page.waitForTimeout(650);
  const saved = await page.evaluate(() => {
    const id = decodeURIComponent(location.hash.split('/').pop());
    const item = window.fanEserlerim().find((x) => x.id === id);
    return { ruleType: item.kurallar[0].tur, field: item.ozelAlanlar.find((x) => x.ad === 'Işık düzeni') };
  });
  assert.equal(saved.ruleType, 'anı-zamanı', 'serbest kural türü kaydedilmeli');
  assert.equal(saved.field.deger, 'Geceleyin gökyüzü yeşil parlar.', 'kodsuz özel alan değeri kaydedilmeli');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#evrenSayfa');
  await page.locator('#evrenSayfa [data-evs-sekme="kurucu"]').click();
  await page.locator('#evrenSayfa .evr-kurucu button.evr-adim[data-evr-adim="dunya"]').click();
  await page.waitForSelector('#evrenSayfa .evr-kurucu [data-fan-alan="kurallar.0.tur"]');
  assert.equal(await page.locator('#evrenSayfa .evr-kurucu [data-fan-alan="kurallar.0.tur"]').inputValue(), 'anı-zamanı', 'serbest tür yenileme sonrası korunmalı');
  assert.equal(await page.locator('#evrenSayfa .evr-kurucu [data-fan-alan="ozelAlanlar.1.deger"]').inputValue(), 'Geceleyin gökyüzü yeşil parlar.', 'özel alan yenileme sonrası korunmalı');
  assert.deepEqual(pageErrors, [], `tarayıcı çalışma zamanı hatası olmamalı: ${pageErrors.join('; ')}`);
  console.log('universe create/explore UX: PASS (320/390px first-screen CTA; 7 profiles; safe profile merge; no-code field and free rule persistence)');
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) server.kill('SIGKILL');
}
