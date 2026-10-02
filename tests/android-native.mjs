import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = read('uygulama/kabuk/android/app/src/main/AndroidManifest.xml');
const activity = read('uygulama/kabuk/android/app/src/main/java/dev/pages/tentiforapp/MainActivity.java');
const plugin = read('uygulama/kabuk/android/app/src/main/java/dev/pages/tentiforapp/TentiforNativePlugin.java');
const widget = read('uygulama/kabuk/android/app/src/main/java/dev/pages/tentiforapp/TentiforWidgetProvider.java');
const workflow = read('.github/workflows/android-build.yml');
const nativeBridge = read('js/core/100-v60-native.js');

assert.match(manifest, /android\.permission\.USE_BIOMETRIC/);
assert.match(manifest, /android\.intent\.action\.SEND/);
assert.match(manifest, /TentiforWidgetProvider/);
assert.match(activity, /registerPlugin\(TentiforNativePlugin\.class\)/);
assert.match(activity, /ACTION_SEND/);
assert.match(activity, /onBackPressed\(\)/);
assert.match(activity, /tentifor-back-button/);
assert.match(plugin, /@CapacitorPlugin\(name = "TentiforNative"\)/);
assert.match(plugin, /BiometricPrompt/);
assert.match(plugin, /FLAG_KEEP_SCREEN_ON/);
assert.match(widget, /AppWidgetProvider/);
assert.match(nativeBridge, /TentiforNative6/);
assert.match(workflow, /assembleDebug/);
assert.match(workflow, /upload-artifact@v4/);
console.log('Android native contracts: PASS (Capacitor plugin, biometric, widget, intents and CI)');
