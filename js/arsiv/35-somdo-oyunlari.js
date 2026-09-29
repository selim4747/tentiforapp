/* Claude tarafından yapılan evren — oynanabilir kurallar.
   Dört oyun, evrenin "Oyunlar" sekmesinde: Şafak Yürüyüşü, Yeveş Avı, Tanık Ayna, İsim Kayması.
   Hepsi kanon dışı ve herkese açık; rekorlar bu cihazda (rekorYaz), ilk başarılar küçük eçka ödülü verir. */

let soOyun = "safak";

function soOdul(anahtar, ecka, kaynak) {
  if (typeof kilitAcik !== "function" || typeof eckaKazan !== "function" || typeof cuzdan === "undefined") { return false; }
  if (kilitAcik(anahtar)) { return false; }
  cuzdan.acilan.push(anahtar);
  eckaKazan(ecka, kaynak);
  return true;
}

function soRekor(ad) {
  const r = (typeof jsonOku === "function" && typeof REKOR_ANAHTAR !== "undefined") ? (jsonOku(REKOR_ANAHTAR, {}) || {}) : {};
  return Number(r[ad]) || 0;
}

function somdoOyunlariHtml() {
  const oyunlar = [["safak", "Şafak Yürüyüşü"], ["yeves", "Yeveş Avı"], ["ayna", "Tanık Ayna"], ["isim", "İsim Kayması"]];
  setTimeout(soOyunKur, 0);
  return '<div class="filtre so-secici">' + oyunlar.map(function (o) {
      return '<button class="filtre-btn' + (soOyun === o[0] ? " secili" : "") + '" data-so-oyun="' + o[0] + '">' + kacir(o[1]) + "</button>";
    }).join("") + "</div>" +
    '<div id="soAlan" class="so-alan"></div>';
}

function soOyunKur() {
  const alan = document.querySelector("#soAlan");
  if (!alan) { return; }
  soDurdur();
  if (soOyun === "safak") { safakKur(alan); }
  else if (soOyun === "yeves") { yevesKur(alan); }
  else if (soOyun === "ayna") { aynaKur(alan); }
  else { isimKaymaKur(alan); }
}

let soDongu = null;
function soDurdur() {
  if (soDongu) { cancelAnimationFrame(soDongu); soDongu = null; }
  if (typeof yevesSesKapat === "function") { yevesSesKapat(); }
  if (SF) { SF.bitti = true; }
}

/* Tuvali kapsayıcıya ve ekran yoğunluğuna göre boyutlar */
function soTuval(tuval, boy) {
  const en = Math.max(280, Math.min(720, tuval.parentElement.clientWidth || 360));
  const d = Math.min(2, window.devicePixelRatio || 1);
  tuval.width = en * d; tuval.height = boy * d;
  tuval.style.width = en + "px"; tuval.style.height = boy + "px";
  const c = tuval.getContext("2d");
  c.setTransform(d, 0, 0, d, 0, 0);
  return { c: c, en: en, boy: boy };
}

/* ==================== 1. ŞAFAK YÜRÜYÜŞÜ ==================== */
/* Şafak kenarı saniyede 1 an ilerler. Sabah bandında (kenarın hemen gerisinde) kal:
   kenarı geçersen karanlıkta Yeveş ölçeği dolar, geride kalırsan sabah kaçar. Zemin hızını değiştirir. */

const SF_ZEMIN = {
  ot:   { ad: "ot",   hiz: 1.15, renk: "#6f8f5a" },
  kum:  { ad: "kum",  hiz: 0.7,  renk: "#c2a878" },
  buz:  { ad: "buz",  hiz: 1.6,  renk: "#b8d6ec" },
  tas:  { ad: "taş",  hiz: 0.25, renk: "#7a7a7a" }
};
let SF = null;

function safakKur(alan) {
  const rekor = soRekor("safak");
  alan.innerHTML =
    '<p class="oyun-giris">Şafak kenarı Kor\'dan dışarı yürüyor. Onunla birlikte kal: <b>kenarın hemen gerisindeki sabah bandında</b> dur. ' +
      "Kenarı geçersen karanlığa girersin ve Yeveşler yaklaşır; geride kalırsan sabah elinden kaçar. Kum yavaşlatır, buz hızlandırır, taşta zıplamazsan takılırsın.</p>" +
    '<canvas class="so-tuval" id="sfTuval" aria-label="Şafak Yürüyüşü oyun alanı"></canvas>' +
    '<div class="so-kontrol">' +
      '<button class="dugme" data-sf="yuru">Yürü</button>' +
      '<button class="dugme dugme-sade" data-sf="kos">Koş</button>' +
      '<button class="dugme dugme-sade" data-sf="zipla">Zıpla</button>' +
    "</div>" +
    '<p class="oyun-not">Klavye: → yürü · Shift koş · ↑ zıpla. Rekorun: <b id="sfRekor">' + (rekor ? (rekor / 10).toFixed(1) + " km" : "—") + "</b></p>" +
    '<button class="dugme" data-sf="basla">Başla</button> <span class="oyun-not" id="sfDurum"></span>';
  SF = null;
  safakCiz();
}

