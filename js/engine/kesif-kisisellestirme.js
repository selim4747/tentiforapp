/* TentiforApp 6.3.4 — kişiselleştirilmiş keşif. */
(function () {
  'use strict';
  var mounted = false;
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>'"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]; }); }
  async function client() { if (typeof hesapIstemci !== 'undefined' && hesapIstemci && hesapIstemci.rpc) return hesapIstemci; if (typeof tf4Istemci === 'function') return tf4Istemci(); return null; }
  function card(x) { return '<article class="kutu-y tf634-kart"><span class="oyun-etiket">' + esc(x.tur === 'arsivci' ? 'arşivci' : 'evren') + '</span><a href="' + esc(x.adres) + '"><b>' + esc(x.baslik) + '</b><span class="oyun-not">' + esc(x.metin || '') + '</span></a>' + (x.popular ? '<small class="oyun-not">' + Number(x.popular) + ' keşif etkileşimi</small>' : '') + '</article>'; }
  async function load(box) {
    var api = await client(); if (!api) return;
    var type=box.querySelector('[name=tf634-tur]').value, sort=box.querySelector('[name=tf634-siralama]').value;
    var r=await api.rpc('kesif_akisi',{p_tur:type,p_siralama:sort,p_limit:30}), target=box.querySelector('[data-tf634-feed]');
    if (r.error) { target.innerHTML='<p class="oyun-not">Keşif akışı yüklenemedi.</p>'; return; }
    var rows=Array.isArray(r.data)?r.data:[]; target.innerHTML=rows.length?rows.map(card).join(''):'<p class="oyun-not">Bu filtreyle henüz içerik bulunamadı.</p>';
  }
  async function featured(box) {
    var api=await client(); if(!api)return; var r=await api.rpc('kesif_one_cikanlar',{p_limit:8}),t=box.querySelector('[data-tf634-featured]'); if(r.error)return;
    var rows=Array.isArray(r.data)?r.data:[]; t.innerHTML=rows.length?'<h3>Öne çıkan arşivciler</h3>'+rows.map(function(x){return '<a class="tf634-yazar" href="#/u/'+esc(x.kullanici_adi)+'"><b>@'+esc(x.kullanici_adi)+'</b><span class="oyun-not">'+Number(x.evren_sayisi)+' public evren · '+Number(x.takipci)+' takipçi</span></a>';}).join(''):'<p class="oyun-not">Henüz öne çıkan arşivci yok.</p>';
  }
  function mount(){var root=document.querySelector('#kesif');if(!root||mounted)return;mounted=true;var box=document.createElement('section');box.className='tf634-kesif kutu-y';box.innerHTML='<div class="tf634-ust"><div><span class="oyun-etiket">Keşfet · 6.3.4</span><h2>Senin için keşfet</h2></div><div class="oyun-sira"><label class="oyun-not">Tür <select class="kod-giris" name="tf634-tur"><option value="hepsi">Hepsi</option><option value="evren">Evrenler</option><option value="arsivci">Arşivciler</option></select></label><label class="oyun-not">Sıralama <select class="kod-giris" name="tf634-siralama"><option value="onerilen">Önerilen</option><option value="yeni">En yeni</option><option value="populer">Popüler</option></select></label></div></div><div data-tf634-feed><p class="oyun-not">Keşif akışı yükleniyor…</p></div><div data-tf634-featured></div>';
    root.insertBefore(box,root.querySelector('#surumNotuAlan'));box.addEventListener('change',function(){load(box);});load(box);featured(box);}
  document.addEventListener('DOMContentLoaded',mount,{once:true});document.addEventListener('tf-veri-hazir',mount);new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});
}());
