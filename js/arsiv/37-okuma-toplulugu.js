/* Okuma topluluğu ve ortamSesi: bölüm tepkileri, kenar notları, sayfaya göre ortamSesi sesi. */

/* ==================== TEPKİLER ve KENAR NOTLARI ====================
   Okunan her şeyin altına <div class="tepki-alan" data-hedef="roman:3"></div> konur;
   görünür olunca kurulur. Sayılar herkese açıktır; tepki ve not için giriş gerekir. */

const TEPKILER = [["buz", "❄", "Ürperttim"], ["kalp", "♥", "Sevdim"], ["yildiz", "✦", "Aklımda kaldı"], ["soru", "?", "Kafamda soru var"]];

function tepkiAlanlariKur(kok) {
  (kok || document).querySelectorAll(".tepki-alan[data-hedef]:not([data-kuruldu])").forEach(function (el) {
    if (el.offsetParent === null) { return; }          /* kapalı <details> ya da gizli bölüm */
    el.dataset.kuruldu = "1";
    tepkiAlanCiz(el);
  });
}

async function tepkiAlanCiz(el) {
  if (typeof hesapEtkin !== "function" || !hesapEtkin()) { el.hidden = true; return; }
  if (typeof hesapIstemci === "undefined" || !hesapIstemci) {
    el.innerHTML = '<p class="oyun-not">Tepkiler yükleniyor…</p>';
    if (typeof hesapGorununce === "function") { hesapGorununce(el, function () { tepkiAlanCiz(el); }); }
    return;
  }
  const hedef = el.dataset.hedef;
  const girisli = !!(typeof hesapKullanici !== "undefined" && hesapKullanici);
  const [s, n, b] = await Promise.all([
    hesapIstemci.from("tepki_sayilari").select("tepki, sayi").eq("hedef", hedef),
    hesapIstemci.from("kenar_notlari_listesi").select("id, metin, zaman, kullanici_adi, gorunen_ad, benim")
      .eq("hedef", hedef).order("zaman", { ascending: false }).limit(30),
    girisli ? hesapIstemci.rpc("tepkilerim", { p_hedef: hedef }) : Promise.resolve({ data: [] })
  ]);
  const sayi = {};
  (s.data || []).forEach(function (x) { sayi[x.tepki] = Number(x.sayi) || 0; });
  const benim = Array.isArray(b.data) ? b.data : [];
  const notlar = n.data || [];
  el.innerHTML =
    '<div class="tepki-sira" role="group" aria-label="Tepkiler">' + TEPKILER.map(function (t) {
      const acik = benim.indexOf(t[0]) !== -1;
      return '<button class="tepki' + (acik ? " acik" : "") + '" data-tepki="' + t[0] + '" title="' + kacir(t[2]) + '" aria-pressed="' + acik + '">' +
        '<span aria-hidden="true">' + t[1] + "</span> " + (sayi[t[0]] || 0) + "</button>";
    }).join("") + "</div>" +
    '<div class="kenar-notlar">' +
      '<span class="oyun-etiket">Kenar notları' + (notlar.length ? " · " + notlar.length : "") + "</span>" +
      (notlar.length ? notlar.map(function (x) {
        return '<div class="kenar-not"><p>' + kacir(x.metin) + "</p>" +
          '<span class="oyun-not"><a href="#/u/' + encodeURIComponent(x.kullanici_adi) + '">@' + kacir(x.kullanici_adi) + "</a> · " +
            new Date(x.zaman).toLocaleDateString("tr-TR") +
            (x.benim ? ' · <button class="ic-bag" data-not-sil="' + x.id + '">sil</button>'
                     : (girisli ? ' · <button class="ic-bag" data-not-bildir="' + x.id + '">bildir</button>' : "")) + "</span></div>";
      }).join("") : '<p class="oyun-not">Henüz not yok.</p>') +
      (girisli
        ? '<form class="kenar-form" data-not-form><textarea class="kod-giris" maxlength="280" rows="2" placeholder="Kenara kısa bir not bırak (herkes görür)"></textarea>' +
          '<button class="dugme dugme-sade" type="submit">Not bırak</button></form>'
        : '<button class="ic-bag" data-hesap-pencere="giris">Tepki ve not için giriş yap</button>') +
      '<p class="pencere-durum" data-not-durum></p>' +
    "</div>";
}

