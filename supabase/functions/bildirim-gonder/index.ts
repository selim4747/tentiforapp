import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push';
import { SignJWT, importPKCS8 } from 'npm:jose@5';

const cors = {
  'Access-Control-Allow-Origin': 'https://tentifor.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json; charset=utf-8',
};

function cevap(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function secretMetni(raw: string) {
  let value = String(raw || '').trim();
  if (value.startsWith('{')) {
    try {
      const parsed = JSON.parse(value);
      value = String(parsed.private_key || parsed.privateKey || value);
    } catch {}
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    try { value = JSON.parse(value); } catch { value = value.slice(1, -1); }
  }
  return value.replace(/\\r?\\n/g, '\n').replace(/\r/g, '').trim();
}

async function fcmAccessToken(email: string, privateKey: string) {
  const normalized = secretMetni(privateKey);
  const begin = normalized.indexOf('-----BEGIN PRIVATE KEY-----');
  const end = normalized.indexOf('-----END PRIVATE KEY-----');
  const pem = begin >= 0 && end >= begin
    ? normalized.slice(begin, end + '-----END PRIVATE KEY-----'.length) + '\n'
    : normalized;
  const key = await importPKCS8(pem, 'RS256');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const json = await response.json();
  if (!response.ok || !json.access_token) throw new Error('FCM OAuth token alınamadı');
  return String(json.access_token);
}

async function fcmGonder(projectId: string, accessToken: string, token: string, baslik: string, metin: string, adres: string) {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: baslik, body: metin },
        data: { adres, tur: 'kisisel' },
        android: {
          priority: 'HIGH',
          notification: { channel_id: 'tentiforapp', sound: 'default', visibility: 'PUBLIC' },
        },
      },
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    const stale = response.status === 404 || /UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT/i.test(body);
    throw Object.assign(new Error(body || `FCM ${response.status}`), { stale });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return cevap({ durum: 'hata', mesaj: 'POST gerekli' }, 405);

  try {
    const auth = req.headers.get('Authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const vapidPublic = secretMetni(Deno.env.get('VAPID_PUBLIC_KEY') || '');
    const vapidPrivate = secretMetni(Deno.env.get('VAPID_PRIVATE_KEY') || '');
    const firebaseProject = secretMetni(Deno.env.get('FIREBASE_PROJECT_ID') || '');
    const firebaseEmail = secretMetni(Deno.env.get('FIREBASE_CLIENT_EMAIL') || '');
    const firebasePrivateKey = Deno.env.get('FIREBASE_PRIVATE_KEY') || '';
    const fcmHazir = !!(firebaseProject && firebaseEmail && firebasePrivateKey);

    if (!token || !supabaseUrl || !anonKey || !serviceKey) return cevap({ durum: 'hata', mesaj: 'Sunucu yapılandırması eksik' }, 500);

    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: kullanici, error: kullaniciHatasi } = await authClient.auth.getUser(token);
    if (kullaniciHatasi || !kullanici.user) return cevap({ durum: 'hata', mesaj: 'giriş gerekli' }, 401);

    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: adminMi, error: adminHatasi } = await authClient.rpc('tam_yonetici_mi');
    if (adminHatasi || adminMi !== true) return cevap({ durum: 'yetki' }, 403);

    const body = await req.json();
    const baslik = String(body.baslik || '').trim().slice(0, 80);
    const metin = String(body.metin || '').trim().slice(0, 200);
    const adres = String(body.adres || '#/sen').trim().slice(0, 280) || '#/sen';
    const uygulamaAdresi = adres.includes('#/') ? adres.slice(adres.indexOf('#/')) : '#/sen';
    const hedefKullanici = String(body.hedefKullanici || '').trim().toLowerCase().slice(0, 20);
    if (!baslik) return cevap({ durum: 'hata', mesaj: 'Başlık boş olamaz' }, 400);

    let hedefId: string | null = null;
    if (hedefKullanici) {
      const { data: profil, error: profilHatasi } = await adminClient.from('profiller').select('id').eq('kullanici_adi', hedefKullanici).maybeSingle();
      if (profilHatasi) return cevap({ durum: 'hata', mesaj: 'Kullanıcı aranamadı' }, 500);
      if (!profil) return cevap({ durum: 'hedef_yok', mesaj: '@' + hedefKullanici + ' bulunamadı' }, 404);
      hedefId = profil.id;
    }

    let uygulama = 0;
    if (hedefId) {
      const { error: uygulamaHatasi } = await adminClient.from('kullanici_bildirimleri').insert({ kullanici: hedefId, metin: `${baslik}: ${metin}`.slice(0, 400), baglanti: uygulamaAdresi });
      if (uygulamaHatasi) return cevap({ durum: 'hata', mesaj: 'Uygulama bildirimi kaydedilemedi' }, 500);
      uygulama = 1;
    }

    let gonderilen = 0, fcmGonderilen = 0, silinen = 0, fcmSilinen = 0, hata = 0;
    let webPushKuruldu = false;
    let webPushYapilandirmaHatasi = '';
    if (vapidPublic && vapidPrivate) {
      const query = adminClient.from('bildirim_abonelikleri').select('endpoint,p256dh,auth,kullanici');
      const { data: abonelikler, error: abonelikHatasi } = hedefId ? await query.eq('kullanici', hedefId) : await query;
      if (abonelikHatasi) return cevap({ durum: 'hata', mesaj: 'Web abonelikleri okunamadı' }, 500);
      try {
        webpush.setVapidDetails('https://tentifor.com', vapidPublic, vapidPrivate);
        webPushKuruldu = true;
        const payload = JSON.stringify({ baslik, metin, adres: uygulamaAdresi });
        for (const abonelik of abonelikler || []) {
          try { await webpush.sendNotification({ endpoint: abonelik.endpoint, keys: { p256dh: abonelik.p256dh, auth: abonelik.auth } }, payload); gonderilen++; }
          catch (error) { hata++; const durum = Number((error as { statusCode?: number })?.statusCode || 0); if (durum === 404 || durum === 410) { await adminClient.from('bildirim_abonelikleri').delete().eq('endpoint', abonelik.endpoint); silinen++; } }
        }
      } catch (error) {
        webPushYapilandirmaHatasi = error instanceof Error ? error.message : String(error);
      }
    }

    if (fcmHazir) {
      const query = adminClient.from('bildirim_cihazlari').select('token,kullanici').eq('aktif', true);
      const { data: cihazlar, error: cihazHatasi } = hedefId ? await query.eq('kullanici', hedefId) : await query;
      if (cihazHatasi) return cevap({ durum: 'hata', mesaj: 'Android cihazları okunamadı' }, 500);
      if ((cihazlar || []).length) {
        const fcmToken = await fcmAccessToken(firebaseEmail, firebasePrivateKey);
        for (const cihaz of cihazlar || []) {
          try { await fcmGonder(firebaseProject, fcmToken, cihaz.token, baslik, metin, uygulamaAdresi); fcmGonderilen++; }
          catch (error) { hata++; if ((error as { stale?: boolean })?.stale) { await adminClient.from('bildirim_cihazlari').delete().eq('token', cihaz.token); fcmSilinen++; } }
        }
      }
    }

    const herhangiBirKanal = webPushKuruldu || fcmHazir;
    if (!herhangiBirKanal && !uygulama) return cevap({ durum: 'hata', mesaj: 'Web Push veya FCM yapılandırması eksik' }, 500);
    return cevap({ durum: 'tamam', gonderilen, fcmGonderilen, uygulama, silinen, fcmSilinen, hata, hedef: hedefKullanici || 'herkes', fcmYapilandirilmamis: !fcmHazir, webPushYapilandirmaHatasi: webPushYapilandirmaHatasi || null });
  } catch (error) {
    return cevap({ durum: 'hata', mesaj: error instanceof Error ? error.message : String(error) }, 400);
  }
});
