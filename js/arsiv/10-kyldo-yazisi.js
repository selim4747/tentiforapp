/* Kyldo yazısı — çizgi/çarpı hece alfabesi.

   Her simge iki harflik bir hece taşır:
     çizgiler → ünsüz    (3x3 ızgara üzerinde doğru parçaları)
     çarpılar → ünlü     (ızgara noktaları)

   Tasarım henüz taslak. Harflerin karşılıkları veri.alfabe içinde durur;
   burada yalnızca çizim ve hecelere ayırma mantığı var. Sözlüğü değiştirdiğinde
   bu dosyaya dokunman gerekmez. */

const UNLULER = "aeıioöuü";

function alfabeAyar() {
  return veri.alfabe;
}

function unsuzMu(h) { return UNLULER.indexOf(h) === -1; }

/** Bir kelimeyi çizilebilir hecelere böler: ünsüz+ünlü, yalnız ünlü, yalnız ünsüz. */
function heceleraAyir(kelime) {
  const harfler = Array.from(String(kelime).toLocaleLowerCase("tr"));
  const heceler = [];

  for (let i = 0; i < harfler.length; i++) {
    const h = harfler[i];

    if (!/[a-zçğıöşü]/.test(h)) { continue; }

    if (unsuzMu(h)) {
      const sonraki = harfler[i + 1];
      if (sonraki && !unsuzMu(sonraki)) {
        heceler.push({ unsuz: h, unlu: sonraki });
        i++;
      } else {
        heceler.push({ unsuz: h, unlu: null });
      }
      continue;
    }

    heceler.push({ unsuz: null, unlu: h });
  }

  return heceler;
}

/* Altı çizginin koordinatları. Kutu 0..1 aralığında; ölçek çizimde uygulanır.
   Dikeyler tam boy, yataylar tam en — kesişimleri 2x2 ızgarayı oluşturur. */
const PARCA_YERI = {
  ust:   [0, 0, 1, 0],
  orta:  [0, 0.5, 1, 0.5],
  alt:   [0, 1, 1, 1],
  sol:   [0, 0, 0, 1],
  ortaD: [0.5, 0, 0.5, 1],
  sag:   [1, 0, 1, 1]
};

/* Çarpıların oturduğu dört hücrenin merkezi. */
const HUCRE_YERI = {
  solUst: [0.25, 0.25],
  sagUst: [0.75, 0.25],
  solAlt: [0.25, 0.75],
  sagAlt: [0.75, 0.75]
};

/** Tek bir heceyi SVG olarak çizer. */
function heceSvg(hece, boyut) {
  const a = alfabeAyar();
  const b = boyut || 46;
  const kenar = b * 0.16;
  const ic = b - kenar * 2;
  const parcalar = [];

  const ol = function (d) { return kenar + d * ic; };

  /* ünsüz: yanan çizgiler */
  if (hece.unsuz && a.unsuzler[hece.unsuz]) {
    a.unsuzler[hece.unsuz].forEach(function (ad) {
      const y = PARCA_YERI[ad];
      if (!y) { return; }
      parcalar.push('<line x1="' + ol(y[0]) + '" y1="' + ol(y[1]) +
                    '" x2="' + ol(y[2]) + '" y2="' + ol(y[3]) + '" class="yz-cizgi"/>');
    });
  }

  /* ünlü: hücrelere konan çarpılar */
  if (hece.unlu && a.unluler[hece.unlu]) {
    a.unluler[hece.unlu].forEach(function (ad) {
      const h = HUCRE_YERI[ad];
      if (!h) { return; }
      const cx = ol(h[0]);
      const cy = ol(h[1]);
      const r = ic * 0.10;
      parcalar.push('<line x1="' + (cx - r) + '" y1="' + (cy - r) +
                    '" x2="' + (cx + r) + '" y2="' + (cy + r) + '" class="yz-carpi"/>' +
                    '<line x1="' + (cx - r) + '" y1="' + (cy + r) +
                    '" x2="' + (cx + r) + '" y2="' + (cy - r) + '" class="yz-carpi"/>');
    });
  }

  const okunus = (hece.unsuz || "") + (hece.unlu || "");

  return '<svg class="yz-hece" viewBox="0 0 ' + b + " " + b + '" width="' + b +
         '" height="' + b + '" role="img" aria-label="' + kacir(okunus) + '">' +
         "<title>" + kacir(okunus) + "</title>" + parcalar.join("") + "</svg>";
}