async function tepkiVer(el, tepki) {
  if (typeof hesapKullanici === "undefined" || !hesapKullanici) {
    if (typeof hesapPencere === "function") { hesapPencere("giris"); }
    return;
  }
  const { error } = await hesapIstemci.rpc("tepki_ver", { p_hedef: el.dataset.hedef, p_tepki: tepki });
  if (error) { const d = el.querySelector("[data-not-durum]"); if (d) { d.textContent = hesapHataMetni(error); } return; }
  tepkiAlanCiz(el);
}

async function kenarNotYaz(el, form) {
  const t = form.querySelector("textarea");
  const d = el.querySelector("[data-not-durum]");
  const metin = (t.value || "").trim();
  if (metin.length < 3) { if (d) { d.textContent = "Biraz daha yaz."; } return; }
  const { data, error } = await hesapIstemci.rpc("kenar_not_yaz", { p_hedef: el.dataset.hedef, p_metin: metin });
  if (error) { if (d) { d.textContent = hesapHataMetni(error); } return; }
  const m = { sinir: "Bugün yeterince not bıraktın (günde 10).", engelli: "Hesabın kısıtlı olduğu için not bırakamıyorsun.", kisa: "Biraz daha yaz." }[data && data.durum];
  if (m) { if (d) { d.textContent = m; } return; }
  tepkiAlanCiz(el);
}

document.addEventListener("click", function (e) {
  const t = e.target.closest("[data-tepki]");
  if (t) { tepkiVer(t.closest(".tepki-alan"), t.dataset.tepki); return; }
  const s = e.target.closest("[data-not-sil]");
  if (s) {
    const el = s.closest(".tepki-alan");
    hesapIstemci.rpc("kenar_not_sil", { p_not: Number(s.dataset.notSil) }).then(function () { tepkiAlanCiz(el); });
    return;
  }
  const b = e.target.closest("[data-not-bildir]");
  if (b) {
    hesapIstemci.rpc("kenar_not_bildir", { p_not: Number(b.dataset.notBildir) }).then(function () { b.replaceWith(document.createTextNode("bildirildi")); });
  }
});
document.addEventListener("submit", function (e) {
  const f = e.target.closest("[data-not-form]");
  if (f) { e.preventDefault(); kenarNotYaz(f.closest(".tepki-alan"), f); }
});
/* hikâye <details> açılınca altındaki tepki alanı kurulsun */
document.addEventListener("toggle", function (e) {
  if (e.target.open) { tepkiAlanlariKur(e.target); }
}, true);

/* ==================== ORTAM SESİ ====================
   Dosya indirmeden, tarayıcıda üretilir. Tömye: rüzgâr ve arada buz çatırtısı.
   Claude'un evreni ekrandayken: şafak uğultusu ve uzaktan Yeveş tıkırtıları. Varsayılan kapalı. */

const ORTAM_SES_ANAHTAR = "tentiforapp_ortam";
let ortamSesi = null;

function ortamSesAcikMi() { try { return localStorage.getItem(ORTAM_SES_ANAHTAR) === "1"; } catch (e) { return false; } }

function ortamSesDugmesiKur() {
  if (document.querySelector("#ortamSes")) { return; }
  const tema = document.querySelector("#temaAnahtar");
  if (!tema) { return; }
  const b = document.createElement("button");
  b.className = "ust-ikon";
  b.id = "ortamSes";
  b.setAttribute("aria-label", "Ortam sesi");
  b.setAttribute("aria-pressed", "false");
  b.textContent = "♪";
  tema.parentNode.insertBefore(b, tema);
}

function ortamSesGurultu(a) {
  const buf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
  const v = buf.getChannelData(0);
  for (let i = 0; i < v.length; i++) { v[i] = Math.random() * 2 - 1; }
  return buf;
}

