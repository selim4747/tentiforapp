import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const personSource = fs.readFileSync('js/engine/47-e25-kisiler.js', 'utf8');
const innerSource = fs.readFileSync('js/engine/89-v47-ic-evren.js', 'utf8');
const extensionStart = personSource.indexOf('/* Hidden identity editor for creator-owned E25 people.');
assert.ok(extensionStart >= 0, 'Yaratıcı kişi gizli kimlik uzantısı bulunmalı');
for (const output of ['js/paket-3.js', 'dist/js/paket-3.js', 'uygulama/kabuk/www/js/paket-3.js']) {
  const bundle = fs.readFileSync(output, 'utf8');
  assert.ok(bundle.includes(personSource), `${output} yaratıcı kişi kaynak modülünü içermeli`);
}
for (const output of ['js/engine/89-v47-ic-evren.js', 'dist/js/engine/89-v47-ic-evren.js', 'uygulama/kabuk/www/js/engine/89-v47-ic-evren.js']) {
  assert.equal(fs.readFileSync(output, 'utf8'), innerSource, `${output} iç evren kaynak dosyasıyla eşleşmeli`);
}
for (const output of ['index.html', 'dist/index.html', 'uygulama/kabuk/www/index.html']) {
  assert.match(fs.readFileSync(output, 'utf8'), /js\/paket-3\.js/, `${output} gizli kimlik modülünü taşıyan kişi paketini yüklemeli`);
}

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
assert.match(form, /profilde spoiler olarak açılır/i, 'Form gizli kimliklerin spoiler olduğunu ve dosyada taşındığını açıklamalı');
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
  // Old records migrate from `bedenler`; former shared sleep flags/trace fields are not retained.
  icEvren: { acik: true, ad: 'İç Rüya', bedenler: [{
    id: 'l25', ad: 'L25', ustHal: 'Uyuyor', icHal: 'Uyanık',
    kisilik: [{ ad: 'Eski hâl', aciklama: 'Bu kayda özgüdür.' }],
    izler: [{ yer: 'Eski olay', metin: 'Bu evrende yaşandı.' }],
  }] },
};
const secondWorld = {
  tur: 'evren', id: 'test-evren-2', ad: 'İkinci Rüya Katmanı',
  kisiler: [{ id: 'l25', ad: 'L25', gizliKimlikler: [{ ad: 'Star Saver', aciklama: 'Dış kimlik.' }] }],
  icEvren: { acik: true, ad: 'İkinci İç Rüya', kisiler: [] },
};
worldWindow.EVS = { kaynak: 'benim', id: world.id, sekme: 'icevren', eser: world };
worldWindow.tf4EvrenYazarMi = () => true;
worldWindow.evrenSayfaVerisi = () => ({ eser: worldWindow.EVS.eser });
worldWindow.evrenBenimDegistir = (id, mutate) => mutate(id === secondWorld.id ? secondWorld : world);
worldWindow.evrenSayfaCiz = () => {};
worldWindow.eckaBildir = () => {};
worldWindow.fanEserlerim = () => [world, secondWorld];
worldWindow.fanSiteListesi = () => [];
worldWindow.eval(innerSource);

function renderInner(activeWorld = world) {
  worldWindow.EVS.id = activeWorld.id;
  worldWindow.EVS.eser = activeWorld;
  worldWindow.document.body.innerHTML = worldWindow.evrenEkBolum({ eser: activeWorld });
}
function click(selector) {
  const button = worldWindow.document.querySelector(selector);
  assert.ok(button, `Tıklanabilir iç evren düğmesi eksik: ${selector}`);
  button.dispatchEvent(new worldWindow.MouseEvent('click', { bubbles: true, cancelable: true }));
}

renderInner();
const migratedIdentityField = worldWindow.document.querySelector('[data-ice-gizli-kimlikler="l25"]');
assert.ok(migratedIdentityField, 'Eski iç kayıt ayrı bir kişi kimlik kartına taşınmalı');
assert.ok(worldWindow.document.querySelector('[data-ice-kisilik="l25"]'), 'İç evren kişiliği kartta düzenlenebilmeli');
const sameWorldLink = worldWindow.document.querySelector('[data-ice-yan-kisi="l25"]');
assert.ok(sameWorldLink, 'Kişi kartında isteğe bağlı yan-evren bağlantı alanı olmalı');
assert.equal([...sameWorldLink.options].some((option) => option.value === JSON.stringify({ evrenId: world.id, kisiId: 'l25' })), false, 'Kişi kendi iç evrenindeki kartına bağlanmamalı');
migratedIdentityField.value = 'Gölge: Sadece ilk iç evrendeki kimlik.';
worldWindow.document.querySelector('[data-ice-kisilik="l25"]').value = 'Yalnız: İlk evrende içine kapanıktır.';
click('[data-ice-kisi-kaydet="l25"]');
assert.equal(world.icEvren.bedenler, undefined, 'İlk kayıt sonrası eski beden birleşimi alanı kaldırılmalı');
assert.equal(world.icEvren.kisiler[0].kaynakKisiId, 'l25', 'Ana evren kişi çapası tutulmalı');
assert.deepEqual(JSON.parse(JSON.stringify(world.icEvren.kisiler[0].gizliKimlikler)), [
  { ad: 'Gölge', aciklama: 'Sadece ilk iç evrendeki kimlik.' },
]);
assert.deepEqual(JSON.parse(JSON.stringify(world.icEvren.kisiler[0].kisilik)), [
  { ad: 'Yalnız', aciklama: 'İlk evrende içine kapanıktır.' },
]);
assert.equal(world.icEvren.kisiler[0].ustHal, undefined, 'Önceki çapraz uyku durumu taşınmamalı');
assert.equal(world.kisiler[0].gizliKimlikler[0].ad, 'Star Saver', 'Ana evrenin kanonik kimliği değişmemeli');

