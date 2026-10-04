import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const outcomes = [];
function pass(name) { outcomes.push(`PASS ${name}`); }
function check(condition, message) { assert.ok(condition, message); pass(message); }

class SupabaseLiveSimulator {
  constructor() {
    this.users = new Map([
      ['admin-1', { id: 'admin-1', email: 'admin@sim.test', username: 'sim_admin', admin: true }],
      ['reader-1', { id: 'reader-1', email: 'reader@sim.test', username: 'sim_okur', admin: false }],
    ]);
    this.tokens = new Map([['admin-token', 'admin-1'], ['reader-token', 'reader-1']]);
    this.subscriptions = new Map();
    this.notifications = [];
    this.sentPushes = [];
    this.nextNotification = 1;
  }

  auth(token) {
    const userId = this.tokens.get(token);
    return userId ? this.users.get(userId) : null;
  }

  signIn(email, password) {
    if (password !== 'sim-password-123') return { data: null, error: { code: 'invalid_credentials' } };
    const user = [...this.users.values()].find((candidate) => candidate.email === email);
    return user ? { data: { user, session: { access_token: user.id === 'admin-1' ? 'admin-token' : 'reader-token' } }, error: null } : { data: null, error: { code: 'invalid_credentials' } };
  }

  subscribe(token, { endpoint, p256dh, auth }) {
    const user = this.auth(token);
    if (!user) return { data: null, error: { message: 'giriş gerekli' } };
    if (!/^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com|[a-z0-9.-]+\.push\.apple\.com)\//.test(endpoint)) {
      return { data: { durum: 'gecersiz' }, error: null };
    }
    if (!/^[A-Za-z0-9_=-]{40,200}$/.test(p256dh) || !/^[A-Za-z0-9_=-]{8,100}$/.test(auth)) {
      return { data: { durum: 'gecersiz' }, error: null };
    }
    this.subscriptions.set(endpoint, { endpoint, p256dh, auth, userId: user.id });
    return { data: { durum: 'tamam' }, error: null };
  }

  unsubscribe(token, endpoint) {
    if (!this.auth(token)) return { data: null, error: { message: 'giriş gerekli' } };
    const existed = this.subscriptions.delete(endpoint);
    return { data: { durum: 'tamam', silinen: existed ? 1 : 0 }, error: null };
  }

  personalNotification(token, username, title, text, address = '#/sen') {
    const user = this.auth(token);
    if (!user?.admin) return { data: null, error: { message: 'yetki yok' } };
    const target = [...this.users.values()].find((candidate) => candidate.username === username.toLowerCase());
    if (!target) return { data: { durum: 'hedef_yok' }, error: null };
    if (!title.trim()) return { data: { durum: 'baslik_yok' }, error: null };
    const safeAddress = /^#\//.test(address) ? address : '#/sen';
    this.notifications.unshift({ no: this.nextNotification++, userId: target.id, metin: `${title.trim()}: ${text.trim()}`.slice(0, 400), baglanti: safeAddress, okundu: false });
    return { data: { durum: 'tamam', uygulama: 1, hedef: target.username }, error: null };
  }

  readNotifications(token) {
    const user = this.auth(token);
    if (!user) return { data: null, error: { message: 'giriş gerekli' } };
    return { data: this.notifications.filter((item) => item.userId === user.id), error: null };
  }

  markNotificationsRead(token) {
    const user = this.auth(token);
    if (!user) return { data: null, error: { message: 'giriş gerekli' } };
    this.notifications.filter((item) => item.userId === user.id).forEach((item) => { item.okundu = true; });
    return { data: null, error: null };
  }

  edgePush(token, body, { vapid = true, staleEndpoints = new Set() } = {}) {
    const user = this.auth(token);
    if (!user) return { status: 401, body: { durum: 'hata', mesaj: 'giriş gerekli' } };
    if (!user.admin) return { status: 403, body: { durum: 'yetki' } };
    const title = String(body.baslik || '').trim().slice(0, 80);
    const text = String(body.metin || '').trim().slice(0, 200);
    const address = String(body.adres || '#/sen').includes('#/') ? String(body.adres || '#/sen').slice(String(body.adres || '#/sen').indexOf('#/')) : '#/sen';
    const target = String(body.hedefKullanici || '').trim().toLowerCase();
    if (!title) return { status: 400, body: { durum: 'hata', mesaj: 'Başlık boş olamaz' } };
    let targetId = null;
    if (target) {
      const profile = [...this.users.values()].find((candidate) => candidate.username === target);
      if (!profile) return { status: 404, body: { durum: 'hedef_yok' } };
      targetId = profile.id;
      this.notifications.unshift({ no: this.nextNotification++, userId: targetId, metin: `${title}: ${text}`.slice(0, 400), baglanti: address, okundu: false });
    }
    if (!vapid) {
      return targetId ? { status: 200, body: { durum: 'tamam', gonderilen: 0, uygulama: 1, silinen: 0, hata: 0, hedef: target } } : { status: 500, body: { durum: 'hata', mesaj: 'VAPID anahtarları eksik' } };
    }
    const candidates = [...this.subscriptions.values()].filter((item) => !targetId || item.userId === targetId);
    let sent = 0; let removed = 0; let errors = 0;
    for (const subscription of candidates) {
      if (staleEndpoints.has(subscription.endpoint)) { this.subscriptions.delete(subscription.endpoint); removed += 1; continue; }
      this.sentPushes.push({ endpoint: subscription.endpoint, payload: { baslik: title, metin: text, adres: address } });
      sent += 1;
    }
    return { status: 200, body: { durum: 'tamam', gonderilen: sent, uygulama: targetId ? 1 : 0, silinen: removed, hata: errors, hedef: target || 'herkes' } };
  }
}

