export async function onRequestGet(context) {
  return new Response(JSON.stringify({ durum: "ok", mesajlar: [] }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

export async function onRequestPost(context) {
  try {
    const veri = await context.request.json();
    return new Response(JSON.stringify({ durum: "ok", kaydedildi: true, veri }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ durum: "hata", mesaj: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}