function ortamSesBaslat() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx || ortamSesi) { return; }
  const a = new Ctx();
  const ana = a.createGain(); ana.gain.value = 0.9; ana.connect(a.destination);

  /* Tömye: rüzgâr */
  const tomye = a.createGain(); tomye.gain.value = 0; tomye.connect(ana);
  const r = a.createBufferSource(); r.buffer = ortamSesGurultu(a); r.loop = true;
  const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 420; bp.Q.value = 0.6;
  const rg = a.createGain(); rg.gain.value = 0.05;
  const lfo = a.createOscillator(); lfo.frequency.value = 0.07;
  const lfoG = a.createGain(); lfoG.gain.value = 0.035; lfo.connect(lfoG); lfoG.connect(rg.gain);
  const lfo2 = a.createOscillator(); lfo2.frequency.value = 0.05;
  const lfo2G = a.createGain(); lfo2G.gain.value = 180; lfo2.connect(lfo2G); lfo2G.connect(bp.frequency);
  r.connect(bp); bp.connect(rg); rg.connect(tomye);
  r.start(); lfo.start(); lfo2.start();

  /* Şomdo: uğultu */
  const somdo = a.createGain(); somdo.gain.value = 0; somdo.connect(ana);
  [55, 82.5, 110.3].forEach(function (f, i) {
    const o = a.createOscillator(); o.type = "sine"; o.frequency.value = f;
    const g = a.createGain(); g.gain.value = [0.05, 0.025, 0.012][i];
    const t = a.createOscillator(); t.frequency.value = 0.09 + i * 0.03;
    const tg = a.createGain(); tg.gain.value = [0.02, 0.012, 0.006][i]; t.connect(tg); tg.connect(g.gain);
    o.connect(g); g.connect(somdo); o.start(); t.start();
  });

  /* 4.4: Derin Uzay Rezonans Drone */
  const uzay = a.createGain(); uzay.gain.value = 0; uzay.connect(ana);
  [55, 55.5, 110, 110.8].forEach(function (freq, idx) {
    const osc = a.createOscillator(); osc.type = idx % 2 === 0 ? "sawtooth" : "sine"; osc.frequency.value = freq;
    const flt = a.createBiquadFilter(); flt.type = "lowpass"; flt.frequency.value = 220; flt.Q.value = 3;
    const g = a.createGain(); g.gain.value = 0.02;
    osc.connect(flt); flt.connect(g); g.connect(uzay);
    osc.start();
  });

  /* 4.4: Siberpunk Prosedürel Arpej Vuruşları */
  const siberpunk = a.createGain(); siberpunk.gain.value = 0; siberpunk.connect(ana);
  const synthOsc = a.createOscillator(); synthOsc.type = "triangle"; synthOsc.frequency.value = 220;
  const synthGain = a.createGain(); synthGain.gain.value = 0.025;
  synthOsc.connect(synthGain); synthGain.connect(siberpunk);
  synthOsc.start();

  ortamSesi = { a: a, ana: ana, tomye: tomye, somdo: somdo, uzay: uzay, siberpunk: siberpunk, mod: null, zaman: null };
  ortamSesOlaylar();
  ortamSesModGuncelle();
}

/** 4.4 Manuel prosedürel ambiyans değiştirici: 'tomye', 'somdo', 'uzay', 'siberpunk' */
function prosedurelAmbiyansAyarla(mod) {
  if (!ortamSesi) { ortamSesBaslat(); }
  if (!ortamSesi) { return; }
  const a = ortamSesi.a;
  const t = a.currentTime;
  ortamSesi.mod = mod;
  if (ortamSesi.tomye) { ortamSesi.tomye.gain.setTargetAtTime(mod === "tomye" ? 1 : 0, t, 0.8); }
  if (ortamSesi.somdo) { ortamSesi.somdo.gain.setTargetAtTime(mod === "somdo" ? 1 : 0, t, 0.8); }
  if (ortamSesi.uzay) { ortamSesi.uzay.gain.setTargetAtTime(mod === "uzay" ? 1 : 0, t, 0.8); }
  if (ortamSesi.siberpunk) { ortamSesi.siberpunk.gain.setTargetAtTime(mod === "siberpunk" ? 1 : 0, t, 0.8); }
}