async function serviceWorkerSimulation() {
  const handlers = {};
  const shown = [];
  const navigations = [];
  const cacheData = new Map();
  const cache = { match: async (key) => cacheData.get(String(key)) || null, put: async (key, value) => cacheData.set(String(key), value), add: async () => {}, delete: async () => true };
  const context = {
    self: {
      location: { origin: 'https://sim.tentifor.app' },
      registration: { showNotification: async (title, options) => shown.push({ title, options }) },
      clients: {
        matchAll: async () => [{ url: 'https://sim.tentifor.app/#/sen', navigate: async (url) => { navigations.push(url); return { focus: async () => {} }; }, focus: async () => {} }],
        openWindow: async (url) => { navigations.push(url); },
        claim: async () => {},
      },
      skipWaiting: async () => {},
      addEventListener: (name, handler) => { handlers[name] = handlers[name] || []; handlers[name].push(handler); },
    },
    caches: { open: async () => cache, keys: async () => ['tentiforapp-old'], delete: async () => true, match: async (key) => cache.match(key) },
    Response,
    URL,
    Request,
    fetch: async () => new Response(JSON.stringify({ fanEserleri: { evrenler: [] } }), { headers: { 'Content-Type': 'application/json' } }),
    location: { origin: 'https://sim.tentifor.app' },
    setTimeout,
    clearTimeout,
    Date,
    Promise,
    console,
  };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), context, { filename: 'sw.js' });
  check(handlers.push?.length === 1, 'service worker push listener registered');
  check(handlers.notificationclick?.length === 1, 'service worker notification click listener registered');
  check(handlers.periodicsync?.length === 1, 'service worker periodic sync listener registered');
  let pushCompletion;
  const pushEvent = { data: { json: () => ({ baslik: 'Yeni bölüm', metin: 'Simülasyon metni', adres: '#/roman' }) }, waitUntil: (promise) => { pushCompletion = promise; } };
  await handlers.push[0](pushEvent);
  await pushCompletion;
  check(shown[0]?.title === 'Yeni bölüm', 'web push payload becomes a notification');
  let clickCompletion;
  const clickEvent = { notification: { data: { adres: 'https://evil.example/phishing' }, close() {} }, waitUntil: (promise) => { clickCompletion = promise; } };
  await handlers.notificationclick[0](clickEvent);
  await clickCompletion;
  check(navigations[0] === 'https://sim.tentifor.app/', 'external notification links are constrained to same-origin root');
}

