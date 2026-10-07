import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {JSDOM} from 'jsdom';
import {SEO_ORIGIN,seoMetadata,buildSitemap} from '../scripts/public-seo.mjs';

const root=process.cwd();
const read=(p)=>fs.readFileSync(p,'utf8');
const document=new JSDOM(read('index.html')).window.document;
assert.equal(document.querySelector('.marka-ad').textContent,'TentiFor');
assert.equal(document.querySelector('meta[property="og:site_name"]').content,'TentiFor');
assert.equal(document.querySelector('meta[name="apple-mobile-web-app-title"]').content,'TentiFor');
assert.equal(document.querySelectorAll('link[rel="canonical"]').length,1,'exactly one canonical tag');
assert.equal(document.querySelectorAll('meta[property="og:url"]').length,1,'exactly one OpenGraph URL tag');
assert.equal(document.querySelector('link[rel="canonical"]').href,'https://tentifor.com/');
assert.equal(document.querySelector('meta[property="og:url"]').content,'https://tentifor.com/');
assert.equal(document.querySelector('meta[property="og:image"]').content,'https://tentifor.com/paylasim.png');
assert.equal(SEO_ORIGIN,'https://tentifor.com');
assert.match(seoMetadata({tur:'evren',slug:'test-world',baslik:'Evren'}).title,/TentiFor/);
const sitemap=buildSitemap([]);
assert.match(sitemap,/https:\/\/tentifor\.com\/evren\/e25\//);
assert.equal(JSON.parse(read('manifest.webmanifest')).name,'TentiFor');
assert.equal(JSON.parse(read('manifest.webmanifest')).short_name,'TentiFor');
assert.equal(JSON.parse(read('manifest.webmanifest')).id,'./');
assert.equal(JSON.parse(read('package.json')).name,'tentiforapp','technical package identity must stay compatible');
assert.match(read('js/core/28-hesap.js'),/sb-tentiforapp-oturum/,'existing auth storage identity must stay compatible');
assert.match(read('js/engine/tentifor-terminal.js'),/window\.TentiforTerminal\s*=/,'terminal API identity must stay compatible');
assert.match(read('uygulama/kabuk/android/app/src/main/AndroidManifest.xml'),/android:host="tentifor\.com"/);
assert.match(read('uygulama/kabuk/android/app/src/main/AndroidManifest.xml'),/android:host="www\.tentifor\.com"/);
assert.equal(JSON.parse(read('uygulama/kabuk/capacitor.config.json')).appName,'TentiFor');
assert.equal(JSON.parse(read('uygulama/kabuk/capacitor.config.json')).appId,'dev.pages.tentiforapp');
assert.match(read('uygulama/kabuk/android/app/src/main/java/dev/pages/tentiforapp/MainActivity.java'),/"TentiFor bildirimleri"/);
assert.match(read('uygulama/kabuk/android/app/src/main/res/layout/tentifor_widget.xml'),/android:text="TentiFor"/);
assert.ok(!fs.existsSync('dist/uygulama/kabuk'),'native source must not be part of production web output');
assert.ok(fs.existsSync('dist/uygulama/indir/apk.json'),'APK distribution metadata must remain available');
assert.doesNotMatch(read('uygulama/kabuk/www/hata.html'),/TentiforApp|pages\.dev/,'preserved native error fallback must use new branding');
const routeDoc=new JSDOM(read('dist/evren/e25/index.html')).window.document;
assert.equal(routeDoc.querySelector('meta[name="twitter:url"]').content,'https://tentifor.com/evren/e25/');
for(const file of execFileSync('git',['ls-files'],{encoding:'utf8'}).trim().split('\n')){
 if(!/\.(?:html|js|mjs|ts|json|xml|md|txt|webmanifest)$/.test(file))continue;
 assert.doesNotMatch(read(file),/tentifor(?:app)?(?:\\?\.)pages(?:\\?\.)dev/i,`${file} should not use previous site address`);
}
for(const p of ['dist','uygulama/kabuk/www']){
 assert.equal(read(`${p}/manifest.webmanifest`),read('manifest.webmanifest'));
 assert.equal(read(`${p}/js/engine/seo-meta.js`),read('js/engine/seo-meta.js'));
}
console.log('Domain/brand regression: PASS (brand, canonical origin, old address removal, PWA identity, auth storage, terminal API, output parity)');
