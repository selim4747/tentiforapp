/* TentiforApp kripto — hem sayfa hem editör kullanır.
   veri.json içinde kodlar SAKLANMAZ; yalnızca doğrulama özetleri durur. Gizli bloklar düz metindir,
   kilit arayüz düzeyindedir (bölüm kilidi + katman kapısı); şifreleme kişi kodlarını yönetici koduna
   sarmak ve kilitli dosyalar için kalır.
   Python tarafındaki karşılığı icerik.py içindedir; ikisi birebir aynı sonucu verir. */

const K256 = [
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
];

function sha256Bayt(girdi) {
  const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];

  const uzunluk = girdi.length;
  const bitUzunluk = uzunluk * 8;
  const dolguBoyu = (((uzunluk + 8) >> 6) + 1) << 6;
  const veri = new Uint8Array(dolguBoyu);

  veri.set(girdi);
  veri[uzunluk] = 0x80;

  const gor = new DataView(veri.buffer);
  gor.setUint32(dolguBoyu - 4, bitUzunluk >>> 0, false);
  gor.setUint32(dolguBoyu - 8, Math.floor(bitUzunluk / 4294967296), false);

  const w = new Uint32Array(64);

  const dondur = function (x, n) { return (x >>> n) | (x << (32 - n)); };

  for (let konum = 0; konum < dolguBoyu; konum += 64) {
    for (let i = 0; i < 16; i++) { w[i] = gor.getUint32(konum + i * 4, false); }

    for (let i = 16; i < 64; i++) {
      const s0 = dondur(w[i - 15], 7) ^ dondur(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = dondur(w[i - 2], 17) ^ dondur(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;

    for (let i = 0; i < 64; i++) {
      const S1 = dondur(e, 6) ^ dondur(e, 11) ^ dondur(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K256[i] + w[i]) >>> 0;
      const S0 = dondur(a, 2) ^ dondur(a, 13) ^ dondur(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;

      hh = g; g = f; f = e;
      e = (d + t1) >>> 0;
      d = c; c = b; b = a;
      a = (t1 + t2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }

  const cikti = new Uint8Array(32);
  const c = new DataView(cikti.buffer);
  for (let i = 0; i < 8; i++) { c.setUint32(i * 4, h[i], false); }
  return cikti;
}

function metniBayta(m) { return new TextEncoder().encode(m); }

function onaltilik(bayt) {
  let s = "";
  for (let i = 0; i < bayt.length; i++) { s += bayt[i].toString(16).padStart(2, "0"); }
  return s;
}

/* Koddan istenen uzunlukta anahtar akışı üretir. */
function anahtarAkisi(kod, uzunluk) {
  const akis = new Uint8Array(uzunluk);
  let yazilan = 0;
  let sayac = 0;

  while (yazilan < uzunluk) {
    const blok = sha256Bayt(metniBayta(kod + ":" + sayac));
    const alinacak = Math.min(32, uzunluk - yazilan);
    akis.set(blok.subarray(0, alinacak), yazilan);
    yazilan += alinacak;
    sayac++;
  }

  return akis;
}

/** 10 karakterlik rastgele kod: harf ve rakam (karışan 0/O, 1/I hariç). Kişi, lore ve evren kodları bununla üretilir;
    katman kodları değişmez. */
const KOD_HARFLER = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const KOD_UZUNLUK = 10;
function kod10() {
  const b = new Uint8Array(KOD_UZUNLUK);
  (window.crypto || window.msCrypto).getRandomValues(b);
  return Array.from(b).map(function (n) { return KOD_HARFLER[n % KOD_HARFLER.length]; }).join("");
}

/* Kodun kendisi hiçbir yerde saklanmaz; bu özet saklanır. */
function dogrulamaOzeti(kod) {
  return onaltilik(sha256Bayt(metniBayta(kod + "#dogrula")));
}

function sifrele(metin, kod) {
  const ham = metniBayta(metin);
  const akis = anahtarAkisi(kod, ham.length);
  let ikili = "";

  for (let i = 0; i < ham.length; i++) {
    ikili += String.fromCharCode(ham[i] ^ akis[i]);
  }

  return btoa(ikili);
}

function sifreCoz(sifreli, kod) {
  const ikili = atob(sifreli);
  const akis = anahtarAkisi(kod, ikili.length);
  const bayt = new Uint8Array(ikili.length);

  for (let i = 0; i < ikili.length; i++) {
    bayt[i] = ikili.charCodeAt(i) ^ akis[i];
  }

  return new TextDecoder("utf-8").decode(bayt);
}

/* ---------- dosya (ikili) şifreleme ----------
   Metin şifrelemeyle aynı anahtar akışını kullanır, ama UTF-8 metne değil
   ham baytlara uygulanır — böylece PDF, ses, görsel gibi herhangi bir
   dosya bozulmadan şifrelenip çözülebilir. XOR simetrik olduğu için tek
   fonksiyon hem şifreler hem çözer. */
function dosyaXOR(bayt, kod) {
  const akis = anahtarAkisi(kod, bayt.length);
  const cikti = new Uint8Array(bayt.length);
  for (let i = 0; i < bayt.length; i++) { cikti[i] = bayt[i] ^ akis[i]; }
  return cikti;
}

/* Büyük dizilerde String.fromCharCode(...bayt) yığın taşmasına yol açabilir;
   parça parça işleyerek bundan kaçınıyoruz. */
function bayttanBase64(bayt) {
  let ikili = "";
  const parca = 8192;
  for (let i = 0; i < bayt.length; i += parca) {
    ikili += String.fromCharCode.apply(null, bayt.subarray(i, i + parca));
  }
  return btoa(ikili);
}

function base64tenBayt(b64) {
  const ikili = atob(b64);
  const bayt = new Uint8Array(ikili.length);
  for (let i = 0; i < ikili.length; i++) { bayt[i] = ikili.charCodeAt(i); }
  return bayt;
}

/* Panoya kopyalama — her ortamda çalışır.
   navigator.clipboard yalnızca güvenli bağlamda (https) tanımlıdır; file:// ile
   açıldığında yoktur. Eskiden bu durumda düğmeler sessizce patlıyordu. */
function panoyaKopyala(metin) {
  return new Promise(function (coz, reddet) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(metin).then(coz).catch(function () {
        eskiUsulKopyala(metin) ? coz() : reddet(new Error("kopyalanamadı"));
      });
      return;
    }

    if (eskiUsulKopyala(metin)) { coz(); } else { reddet(new Error("kopyalanamadı")); }
  });
}

function eskiUsulKopyala(metin) {
  try {
    const kutu = document.createElement("textarea");
    kutu.value = metin;
    kutu.setAttribute("readonly", "");
    kutu.style.position = "fixed";
    kutu.style.left = "-9999px";
    document.body.appendChild(kutu);
    kutu.select();
    kutu.setSelectionRange(0, kutu.value.length);
    const oldu = document.execCommand && document.execCommand("copy");
    document.body.removeChild(kutu);
    return !!oldu;
  } catch (e) {
    return false;
  }
}

/* ---------- tohumlu rastgelelik ----------
   Meydan okuma bağlantısında iki oyuncunun aynı diziyi görmesi için.
   Tohum yokken normal rastgelelik kullanılır. */

let TOHUM = null;
let tohumDurum = 0;

function tohumAyarla(t) {
  TOHUM = (t === null || t === undefined) ? null : (t >>> 0);
  tohumDurum = TOHUM || 0;
}

function tohumVar() { return TOHUM !== null; }

/** 0..1 arası sayı. Tohum varsa deterministik. */
function rast01() {
  if (TOHUM === null) { return Math.random(); }
  tohumDurum = (tohumDurum * 1664525 + 1013904223) >>> 0;
  return tohumDurum / 4294967296;
}

/** Diziyi yerinde karıştırır. */
function karistir(dizi) {
  for (let i = dizi.length - 1; i > 0; i--) {
    const j = Math.floor(rast01() * (i + 1));
    const t = dizi[i]; dizi[i] = dizi[j]; dizi[j] = t;
  }
  return dizi;
}

/** Metinden sayısal tohum üretir. */
function metinTohumu(m) {
  let t = 2166136261;
  const s = String(m);
  for (let i = 0; i < s.length; i++) {
    t ^= s.charCodeAt(i);
    t = Math.imul(t, 16777619);
  }
  return t >>> 0;
}