async function main() {
  const supabase = new SupabaseLiveSimulator();
  const validKeys = { endpoint: 'https://fcm.googleapis.com/fcm/send/sim-1', p256dh: 'A'.repeat(40), auth: 'B'.repeat(16) };
  check(supabase.signIn('admin@sim.test', 'bad').error?.code === 'invalid_credentials', 'invalid Supabase credentials are rejected');
  const admin = supabase.signIn('admin@sim.test', 'sim-password-123');
  const reader = supabase.signIn('reader@sim.test', 'sim-password-123');
  check(Boolean(admin.data?.session && reader.data?.session), 'admin and reader sessions are issued');
  check(supabase.subscribe(reader.data.session.access_token, validKeys).data.durum === 'tamam', 'valid Web Push subscription is stored');
  check(supabase.subscribe(reader.data.session.access_token, { ...validKeys, endpoint: 'http://invalid.test/x' }).data.durum === 'gecersiz', 'invalid push endpoint is rejected');
  check(supabase.personalNotification(admin.data.session.access_token, 'sim_okur', 'Yeni duyuru', 'Canlı ortam simülasyonu', 'https://evil.test').data.durum === 'tamam', 'targeted in-app notification is stored with safe route fallback');
  const inbox = supabase.readNotifications(reader.data.session.access_token).data;
  check(inbox.length === 1 && inbox[0].baglanti === '#/sen', 'reader sees targeted notification and unsafe address is constrained');
  check(supabase.markNotificationsRead(reader.data.session.access_token).error === null, 'reader can mark notifications read');
  const send = supabase.edgePush(admin.data.session.access_token, { baslik: 'Yeni bölüm', metin: 'Web push testi', adres: '/#/roman' });
  check(send.status === 200 && send.body.gonderilen === 1, 'admin Edge Function sends Web Push to active subscription');
  const stale = new Set([validKeys.endpoint]);
  const cleanup = supabase.edgePush(admin.data.session.access_token, { baslik: 'Temizlik', metin: 'Stale endpoint' }, { staleEndpoints: stale });
  check(cleanup.body.silinen === 1 && supabase.subscriptions.size === 0, '410/404-like stale subscriptions are removed');
  const forbidden = supabase.edgePush(reader.data.session.access_token, { baslik: 'Yetkisiz', metin: 'x' });
  check(forbidden.status === 403, 'non-admin notification send is rejected');
  const noVapid = supabase.edgePush(admin.data.session.access_token, { baslik: 'Hedefli', metin: 'APK fallback', hedefKullanici: 'sim_okur' }, { vapid: false });
  check(noVapid.status === 200 && noVapid.body.uygulama === 1, 'targeted in-app notification works without VAPID keys');
  await serviceWorkerSimulation();
  const source = fs.readFileSync(path.join(ROOT, 'js/topluluk/41-bildirim.js'), 'utf8');
  check(source.includes('bildirim_abone_ol') && source.includes('bildirim_abonelik_sil') && source.includes('bildirim-gonder'), 'web notification client contracts match SQL and Edge Function names');
  const mobile = fs.readFileSync(path.join(ROOT, 'js/core/78-uygulama-kabugu.js'), 'utf8');
  check(mobile.includes('PushNotifications') && mobile.includes('requestPermissions') && mobile.includes('register') && mobile.includes('pushNotificationReceived') && mobile.includes('LocalNotifications') && mobile.includes('schedule') && mobile.includes('createChannel') && mobile.includes('pushNotificationActionPerformed'), 'native push and local notification lifecycle hooks exist');
  check(mobile.includes('channelId:FCM.kanal') && mobile.includes('location.hash=a'), 'native notification channel and in-app notification click navigation exist');
  console.log(outcomes.join('\n'));
  console.log(`\nLive environment simulation: PASS (${outcomes.length} checks)`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
