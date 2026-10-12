import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const read = (file) => fs.readFileSync(file, 'utf8');
const data = JSON.parse(read('veri.json'));
const byId = Object.fromEntries(data.karakterler.map((person) => [String(person.id).toLowerCase(), person]));

assert.deepEqual(byId.l25.gizliKimlikler, ['l25-star-saver']);
assert.deepEqual(byId.feil.gizliKimlikler, ['feil-yasam', 'feil-kutuphane', 'feil-bilim-insani']);
assert.equal(byId['l25-star-saver'].gizliKimlikAnaId, 'l25');
assert.equal(byId['feil-yasam'].gizliKimlikAnaId, 'feil');
assert.deepEqual(byId['l25-star-saver'].gizli.map((item) => item.baslik), ['StarSaver', 'StarSaver Sonu']);
assert.deepEqual(byId['feil-yasam'].gizli.map((item) => item.baslik), ['1150 Yıl', 'Beyaz Adının Kaynağı']);
assert.deepEqual(byId.l25.gizli.map((item) => item.baslik), ['Yükseliş ve Hayal Kırıklığı']);
assert.equal(byId.feil.gizli.length, 0, 'Feil’in kimlik katmanları Yaşam paneline taşınmalı');
assert.equal(byId.feil.unvan, 'Kurucu', 'Beyaz rengi ana Feil panelinde ifşa edilmemeli');
assert.match(byId['feil-yasam'].ozellikler.luyotRengi, /^Beyaz/);
assert.match(byId.kaelan.ozellikler.luyotRengi, /^Siyah/);
assert.match(byId.saek.ozellikler.luyotRengi, /^Kırmızı/);
assert.match(byId['feil-yasam'].detay, /her zaman|sürekli/);

const adminSource = read('js/admin/86-gizli-kisilik-6314.js');
const profileSource = read('js/engine/kanon-gizli-kimlikler-6314.js');
const adminDom = new JSDOM('<!doctype html><html><body><div id="yoneticiAlan"></div></body></html>', {
  url: 'https://tentifor.com/', runScripts: 'outside-only',
});
const adminWindow = adminDom.window;
const adminRecord = { id: 'l25', ad: 'L25', gizliKimlikler: ['l25-star-saver'] };
adminWindow.kacir = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));
adminWindow.veri = { karakterler: [adminRecord,
  { id: 'l25-star-saver', ad: 'Star Saver', gizliKimlikAnaId: 'l25' },
  { id: 'other-child', ad: 'Other', gizliKimlikAnaId: 'other' },
] };
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
assert.ok(identityField, 'Kanon admin formunda kimlik ID sırası alanı bulunmalı');
assert.equal(identityField.value, 'l25-star-saver');
assert.match(adminWindow.document.querySelector('.y-gizli-kimlik-editor').textContent, /altın rozeti/i);
identityField.value = 'l25-star-saver\n<svg onload=alert(1)>\nother-child';
adminWindow.document.querySelector('[data-yonetici="kaydet"]').dispatchEvent(
  new adminWindow.MouseEvent('click', { bubbles: true, cancelable: true }),
);
assert.deepEqual(JSON.parse(JSON.stringify(adminRecord.gizliKimlikler)), ['l25-star-saver'],
  'Admin yalnızca aynı ana karaktere bağlı, geçerli kimlik ID’lerini kaydetmeli');
adminDom.window.close();

const profileDom = new JSDOM('<!doctype html><html><body><div id="perde"><div class="pencere"></div></div></body></html>', {
  url: 'https://tentifor.com/', runScripts: 'outside-only',
});
const profileWindow = profileDom.window;
profileWindow.kacir = adminWindow.kacir;
const profileData = { karakterler: [
  { id: 'parent', ad: 'Ana Karakter', gizliKimlikler: ['identity-one', 'identity-two'] },
  { id: 'identity-one', ad: 'Yaşam', gizliKimlikAnaId: 'parent' },
  { id: 'identity-two', ad: 'Bilim insanı', gizliKimlikAnaId: 'parent' },
] };
profileWindow.veri = profileData;
const badges = new Set();
profileWindow.kilitAcik = (key) => badges.has(key);
profileWindow.karakterAc = function (index) {
  const person = profileData.karakterler[Number(index)];
  profileWindow.document.querySelector('#perde .pencere').innerHTML = '<p>Profil ' + person.id + '</p>';
  return 'opened-' + person.id;
};
profileWindow.rozetleriDenetle = function () { return 'badges-checked'; };
profileWindow.eval(profileSource);
assert.equal(profileWindow.kanonKimlikErisilebilir(profileData.karakterler[1]), false);
assert.equal(profileWindow.kanonKimlikListedeGorunur(profileData.karakterler[1]), false);
assert.equal(profileWindow.kanonKimlikEvrenGorunur(profileData.karakterler[1]), false);
profileWindow.karakterAc(0);
assert.match(profileWindow.document.querySelector('.kanon-gizli-kimlikler').textContent, /altın rozeti kazanılınca/i);
assert.equal(profileWindow.document.querySelectorAll('.kanon-gizli-kimlik-dugmeleri button').length, 0);