function safakYeni() {
  const zemin = [];
  let x = -10;
  while (x < 4000) {
    const zor = Math.min(1, Math.max(0, x) / 600);
    const r = Math.random();
    const tur = x < 8 ? "ot" : r < 0.45 - zor * 0.2 ? "ot" : r < 0.7 ? "kum" : r < 0.85 ? "buz" : "tas";
    const boy = tur === "tas" ? 1.2 : 3 + Math.random() * 6;
    zemin.push({ bas: x, son: x + boy, tur: tur });
    x += boy;
  }
  return { f: 0, p: -1.5, t: 0, dayanik: 1, karanlik: 0, gec: 0, zemin: zemin, tus: {}, zipla: 0, takildi: 0,
           gecmis: [], bitti: false, basladi: true, son: performance.now(), mesaj: "" };
}

function safakZemin(x) {
  const z = SF.zemin;
  for (let i = 0; i < z.length; i++) { if (x >= z[i].bas && x < z[i].son) { return z[i]; } }
  return z[z.length - 1];
}

function safakAdim(zaman) {
  if (!SF || SF.bitti) { return; }
  const dt = Math.min(0.05, (zaman - SF.son) / 1000);
  SF.son = zaman;
  SF.t += dt;
  SF.f += dt * 1.0;                               /* ışık: saniyede bir an */
  const z = safakZemin(SF.p);
  let hiz = 0;
  const yuru = SF.tus.yuru || SF.tus.kos;
  if (yuru) {
    hiz = SF_ZEMIN[z.tur].hiz;
    if (z.tur === "tas" && SF.zipla > 0) { hiz = 1.2; }
    if (SF.tus.kos && SF.dayanik > 0) { hiz *= 2.2; SF.dayanik = Math.max(0, SF.dayanik - dt * 0.45); }
  }
  if (!SF.tus.kos) { SF.dayanik = Math.min(1, SF.dayanik + dt * 0.18); }
  if (z.tur === "buz" && !yuru) { hiz = 0.5; }    /* buzda durulmaz */
  SF.zipla = Math.max(0, SF.zipla - dt);
  SF.p += hiz * dt;

  const rel = SF.p - SF.f;                        /* >0: kenarın önü (karanlık) */
  if (rel > 0) { SF.karanlik += dt * (0.25 + rel * 0.35); SF.mesaj = "Karanlıktasın — tıkırtılar yaklaşıyor"; }
  else if (rel < -4) { SF.gec += dt * (0.2 + (-rel - 4) * 0.12); SF.mesaj = "Sabah kaçıyor"; }
  else { SF.karanlik = Math.max(0, SF.karanlik - dt * 0.15); SF.gec = Math.max(0, SF.gec - dt * 0.15); SF.mesaj = ""; }

  SF.gecmis.push({ t: SF.t, p: SF.p });
  if (SF.gecmis.length > 240) { SF.gecmis.shift(); }

  if (SF.karanlik >= 1 || SF.gec >= 1) { safakBitir(SF.karanlik >= 1 ? "Karanlıkta bir Yeveş seni buldu." : "Akşam duvarı yetişti; sabahı kaybettin."); }
  safakCiz();
  if (!SF.bitti) { soDongu = requestAnimationFrame(safakAdim); }
}

function safakBitir(neden) {
  SF.bitti = true;
  const puan = Math.round(SF.f * 10) / 10;
  const eski = soRekor("safak");
  if (typeof rekorYaz === "function") { rekorYaz("safak", Math.round(SF.f)); }
  const d = document.querySelector("#sfDurum");
  let ek = "";
  if (SF.f >= 60 && soOdul("so_safak_60", 30, "Şafak Yürüyüşü")) { ek = " · İlk bir dakikalık yürüyüş: +30 eçka"; }
  if (d) { d.textContent = neden + " Yol: " + (puan / 10).toFixed(1) + " km" + (Math.round(SF.f) > eski ? " · yeni rekor!" : "") + ek; }
  const r = document.querySelector("#sfRekor");
  if (r) { r.textContent = (Math.max(eski, Math.round(SF.f)) / 10).toFixed(1) + " km"; }
}

