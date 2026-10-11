import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";

const allowedOrigins = new Set([
  "https://tentifor.com",
  "https://www.tentifor.com",
  "http://localhost",
  "https://localhost",
  "capacitor://localhost",
]);
const maxCompressedBytes = 12 * 1024 * 1024;
const maxExpandedBytes = 32 * 1024 * 1024;
const legacyKey = "tentiforapp_evrengezer";

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://tentifor.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
}

async function gunzipBounded(encoded: string): Promise<string> {
  if (encoded.length > maxCompressedBytes) throw new Error("snapshot_too_large");
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxExpandedBytes) {
      await reader.cancel();
      throw new Error("snapshot_too_large");
    }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(result);
}

async function parseProgress(value: unknown): Promise<Record<string, unknown>> {
  let parsed: unknown = value;
  if (typeof parsed === "string") {
    if (parsed.length > maxExpandedBytes) throw new Error("snapshot_too_large");
    parsed = JSON.parse(parsed);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_snapshot");
  const snapshot = parsed as Record<string, unknown>;
  if (typeof snapshot._z === "string") {
    if (snapshot._v !== 2) throw new Error("unsupported_snapshot");
    const expanded = await gunzipBounded(snapshot._z);
    const result: unknown = JSON.parse(expanded);
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("invalid_snapshot");
    return result as Record<string, unknown>;
  }
  if (JSON.stringify(snapshot).length > maxExpandedBytes) throw new Error("snapshot_too_large");
  return snapshot;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { durum: "method_not_allowed" }, 405);

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json(request, { durum: "giris" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json(request, { durum: "yapilandirilmadi" }, 503);

  const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user) return json(request, { durum: "giris" }, 401);

  const { data: progressRow, error: progressError } = await adminClient
    .from("ilerlemeler")
    .select("veri")
    .eq("id", user.id)
    .maybeSingle();
  if (progressError) return json(request, { durum: "aktarim_okunamadi" }, 503);
  if (!progressRow) return json(request, { durum: "senkron_bekleniyor" });

  try {
    const progress = await parseProgress(progressRow.veri);
    const rawLegacy = progress[legacyKey];
    let legacy: unknown = rawLegacy;
    if (typeof legacy === "string") {
      if (legacy.length > 1024 * 1024) throw new Error("legacy_wallet_too_large");
      legacy = JSON.parse(legacy);
    }
    if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) {
      if (rawLegacy === undefined || rawLegacy === null) legacy = { eg: 0 };
      else throw new Error("invalid_legacy_wallet");
    }
    const amount = (legacy as Record<string, unknown>).eg;
    if (amount === undefined) {
      // The cloud snapshot has no old EG key. Record a one-time zero migration;
      // never fall back to the browser's unsynced localStorage value.
      (legacy as Record<string, unknown>).eg = 0;
    }
    const eg = (legacy as Record<string, unknown>).eg;
    if (typeof eg !== "number" || !Number.isSafeInteger(eg) || eg < 0) {
      return json(request, { durum: "legacy_bakiye_gecersiz" }, 422);
    }

    const { data: result, error: importError } = await adminClient.rpc("evren_gezer_bakiye_aktar", {
      p_kullanici: user.id,
      p_miktar: eg,
    });
    if (importError || !result || result.durum !== "tamam") {
      return json(request, { durum: "aktarim_yapilamadi" }, 503);
    }
    return json(request, {
      durum: result.tekrar ? "zaten_aktarildi" : "aktarildi",
      bakiye: result.bakiye,
      aktarilan: result.aktarilan,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid_snapshot";
    if (message === "snapshot_too_large" || message === "legacy_wallet_too_large") {
      return json(request, { durum: "snapshot_cok_buyuk" }, 413);
    }
    return json(request, { durum: "eski_bakiye_okunamadi" }, 422);
  }
});
