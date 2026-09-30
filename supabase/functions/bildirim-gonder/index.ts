import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json; charset=utf-8',
};

function cevap(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
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
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY') || '';
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY') || '';

    if (!token || !supabaseUrl || !anonKey || !serviceKey) {
      return cevap({ durum: 'hata', mesaj: 'Sunucu yapılandırması eksik' }, 500);
    }
    if (!vapidPublic || !vapidPrivate) {
      return cevap({ durum: 'hata', mesaj: 'VAPID anahtarları eksik' }, 500);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: kullanici, error: kullaniciHatasi } = await authClient.auth.getUser(token);
    if (kullaniciHatasi || !kullanici.user) return cevap({ durum: 'hata', mesaj: 'giriş gerekli' }, 401);

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: adminMi, error: adminHatasi } = await authClient.rpc('tam_yonetici_mi');
    if (adminHatasi || adminMi !== true) return cevap({ durum: 'yetki' }, 403);

    const body = await req.json();
    const baslik = String(body.baslik || '').trim().slice(0, 80);
    const metin = String(body.metin || '').trim().slice(0, 200);
    const adres = String(body.adres || '/').trim().slice(0, 280) || '/';
    const hedefKullanici = String(body.hedefKullanici || '').trim().toLowerCase().slice(0, 20);
    if (!baslik) return cevap({ durum: 'hata', mesaj: 'Başlık boş olamaz' }, 400);

    let hedefId: string | null = null;
    if (hedefKullanici) {
      const { data: profil, error: profilHatasi } = await adminClient
        .from('profiller').select('id').eq('kullanici_adi', hedefKullanici).maybeSingle();
      if (profilHatasi) return cevap({ durum: 'hata', mesaj: 'Kullanıcı aranamadı' }, 500);
      if (!profil) return cevap({ durum: 'hedef_yok', mesaj: '@' + hedefKullanici + ' bulunamadı' }, 404);
      hedefId = profil.id;
    }

    const query = adminClient.from('bildirim_abonelikleri').select('endpoint,p256dh,auth,kullanici');
    const { data: abonelikler, error: abonelikHatasi } = hedefId
      ? await query.eq('kullanici', hedefId)
      : await query;
    if (abonelikHatasi) return cevap({ durum: 'hata', mesaj: 'Abonelikler okunamadı' }, 500);

    webpush.setVapidDetails('mailto:admin@tentiforapp.pages.dev', vapidPublic, vapidPrivate);
    const payload = JSON.stringify({ title: baslik, body: metin, url: adres });
    let gonderilen = 0;
    let silinen = 0;
    let hata = 0;
    for (const abonelik of abonelikler || []) {
      try {
        await webpush.sendNotification({ endpoint: abonelik.endpoint, keys: { p256dh: abonelik.p256dh, auth: abonelik.auth } }, payload);
        gonderilen++;
      } catch (error) {
        hata++;
        const durum = Number((error as { statusCode?: number })?.statusCode || 0);
        if (durum === 404 || durum === 410) {
          await adminClient.from('bildirim_abonelikleri').delete().eq('endpoint', abonelik.endpoint);
          silinen++;
        }
      }
    }

    return cevap({ durum: 'tamam', gonderilen, silinen, hata, hedef: hedefKullanici || 'herkes' });
  } catch (error) {
    return cevap({ durum: 'hata', mesaj: error instanceof Error ? error.message : String(error) }, 400);
  }
});
