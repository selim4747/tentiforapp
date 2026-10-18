import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync('js/arayuz/34-ux-645.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const tour = fs.readFileSync('js/arsiv/14-rol-yolu-mektuplar.js', 'utf8');
const css = fs.readFileSync('css/style.css', 'utf8');
const fixture = `<!doctype html><html><body>
  <header class="ust"><div id="ustAraclar"><button data-tf654-tools-toggle aria-expanded="false" aria-controls="ustAraclarPanel">Araçlar</button><div id="ustAraclarPanel"><button id="rastgeleBtn">Rastgele</button><button id="btnTerminalUst">Terminal</button></div></div></header>
  <nav id="gezinme"><button id="icindekilerBtn">Tüm sayfalar</button></nav>
  <section id="arsiv"><div class="bolum-basi"><h2>Karakter Arşivi</h2></div><div class="izgara" id="karakterIzgara">
    <button class="kart" data-karakter="0">Tarı · Yolcu · kuzey kapısı</button><button class="kart" data-karakter="1">Gerdeç · Kütüphaneci · eski şehir</button>
  </div></section>
  <div id="perde" hidden><div class="pencere"><button class="pencere-geri" type="button">Geri</button><button class="pencere-kapat" type="button" data-kapat="1" aria-label="Kapat">×</button><h3>Tarı</h3><div class="detay-metin" data-oku="kar:tari">Karakter metni</div><div class="kutu-y rozet-kutu"><div class="oyun-etiket">Karakter rozeti · 0 / 5 kutu okundu</div><ul class="rozet-liste">
    <li>○ <a href="#/evren">Evren: Şehirler</a></li><li>○ <a href="#/mektuplar">Mektup: Tömye</a></li><li>○ <a href="#/zaman">Zaman: Kuruluş</a></li><li>○ <a href="#/alintilar">Alıntı: Yol</a></li><li>○ <a href="#/gunluk">Günlük: Bir gün</a></li>
  </ul></div></div></div>
</body></html>`;
const dom = new JSDOM(fixture, { url: 'https://tentifor.com/#/arsiv', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
window.eval(source);
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
await new Promise((resolve) => setTimeout(resolve, 40));

const searchButton = window.document.querySelector('#gezinme #komutTetikBtn');
assert.ok(searchButton, 'global arama görünür gezinmeye eklenmeli');
assert.equal(searchButton.getAttribute('aria-label'), 'Hızlı arama');
const search = window.document.querySelector('#tf654CharacterQuery');
assert.ok(search, 'karakter araması oluşturulmalı');
search.value = 'tarı';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal(window.document.querySelector('[data-karakter="0"]').hidden, false);
assert.equal(window.document.querySelector('[data-karakter="1"]').hidden, true);
assert.match(window.document.querySelector('.tf654-archive-count').textContent, /1 \/ 2/);
search.value = '';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal(window.document.querySelector('[data-karakter="1"]').hidden, false);

const tools = window.document.querySelector('#ustAraclar');
const toggle = tools.querySelector('[data-tf654-tools-toggle]');
toggle.click();
assert.equal(tools.classList.contains('acik'), true);
assert.equal(toggle.getAttribute('aria-expanded'), 'true');
window.document.body.click();
assert.equal(tools.classList.contains('acik'), false);
assert.equal(toggle.getAttribute('aria-expanded'), 'false');

const modalTools = window.document.querySelector('#perde .tf654-modal-tools');
assert.ok(modalTools, 'karakter modali sabit araç çubuğu oluşturmalı');
assert.ok(modalTools.closest('.tf654-character-modal'), 'karakter modali masaüstü genişlik düzenini almalı');
assert.ok(modalTools.querySelector('.pencere-kapat'), 'kapat düğmesi sabit çubukta kalmalı');
assert.ok(modalTools.querySelector('.pencere-geri'), 'geri düğmesi sabit çubukta kalmalı');
assert.match(modalTools.querySelector('[data-tf654-progress]').textContent, /0 \/ 5/);
const listToggle = window.document.querySelector('.tf654-rozet-list-toggle');
assert.ok(listToggle, 'uzun rozet listesi disclosure içinde olmalı');
assert.equal(listToggle.open, false, 'uzun tekrar listesi başlangıçta kapalı olmalı');
assert.equal(listToggle.querySelectorAll('li').length, 5, 'liste içeriği ve ilerleme bağlantıları korunmalı');
assert.equal(listToggle.querySelectorAll('a.tf654-badge-link').length, 5, 'tüm rozet hedefleri dokunma sınıfı almalı');
window.document.querySelector('[data-tf654-rozet-jump]').click();
assert.equal(listToggle.open, true, 'sticky düğme listeyi açmalı');
const oldBadge = window.document.querySelector('.rozet-kutu');
const newBadge = window.document.createElement('div');
newBadge.className = 'kutu-y rozet-kutu';
newBadge.innerHTML = '<div class="oyun-etiket">Karakter rozeti · 1 / 5 kutu okundu</div><ul class="rozet-liste"><li>✓ <a href="#">Bir</a></li><li>○ <a href="#">İki</a></li><li>○ <a href="#">Üç</a></li><li>○ <a href="#">Dört</a></li><li>○ <a href="#">Beş</a></li></ul>';
oldBadge.replaceWith(newBadge);
await new Promise((resolve) => setTimeout(resolve, 40));
assert.equal(window.document.querySelector('.tf654-rozet-list-toggle').open, true, 'okuma ilerlemesi yenilenince açık liste durumu korunmalı');

assert.match(index, /class="tf654-home-week"[\s\S]*?<summary>7 günlük okuma yolu<\/summary>/);
assert.match(index, /class="ust-araclar-trigger"[\s\S]*?id="rastgeleBtn"[\s\S]*?id="btnTerminalUst"/);
assert.match(tour, /host\.insertAdjacentElement\("beforebegin", dialog\)/, 'ilk tur ana CTA’dan önce yerleştirilmeli');
assert.match(css, /\.tur-ipucu\{position:relative/);
assert.match(css, /\.tf654-badge-link\{[^}]*min-height:44px/);
assert.match(css, /#perde \.tf654-modal-tools\{position:sticky/);

window.close();
console.log('6.5.4 UI polish: PASS (search, mobile tools, tour placement, badge list and sticky character modal)');
