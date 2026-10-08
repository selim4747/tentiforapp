import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const personSource = fs.readFileSync('js/engine/47-e25-kisiler.js', 'utf8');
const personBundle = fs.readFileSync('js/paket-3.js', 'utf8');
const innerSource = fs.readFileSync('js/engine/89-v47-ic-evren.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const extensionStart = personSource.indexOf('/* Hidden identity editor for creator-owned E25 people.');
assert.ok(extensionStart >= 0, 'Yaratıcı kişi gizli kimlik uzantısı bulunmalı');
assert.ok(personBundle.includes(personSource), 'Üretimde yüklenen paket 3 kaynak modülünü içermeli');
assert.match(index, /js\/paket-3\.js/, 'Site gizli kimlik kodunu taşıyan kişi paketini yüklemeli');

const personDom = new JSDOM('<!doctype html><html><body><textarea id="kisiGizliKimlikler"></textarea></body></html>', {
  url: 'https://tentifor.com/',
  runScripts: 'outside-only',
});
const personWindow = personDom.window;
personWindow.kisiTemizle = (person) => ({ id: person.id, ad: person.ad });
personWindow.kisiImzaMetni = (person) => JSON.stringify({
  id: person.id,
  ad: person.ad,
  kisilik: (person.kisilik || []).map((part) => [part.ad, part.aciklama]),
});
personWindow.kisiFormHtml = () => '<label for="kisiYazar">Yaratan</label>';
personWindow.kisiGovde = () => '<section>profil</section>';
personWindow.kisiKartHtml = () => '<div class="kisi-kart">kart</div>';
personWindow.konukGovde = () => '<div class="konuk">konuk</div>';
personWindow.konukDuzenleyiciHtml = () => '<div class="konuk">konuk</div>';
personWindow.eval(`
  async function kisiImzala(person) { return kisiImzaMetni(person); }
  async function kisiKaydet(id, data) {
    var person = { tur: 'kisi', id: id || 'new-id', ad: data.ad };
    person.imzaliMetin = await kisiImzala(person);
    return person;
  }
`);
personWindow.eval(personSource.slice(extensionStart));

const legacyPerson = { id: 'old', ad: 'Eski', kisilik: [{ ad: 'Meraklı', aciklama: 'Soru sorar.' }] };
const expectedLegacySignature = JSON.stringify({ id: 'old', ad: 'Eski', kisilik: [['Meraklı', 'Soru sorar.']] });
assert.equal(personWindow.kisiImzaMetni(legacyPerson), expectedLegacySignature, 'Gizli kimlik alanı boşken eski kişi imzaları değişmemeli');

const incoming = {
  id: 'existing',
  ad: 'L25',
  gizliKimlikler: [
    { ad: 'Star Saver', aciklama: 'L25’in sakladığı ikinci kimlik.' },
    { ad: '<img src=x onerror=alert(1)>', aciklama: 'Kullanıcı metni güvenli kaçışlanmalı.' },
    ...Array.from({ length: 9 }, (_, i) => ({ ad: `Kimlik ${i}`, aciklama: 'fazla kayıt' })),
  ],
};
const cleaned = personWindow.kisiTemizle(incoming);
assert.equal(cleaned.gizliKimlikler.length, 8, 'Kişi gizli kimlikleri üst sınırla temizlenmeli');
assert.equal(cleaned.gizliKimlikler[0].ad, 'Star Saver');
const signatureWithIdentity = JSON.parse(personWindow.kisiImzaMetni(incoming));
assert.equal(signatureWithIdentity.gizliKimlikler[0][0], 'Star Saver', 'Yeni gizli kimlikler kişi imzasına girmeli');

const form = personWindow.kisiFormHtml(incoming);
assert.match(form, /id="kisiGizliKimlikler"/, 'Yeni ve mevcut kişi formunda gizli kimlik alanı olmalı');
assert.match(form, /profilde spoiler olarak açılır/, 'Form gizli kimliklerin spoiler olduğunu ve dosyada taşındığını açıklamalı');
assert.match(form, /Star Saver: L25’in sakladığı ikinci kimlik\./, 'Mevcut kimlikler düzenleme formunda korunmalı');

personWindow.document.querySelector('#kisiGizliKimlikler').value = 'Star Saver: L25’in sakladığı ad.\nFeil: Yaşam ve kütüphaneci.';
const savedPerson = await personWindow.kisiKaydet('existing', { ad: 'L25' });
assert.deepEqual(JSON.parse(JSON.stringify(savedPerson.gizliKimlikler)), [
  { ad: 'Star Saver', aciklama: 'L25’in sakladığı ad.' },
  { ad: 'Feil', aciklama: 'Yaşam ve kütüphaneci.' },
]);
assert.match(savedPerson.imzaliMetin, /Star Saver/, 'Kaydetme sırasında yeni kimlik imzalanmalı');

const renderedPerson = personWindow.kisiGovde(incoming);
assert.match(renderedPerson, /<details class="kisi-gizli-kimlik">/, 'Kişi profilinde kimlik kapalı spoiler olmalı');
assert.match(renderedPerson, /&lt;img src=x onerror=alert\(1\)&gt;/, 'Kimlik metni HTML enjeksiyonuna karşı kaçışlanmalı');
assert.doesNotMatch(renderedPerson, /<img src=x/, 'Kullanıcı girdisi HTML olarak çalışmamalı');
assert.match(personWindow.kisiKartHtml({ e: incoming }), /<details class="kisi-gizli-kimlik">/, 'Bulunan kişi kartı da gizli kimlikleri spoiler göstermeli');
const guestHtml = personWindow.konukGovde({ konuklar: [incoming] });
assert.match(guestHtml, /<details class="kisi-gizli-kimlik">/, 'Hikâyeye konuk eklenmiş kişi spoiler bilgisini korumalı');
personDom.window.close();

const worldDom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
  url: 'https://tentifor.com/',
  runScripts: 'outside-only',
});
const worldWindow = worldDom.window;
const world = {
  tur: 'evren',
  id: 'test-evren',
  ad: 'Rüya Katmanı',
  kisiler: [{ id: 'l25', ad: 'L25', gizliKimlikler: [{ ad: 'Star Saver', aciklama: 'Dış kimlik.' }] }],
  icEvren: { acik: true, ad: 'İç Rüya', bedenler: [] },
};
worldWindow.EVS = { kaynak: 'benim', id: world.id, sekme: 'icevren', eser: world };
worldWindow.tf4EvrenYazarMi = () => true;
worldWindow.evrenSayfaVerisi = () => ({ eser: world });
worldWindow.evrenBenimDegistir = (id, mutate) => mutate(world);
worldWindow.evrenSayfaCiz = () => {};
worldWindow.eckaBildir = () => {};
worldWindow.eval(innerSource);

function renderInner() {
  worldWindow.document.body.innerHTML = worldWindow.evrenEkBolum({ eser: world });
}
function click(selector) {
  const button = worldWindow.document.querySelector(selector);
  assert.ok(button, `Tıklanabilir iç evren düğmesi eksik: ${selector}`);
  button.dispatchEvent(new worldWindow.MouseEvent('click', { bubbles: true, cancelable: true }));
}
renderInner();
assert.ok(worldWindow.document.querySelector('#iceKisiSec option[value="l25"]'), 'Mevcut kişi iç evrene bağlanabilmeli');
worldWindow.document.querySelector('#iceKisiSec').value = 'l25';
click('[data-ice-beden-ekle]');
assert.equal(world.icEvren.bedenler[0].gizliKimlikler[0].ad, 'Star Saver', 'Kişinin var olan kimliği yeni iç bedenle taşınmalı');

renderInner();
const innerIdentityField = worldWindow.document.querySelector('[data-ice-gizli-kimlikler="l25"]');
assert.ok(innerIdentityField, 'İç evren beden editöründe ayrı kimlik alanı olmalı');
innerIdentityField.value = 'Star Saver: L25’in iç katmandaki karşılığı.\nGölge: Gece arşivcisi.';
click('[data-ice-kimlik-kaydet="l25"]');
assert.deepEqual(JSON.parse(JSON.stringify(world.icEvren.bedenler[0].gizliKimlikler)), [
  { ad: 'Star Saver', aciklama: 'L25’in iç katmandaki karşılığı.' },
  { ad: 'Gölge', aciklama: 'Gece arşivcisi.' },
]);

worldWindow.EVS.kaynak = 'site';
renderInner();
const innerReveal = worldWindow.document.querySelector('.ice-gizli-kimlik');
assert.ok(innerReveal, 'Okur iç evrendeki gizli kimlikleri görebilmeli');
assert.equal(innerReveal.hasAttribute('open'), false, 'İç evren kimlikleri ilk açılışta spoiler olarak kapalı kalmalı');
assert.match(innerReveal.textContent, /Gizli kimlik · spoiler/, 'Okur spoiler alanını açığa çıkmadan tanıyabilmeli');
worldDom.window.close();

console.log('Hidden identities: legacy signatures, own-person edit/create, safe spoiler rendering, and inner-universe link/edit/view checks passed.');
