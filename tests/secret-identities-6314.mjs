import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const read = (file) => fs.readFileSync(file, 'utf8');
const data = JSON.parse(read('veri.json'));
const byId = Object.fromEntries(data.karakterler.map((person) => [String(person.id).toLowerCase(), person]));
assert.deepEqual(byId.l25.gizliKimlikler, [
  { ad: 'Star Saver', aciklama: 'L25’in gerçek kimliği.' },
], 'L25 kanonik Star Saver kimliğini taşımalı');
assert.deepEqual(byId.feil.gizliKimlikler.map((item) => item.ad), ['Yaşam', 'Kütüphaneci', 'Bilim insanı']);
assert.match(byId.feil.gizliKimlikler[2].aciklama, /L25 ile birlikte çalışır/);

const adminSource = read('js/admin/86-gizli-kisilik-6314.js');
const profileSource = read('js/engine/kanon-gizli-kimlikler-6314.js');
const identity = { ad: 'Star Saver', aciklama: 'L25’in saklı kimliği.' };

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

const adminDom = new JSDOM('<!doctype html><html><body><div id="yoneticiAlan"></div></body></html>', {
  url: 'https://tentifor.com/', runScripts: 'outside-only',
});
const adminWindow = adminDom.window;
const adminRecord = { id: 'l25', ad: 'L25', gizliKimlikler: [identity] };
adminWindow.kacir = escapeHtml;
adminWindow.yoneticiSekme = 'karakterler';
adminWindow.yoneticiSecili = 0;
adminWindow.yoneticiKayitlar = () => [adminRecord];
adminWindow.yoneticiTemelCiz = function () {
  adminWindow.document.querySelector('#yoneticiAlan').innerHTML =
    '<textarea id="yMetin"></textarea><button data-yonetici="kaydet">Kaydet</button><p id="yDurum"></p>';
};
adminWindow.eval(adminSource);
adminWindow.yoneticiTemelCiz();
const identityField = adminWindow.document.querySelector('#yGizliKisilikler');
assert.ok(identityField, 'Kanonik karakter formunda gizli kimlik düzenleme alanı bulunmalı');
assert.match(identityField.value, /Star Saver: L25’in saklı kimliği/);
assert.match(adminWindow.document.querySelector('.y-gizli-kimlik-editor').textContent, /düz metin/i);
identityField.value = 'Star Saver: L25’in saklı kimliği.\n<svg onload=alert(1)>: kaçış testi';
adminWindow.document.querySelector('[data-yonetici="kaydet"]').dispatchEvent(
  new adminWindow.MouseEvent('click', { bubbles: true, cancelable: true }),
);
assert.deepEqual(JSON.parse(JSON.stringify(adminRecord.gizliKimlikler)), [
  { ad: 'Star Saver', aciklama: 'L25’in saklı kimliği.' },
  { ad: '<svg onload=alert(1)>', aciklama: 'kaçış testi' },
], 'Yönetici kaydetme, kimlik/ad açıklamasını karakter kaydına yazmalı');
adminDom.window.close();

const profileDom = new JSDOM('<!doctype html><html><body><div id="perde"><div class="pencere"></div></div></body></html>', {
  url: 'https://tentifor.com/', runScripts: 'outside-only',
});
const profileWindow = profileDom.window;
profileWindow.kacir = escapeHtml;
profileWindow.veri = { karakterler: [{ id: 'l25', ad: 'L25', gizliKimlikler: [
  identity,
  { ad: '<img src=x onerror=alert(1)>', aciklama: 'HTML değil, metin olmalı.' },
] }] };
profileWindow.karakterAc = function () {
  profileWindow.document.querySelector('#perde .pencere').innerHTML = '<p>Karakter profili</p>';
  return 'opened';
};
profileWindow.eval(profileSource);
assert.equal(profileWindow.karakterAc(0), 'opened', 'Spoiler renderer var olan profil açma sonucunu korumalı');
const spoiler = profileWindow.document.querySelector('.kanon-gizli-kimlikler');
assert.ok(spoiler, 'Kanonik karakter profili kapalı spoiler alanı göstermeli');
assert.equal(spoiler.hasAttribute('open'), false, 'Spoiler ilk açılışta kapalı olmalı');
assert.match(spoiler.textContent, /Star Saver/);
assert.match(spoiler.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
assert.doesNotMatch(spoiler.innerHTML, /<img src=x/);
profileDom.window.close();

const loader = read('js/admin/65-yonetici-yukle.js');
const index = read('index.html');
assert.match(loader, /js\/admin\/86-gizli-kisilik-6314\.js/);
assert.match(loader, /yoneticiGizliKisilikHazir/);
assert.ok(index.indexOf('js/paket-3.js') < index.indexOf('js/engine/kanon-gizli-kimlikler-6314.js'), 'Kanon renderer karakter açıcı paketinden sonra yüklenmeli');
for (const output of ['js/paket-3.js', 'dist/js/paket-3.js', 'uygulama/kabuk/www/js/paket-3.js']) {
  assert.match(read(output), /js\/admin\/86-gizli-kisilik-6314\.js/, `${output} admin kimlik modülünü yüklemeli`);
}
for (const output of ['js/engine/kanon-gizli-kimlikler-6314.js', 'dist/js/engine/kanon-gizli-kimlikler-6314.js', 'uygulama/kabuk/www/js/engine/kanon-gizli-kimlikler-6314.js']) {
  assert.equal(read(output), profileSource, `${output} kanonik spoiler renderer kaynağıyla eşleşmeli`);
}
const css = read('css/style.css');
assert.match(css, /@media\(max-width:640px\)[\s\S]*\.y-gizli-kimlik-editor/);
assert.match(css, /\.kanon-gizli-kimlikler dl\{grid-template-columns:minmax\(0,1fr\)/);

console.log('6.3.14 secret identity: curated records, admin editing, safe spoiler profile, bundle sync and mobile rules defined.');
