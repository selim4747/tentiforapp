/* TentiforApp 4.0 · studio/paketleyici — evreni tek bir sıkıştırılmış .json.gz paketine çevirir, boyutunu
   denetler ve kilitli onay kuyruğuna bırakır. Veritabanına yalnızca küçük bir başvuru satırı yazılır. */

const PAKET_SINIR = 3 * 1024 * 1024;   /* sıkıştırılmış en çok 3 MB (bucket sınırıyla aynı) */

async function evrenPaketle(e) {
  const temiz = fanTemizle(JSON.parse(JSON.stringify(e)));
  if (!temiz || temiz.tur !== "evren") { throw new Error("Evren okunamadı."); }
  delete temiz.lorlar; delete temiz.yoneticiOzet;   /* kilitli lore ve yönetici kodu kurucuya aittir */
  const blob = await tf4Sikistir(JSON.stringify(temiz));
  if (blob.size > PAKET_SINIR) { throw new Error("Paket " + (blob.size / 1048576).toFixed(1) + " MB; en çok 3 MB olabilir (büyük görselleri küçült)."); }
  return { blob: blob, evren: temiz };
}

async function evrenOnayaGonder(id) {
  const e = typeof evrenBenimBul === "function" ? evrenBenimBul(id) : null;
  if (!e) { throw new Error("Evren bulunamadı."); }
  if (String(e.ad || "").trim().length < 2 || String(e.ozet || "").trim().length < 20) { throw new Error("Göndermeden önce evrenin adını ve en az bir cümlelik özetini yaz."); }
  if (typeof hesapKullanici === "undefined" || !hesapKullanici) { throw new Error("Onaya göndermek için giriş yap (başvuru hesabına bağlanır)."); }
  const p = await evrenPaketle(e);
  const s = await tf4Istemci();
  const yol = hesapKullanici.id + "/" + Date.now() + "-" + String(e.id).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) + ".json.gz";
  const y = await s.storage.from("onay-kuyrugu").upload(yol, p.blob, { contentType: "application/gzip", upsert: false });
  if (y.error) { throw new Error("Yüklenemedi: " + y.error.message); }
  const r = await s.rpc("basvuru_gonder", { p_baslik: String(e.ad).trim(), p_ozet: String(e.ozet || "").trim().slice(0, 600), p_dosya_yolu: yol, p_boyut: p.blob.size });
  if (r.error) { throw new Error(/bekleyen/.test(r.error.message) ? "Onayda bekleyen başvurun var (ücretsiz 1, Pro 5)." : r.error.message); }
  return { id: r.data, boyut: p.blob.size };
}

async function basvurularim() {
  const s = await tf4Istemci();
  const { data, error } = await s.from("basvurular").select("baslik,durum,karar_notu,tarih,oncelik").order("tarih", { ascending: false }).limit(10);
  if (error) { throw error; }
  return data || [];
}

function teslimHtml() {
  return '<section class="kutu-y tf4-teslim" aria-label="Onaya gönder"><b>Siteye yayın için onaya gönder</b>' +
    '<p class="oyun-not">Evrenin sıkıştırılıp kilitli kuyruğa gider; moderatörler önizleyip onaylayınca ana sayfadaki “Onaylanan evrenler”de herkese açılır.' + (tf4ProMu() ? " Pro: kuyrukta önceliklisin." : "") + "</p>" +
    '<div class="oyun-sira"><button type="button" class="dugme" data-tf4-gonder>Onaya gönder</button><button type="button" class="dugme dugme-sade" data-tf4-basvurularim>Başvurularım</button></div>' +
    '<p class="pencere-durum" id="tf4TeslimDurum" role="status"></p><div id="tf4Basvurular"></div></section>';
}

if (typeof evrKurucuHtml === "function") {
  const eskiEKH40 = evrKurucuHtml;
  window.evrKurucuHtml = function (v) {
    const h = eskiEKH40.apply(this, arguments);
    const e = v && v.eser;
    if (!e || typeof EVR_ADIM === "undefined" || (EVR_ADIM[e.id] || "temel") !== "paylas") { return h; }
    return h + teslimHtml();
  };
}

document.addEventListener("click", async function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-tf4-gonder], [data-tf4-basvurularim]");
  if (!b || typeof EVS === "undefined" || !EVS) { return; }
  const d = document.querySelector("#tf4TeslimDurum");
  const yaz = function (m, iyi) { if (d) { d.textContent = m; d.className = "pencere-durum " + (iyi ? "iyi" : "kotu"); } };
  if (b.hasAttribute("data-tf4-basvurularim")) {
    try {
      const l = await basvurularim();
      const a = document.querySelector("#tf4Basvurular");
      if (a) { a.innerHTML = l.length ? "<ul>" + l.map(function (x) { return "<li><b>" + kacir(x.baslik) + "</b> · " + ({ bekliyor: "onayda bekliyor", onaylandi: "onaylandı ✓", reddedildi: "reddedildi" })[x.durum] + (x.karar_notu ? ' <span class="oyun-not">— ' + kacir(x.karar_notu) + "</span>" : "") + "</li>"; }).join("") + "</ul>" : '<p class="oyun-not">Henüz başvurun yok.</p>'; }
    } catch (e) { yaz("Başvurular okunamadı.", false); }
    return;
  }
  b.disabled = true; yaz("Paketleniyor…", true);
  try { const r = await evrenOnayaGonder(EVS.id); yaz("Gönderildi (" + Math.max(1, Math.round(r.boyut / 1024)) + " KB). Moderatörler bakınca burada “Başvurularım”da görürsün.", true); }
  catch (e) { yaz(e.message, false); }
  b.disabled = false;
});

/* 4.0.1: "Onaya gönder" kendi evreninin Bilgiler sekmesinde de, en üstte (Kurucu'nun son adımında kalmasın) */
if (typeof evrenBilgiBolumu === "function") {
  const eskiEBB40 = evrenBilgiBolumu;
  window.evrenBilgiBolumu = function (v) {
    const h = eskiEBB40.apply(this, arguments);
    return (typeof EVS !== "undefined" && EVS && EVS.kaynak === "benim" ? teslimHtml() : "") + h;
  };
}