badges.add('rozet_altin_parent');
assert.equal(profileWindow.kanonKimlikErisilebilir(profileData.karakterler[1]), true);
assert.equal(profileWindow.kanonKimlikErisilebilir(profileData.karakterler[2]), false);
assert.equal(profileWindow.kanonKimlikEvrenGorunur(profileData.karakterler[2]), true,
  'Ana altın rozetinden sonra evren görünümünde tüm kimlik kayıtları ayrı kartlar olmalı');
profileWindow.karakterAc(0);
const buttons = profileWindow.document.querySelectorAll('.kanon-gizli-kimlik-dugmeleri button');
assert.equal(buttons.length, 2, 'Ana altın rozeti tüm kimlik düğmelerini göstermeli');
assert.equal(buttons[0].disabled, false, 'İlk kimlik hemen açılmalı');
assert.equal(buttons[0].getAttribute('data-karakter'), '1');
assert.equal(buttons[1].disabled, true, 'İkinci kimlik ilk kimliğin altın rozeti gelene kadar kilitli olmalı');
profileWindow.karakterAc(2);
assert.match(profileWindow.document.querySelector('#perde .pencere').textContent, /Profil parent/,
  'Kilitli kimliğin doğrudan rota açılışı ana karakter paneline dönmeli');
assert.doesNotMatch(profileWindow.document.querySelector('#perde .pencere').textContent, /Profil identity-two/);

badges.add('rozet_altin_identity-one');
assert.equal(profileWindow.kanonKimlikErisilebilir(profileData.karakterler[2]), true,
  'Birinci kimliğin altın rozeti ikinci kimliği açmalı');
assert.equal(profileWindow.karakterAc(2), 'opened-identity-two');
assert.match(profileWindow.document.querySelector('#perde .pencere').textContent, /Profil identity-two/);
assert.match(profileWindow.document.querySelector('.kanon-gizli-kimlikler').textContent, /Bilim insanı/);
const wrappedBadgeCheck = profileWindow.rozetleriDenetle;
assert.equal(wrappedBadgeCheck(), 'badges-checked', 'Rozet sarmalayıcı özgün sonucu korumalı');
profileDom.window.close();

const loader = read('js/admin/65-yonetici-yukle.js');
const index = read('index.html');
assert.match(loader, /js\/admin\/86-gizli-kisilik-6314\.js/);
assert.match(loader, /yoneticiGizliKisilikHazir/);
assert.ok(index.indexOf('js/paket-3.js') < index.indexOf('js/engine/kanon-gizli-kimlikler-6314.js'),
  'Kanon renderer karakter açıcı paketinden sonra yüklenmeli');
assert.match(read('js/core/24-arsiv-mantigi.js'), /kanonKimlikListedeGorunur/);
assert.match(read('js/engine/44-evrenler.js'), /kanonKimlikEvrenGorunur/);
assert.match(read('js/arsiv/63-okuma-rozet.js'), /kanonKimlikRozetKazanabilir/);
for (const file of ['js/arsiv/08-kesif.js', 'js/arsiv/09-medya-harita.js', 'js/arayuz/18-gezinme.js', 'js/arayuz/21-komut-sohbet-moodboard.js', 'js/oyun/30-yarislar.js', 'js/oyun/50-kelime-oyunu.js', 'js/oyun/66-gunluk-oyunlar.js', 'js/engine/58-yolculuklar.js', 'js/engine/terminal.js', 'js/core/54-v54-olgunlastirma.js', 'js/studio/40-fan-atolye.js']) {
  assert.match(read(file), /kanonKimlikListedeGorunur/, `${file} kilitli kimlikleri göstermemeli`);
}
for (const output of ['js/engine/kanon-gizli-kimlikler-6314.js', 'dist/js/engine/kanon-gizli-kimlikler-6314.js', 'uygulama/kabuk/www/js/engine/kanon-gizli-kimlikler-6314.js']) {
  assert.equal(read(output), profileSource, `${output} kimlik paneli renderer kaynağıyla eşleşmeli`);
}
for (const output of ['js/admin/86-gizli-kisilik-6314.js', 'dist/js/admin/86-gizli-kisilik-6314.js', 'uygulama/kabuk/www/js/admin/86-gizli-kisilik-6314.js']) {
  assert.equal(read(output), adminSource, `${output} admin kimlik editörü kaynağıyla eşleşmeli`);
}
console.log('Secret identity profiles, layer relocation, color mapping, badge chain, archive/universe visibility and admin links verified.');
