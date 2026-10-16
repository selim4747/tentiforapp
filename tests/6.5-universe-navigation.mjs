import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync('js/engine/v65-universe-navigation.js', 'utf8');
const dom = new JSDOM('<!doctype html><html><body><button id="cuzdanRozet"></button><nav id="altMenu"></nav><div id="evrenSayfa"><div class="madde" data-madde="2"><button class="madde-bas" aria-expanded="false"></button></div></div></body></html>', {
  url: 'https://tentifor.test/#/arsiv', runScripts: 'outside-only', pretendToBeVisual: true
});
const { window } = dom;
window.veri = {
  haritalar: [
    { id: 'tomye', ad: 'Tömye', evrenAdi: 'Tentiforverse', yerler: [] },
    { id: 'ax24', ad: 'Ax-24', evrenAdi: 'Ax-24', yerler: [] }
  ],
  evren: [
    { id: 't1', evrenler: ['tomye'], bolum: 'Başlangıç', baslik: 'Tömye’nin ilk günü', ozet: 'Tömye hakkındaki açık bir giriş metni.', metin: 'Uzun lore metni.' },
    { id: 'a1', evrenler: ['ax24'], bolum: 'Tarih', baslik: 'Ax-24 kayıtları', ozet: 'Ax-24 hakkındaki açık bir metin.', metin: 'Tarihçe.' },
    { id: 'e1', evrenler: ['e25'], bolum: 'Evrengezerler', baslik: 'E25 başlangıcı', ozet: 'E25 hakkındaki kanon metni.', metin: 'Birinci bölüm.' }
  ],
  kanonEvrenleri: {}
};
window.EVS = { kaynak: 'site', id: 'e25', sekme: 'oku' };
window.evrendeMi = (item, id) => Array.isArray(item?.evrenler) ? item.evrenler.includes(id) : id === 'tomye';
window.evrenSayfaVerisi = () => null;
window.evrenEkSekmeler = () => [['oyna', 'Oyna']];
window.evrenEkBolum = () => 'önceki bölüm';
window.evrenRehberBolumu = (page) => '<ol>' + window.evrenRehberi(page.eser).map((item) => '<li data-guide="' + item.dosya + '">' + item.baslik + '</li>').join('') + '</ol>';
window.altMenuCiz = () => {
  window.document.querySelector('#altMenu').innerHTML = '<button class="alt-oge" data-evren-sec>◎ Evrenler</button><a class="alt-oge" data-alt-hedef="oku" href="#/ev/site/tomye">Oku</a>';
};
window.simdikiEvren = () => ({ git: '#/arsiv', ad: 'Tentiforverse' });
window.aktifEvren = () => null;
window.eval(source);

const e25 = { id: 'e25', ad: 'E25', ozet: 'E25 evrenini tanıtan yeterince uzun bir özet.', okuma_rehberi: [] };
const e25Guide = window.evrenRehberi(e25);
assert.ok(e25Guide.some((item) => item.dosya === 'bolum:kanon-2'), 'E25 kanon yazısı Oku rotasına eklenmeli');
assert.ok(e25Guide.some((item) => item.dosya === 'bolum:ozet'), 'E25 özeti giriş rotası olmalı');

const e26 = { id: 'e26', ad: 'E26', ozet: 'E26 evrenini tanıtan bir giriş metni.', kurallar: [{ ad: 'Zaman', aciklama: 'Zamanın nasıl aktığını anlatan kural.' }], kisiler: [{ ad: 'Arin', aciklama: 'Arin bu evrenin ilk karakteridir.' }] };
window.EVS = { kaynak: 'site', id: 'e26', sekme: 'oku' };
const e26Guide = window.evrenRehberi(e26);
assert.ok(e26Guide.some((item) => item.dosya === 'bolum:kurallar'));
assert.ok(e26Guide.some((item) => item.dosya === 'bolum:kisiler'));

window.EVS = { kaynak: 'fan', id: 'fan-1', sekme: 'oku' };
const fanGuide = window.evrenRehberi({ id: 'fan-1', ad: 'Fan evreni', ozet: 'Fan evrenini açıklayan bir özet.', kurallar: [{ ad: 'Kural', aciklama: 'Açıklama' }], roman: { bolumler: [{ id: 'giris', baslik: 'Giriş' }] }, lorlar: [{ id: 'acik', baslik: 'Açık lore' }, { id: 'gizli', baslik: 'Korumalı lore', kilitli: true, kod_gerekli: true }] });
assert.ok(fanGuide.some((item) => item.dosya === 'bolum:kurallar'));
assert.ok(fanGuide.some((item) => item.dosya === 'roman:giris'));
assert.equal(fanGuide.find((item) => item.dosya === 'lore:acik').kod_gerekli, false, 'açık lore gereksiz yere kodla kilitlenmemeli');
assert.equal(fanGuide.find((item) => item.dosya === 'lore:gizli').kod_gerekli, true, 'korumalı lore erişim bayrağını korumalı');

window.EVS = { kaynak: 'site', id: 'tomye', sekme: 'bilgi' };
const tomyePage = window.evrenSayfaVerisi();
assert.equal(tomyePage.eser.id, 'tomye', 'ana harita evren rotasında açılabilmeli');
assert.match(tomyePage.eser.ozet, /Tömye|açık bir giriş metni|gökyüzü|Dünya/i);
const tabs = window.evrenEkSekmeler({ eser: tomyePage.eser, kilitli: false });
assert.ok(tabs.some((tab) => tab[0] === 'oku'), 'her erişilebilir evrende Oku sekmesi olmalı');

const target = window.aktifEvrenHedefi('evren');
assert.equal(target.git, '#/ev/site/tomye');
assert.equal(target.sekme, 'bilgi', 'alt menü Evren öğesi bilgi/lore görünümüne gitmeli');
assert.equal(window.aktifEvrenHedefi('oku').sekme, 'oku');
window.altMenuCiz();
const worldLink = window.document.querySelector('#altMenu [data-alt-hedef="evren"]');
assert.ok(worldLink && worldLink.matches('a'));
assert.equal(worldLink.getAttribute('href'), '#/ev/site/tomye');
assert.equal(window.document.querySelector('#altMenu [data-evren-sec]'), null);
const readLink = window.document.querySelector('#altMenu [data-alt-hedef="oku"]');
readLink.click();
assert.equal(window.__tf65ForceGuideOnce, true, 'alt menü Oku tıklaması evren okuma rehberini seçmeli');

window.simdikiEvren = () => ({ git: 'harita:ax24', ad: 'Ax-24' });
window.location.hash = '#/harita';
assert.equal(window.aktifEvrenHedefi('evren').git, '#/ev/site/ax24');

window.EVS = { kaynak: 'site', id: 'e25', sekme: 'oku' };
const guideHtml = window.evrenEkBolum({ eser: e25 });
assert.match(guideHtml, /bolum:kanon-2/);

const header = window.document.querySelector('#evrenSayfa .madde-bas');
let opened = 0;
header.addEventListener('click', () => { opened += 1; header.setAttribute('aria-expanded', 'true'); });
const guideButton = window.document.createElement('button');
guideButton.setAttribute('data-rehber-git', 'bolum:kanon-2');
window.document.body.appendChild(guideButton);
guideButton.click();
await new Promise((resolve) => setTimeout(resolve, 10));
assert.equal(opened, 1, 'Oku eylemi lore kartının metnini açmalı');
window.close();
console.log('6.5 universe navigation tests passed');
