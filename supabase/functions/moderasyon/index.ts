// Gerçek JWT/rol ve içerik denetimi olmadan fail-open onay üretme.
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://tentifor.com', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  return new Response(JSON.stringify({ durum: 'yapilandirilmadi', onaylandi: false, mesaj: 'Moderasyon servisi henüz yapılandırılmadı.' }), { status: 503, headers });
});
