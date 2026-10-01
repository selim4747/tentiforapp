import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const profileSource = fs.readFileSync('js/topluluk/31-topluluk.js', 'utf8');
const badgeSource = fs.readFileSync('js/arsiv/76-rozet-baglari.js', 'utf8');

function makeProfileApi({ read = [], badges = [], boxes = [] } = {}) {
  const context = {
    veri: {
      kanonEvrenleri: {
        e25: { ad: 'E25', kisiler: [{ id: 'e25-kisi', ad: 'E25 Kişi' }] },
        e26: { ad: 'E26', kisiler: [{ id: 'e26-kisi', ad: 'E26 Kişi' }] },
      },
      karakterler: [{ id: 'tari', ad: 'Tarı', unvan: 'Görevli' }],
      alintilar: [
        { metin: 'E26 Kişi sözü', kim: 'E26 Kişi' },
        { metin: 'Tarı sözü', kim: 'Tarı' },
        { metin: 'Genel Tömye sözü' },
      ],
    },
    rbAg: () => boxes,
    okunduMu: (key) => read.includes(key),
    kilitAcik: (key) => badges.includes(key),
    kacir: (value) => String(value ?? ''),
  };
  const start = profileSource.indexOf('function vitrinEvrenIlerlemeleri');
  const end = profileSource.indexOf('async function toplulukProfilEk', start);
  assert.ok(start >= 0 && end > start, 'Profil vitrin fonksiyonları bulunamadı');
  vm.runInNewContext(`${profileSource.slice(start, end)};globalThis.api={vitrinKarakterListesi,vitrinAlintiListesi,vitrinSecimleri};`, context);
  return context.api;
}

const e25Boxes = [
  { kutu: { alan: 'ev:site:e25:', anahtar: 'ev:site:e25:kurallar' } },
  { kutu: { alan: 'ev:site:e25:', anahtar: 'ev:site:e25:sozluk' } },
  { kutu: { alan: 'ev:site:e25:', anahtar: 'ev:site:e25:roman:1' } },
  { kutu: { alan: 'ev:site:e25:', anahtar: 'ev:site:e25:roman:2' } },
];
const e26Boxes = [
  { kutu: { alan: 'ev:site:e26:', anahtar: 'ev:site:e26:kurallar' } },
  { kutu: { alan: 'ev:site:e26:', anahtar: 'ev:site:e26:sozluk' } },
];

let api = makeProfileApi({
  boxes: [...e25Boxes, ...e26Boxes],
  read: e25Boxes.slice(0, 2).map((x) => x.kutu.anahtar),
});
assert.ok(api.vitrinKarakterListesi().some((x) => x.id === 'kanon:e25:e25-kisi'), '35%+ okunan evren karakteri görünmeli');
assert.ok(!api.vitrinKarakterListesi().some((x) => x.id === 'kanon:e26:e26-kisi'), 'Yetersiz okunan ve rozetsiz evren karakteri görünmemeli');
assert.ok(api.vitrinAlintiListesi().some((x) => x.metin === 'Tarı sözü'));
assert.ok(!api.vitrinAlintiListesi().some((x) => x.metin === 'E26 Kişi sözü'));

api = makeProfileApi({
  boxes: [...e25Boxes, ...e26Boxes],
  badges: ['rozet_e26-kisi'],
});
assert.ok(api.vitrinKarakterListesi().some((x) => x.id === 'kanon:e26:e26-kisi'), 'Doğrudan karakter rozeti vitrini açmalı');
assert.ok(api.vitrinAlintiListesi().some((x) => x.metin === 'E26 Kişi sözü'), 'Karakter rozeti ilgili satırı da açmalı');

function runBadge({ linkedRead, story = false }) {
  const state = { unlocked: [], rewards: 0, messages: [] };
  const context = {
    RB_ODUL: { gumus: 5, altin: 15 },
    rbAg: () => new Map([
      ['ev:site:e25:kurallar', { kutu: { anahtar: 'ev:site:e25:kurallar', ad: 'Kurallar' } }],
    ]),
    rbBaglar: () => [{ anahtar: 'ev:site:e25:sozluk', ad: 'Sözlük' }],
    rbErisir: () => true,
    okunduMu: (key) => key === 'ev:site:e25:kurallar' || (linkedRead && key === 'ev:site:e25:sozluk'),
    kilitAcik: (key) => state.unlocked.includes(key),
    cuzdan: { acilan: state.unlocked },
    rbFanHikayesi: () => (story ? { metin: 'x'.repeat(300) } : null),
    rbKonu: () => ['E25'],
    eckaKazan: (amount, message) => { state.rewards += amount; state.messages.push(message); },
    eckaBildir: () => {},
    rbSeritleriTazele: () => {},
  };
  const start = badgeSource.indexOf('function rbRozetleriDenetle');
  const end = badgeSource.indexOf('function rbSeritHtml', start);
  vm.runInNewContext(`${badgeSource.slice(start, end)};globalThis.run=rbRozetleriDenetle;`, context);
  context.run();
  return state;
}

assert.deepEqual(runBadge({ linkedRead: false }).unlocked, [], 'Bağlı kutu okunmadan rozet verilmemeli');
assert.deepEqual(runBadge({ linkedRead: true }).unlocked, ['rozetk:ev:site:e25:kurallar'], 'Tüm bağlı kutular okununca gümüş rozet verilmeli');
assert.deepEqual(runBadge({ linkedRead: true, story: true }).unlocked, ['rozetk:ev:site:e25:kurallar', 'rozetk_altin:ev:site:e25:kurallar'], 'Okuma ve fan hikâyesi tamamlanınca altın rozet verilmeli');

assert.match(profileSource, /vitrinKisiRozetiVar/);
assert.match(profileSource, /vitrinAlintiListesi\(\)\.some/);
assert.match(fs.readFileSync('veri.json', 'utf8'), /"surum": "5\.3\./);
console.log('5.3.3 profil + okuma rozeti: uygunluk, doğrudan karakter rozeti, bağlı kutu ve altın rozet senaryoları geçti.');