const legacyEvents = worldWindow.document.querySelector('[data-ice-olaylar="l25"]');
assert.ok(legacyEvents, 'Her kişi kartında bu evrene özel olay alanı olmalı');
legacyEvents.value = 'İlk karşılaşma: Eski arşivde tanıştılar.';
click('[data-ice-olaylar-kaydet="l25"]');
assert.deepEqual(JSON.parse(JSON.stringify(world.icEvren.kisiler[0].olaylar)), [
  { ad: 'İlk karşılaşma', aciklama: 'Eski arşivde tanıştılar.' },
]);

renderInner(secondWorld);
assert.ok(worldWindow.document.querySelector('#iceKisiSec option[value="l25"]'), 'Aynı ana kişi ikinci iç evrende de bağımsız karta dönüştürülebilmeli');
worldWindow.document.querySelector('#iceKisiSec').value = 'l25';
click('[data-ice-kisi-ekle]');
const secondId = secondWorld.icEvren.kisiler[0].id;
assert.notEqual(secondId, 'l25', 'İkinci evren kendi yerel kart kimliğini üretmeli');
assert.equal(secondWorld.icEvren.kisiler[0].kaynakKisiId, 'l25');
assert.deepEqual(JSON.parse(JSON.stringify(secondWorld.icEvren.kisiler[0].gizliKimlikler)), [], 'Ana kimlikler yeni iç karta otomatik kopyalanmamalı');
renderInner(secondWorld);
const secondPersonality = worldWindow.document.querySelector(`[data-ice-kisilik="${secondId}"]`);
secondPersonality.value = 'Cesur: İkinci evrende öne atılır.';
worldWindow.document.querySelector(`[data-ice-gizli-kimlikler="${secondId}"]`).value = 'Kutup: İkinci evrenin saklı adı.';
click(`[data-ice-kisi-kaydet="${secondId}"]`);
worldWindow.document.querySelector(`[data-ice-olaylar="${secondId}"]`).value = 'İkinci olay: Başka bir tarihte başladı.';
click(`[data-ice-olaylar-kaydet="${secondId}"]`);
assert.equal(world.icEvren.kisiler[0].kisilik[0].ad, 'Yalnız', 'İkinci evren düzenlemesi ilk evrenin kişiliğini değiştirmemeli');
assert.equal(world.icEvren.kisiler[0].olaylar[0].ad, 'İlk karşılaşma', 'Olaylar evrenler arasında paylaşılmamalı');
assert.equal(secondWorld.icEvren.kisiler[0].kisilik[0].ad, 'Cesur');
assert.equal(secondWorld.icEvren.kisiler[0].olaylar[0].ad, 'İkinci olay');

renderInner(secondWorld);
const counterpart = worldWindow.document.querySelector(`[data-ice-yan-kisi="${secondId}"]`);
const counterpartOption = [...counterpart.options].find((option) => option.value === JSON.stringify({ evrenId: world.id, kisiId: 'l25' }));
assert.ok(counterpartOption, 'Başka iç evrende bulunan kişi kartı yalnızca karşılık olarak seçilebilmeli');
counterpart.value = counterpartOption.value;
click(`[data-ice-yan-kisi-kaydet="${secondId}"]`);
assert.deepEqual(JSON.parse(JSON.stringify(secondWorld.icEvren.kisiler[0].yanKisi)), { evrenId: world.id, kisiId: 'l25' });
assert.equal(world.icEvren.kisiler[0].kisilik[0].ad, 'Yalnız', 'Karşılık bağlantısı verileri birleştirmemeli');

worldWindow.EVS.kaynak = 'site';
renderInner(secondWorld);
const innerReveal = worldWindow.document.querySelector('.ice-gizli-kimlik');
assert.ok(innerReveal, 'Okur iç evrendeki gizli kimlikleri görebilmeli');
assert.equal(innerReveal.hasAttribute('open'), false, 'İç evren kimlikleri ilk açılışta spoiler olarak kapalı kalmalı');
assert.match(innerReveal.textContent, /Gizli kimlik · spoiler/, 'Okur spoiler alanını açığa çıkmadan tanıyabilmeli');
assert.match(worldWindow.document.body.textContent, /Yan evrendeki karşılığı/, 'Okur kişi kartındaki karşılık bağlantısını görebilmeli');
worldDom.window.close();

console.log('Hidden identities: legacy migration, independent inner-world cards/personality/events, counterpart-only links, and spoiler rendering checks passed.');
