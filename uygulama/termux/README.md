# Tentiforverse Termux Kütüphanesi ve CLI Araç Seti

Bu paket, **TentiforApp** ekosistemine özel olarak geliştirilmiş, Android **Termux** terminalinde çalışan resmi CLI aracı ve Node.js kütüphanesidir.

Aysız bir gezegen olan Tömye'nin 25 saatlik zaman döngüsünü, 310 günlük takvimini, kanon ses çifti isim üretim algoritmasını ve taşınabilir `.tentifor.html` evren dosyalarını doğrudan Android terminalinizden yönetmenizi sağlar.

---

## ⚡ Hızlı Kurulum (Android Termux)

Termux terminalinizi açın ve aşağıdaki adımları uygulayın:

```bash
# 1. Gerekli paketleri kurun
pkg update && pkg install -y nodejs git termux-api

# 2. Kurulum betiğini çalıştırın (proje dizininde)
bash uygulama/termux/install.sh
```

Kurulum tamamlandığında `tentifor` komutu terminalinize global olarak eklenir.

---

## 🚀 CLI Komutları

### 1. Tömye Saati ve Güncel Zaman
Tömye'nin 25 saatlik döngüsündeki saati, ayı ve gün ilerleme çubuğunu gösterir:
```bash
tentifor saat
```

### 2. Tömye Takvim Tablosu
Ayları (28'er gün, Kyldo 30 gün) ve 6 günlük haftalık düzeni (Yen, Tan, Gün, Dün, Tün, Son) listeler:
```bash
tentifor takvim
```

### 3. Dünya ↔ Tömye Tarih ve Yaş Çevirici
```bash
# Dünya tarihini Tömye takvimine çevir
tentifor cevir 2026-10-06

# Yaş çevirici (Dünya yılı -> Tömye yılı)
tentifor yas 25

# Tömye yılı -> Dünya yılı
tentifor yas 120 --tomyeden
```

### 4. İsim Sistemi (Ses Çifti Algoritması)
Tentiforverse'ün kanon 4 kuralıyla (harf çevirisi, ters+harf, ünlüler korunur, ayna yansıması) isim üretin veya çözün:
```bash
# Türkçe kelimeden Tentiforverse ismi üret
tentifor isim çatlak
# Çıktı: Cedreg (harf çevirisi), Gerdec (ters+harf / 4. ay adı), Cadrag...

# Rastgele öneriler üret (karakter, sehir, ay)
tentifor isim oneri karakter 5
tentifor isim oneri sehir 3
```

### 5. Arşiv Arama ve Karakter Kartı
```bash
# Karakter, evren veya sözlük terimi ara
tentifor ara Ax

# Karakter biyografisini ve kayıt kutularını oku
tentifor karakter Necale

# Evrenleri listele veya detayını gör
tentifor evren
tentifor evren e25
```

### 6. Fan Evreni Paketleme & Doğrulama (.tentifor.html)
Telefonunuzda hazırladığınız bir evren JSON dosyasını sitede doğrudan açılabilen çevrimdışı `.tentifor.html` dosyasına paketleyin:
```bash
# JSON formatını denetle
tentifor dogrula evrenim.json

# Çevrimdışı tek parça HTML dosyasına paketle
tentifor paketle evrenim.json evrenim.tentifor.html

# Mevcut .tentifor.html dosyasından JSON verisini çıkar
tentifor cikar evrenim.tentifor.html evrenim.json
```

### 7. Android Termux:API Entegrasyonu
```bash
# Android bildirim çubuğuna bildirim gönder
tentifor bildirim "TentiforApp" "Tömye'de yeni bir gün başladı."

# Ekrana toast mesajı bas
tentifor toast "Tömye saati güncellendi"
```

---

## 💻 Kendi Scriptlerinizde Kütüphane Olarak Kullanım

Termux içinde kendi Node.js otomasyon scriptlerinizde modül olarak içeri aktarabilirsiniz:

```javascript
import { takvim, isim, arsiv, eser, termux } from './uygulama/termux/tentifor.js';

// 1. Tömye zamanını al
const simdi = takvim.suan();
console.log(`Tömye'de bugün: ${simdi.gun} ${simdi.ay} ${simdi.yil} (${simdi.haftaGunu})`);

// 2. İsim üret
const isimler = isim.uret('çatlak');
console.log('Üretilen isim:', isimler[1].sonuc); // Gerdec

// 3. Arşivde ara
const sonuclar = arsiv.ara('Ax');
console.log('Bulunan evrenler:', sonuclar);

// 4. Termux Android bildirimi tetikle
if (termux.aktifMi()) {
  await termux.bildirim({
    baslik: 'Tömye Alarmı',
    metin: `${simdi.saat}. saat başladı.`
  });
}
```

---

## 🛡️ Hata Yakalama ve Güvenlik
- **Fan Hikâyesi Koruması:** `eser.dogrula` ve paketleme modülleri bozuk şemaları anında tespit eder ve dosya bütünlüğünü korur.
- **Çevrimdışı Çalışma:** Termux kütüphanesi internet bağlantısı gerektirmeden yerel algoritma ve `veri.json` anlık görüntüsüyle %100 çevrimdışı çalışabilir.
