import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync('js/engine/user-universe-secret-identities.js', 'utf8');
const dom = new JSDOM('<!doctype html><html><head></head><body><main><div class="evr-kisiler"></div></main></body></html>', {
  url: 'https://tentifor.com/', runScripts: 'outside-only',
});
const w = dom.window;
const world = {
  id: 'user-world', tur: 'evren', ad: 'Rüya Katmanı',
  kisiler: [{ id: 'parent-a', ad: 'Ada', rol: 'Kaşif', aciklama: 'Ana karakter.', gizliKimlikler: [{ ad: 'Yıldız Bekçisi', aciklama: 'İlk kimlik.' }] }],
};
const items = [world];
w.fanSecili = { evren: world.id };
w.fanEserlerim = () => items;
w.fanEserlerimYaz = (next) => { items.splice(0, items.length, ...next); return true; };
w.fanTemizle = (input) => ({ tur: input.tur, kisiler: input.kisiler.map((person) => ({ ad: person.ad, aciklama: person.aciklama })) });
w.fanId = (() => { let i = 0; return () => `fan-id-${++i}`; })();
w.fanGirdi = (path, value, label) => `<label>${label}<input data-fan-alan="${path}" value="${value || ''}"></label>`;
w.fanEvrenGrupHtml = (data, group) => `<fieldset><legend>${group.ad}</legend>${data.kisiler.map((person, index) => `<input data-fan-alan="kisiler.${index}.ad" value="${person.ad}">`).join('')}</fieldset>`;
w.FAN_EVREN_GRUPLARI = [{
  k: 'kisiler', ad: 'Kişiler', not: '', alanlar: [['ad', 'Adı'], ['aciklama', 'Hikâyesi', 'uzun']],
  ciz: (list) => `<div class="evr-kisiler">${list.map((person) => `<article><h3>${person.ad}</h3></article>`).join('')}</div>`,
}];
w.kilitAcik = (key) => w.cuzdan.acilan.includes(key);
w.cuzdan = { acilan: [] };
w.eckaBildir = (message) => { w.lastMessage = message; };
w.eckaKazan = (amount, message) => { w.lastReward = { amount, message }; };
w.eval(source);
w.document.dispatchEvent(new w.Event('DOMContentLoaded'));

assert.equal(world.kisiler[0].gizliKimlikler.length, 1, 'Normalization is explicit; legacy data is preserved until the editor opens.');
const editForm = w.fanEvrenGrupHtml(world, w.FAN_EVREN_GRUPLARI[0]);
assert.match(editForm, /Karakter kimlik zinciri/);
assert.match(editForm, /Yıldız Bekçisi/);
assert.equal(world.kisiler.filter((person) => person.gizliKimlikAnaId === 'parent-a').length, 1, 'Legacy identity becomes a separate linked character record.');
assert.deepEqual(JSON.parse(JSON.stringify(world.kisiler[0].gizliKimlikler)), [], 'Legacy inline identities are removed after migration.');

const parent = world.kisiler[0];
w.document.body.innerHTML = w.FAN_EVREN_GRUPLARI[0].ciz(world.kisiler.filter((person) => !person.gizliKimlikAnaId), world, true);
assert.match(w.document.body.textContent, /en az 300 karakterlik bir hikâye yazınca altın rozet kazanılır; ilk kimlik açılır/);
assert.doesNotMatch(w.document.body.textContent, /İlk kimlik\./, 'Spoiler description stays hidden before the parent gold badge.');
const readParent = w.document.querySelector(`[data-tf-user-id-read="${parent.id}"]`);
assert.ok(readParent, 'The reader can mark the main character as read.');
readParent.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
assert.match(w.lastMessage, /en az 300 karakterlik bir hikâye yaz/);
assert.equal(w.cuzdan.acilan.includes(`rozet_altin_${parent.id}`), false, 'A read without a story does not award gold.');

items.push({ id: 'story-a', tur: 'hikaye', karakterler: 'Ada', metin: 'A'.repeat(320) });
readParent.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
assert.equal(w.cuzdan.acilan.includes(`rozet_altin_${parent.id}`), true, 'A qualifying story plus read completion awards the parent gold badge.');
assert.equal(w.lastReward.amount, 50);
const child = world.kisiler.find((person) => person.gizliKimlikAnaId === parent.id);
const second = { id: 'identity-two', ad: 'Gölgeli Gezgin', aciklama: 'İkinci kimlik.', gizliKimlikAnaId: parent.id, gizliKimlikSira: 2 };
world.kisiler.push(second);
const afterParentBadge = w.FAN_EVREN_GRUPLARI[0].ciz(world.kisiler.filter((person) => !person.gizliKimlikAnaId), world, true);
w.document.body.innerHTML = afterParentBadge;
assert.match(w.document.body.textContent, /Yıldız Bekçisi/);
assert.match(w.document.body.textContent, /Gölgeli Gezgin/);
assert.match(w.document.body.textContent, /Yıldız Bekçisi altın rozeti gerekir/);
assert.ok(w.document.querySelector(`[data-tf-user-id-read="${child.id}"]`));

items.push({ id: 'story-child', tur: 'hikaye', karakterler: child.ad, metin: 'B'.repeat(320) });
w.document.querySelector(`[data-tf-user-id-read="${child.id}"]`).dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
assert.equal(w.cuzdan.acilan.includes(`rozet_altin_${child.id}`), true, 'The first identity gold badge unlocks the next identity panel.');
const unlocked = w.FAN_EVREN_GRUPLARI[0].ciz(world.kisiler.filter((person) => !person.gizliKimlikAnaId), world, true);
assert.match(unlocked, /2\. Gölgeli Gezgin · gizli kimlik/);

const sanitized = w.fanTemizle(world);
assert.equal(sanitized.kisiler.find((person) => person.ad === 'Ada').id, 'parent-a', 'Safe cleaning preserves stable character IDs.');
assert.equal(sanitized.kisiler.find((person) => person.ad === child.ad).gizliKimlikAnaId, 'parent-a', 'Safe cleaning preserves parent linkage for identity records.');
w.document.body.innerHTML = w.fanEvrenGrupHtml(world, w.FAN_EVREN_GRUPLARI[0]);
const addIdentity = w.document.querySelector('[data-tf-user-id-add="parent-a"]');
assert.ok(addIdentity, 'The editor has an explicit add-next-identity action.');
addIdentity.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
assert.equal(world.kisiler.filter((person) => person.gizliKimlikAnaId === 'parent-a').length, 3, 'The editor creates another independent linked person record.');

const innerPerson = { id: 'l25', rozetId: 'ic-user-world-l25', ad: 'L25' };
world.icEvren = { kisiler: [innerPerson] };
items.push({ id: 'story-inner', tur: 'hikaye', karakterler: 'L25', metin: 'C'.repeat(320) });
w.document.body.innerHTML = w.tfUserIdentityReadButton(innerPerson);
w.document.querySelector('[data-tf-user-id-read="l25"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
assert.equal(w.cuzdan.acilan.includes('rozet_altin_ic-user-world-l25'), true, 'Inner-universe completion earns its scoped gold badge.');
assert.equal(w.cuzdan.acilan.includes('rozet_altin_l25'), false, 'Inner-universe badges do not borrow canonical-character badge state.');

dom.window.close();
console.log('User-universe identities: separate records, legacy conversion, spoiler gating, read + story gold badge, and sequential reveal passed.');