/** Bir metni Kyldo yazısına çevirir. Kelimeler arası boşluk korunur. */
function kyldoYaz(metin, boyut) {
  const kelimeler = String(metin).trim().split(/\s+/).filter(Boolean);

  if (!kelimeler.length) { return ""; }

  return kelimeler.map(function (k) {
    const heceler = heceleraAyir(k);
    if (!heceler.length) { return ""; }

    return '<span class="yz-kelime" title="' + kacir(k) + '">' +
           heceler.map(function (h) { return heceSvg(h, boyut); }).join("") +
           "</span>";
  }).join("");
}

/* ---------- bölüm çizimi ---------- */

function yaziCiz() {
  const alan = document.querySelector("#yaziAlan");
  if (!alan || !veri.alfabe) { return; }

  const a = veri.alfabe;

  const unsuzTablo = Object.keys(a.unsuzler).map(function (h) {
    return '<div class="yz-kutu">' + heceSvg({ unsuz: h, unlu: null }, 40) +
           '<span class="yz-harf">' + h + "</span></div>";
  }).join("");

  const unluTablo = Object.keys(a.unluler).map(function (h) {
    return '<div class="yz-kutu">' + heceSvg({ unsuz: null, unlu: h }, 40) +
           '<span class="yz-harf">' + h + "</span></div>";
  }).join("");

  const ornekler = (a.ornekler || []).map(function (o) {
    return '<div class="yz-ornek">' +
             '<div class="yz-satir">' + kyldoYaz(o, 40) + "</div>" +
             '<div class="yz-okunus">' + kacir(o) + "</div>" +
           "</div>";
  }).join("");

  alan.innerHTML =
    (a.durum === "taslak"
      ? '<div class="tavan-uyari">Bu yazı sistemi henüz taslak. Harflerin karşılıkları ' +
        "değişecek.</div>"
      : "") +
    '<p class="oyun-giris">' + kacir(a.aciklama) + "</p>" +

    '<div class="arac-blok">' +
      '<div class="oyun-etiket">Yaz</div>' +
      '<input class="kod-giris arac-giris" id="yaziGiris" placeholder="türkçe bir şey yaz" ' +
        'autocomplete="off" spellcheck="false" value="Tömye">' +
      '<div class="yz-cikti" id="yaziCikti"></div>' +
    "</div>" +

    '<div class="arac-blok">' +
      '<div class="oyun-etiket">Örnekler</div>' +
      '<div class="yz-ornekler">' + ornekler + "</div>" +
    "</div>" +

    '<div class="arac-blok">' +
      '<div class="oyun-etiket">Ünsüzler — altı çizgi</div>' +
      '<div class="yz-tablo">' + unsuzTablo + "</div>" +
    "</div>" +

    '<div class="arac-blok">' +
      '<div class="oyun-etiket">Ünlüler — dört hücre</div>' +
      '<div class="yz-tablo">' + unluTablo + "</div>" +
      '<p class="oyun-not">' + kacir(a.kural || "") + "</p>" +
      '<p class="oyun-not">' + kacir(a["not"] || "") + "</p>" +
    "</div>";

  yaziCevir();
}

function yaziCevir() {
  const g = document.querySelector("#yaziGiris");
  const c = document.querySelector("#yaziCikti");
  if (!g || !c) { return; }

  const yazi = kyldoYaz(g.value, 44);
  c.innerHTML = yazi || '<span class="oyun-not">Bir şey yaz.</span>';
}

document.addEventListener("input", function (e) {
  if (e.target.id === "yaziGiris") { yaziCevir(); }
});
