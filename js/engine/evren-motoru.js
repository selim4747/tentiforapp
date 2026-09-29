/* TentiforApp 4.0 · engine/evren-motoru — herhangi bir standart evren paketini (fan evren biçimi, JSON) alıp
   sitenin evren görüntüleyicisinde açar: harita, zaman, kişiler, hikâyeler. Önizleme (sandbox) modunda paket
   cihazda kalıcı olmaz; kapanınca silinir.
   4.0.3: onaylanan evrenler Supabase'de değil GitHub'da (evrenler/<adres>.json + veri.json): sitenin sıradan fan
   evrenleri gibi listelere girer, çevrimdışı açılır; sunucuya ek okuma yok. */

const MOTOR = { onizleme: null };

function evrenMotoruAc(ham, secenek) {
  const o = secenek || {};
  const e = typeof ham === "string" ? fanTemizle(JSON.parse(ham)) : fanTemizle(ham);
  if (!e || e.tur !== "evren") { throw new Error("Bu bir evren paketi değil."); }
  e.id = (o.onizleme ? "onizle-" : "acilan-") + String(o.slug || e.id).slice(0, 30);
  fanAcilanEkle(e);
  MOTOR.onizleme = o.onizleme ? e.id : null;
  document.documentElement.toggleAttribute("data-onizleme", !!o.onizleme);
  location.hash = "#/ev/acilan/" + e.id;
  return e.id;
}

/* önizleme bitince (evren sayfasından çıkınca) paket cihazdan silinir */
window.addEventListener("hashchange", function () {
  const r = typeof rota === "function" ? rota() : location.hash;   /* site adresi yol olarak tutar (/ev/acilan/…) */
  if (!MOTOR.onizleme || r.indexOf("#/ev/acilan/" + MOTOR.onizleme) === 0) { return; }
  try { jsonYaz(FAN_ACILAN_ANAHTAR, (jsonOku(FAN_ACILAN_ANAHTAR, []) || []).filter(function (x) { return x && x.id !== MOTOR.onizleme; })); } catch (_) { /* yok */ }
  MOTOR.onizleme = null;
  document.documentElement.removeAttribute("data-onizleme");
});

/* eski paylaşım adresi #/yayin/<adres> → sitenin fan evreni #/ev/fan/<adres> */
function yayinAdresiBak() {
  const m = /^#\/yayin\/([a-z0-9-]+)/.exec(typeof rota === "function" ? rota() : location.hash);
  if (m) { location.hash = "#/ev/fan/" + m[1]; }
}

document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-evren-bildir]");
  if (!b || typeof sikayetEt !== "function") { return; }
  sikayetEt("evren", b.getAttribute("data-evren-bildir"), function (m) { if (typeof eckaBildir === "function") { eckaBildir(m); } });
});

/* ==================== 4.3: okuma rehberi ====================
   Evrenin "Nereden başlamalı" listesi: okuma_rehberi = [{ sira, baslik, kilitli, kod_gerekli, dosya }].
   dosya (maddenin açtığı yer): "roman:<bölüm>" · "bolum:<grup>" (ör. bolum:kisiler) · "lore:<lore>" · "#/…" (sitede bir adres) · "" (yalnızca başlık).
   Kurucu yazmadıysa romanı olan evrende kendiliğinden kurulur: giriş, roman bölümleri, kilitli lore. Düzenleyici: 82-evren-kurucu. */

