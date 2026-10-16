#!/data/data/com.termux/files/usr/bin/bash
# Tentiforverse Android Termux Kurulum Betiği
set -e

echo -e "\033[1;36m╔══════════════════════════════════════════════════════════════╗\033[0m"
echo -e "\033[1;36m║   \033[1;33mTENTİFORVERSE\033[1;36m · Termux Kurulumu Başlatılıyor...            ║\033[0m"
echo -e "\033[1;36m╚══════════════════════════════════════════════════════════════╝\033[0m"

# 1. Node.js Kontrolü
if ! command -v node >/dev/null 2>&1; then
    echo -e "\033[1;33m[1/3]\033[0m Node.js bulunamadı, Termux paket yöneticisiyle kuruluyor..."
    pkg update -y && pkg install -y nodejs
else
    echo -e "\033[1;32m[1/3]\033[0m Node.js mevcut ($(node -v))"
fi

# 2. Termux-API Kontrolü (Opsiyonel ama tavsiye edilen)
if ! command -v termux-notification >/dev/null 2>&1; then
    echo -e "\033[1;33m[2/3]\033[0m Termux:API araçları kuruluyor (bildirim ve pano desteği için)..."
    pkg install -y termux-api || true
else
    echo -e "\033[1;32m[2/3]\033[0m Termux:API araçları hazır."
fi

# 3. CLI Çalıştırılabilir Bağlantısı
PREFIX_BIN="${PREFIX:-/data/data/com.termux/files/usr}/bin"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_PATH="$SCRIPT_DIR/bin/tentifor.mjs"

chmod +x "$BIN_PATH"

if [ -d "$PREFIX_BIN" ]; then
    echo -e "\033[1;33m[3/3]\033[0m '$PREFIX_BIN/tentifor' sembolik bağı oluşturuluyor..."
    ln -sf "$BIN_PATH" "$PREFIX_BIN/tentifor"
    echo -e "\033[1;32m✓ Kurulum tamamlandı!\033[0m"
    echo -e "\nŞimdi terminalde doğrudan şu komutu çalıştırabilirsin:"
    echo -e "  \033[1;32mtentifor saat\033[0m"
    echo -e "  \033[1;32mtentifor takvim\033[0m"
    echo -e "  \033[1;32mtentifor isim çatlak\033[0m\n"
else
    echo -e "\033[1;33m[Bilgi]\033[0m Standart Termux prefix dizini bulunamadı. Şu komutla çalıştırabilirsin:"
    echo -e "  node $BIN_PATH saat\n"
fi