/* ara sıra: Tömye'de buz çatırtısı, Şomdo'da uzak tıkırtı */
function ortamSesOlaylar() {
  if (!ortamSesi) { return; }
  const a = ortamSesi.a;
  const t = a.currentTime;
  if (ortamSesi.mod === "somdo") {
    for (let i = 0; i < 3; i++) {
      const o = a.createOscillator(), g = a.createGain(), p = a.createStereoPanner ? a.createStereoPanner() : null;
      o.type = "square"; o.frequency.value = 1100 + Math.random() * 300;
      const b = t + i * 0.19;
      g.gain.setValueAtTime(0.0001, b); g.gain.exponentialRampToValueAtTime(0.012, b + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, b + 0.04);
      if (p) { p.pan.value = Math.random() * 1.6 - 0.8; o.connect(g); g.connect(p); p.connect(ortamSesi.somdo); } else { o.connect(g); g.connect(ortamSesi.somdo); }
      o.start(b); o.stop(b + 0.05);
    }
  } else if (ortamSesi.mod === "tomye") {
    const s = a.createBufferSource(); s.buffer = ortamSesGurultu(a);
    const hp = a.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1800;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    s.connect(hp); hp.connect(g); g.connect(ortamSesi.tomye); s.start(t); s.stop(t + 0.15);
  }
  ortamSesi.zaman = setTimeout(ortamSesOlaylar, (ortamSesi.mod === "somdo" ? 1800 : 6000) + Math.random() * 6000);
}

function ortamSesModGuncelle() {
  if (!ortamSesi) { return; }
  const ce = document.querySelector("#claudeEvren");
  /* Claude'un evreninin kendi sayfası baştan sona Şomdo */
  let somdo = typeof aktifSayfa !== "undefined" && aktifSayfa === "claude";
  if (!somdo && ce && !ce.hidden) {
    const r = ce.getBoundingClientRect();
    somdo = r.top < window.innerHeight * 0.6 && r.bottom > window.innerHeight * 0.4;
  }
  const mod = somdo ? "somdo" : "tomye";
  if (mod === ortamSesi.mod) { return; }
  ortamSesi.mod = mod;
  const t = ortamSesi.a.currentTime;
  ortamSesi.tomye.gain.setTargetAtTime(mod === "tomye" ? 1 : 0, t, 1.2);
  ortamSesi.somdo.gain.setTargetAtTime(mod === "somdo" ? 1 : 0, t, 1.2);
}

function ortamSesDurdur() {
  if (!ortamSesi) { return; }
  clearTimeout(ortamSesi.zaman);
  try { ortamSesi.a.close(); } catch (e) { /* kapalı */ }
  ortamSesi = null;
}

function ortamSesDugmesiTazele() {
  const b = document.querySelector("#ortamSes");
  if (!b) { return; }
  const acik = !!ortamSesi;
  b.setAttribute("aria-pressed", String(acik));
  b.classList.toggle("acik", acik);
  b.title = acik ? "Ortam sesi açık" : "Ortam sesi kapalı";
}

document.addEventListener("click", function (e) {
  if (!e.target.closest("#ortamSes")) { return; }
  if (ortamSesi) { ortamSesDurdur(); try { localStorage.setItem(ORTAM_SES_ANAHTAR, "0"); } catch (x) { /* yok */ } }
  else { ortamSesBaslat(); try { localStorage.setItem(ORTAM_SES_ANAHTAR, "1"); } catch (x) { /* yok */ } }
  ortamSesDugmesiTazele();
});

let ortamSesKaydirBekliyor = false;
window.addEventListener("scroll", function () {
  if (!ortamSesi || ortamSesKaydirBekliyor) { return; }
  ortamSesKaydirBekliyor = true;
  requestAnimationFrame(function () { ortamSesKaydirBekliyor = false; ortamSesModGuncelle(); });
}, { passive: true });
window.addEventListener("hashchange", function () { setTimeout(ortamSesModGuncelle, 400); });
document.addEventListener("visibilitychange", function () {
  if (!ortamSesi) { return; }
  if (document.hidden) { ortamSesi.a.suspend(); } else { ortamSesi.a.resume(); }
});

document.addEventListener("DOMContentLoaded", function () {
  ortamSesDugmesiKur();
  /* tarayıcılar sesi ancak bir dokunuştan sonra başlatır: açık bırakıldıysa ilk dokunuşta devam et */
  if (ortamSesAcikMi()) {
    const ilk = function (e) {
      if (e.target.closest && e.target.closest("#ortamSes")) { document.removeEventListener("pointerdown", ilk, true); return; }  /* düğmenin kendisi: tıklama karar versin */
      document.removeEventListener("pointerdown", ilk, true);
      if (!ortamSesi && ortamSesAcikMi()) { ortamSesBaslat(); ortamSesDugmesiTazele(); }
    };
    document.addEventListener("pointerdown", ilk, true);
  }
  ortamSesDugmesiTazele();
});