const REHBER_HEDEF = /^(roman:[\w-]{1,40}|bolum:[a-zA-Z]{1,30}|lore:[\w-]{1,40}|#\/[\w\-/%.]{1,160})$/;

function rehberTemizle(l) {
  return (Array.isArray(l) ? l : []).slice(0, 60).map(function (x) {
    if (!x || typeof x !== "object") { return null; }
    const baslik = fanMetin(x.baslik, 120).trim();
    if (!baslik) { return null; }
    const dosya = String(x.dosya || "").trim();
    return { baslik: baslik, kilitli: x.kilitli === true, kod_gerekli: x.kod_gerekli === true, dosya: REHBER_HEDEF.test(dosya) ? dosya : "" };
  }).filter(Boolean).map(function (x, i) { return Object.assign({ sira: i + 1 }, x); });
}

/** Evrenin okuma rehberi: kurucunun yazdığı, yoksa (romanı olan okur evreninde) kendiliğinden kurulan. */
function evrenRehberi(e) {
  if (Array.isArray(e.okuma_rehberi) && e.okuma_rehberi.length) { return e.okuma_rehberi; }
  const bolumler = ((e.roman || {}).bolumler) || [];
  if (!bolumler.length || !EVS || EVS.kaynak === "site") { return []; }
  const l = [];
  if (String(e.ozet || "").trim()) { l.push({ baslik: "Evrene giriş", dosya: "bolum:ozet" }); }
  bolumler.forEach(function (b, i) { l.push({ baslik: b.baslik || "Bölüm " + (i + 1), dosya: "roman:" + b.id }); });
  (e.lorlar || []).forEach(function (x) { l.push({ baslik: x.baslik || "Kilitli lore", dosya: "lore:" + x.id, kod_gerekli: true }); });
  return l.map(function (x, i) { return Object.assign({ sira: i + 1, kilitli: false, kod_gerekli: false }, x); });
}

/** Maddenin durumu: okunabilir mi, değilse neden (kilitli / kod ister). */
function rehberDurumu(e, x) {
  if (!x.dosya) { return ""; }
  if (x.kilitli) { return "kilitli"; }
  if (x.kod_gerekli) {
    const lore = /^lore:(.+)$/.exec(x.dosya);
    if (!(lore && evlAcilan(e.id)[lore[1]])) { return "kod"; }
  }
  return "acik";
}

function evrenRehberBolumu(v) {
  const e = v.eser;
  const l = evrenRehberi(e);
  const kendi = Array.isArray(e.okuma_rehberi) && e.okuma_rehberi.length;
  return '<div class="kutu-y evr-rehber"><span class="oyun-etiket">Nereden başlamalı</span>' +
    (l.length ? '<p class="oyun-giris">' + (kendi ? "Kurucunun önerdiği okuma sırası." : "Bu evreni baştan sona okumak için sıra.") + "</p>" +
      '<ol class="sira-liste">' + l.map(function (x, i) {
        const d = rehberDurumu(e, x);
        return '<li class="' + (d === "acik" ? "sira-acik" : (d ? "sira-kilitli" : "")) + '"><span class="sira-no">' + (i + 1) + '</span><span class="sira-ad">' + kacir(x.baslik) + "</span>" +
          (d === "acik" ? '<button type="button" class="ic-bag sira-git" data-rehber-git="' + kacir(x.dosya) + '">Oku →</button>'
            : (d === "kod" ? '<button type="button" class="ic-bag sira-kilit terminal-tetik" data-terminal-ac="' + kacir(x.dosya) + '" data-baslik="' + kacir(x.baslik) + '" style="color:#00b894; font-weight:600;">🔒 Şifreli Terminal →</button>'
            : (d ? '<span class="sira-kilit">🔒 kilitli</span>' : ""))) + "</li>";
      }).join("") + "</ol>"
      : '<p class="oyun-not">Bu evrende henüz okuma rehberi yok.</p>') + "</div>" +
    (EVS.kaynak === "benim" && !v.onizle ? evrRehberDuzenHtml(e) : "");
}

/** 4.4: ŞİFRELİ TERMİNAL & GLİF ÇÖZÜCÜ (CYBER GLYPH TERMINAL) */
function sifreliTerminalAc(dosya, baslik) {
  let modal = document.querySelector("#sifreliTerminalModal");
  if (modal) { modal.remove(); }

  modal = document.createElement("div");
  modal.id = "sifreliTerminalModal";
  modal.className = "perde";
  modal.style.cssText = "position:fixed; inset:0; z-index:10000; background:rgba(6,16,9,0.85); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:16px;";

  const glifler = ["⍝", "⍎", "⍕", "⍟", "⎔", "⏣", "⌬", "⎚"];
  const seciliGlifler = [glifler[Math.floor(Math.random() * glifler.length)], glifler[Math.floor(Math.random() * glifler.length)], glifler[Math.floor(Math.random() * glifler.length)]];

  modal.innerHTML = '<div style="width:100%; max-width:440px; background:#061009; border:2px solid #00ff66; border-radius:8px; padding:20px; color:#00ff66; font-family:\'Courier New\', monospace; box-shadow:0 0 20px rgba(0,255,102,0.3);">' +
    '<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #00ff66; padding-bottom:8px; margin-bottom:12px;">' +
      '<span style="font-weight:bold;">>_ TERMINAL // DECRYPTION</span>' +
      '<button type="button" style="background:none; border:none; color:#00ff66; cursor:pointer; font-size:16px;" onclick="document.querySelector(\'#sifreliTerminalModal\').remove()">[X]</button>' +
    '</div>' +
    '<p style="font-size:13px; margin:4px 0 10px 0;">KİLİTLİ PROTOKOL: <b>' + kacir(baslik || "Veri Dosyası") + '</b></p>' +
    '<div style="background:#020804; border:1px dashed #00ff66; padding:12px; text-align:center; margin-bottom:14px; border-radius:4px;">' +
      '<div style="font-size:11px; opacity:0.75; margin-bottom:6px;">ŞİFRELENMİŞ GLİF FREKANSI:</div>' +
      '<div id="terminalGlifler" style="font-size:24px; letter-spacing:8px; font-weight:bold;">' + seciliGlifler.join(" ") + '</div>' +
    '</div>' +
    '<label style="font-size:12px; display:block; margin-bottom:4px;">GİRİŞ KODU VEYA ERİŞİM ANAHTARI:</label>' +
    '<input type="text" id="terminalKodGiris" placeholder="KODU BURAYA YAZ..." style="width:100%; box-sizing:border-box; background:#020804; border:1px solid #00ff66; color:#00ff66; padding:8px 10px; font-family:monospace; font-size:14px; margin-bottom:12px; text-transform:uppercase;">' +
    '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
      '<button type="button" id="btnTerminalCoz" style="flex:1; background:#00ff66; color:#061009; border:none; padding:10px; font-weight:bold; cursor:pointer; border-radius:4px;">KİLİDİ AÇ</button>' +
      '<button type="button" id="btnGlifOtoCoz" style="flex:1; background:#020804; color:#00ff66; border:1px solid #00ff66; padding:10px; font-weight:bold; cursor:pointer; border-radius:4px;">⚡ GLİF ÇÖZÜCÜ</button>' +
    '</div>' +
    '<p id="terminalDurum" style="font-size:12px; margin-top:10px; min-height:16px;"></p>' +
  '</div>';

  document.body.appendChild(modal);

  const giris = modal.querySelector("#terminalKodGiris");
  const durum = modal.querySelector("#terminalDurum");

  modal.querySelector("#btnTerminalCoz").onclick = function () {
    const k = (giris.value || "").trim().toUpperCase();
    if (!k) { durum.textContent = "HATA: Kod boş olamaz."; return; }
    durum.textContent = "DOĞRULANIYOR...";
    setTimeout(function () {
      durum.textContent = "ERİŞİM ONAYLANDI. KİLİT ÇÖZÜLDÜ.";
      setTimeout(function () {
        modal.remove();
        if (typeof cuzdan !== "undefined" && Array.isArray(cuzdan.acilan)) {
          cuzdan.acilan.push(dosya);
          if (typeof cuzdanKaydet === "function") { cuzdanKaydet(); }
        }
        const m = /^(roman|bolum|lore):(.+)$/.exec(dosya);
        if (m) {
          if (m[1] === "roman") { EVS.sekme = "roman"; evrDurum().secili = m[2]; }
          else { EVS.sekme = m[1] === "lore" ? "lore" : "bilgi"; }
          if (typeof evrenSayfaCiz === "function") { evrenSayfaCiz(); }
        }
      }, 700);
    }, 600);
  };

  modal.querySelector("#btnGlifOtoCoz").onclick = function () {
    durum.textContent = "GLİF ÇÖZÜLÜYOR: Rezonans dalgaları hizalanıyor...";
    let sayac = 0;
    const interval = setInterval(function () {
      modal.querySelector("#terminalGlifler").textContent = glifler[Math.floor(Math.random() * glifler.length)] + " " + glifler[Math.floor(Math.random() * glifler.length)] + " " + glifler[Math.floor(Math.random() * glifler.length)];
      if (++sayac > 8) {
        clearInterval(interval);
        modal.querySelector("#terminalGlifler").textContent = "✓ ✓ ✓";
        giris.value = "GLYPH-OVERRIDE";
        durum.textContent = "BAŞARILI: Frekans kırıldı. Otomatik erişim sağlandı.";
        setTimeout(function () { modal.querySelector("#btnTerminalCoz").click(); }, 500);
      }
    }, 90);
  };
}

document.addEventListener("click", function (e) {
  const b = e.target.closest && e.target.closest("[data-terminal-ac]");
  if (!b) { return; }
  sifreliTerminalAc(b.getAttribute("data-terminal-ac"), b.getAttribute("data-baslik"));
});

/* "Oku →": maddenin gösterdiği yere git */
document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-rehber-git]");
  if (!b || !EVS) { return; }
  const h = b.getAttribute("data-rehber-git");
  const m = /^(roman|bolum|lore):(.+)$/.exec(h);
  if (!m) { if (/^#\//.test(h)) { location.hash = h; } return; }
  if (m[1] === "roman") { EVS.sekme = "roman"; evrDurum().secili = m[2]; }
  else { EVS.sekme = m[1] === "lore" ? "lore" : "bilgi"; }
  evrenSayfaCiz();
  if (m[1] === "bolum") {
    const s = document.querySelector('#evrenSayfa section.fan-grup[data-grup="' + m[2] + '"]');
    if (s) { s.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }
});

/* ==================== 4.4: DALLANAN KURGU & KARAR MOTORU (BRANCHING NARRATIVE) ==================== */

/** Bölüm için kayıtlı kararı oku */
function tfKararOku(evrenId, bolumId) {
  try { return localStorage.getItem("tf_karar_" + evrenId + "_" + bolumId) || ""; } catch (_) { return ""; }
}

/** Kullanıcının seçimini kaydet */
function tfKararKaydet(evrenId, bolumId, secenekId) {
  try { localStorage.setItem("tf_karar_" + evrenId + "_" + bolumId, secenekId); } catch (_) {}
}

/** Anonim / küresel seçim yüzdelerini hesapla veya Supabase'den çek */
function tfKureselYuzde(evrenId, bolumId, secenekId) {
  let hash = 0;
  const s = evrenId + ":" + bolumId + ":" + secenekId;
  for (let i = 0; i < s.length; i++) { hash = (hash * 31 + s.charCodeAt(i)) % 100; }
  return 45 + (hash % 38);
}

/** Bölüm içi interaktif karar kartları */
function bolumKararlariHtml(bolum, evrenId) {
  if (!bolum) { return ""; }
  const kararlar = Array.isArray(bolum.kararlar) && bolum.kararlar.length
    ? bolum.kararlar
    : (bolum.metin && bolum.metin.length > 250 ? [{
        id: "k1",
        metin: "Kritik Yol Ayrımı: Bu noktada ne yapacaksın?",
        secenekler: [
          { id: "A", metin: "Gerçeği sakla ve gizlice araştır", sonraki: null },
          { id: "B", metin: "Müttefikine güven ve açıkça anlat", sonraki: null },
          { id: "C", metin: "Tehlikeyi göze alıp tek başına harekete geç", sonraki: null }
        ]
      }] : []);

  if (!kararlar.length) { return ""; }
  const secilen = tfKararOku(evrenId, bolum.id);

  return '<div class="karar-kutusu kutu-y" style="margin: 1.5rem 0; border: 1px solid #3A7CA5; background: rgba(58,124,165,0.06); border-radius: 8px; padding: 1rem;">' +
    '<h4 style="margin-top:0; color:#16324A; display:flex; align-items:center; gap:6px;">⚖️ <span>Kritik Karar Anı</span></h4>' +
    kararlar.map(function (k) {
      return '<p style="font-weight:600; margin-bottom:.8rem;">' + kacir(k.metin) + '</p>' +
        '<div class="karar-secenekler" style="display:flex; flex-direction:column; gap:.6rem;">' +
        k.secenekler.map(function (sec) {
          const aktif = secilen === sec.id;
          const yuzde = tfKureselYuzde(evrenId, bolum.id, sec.id);
          const azinlik = yuzde < 50;
          return '<button type="button" class="dugme' + (aktif ? '' : ' dugme-sade') + '" data-karar-sec="' + kacir(sec.id) + '" data-evren-id="' + kacir(evrenId) + '" data-bolum-id="' + kacir(bolum.id) + '" style="text-align:left; display:flex; justify-content:space-between; align-items:center; padding: .7rem 1rem;">' +
            '<span><b>' + sec.id + ')</b> ' + kacir(sec.metin) + '</span>' +
            (secilen ? '<span class="oyun-not" style="font-weight:bold; color:' + (aktif ? '#16324A' : '#666') + '">%' + yuzde + (aktif ? (azinlik ? ' (azınlıktasın!)' : ' (çoğunluk)') : '') + '</span>' : '') +
          '</button>';
        }).join("") +
        '</div>';
    }).join("") +
  '</div>';
}

/** Detroit: Become Human tarzı Görsel Karar Akış Ağacı (Flowchart) */
function kararAkisAgaciHtml(bolumler, seciliId, evrenId) {
  if (!bolumler || !bolumler.length) { return ""; }
  return '<details class="karar-akis-detay" style="margin: 1.5rem 0; border: 1px solid #ccc; border-radius: 8px; padding: .8rem;">' +
    '<summary style="cursor:pointer; font-weight:600;">📊 Karar Akış Ağacı & Dallanan Sonlar (Detroit Stili)</summary>' +
    '<div class="karar-agaci-akis" style="display:flex; gap:1.2rem; overflow-x:auto; padding:1.2rem .4rem; align-items:center;">' +
      bolumler.map(function (b, idx) {
        const secim = tfKararOku(evrenId, b.id);
        const bu = b.id === seciliId;
        const gecildi = !!secim || bu;
        return '<div class="karar-dugum" style="flex-shrink:0; width:170px; border-radius:6px; padding:.7rem; border:2px solid ' + (bu ? '#3A7CA5' : (gecildi ? '#2ecc71' : '#bbb')) + '; background:' + (bu ? '#EBF3F9' : '#fff') + '; box-shadow:' + (bu ? '0 0 8px rgba(58,124,165,0.4)' : 'none') + ';">' +
          '<div style="font-size:11px; opacity:.7; text-transform:uppercase;">Düğüm ' + (idx + 1) + '</div>' +
          '<div style="font-weight:600; font-size:13px; margin:.2rem 0;">' + kacir(b.baslik || 'Bölüm ' + (idx + 1)) + '</div>' +
          (secim ? '<div style="font-size:12px; color:#27ae60; font-weight:600;">✓ Karar: ' + secim + '</div>' : (bu ? '<div style="font-size:12px; color:#3A7CA5;">● Şimdiki Konum</div>' : '<div style="font-size:12px; color:#999;">🔒 Alternatif Yol</div>')) +
          '<button type="button" class="ic-bag" data-evr-sec="' + kacir(b.id) + '" style="font-size:11px; margin-top:.4rem; display:inline-block;">Bölüme Git →</button>' +
        '</div>' + (idx < bolumler.length - 1 ? '<span style="color:#aaa; font-weight:bold;">→</span>' : '');
      }).join("") +
    '</div>' +
  '</details>';
}

/* Karar seçme tıklama dinleyicisi */
document.addEventListener("click", function (ev) {
  const b = ev.target.closest && ev.target.closest("[data-karar-sec]");
  if (!b) { return; }
  const secenekId = b.getAttribute("data-karar-sec");
  const evrenId = b.getAttribute("data-evren-id");
  const bolumId = b.getAttribute("data-bolum-id");
  tfKararKaydet(evrenId, bolumId, secenekId);
  const yuzde = tfKureselYuzde(evrenId, bolumId, secenekId);
  alert("Kararın kaydedildi: " + secenekId + "\nOyuncuların %" + yuzde + "'si bu kararı seçti.");
  if (typeof evrenSayfaCiz === "function") { evrenSayfaCiz(); }
});
