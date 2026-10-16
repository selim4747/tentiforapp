// Sağlayıcı imzası ve idempotent DB yazımı eklenmeden webhook başarı kabul etmez.
Deno.serve(async () => new Response(JSON.stringify({ durum: 'yapilandirilmadi', mesaj: 'Webhook doğrulaması henüz yapılandırılmadı.' }), {
  status: 503, headers: { 'Content-Type': 'application/json' }
}));
