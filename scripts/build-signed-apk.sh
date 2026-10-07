#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYSTORE="${TF_ANDROID_KEYSTORE_PATH:?TF_ANDROID_KEYSTORE_PATH gerekli}"
STORE_PASSWORD="${TF_ANDROID_KEYSTORE_PASSWORD:?TF_ANDROID_KEYSTORE_PASSWORD gerekli}"
KEY_ALIAS="${TF_ANDROID_KEY_ALIAS:?TF_ANDROID_KEY_ALIAS gerekli}"
KEY_PASSWORD="${TF_ANDROID_KEY_PASSWORD:?TF_ANDROID_KEY_PASSWORD gerekli}"

[[ -f "$KEYSTORE" ]] || { echo 'Keystore bulunamadı.' >&2; exit 1; }
export TF_ANDROID_KEYSTORE_PATH="$KEYSTORE"
export TF_ANDROID_KEYSTORE_PASSWORD="$STORE_PASSWORD"
export TF_ANDROID_KEY_ALIAS="$KEY_ALIAS"
export TF_ANDROID_KEY_PASSWORD="$KEY_PASSWORD"

cd "$ROOT_DIR"
npm run build
npm --prefix uygulama/kabuk install --no-audit --no-fund
(cd uygulama/kabuk && npx cap sync android)
(cd uygulama/kabuk/android && ./gradlew --no-daemon --stacktrace assembleRelease)
mkdir -p "$ROOT_DIR/.apk-release-output"
cp uygulama/kabuk/android/app/build/outputs/apk/release/app-release.apk "$ROOT_DIR/.apk-release-output/tentiforapp.apk"
printf 'Release APK: %s\n' "$ROOT_DIR/.apk-release-output/tentiforapp.apk"