function safakCiz() {
  const tuval = document.querySelector("#sfTuval");
  if (!tuval) { return; }
  const { c, en, boy } = soTuval(tuval, 190);
  const olcek = en / 16;                           /* ekranda 16 an görünür */
  const f = SF ? SF.f : 0, p = SF ? SF.p : -1.5;
  const kam = f - 9;
  const X = function (x) { return (x - kam) * olcek; };
  const zeminY = boy - 44;

  /* gök: kenarın gerisi gün, önü gece */
  const kx = X(f);
  const g = c.createLinearGradient(kx - olcek * 6, 0, kx + olcek * 1.5, 0);
  g.addColorStop(0, "#f4d9a6"); g.addColorStop(0.72, "#f2b872"); g.addColorStop(0.86, "#5a4a6e"); g.addColorStop(1, "#0f1726");
  c.fillStyle = g; c.fillRect(0, 0, en, zeminY);
  /* sabah bandı */
  c.fillStyle = "rgba(255,255,255,.18)"; c.fillRect(X(f - 4), 0, olcek * 4, zeminY);
  /* yıldız yok: ışıkları gelmedi. Yalnızca Gelen */
  c.fillStyle = "#fff"; c.beginPath(); c.arc(en - 26, 22, 2.2, 0, Math.PI * 2); c.fill();
  /* şafak kenarı */
  c.strokeStyle = "#fff3cf"; c.lineWidth = 2; c.beginPath(); c.moveTo(kx, 0); c.lineTo(kx, zeminY); c.stroke();

  /* zemin */
  if (SF) {
    SF.zemin.forEach(function (z) {
      if (z.son < kam || z.bas > kam + 17) { return; }
      c.fillStyle = SF_ZEMIN[z.tur].renk;
      c.fillRect(X(z.bas), zeminY, (z.son - z.bas) * olcek + 1, 14);
      if (z.tur === "tas") { c.fillStyle = "#555"; c.fillRect(X(z.bas) + 2, zeminY - 8, (z.son - z.bas) * olcek - 4, 8); }
    });
    /* kırağı: gece tarafında zemin beyazlar */
    c.fillStyle = "rgba(255,255,255,.35)"; c.fillRect(kx, zeminY, en - kx, 3);
  } else { c.fillStyle = SF_ZEMIN.ot.renk; c.fillRect(0, zeminY, en, 14); }

  /* geri görüntü: kenarı geçtiysen görüntün geriye oynar */
  if (SF && p > f) {
    c.globalAlpha = 0.35; c.fillStyle = "#fff";
    c.beginPath(); c.arc(X(f - (p - f)), zeminY - 12, 7, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
  }
  /* oyuncu */
  const zip = SF && SF.zipla > 0 ? -14 * Math.sin(Math.PI * (SF.zipla / 0.5)) : 0;
  c.fillStyle = p > f ? "#9fb7ff" : "#0A0F14";
  c.beginPath(); c.arc(X(p), zeminY - 12 + zip, 8, 0, Math.PI * 2); c.fill();

  /* ölçekler */
  const cubuk = function (y, oran, renk, ad) {
    c.fillStyle = "rgba(0,0,0,.25)"; c.fillRect(10, y, 120, 7);
    c.fillStyle = renk; c.fillRect(10, y, 120 * Math.min(1, oran), 7);
    c.fillStyle = "#fff"; c.font = "11px ui-monospace, monospace"; c.fillText(ad, 136, y + 7);
  };
  if (SF) {
    cubuk(10, SF.karanlik, "#c0392b", "karanlık");
    cubuk(22, SF.gec, "#e0a030", "sabah kaçıyor");
    cubuk(34, SF.dayanik, "#3fa06a", "nefes");
    c.fillStyle = "#1a2230"; c.fillRect(0, zeminY + 14, en, boy - zeminY - 14);
    c.fillStyle = "#e8eef4"; c.font = "13px ui-monospace, monospace";
    c.fillText((SF.f / 10).toFixed(1) + " km", en - 80, boy - 10);
    c.fillText("zemin: " + SF_ZEMIN[safakZemin(p).tur].ad, 10, boy - 10);
    if (SF.mesaj) { c.fillStyle = "#fff"; c.fillText(SF.mesaj, 10, 60); }
  }
}

function safakTus(ad, bas) {
  if (!SF || SF.bitti) { return; }
  if (ad === "zipla") { if (bas && SF.zipla <= 0) { SF.zipla = 0.5; } return; }
  SF.tus[ad] = bas;
}

/* ==================== 2. YEVEŞ AVI ==================== */
/* Görüntü 1 saniye gecikir; ses anında gelir. Kulağınla nişan al. Yavruları vurma. */

let YV = null;
let yevesSes = null;

function yevesSesKapat() {
  if (YV) { YV.bitti = true; }
  if (yevesSes) { try { yevesSes.close(); } catch (e) { /* kapalı */ } yevesSes = null; }
}

function yevesKur(alan) {
  const rekor = soRekor("yeves");
  alan.innerHTML =
    '<p class="oyun-giris">Bir Yeveş\'i gördüğün yerde değildir: görüntüsü bir saniye geç gelir. Ama tıkırtısı hemen gelir. ' +
      "<b>Kulaklık tak</b>, sesin sağdan mı soldan mı geldiğini dinle ve bu şeride dokunarak vur. Yavrular daha ince ve hızlı tıkırdar — onları vurma.</p>" +
    '<canvas class="so-tuval" id="yvTuval" aria-label="Yeveş Avı şeridi"></canvas>' +
    '<label class="so-secenek"><input type="checkbox" id="yvKor"> Gözlerimi kapatıyorum (görüntü yok, puan iki katı)</label>' +
    '<p class="oyun-not">Rekorun: <b id="yvRekor">' + (rekor || "—") + "</b></p>" +
    '<button class="dugme" data-yv="basla">Avı başlat</button> <span class="oyun-not" id="yvDurum"></span>';
  YV = null;
  yevesCiz();
}

function yevesBasla() {
  yevesSesKapat();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (Ctx) { try { yevesSes = new Ctx(); } catch (e) { yevesSes = null; } }
  const turlar = [];
  for (let i = 0; i < 12; i++) { turlar.push(i === 3 || i === 7 || i === 10 ? "yavru" : "yetiskin"); }
  YV = { turlar: turlar, i: -1, puan: 0, isabet: 0, kor: !!(document.querySelector("#yvKor") || {}).checked,
         gecmis: [], bitti: false, son: performance.now(), mesaj: "" };
  yevesSonraki();
  soDongu = requestAnimationFrame(yevesAdim);
}

function yevesSonraki() {
  YV.i++;
  if (YV.i >= YV.turlar.length) { yevesBitir(); return; }
  const yavru = YV.turlar[YV.i] === "yavru";
  YV.hedef = { x: Math.random(), v: (Math.random() < 0.5 ? -1 : 1) * (yavru ? 0.45 : 0.3), yavru: yavru, bas: performance.now(), sonTik: 0 };
  YV.gecmis = [];
}

function yevesTik(pan, yavru) {
  if (!yevesSes) { return; }
  const a = yevesSes, t = a.currentTime;
  const o = a.createOscillator(), g = a.createGain();
  o.type = "square"; o.frequency.value = yavru ? 2400 : 1300;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(yavru ? 0.12 : 0.2, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  let son = g;
  if (a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = pan; g.connect(p); son = p; }
  o.connect(g); son.connect(a.destination);
  o.start(t); o.stop(t + 0.06);
}

function yevesAdim(zaman) {
  if (!YV || YV.bitti) { return; }
  const dt = Math.min(0.05, (zaman - YV.son) / 1000);
  YV.son = zaman;
  const h = YV.hedef;
  if (!h) { return; }
  if (Math.random() < dt * 0.9) { h.v = -h.v * (0.7 + Math.random() * 0.6); }
  h.x += h.v * dt;
  if (h.x < 0.03 || h.x > 0.97) { h.v = -h.v; h.x = Math.min(0.97, Math.max(0.03, h.x)); }
  YV.gecmis.push({ z: zaman, x: h.x });
  while (YV.gecmis.length && zaman - YV.gecmis[0].z > 1200) { YV.gecmis.shift(); }
  if (zaman - h.sonTik > (h.yavru ? 150 : 230)) { h.sonTik = zaman; yevesTik(h.x * 2 - 1, h.yavru); }
  if (zaman - h.bas > 6500) { YV.mesaj = h.yavru ? "Yavru uzaklaştı. İyi." : "Kaçtı."; yevesSonraki(); }
  yevesCiz();
  if (YV && !YV.bitti) { soDongu = requestAnimationFrame(yevesAdim); }
}

function yevesAtes(oran) {
  if (!YV || YV.bitti || !YV.hedef) { return; }
  const h = YV.hedef;
  const vurdu = Math.abs(oran - h.x) < 0.075;
  if (vurdu && h.yavru) { YV.puan -= 2; YV.mesaj = "Bir yavruyu vurdun. Sıssoz bunu affetmezdi (−2)."; yevesSonraki(); return; }
  if (vurdu) { YV.isabet++; YV.puan += YV.kor ? 2 : 1; YV.mesaj = "Vurdun. Gördüğün yer " + Math.round(Math.abs(oran - yevesGorunen()) * 100) + " adım gerideydi."; yevesSonraki(); return; }
  YV.mesaj = "Iska — " + (oran < h.x ? "daha sağda" : "daha solda") + " tıkırdıyor.";
}

function yevesGorunen() {
  return YV && YV.gecmis.length ? YV.gecmis[0].x : 0.5;
}

function yevesBitir() {
  YV.bitti = true;
  const eski = soRekor("yeves");
  if (typeof rekorYaz === "function" && YV.puan > 0) { rekorYaz("yeves", YV.puan); }
  let ek = "";
  if (YV.isabet >= 6 && soOdul("so_yeves_6", 30, "Yeveş Avı")) { ek = " · İlk iyi av: +30 eçka"; }
  if (YV.kor && YV.isabet >= 6 && soOdul("so_yeves_kor", 50, "Yeveş Avı · kör")) { ek += " · Sıssoz gibi: +50 eçka"; }
  const d = document.querySelector("#yvDurum");
  if (d) { d.textContent = "Av bitti: " + YV.isabet + " isabet, puan " + YV.puan + (YV.puan > eski ? " · yeni rekor!" : "") + ek; }
  const r = document.querySelector("#yvRekor"); if (r) { r.textContent = Math.max(eski, YV.puan) || "—"; }
  yevesSesKapat();
  yevesCiz();
}

function yevesCiz() {
  const tuval = document.querySelector("#yvTuval");
  if (!tuval) { return; }
  const { c, en, boy } = soTuval(tuval, 140);
  c.fillStyle = "#101820"; c.fillRect(0, 0, en, boy);
  c.strokeStyle = "rgba(255,255,255,.15)"; c.beginPath(); c.moveTo(0, boy - 36); c.lineTo(en, boy - 36); c.stroke();
  c.fillStyle = "rgba(255,255,255,.5)"; c.font = "11px ui-monospace, monospace";
  c.fillText("sol kulak", 8, 14); c.fillText("sağ kulak", en - 66, 14);
  if (YV && !YV.bitti && YV.hedef && !YV.kor) {
    const gx = yevesGorunen() * en;
    c.fillStyle = YV.hedef.yavru ? "#e8c07a" : "#d86a4a";
    c.beginPath(); c.ellipse(gx, boy - 50, YV.hedef.yavru ? 9 : 14, YV.hedef.yavru ? 6 : 9, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "rgba(255,255,255,.4)"; c.fillText("görüntü (1 sn önce)", Math.min(en - 120, Math.max(4, gx - 50)), boy - 68);
  }
  c.fillStyle = "#e8eef4"; c.font = "13px ui-monospace, monospace";
  if (YV) {
    c.fillText("Yeveş " + Math.min(YV.turlar.length, YV.i + 1) + "/" + YV.turlar.length + " · puan " + YV.puan, 8, boy - 14);
    if (YV.mesaj) { c.fillText(YV.mesaj.slice(0, 60), 8, 34); }
  } else { c.fillText("Başlatınca tıkırtıları dinle, şeride dokun.", 8, boy - 14); }
}

/* ==================== 3. TANIK AYNA ==================== */
/* Dört ayna karesi: biri eğilmiş (sahte). Kurallar: gölge Kor'un ters yönüne düşer; yaklaşan maviye,
   uzaklaşan kızıla kayar; zincirde daha uzak halka daha soluktur. */

const AYNA_DAVALARI = [
  { baslik: "Birinci dava: Fırıncının sabahı", metin: "Fırıncı, çırağının un çaldığını söylüyor. Zincirden dört kare geldi. Biri eğik.",
    parca: "Sahte kare çırağı suçluyordu. Gırçık o gün ilk kez, otuz yıldır baktığı aynaya şüpheyle baktı." },
  { baslik: "İkinci dava: Limandaki kavga", metin: "Sabah Limanı'nda iki denizci. Hangisi önce vurdu?",
    parca: "Eğik karede renkler yanlıştı: uzaklaşan biri maviye çalıyordu. Birisi ışığın kurallarını bilmiyordu — ya da bildiğini unuttu." },
  { baslik: "Üçüncü dava: Kayıp kor meyveleri", metin: "Sebir çarşısında bir sepet kor meyvesi kayboldu. Gölgeler önemli.",
    parca: "Sahte karede gölge Kor'a doğru düşüyordu. Kareyi yapan, Kor Altı'na yakın yaşamamış biriydi." },
  { baslik: "Dördüncü dava: Hetire'nin eski davası", metin: "Beş yıl önceki idam davası. Gırçık dosyayı yeniden açıyor.",
    parca: "Zincirin uzak halkası, yakın halkasından daha parlaktı. Işık yorulmadan gelmişti — yani yol hiç yürünmemişti. Kare zincirin ortasında üretilmişti." },
  { baslik: "Beşinci dava: Adadaki gölge", metin: "Ayna Adaları'ndan gelen bir gece kaydı. Aynanın yanında biri var.",
    parca: "Sahte karenin kenarında, aynanın gölgesini tutan bir el. Parmakları ince, hırsız eli. Gulgı." },
  { baslik: "Son dava: Aynaya dokunan", metin: "Gulgı'yı kim tuttu? Bıklı'nın kendi aynası konuşuyor.",
    parca: "Son kare eğikti ama bu kez eğen el aynanın öbür tarafındaydı: Yelen'in eli. Bıklı onu kırk yıldır bekliyordu. Gırçık gözlerini kapattı ve dinlemeye başladı." }
];
let aynaDava = 0;
let aynaKareler = null;

function aynaIlerleme() {
  try { return Number(localStorage.getItem("tentiforapp_tanik_ayna")) || 0; } catch (e) { return 0; }
}

function aynaKur(alan) {
  const acilan = aynaIlerleme();
  aynaDava = Math.min(acilan, AYNA_DAVALARI.length);   /* son dava bittiyse serbest davalar */
  aynaKareler = aynaUret();
  const d = AYNA_DAVALARI[aynaDava];
  alan.innerHTML =
    '<p class="oyun-giris">Gırçık\'ın masası. Tanık Ayna zincirinden dört kare geldi; <b>biri eğilmiş</b>. Kurallar:</p>' +
    '<ul class="ayna-kural"><li>Gölge <b>Kor\'un ters yönüne</b> düşer.</li>' +
      "<li>Yaklaşan <b>maviye</b>, uzaklaşan <b>kızıla</b> kayar; duran gerçek renktedir.</li>" +
      "<li>Zincirde uzak halka daha <b>soluktur</b> (ışık yorulur).</li></ul>" +
    '<div class="ayna-dava"><b>' + kacir(d ? d.baslik : "Serbest dava") + "</b> — " + kacir(d ? d.metin : "Hikâye bitti; zincir hâlâ kare gönderiyor.") + "</div>" +
    '<div class="ayna-izgara">' + aynaKareler.map(function (k, i) { return aynaKareSvg(k, i); }).join("") + "</div>" +
    '<p class="pencere-durum" id="aynaDurum"></p>' +
    '<div class="ayna-defter">' + AYNA_DAVALARI.slice(0, acilan).map(function (x, i) {
      return '<details><summary>' + (i + 1) + ". " + kacir(x.baslik) + "</summary><p>" + kacir(x.parca) + "</p></details>";
    }).join("") + "</div>";
}

function aynaUret() {
  const kareler = [];
  for (let i = 0; i < 4; i++) {
    const korSol = Math.random() < 0.5;
    const hareket = ["yaklasiyor", "uzaklasiyor", "duruyor"][Math.floor(Math.random() * 3)];
    kareler.push({ halka: i + 1, korSol: korSol, hareket: hareket, golgeSag: korSol, renk: hareket, parlak: 0.95 - i * 0.2 });
  }
  const kural = aynaDava < AYNA_DAVALARI.length ? [0, 1, 0, 2, 0, 1][aynaDava] : Math.floor(Math.random() * 3);
  /* parlaklık kuralında sahte kare ilk halka olamaz: bir önceki halkadan parlak olmalı */
  const sahte = kural === 2 ? 1 + Math.floor(Math.random() * 3) : Math.floor(Math.random() * 4);
  const k = kareler[sahte];
  if (kural === 0) { k.golgeSag = !k.golgeSag; }
  else if (kural === 1) {
    if (k.hareket === "duruyor") { k.hareket = "uzaklasiyor"; }
    k.renk = k.hareket === "yaklasiyor" ? "uzaklasiyor" : "yaklasiyor";
  }
  else { k.parlak = kareler[sahte - 1].parlak + 0.05; kareler[sahte - 1].parlak -= 0.1; }
  kareler.forEach(function (x, i) { x.sahte = i === sahte; });
  return kareler;
}

function aynaKareSvg(k, i) {
  const renk = k.renk === "yaklasiyor" ? "#3d6fd8" : k.renk === "uzaklasiyor" ? "#c8443a" : "#5a4a3a";
  const ok = k.hareket === "yaklasiyor" ? "→ sana doğru" : k.hareket === "uzaklasiyor" ? "← uzaklaşıyor" : "· duruyor";
  const gx = k.golgeSag ? 1 : -1;
  return '<button class="ayna-kare" data-ayna="' + i + '" aria-label="' + k.halka + '. halka, ' + ok + '">' +
    '<svg viewBox="0 0 160 110" style="opacity:' + Math.max(0.25, Math.min(1, k.parlak)).toFixed(2) + '">' +
      '<rect width="160" height="110" fill="#f3ead8"/>' +
      '<circle cx="' + (k.korSol ? 14 : 146) + '" cy="14" r="8" fill="#f2b872"/>' +
      '<line x1="0" y1="86" x2="160" y2="86" stroke="#9a8a70"/>' +
      '<ellipse cx="' + (80 + gx * 22) + '" cy="88" rx="22" ry="4" fill="rgba(0,0,0,.35)"/>' +
      '<circle cx="80" cy="46" r="9" fill="' + renk + '"/><rect x="72" y="56" width="16" height="30" rx="5" fill="' + renk + '"/>' +
    "</svg>" +
    '<span class="ayna-alt">' + k.halka + ". halka · Kor " + (k.korSol ? "solda" : "sağda") + " · " + ok + "</span></button>";
}

function aynaSec(i) {
  const k = aynaKareler && aynaKareler[i];
  const d = document.querySelector("#aynaDurum");
  if (!k || !d) { return; }
  if (!k.sahte) {
    d.textContent = "Bu kare tutarlı. Kurallara bir daha bak.";
    d.className = "pencere-durum kotu";
    return;
  }
  const dava = AYNA_DAVALARI[aynaDava];
  if (dava) {
    try { localStorage.setItem("tentiforapp_tanik_ayna", String(aynaDava + 1)); } catch (e) { /* yok */ }
    const odul = soOdul("so_ayna_" + (aynaDava + 1), aynaDava === AYNA_DAVALARI.length - 1 ? 80 : 20, "Tanık Ayna");
    d.textContent = "Doğru: eğik kare bulundu." + (odul ? " Deftere yeni sayfa eklendi." : "");
  } else { d.textContent = "Doğru."; }
  d.className = "pencere-durum iyi";
  setTimeout(function () { const a = document.querySelector("#soAlan"); if (a && soOyun === "ayna") { aynaKur(a); } }, 1400);
}

/* ==================== 4. İSİM KAYMASI ==================== */

const KAYMA_MERDIVEN = ["a", "e", "ı", "i", "o", "ö", "u", "ü"];

/** yon 1: Türkçe → Şomdo; yon −1: Şomdo → Türkçe */
function isimKaydir(metin, yon) {
  yon = yon || 1;
  return Array.from(String(metin)).map(function (h) {
    const kucuk = h.toLocaleLowerCase("tr");
    const i = KAYMA_MERDIVEN.indexOf(kucuk);
    if (i === -1) { return h; }
    const y = KAYMA_MERDIVEN[(i + yon + KAYMA_MERDIVEN.length) % KAYMA_MERDIVEN.length];
    return h === kucuk ? y : y.toLocaleUpperCase("tr");
  }).join("");
}

let kaymaTuval = null;

function isimKaymaKur(alan) {
  alan.innerHTML =
    '<p class="oyun-giris">Şomdo\'da her ad bir Türkçe kelimenin ünlüleri bir basamak kaydırılarak yapılır: ' +
      "<b>a → e → ı → i → o → ö → u → ü → a</b>. Adını yaz, Şomdo adını al.</p>" +
    '<input class="kod-giris arac-giris kayma-giris" id="kaymaGiris" maxlength="30" placeholder="adın ya da bir kelime" autocomplete="off">' +
    '<label class="so-secenek"><input type="checkbox" id="kaymaTers"> Tersine çevir (Şomdo → Türkçe)</label>' +
    '<div class="kayma-sonuc" id="kaymaSonuc" aria-live="polite"></div>' +
    '<div id="kaymaKart" class="kart-onizleme"></div>' +
    '<button class="dugme" data-kayma="paylas" hidden>Kartı paylaş</button> <span class="oyun-not" id="kaymaDurum"></span>';
}

function isimKaymaGuncelle() {
  const g = document.querySelector("#kaymaGiris");
  const s = document.querySelector("#kaymaSonuc");
  if (!g || !s) { return; }
  const ters = (document.querySelector("#kaymaTers") || {}).checked;
  const ham = g.value.trim();
  const b = document.querySelector('[data-kayma="paylas"]');
  if (!ham) { s.innerHTML = ""; if (b) { b.hidden = true; } document.querySelector("#kaymaKart").innerHTML = ""; return; }
  const sonuc = isimKaydir(ham, ters ? -1 : 1);
  s.innerHTML = '<span class="kayma-eski">' + kacir(ham) + '</span> <span class="oyun-not">→</span> <b class="kayma-yeni">' + kacir(sonuc) + "</b>";
  if (b) { b.hidden = ters; }
  if (!ters) { isimKaymaKart(ham, sonuc); } else { document.querySelector("#kaymaKart").innerHTML = ""; }
}

async function isimKaymaKart(eski, yeni) {
  if (typeof kartFontlariHazir === "function") { await kartFontlariHazir(); }
  const t = document.createElement("canvas");
  t.width = 1080; t.height = 1350;
  const c = t.getContext("2d");
  const g = c.createLinearGradient(0, 0, 0, 1350);
  g.addColorStop(0, "#0f1726"); g.addColorStop(0.55, "#3a2f4f"); g.addColorStop(1, "#f2b872");
  c.fillStyle = g; c.fillRect(0, 0, 1080, 1350);
  /* Kor'dan yürüyen halkalar */
  for (let r = 180; r < 1500; r += 140) {
    c.strokeStyle = "rgba(255,243,207," + (0.22 - r / 9000) + ")"; c.lineWidth = 3;
    c.beginPath(); c.arc(540, 1350, r, Math.PI, 2 * Math.PI); c.stroke();
  }
  c.fillStyle = "#fff"; c.beginPath(); c.arc(900, 150, 5, 0, Math.PI * 2); c.fill();
  const f = typeof KART_FONT !== "undefined" ? KART_FONT : { baslik: function (p) { return p + "px Georgia"; }, mono: function (p) { return p + "px monospace"; }, yazi: function (p) { return p + "px Georgia"; } };
  c.textAlign = "center";
  c.fillStyle = "rgba(255,255,255,.7)"; c.font = f.mono(30);
  c.fillText("ŞOMDO ADIN", 540, 420);
  c.fillStyle = "#fff3cf"; c.font = f.baslik(yeni.length > 10 ? 110 : 150);
  c.fillText(yeni, 540, 600);
  c.fillStyle = "rgba(255,255,255,.8)"; c.font = f.yazi(44, true);
  c.fillText("\"" + eski + "\" ışıkla birlikte bir basamak kaydı", 540, 700);
  c.fillStyle = "rgba(10,15,20,.75)"; c.font = f.mono(28);
  c.fillText("Claude tarafından yapılan evren · TentiforApp", 540, 1280);
  kaymaTuval = t;
  if (typeof kartOnizle === "function") { kartOnizle(document.querySelector("#kaymaKart"), t); }
}

/* ==================== olaylar ==================== */

document.addEventListener("click", function (e) {
  const o = e.target.closest("[data-so-oyun]");
  if (o) {
    soOyun = o.dataset.soOyun;
    document.querySelectorAll("[data-so-oyun]").forEach(function (b) { b.classList.toggle("secili", b === o); });
    soOyunKur();
    return;
  }
  const sf = e.target.closest('[data-sf="basla"]');
  if (sf) {
    soDurdur();
    SF = safakYeni();
    const d = document.querySelector("#sfDurum"); if (d) { d.textContent = ""; }
    soDongu = requestAnimationFrame(safakAdim);
    return;
  }
  if (e.target.closest('[data-sf="zipla"]')) { safakTus("zipla", true); return; }
  if (e.target.closest('[data-yv="basla"]')) { const d = document.querySelector("#yvDurum"); if (d) { d.textContent = ""; } yevesBasla(); return; }
  const yt = e.target.closest("#yvTuval");
  if (yt) { const r = yt.getBoundingClientRect(); yevesAtes((e.clientX - r.left) / r.width); return; }
  const a = e.target.closest("[data-ayna]");
  if (a) { aynaSec(Number(a.dataset.ayna)); return; }
  if (e.target.closest('[data-kayma="paylas"]') && kaymaTuval) {
    const yeni = ((document.querySelector("#kaymaSonuc .kayma-yeni") || {}).textContent || "somdo");
    kartPaylas(kaymaTuval, "somdo-" + yeni.toLocaleLowerCase("tr") + ".png", "Şomdo adım: " + yeni).then(function (m) {
      const d = document.querySelector("#kaymaDurum"); if (d) { d.textContent = m; }
    });
  }
});

/* Yürü/Koş basılı tutulur. Her parmak ayrı izlenir: parmak düğmeden kayarak kalksa da
   bırakma yakalanır (yoksa oyuncu sonsuza dek yürürdü); bir parmak kalkınca ötekinin tuttuğu bırakılmaz. */
const sfParmak = {};
document.addEventListener("pointerdown", function (e) {
  const b = e.target.closest && e.target.closest('[data-sf="yuru"], [data-sf="kos"]');
  if (!b) { return; }
  e.preventDefault();
  sfParmak[e.pointerId] = b.dataset.sf;
  safakTus(b.dataset.sf, true);
});
["pointerup", "pointercancel"].forEach(function (olay) {
  document.addEventListener(olay, function (e) {
    const ad = sfParmak[e.pointerId];
    if (!ad) { return; }
    delete sfParmak[e.pointerId];
    if (!Object.keys(sfParmak).some(function (k) { return sfParmak[k] === ad; })) { safakTus(ad, false); }
  });
});
window.addEventListener("blur", function () {
  Object.keys(sfParmak).forEach(function (k) { delete sfParmak[k]; });
  safakTus("yuru", false); safakTus("kos", false);
});

document.addEventListener("keydown", function (e) {
  if (!SF || SF.bitti || soOyun !== "safak") { return; }
  if (e.key === "ArrowRight") { SF.tus.yuru = true; e.preventDefault(); }
  if (e.key === "Shift") { SF.tus.kos = true; }
  if (e.key === "ArrowUp") { safakTus("zipla", true); e.preventDefault(); }
});
document.addEventListener("keyup", function (e) {
  if (!SF) { return; }
  if (e.key === "ArrowRight") { SF.tus.yuru = false; }
  if (e.key === "Shift") { SF.tus.kos = false; }
});

document.addEventListener("input", function (e) {
  if (e.target.id === "kaymaGiris") { isimKaymaGuncelle(); }
});
document.addEventListener("change", function (e) {
  if (e.target.id === "kaymaTers") { isimKaymaGuncelle(); }
});

/* sekmeden çıkınca oyun durur */
window.addEventListener("hashchange", soDurdur);
