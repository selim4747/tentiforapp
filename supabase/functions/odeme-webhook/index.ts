// Supabase Edge Function: Ödeme Webhook
Deno.serve(async (req) => {
  return new Response(JSON.stringify({ durum: 'ok' }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
