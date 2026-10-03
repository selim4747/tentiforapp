import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://tentiforapp.pages.dev",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ hata: "Yalnızca POST desteklenir" }, 405);

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ hata: "Giriş gerekli" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const githubToken = Deno.env.get("GITHUB_TOKEN");
  const githubOwner = Deno.env.get("GITHUB_OWNER") || "selim4747";
  const githubRepo = Deno.env.get("GITHUB_REPO") || "tentiforapp";
  const githubBranch = Deno.env.get("GITHUB_BRANCH") || "main";
  if (!supabaseUrl || !supabaseAnonKey || !githubToken) {
    return json({ hata: "Sunucu ayarları eksik" }, 503);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "").trim();
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(id)) return json({ hata: "Geçersiz evren kimliği" }, 400);

  const { data: erisim, error: erisimHatasi } = await userClient.rpc("evren_erisimi", { p_id: id });
  if (erisimHatasi) return json({ hata: "Erişim kontrolü yapılamadı" }, 500);
  if (!erisim || erisim.izin !== true || !erisim.github_yol) return json({ hata: "Bu evren için izin yok" }, 403);

  const path = String(erisim.github_yol);
  if (!/^evren\/[A-Za-z0-9_-]{1,60}\.json$/.test(path)) return json({ hata: "Geçersiz evren yolu" }, 400);
  const githubPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.github.com/repos/${encodeURIComponent(githubOwner)}/${encodeURIComponent(githubRepo)}/contents/${githubPath}?ref=${encodeURIComponent(githubBranch)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Tentiforverse-evren-gecidi",
    },
  });
  if (response.status === 404) return json({ hata: "Evren dosyası bulunamadı" }, 404);
  if (!response.ok) return json({ hata: "GitHub dosyası okunamadı" }, 502);
  const remote = await response.json();
  if (remote.encoding !== "base64" || typeof remote.content !== "string") return json({ hata: "Geçersiz GitHub içeriği" }, 502);

  try {
    const binary = atob(remote.content.replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const veri = JSON.parse(new TextDecoder().decode(bytes));
    return json({ durum: "tamam", id, github_yol: path, guncelleme: erisim.guncelleme, rol: erisim.rol, veri });
  } catch {
    return json({ hata: "Evren JSON dosyası bozuk" }, 502);
  }
});
