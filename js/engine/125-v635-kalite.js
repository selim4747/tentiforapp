/* TentiforApp 6.3.5 — analitik ve gizlilik merkezi. */
(function () {
  'use strict';
  var mounted = false;
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>'"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]; }); }
  function c() { return typeof hesapIstemci !== 'undefined' && hesapIstemci && hesapIstemci.rpc ? hesapIstemci : null; }
  function msg(root, text, good) { var n=root.querySelector('[data-tf635-msg]'); if(n){n.textContent=text;n.className='pencere-durum '+(good?'iyi':'kotu');} }
  async function load(box) {
    var r=await c().rpc('arsivci_istatistikleri',{p_kullanici_adi:null}),t=box.querySelector('[data-tf635-stats]');
    if(r.error||!r.data||r.data.durum!=='tamam'){t.innerHTML='<p class="oyun-not">Analitik verisi yüklenemedi.</p>';return;}
    var x=r.data;t.innerHTML='<div class="tf635-olcu"><b>'+Number(x.public_evren)+'</b><span>public evren</span></div><div class="tf635-olcu"><b>'+Number(x.takipci)+'</b><span>takipçi</span></div><div class="tf635-olcu"><b>'+Number(x.takip)+'</b><span>takip</span></div><div class="tf635-olcu"><b>'+Number(x.ziyaret_30)+'</b><span>30 günlük keşif</span></div>';
  }
  async function exportData(box) {
    var b=box.querySelector('[data-tf635-export]');b.disabled=true;msg(box,'Verilerin hazırlanıyor…',true);
    try { var r=await c().rpc('veri_disa_aktar');if(r.error)throw r.error;var blob=new Blob([JSON.stringify(r.data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='tentiforapp-veri-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);msg(box,'Veri dışa aktarma hazırlandı.',true); } catch(e){msg(box,'Dışa aktarılamadı: '+(e.message||e),false);} b.disabled=false;
  }
  function mount(){var root=document.querySelector('#hesapTopluluk');if(!root||mounted||typeof hesapKullanici==='undefined'||!hesapKullanici||!c())return;mounted=true;var box=document.createElement('section');box.className='hesap-kutu tf635-kalite';box.innerHTML='<span class="oyun-etiket">Kalite ve gizlilik · 6.3.5</span><h3>Arşivci analitiği</h3><p class="oyun-not">Yalnızca kendi public içeriklerinin toplu sayılarını görürsün; özel içerik metni burada gösterilmez.</p><div class="tf635-olculer" data-tf635-stats><p class="oyun-not">Analitik yükleniyor…</p></div><h3>Profil paylaşımı</h3><p class="oyun-not">Public profil bağlantını kopyalayıp paylaşabilirsin.</p><button class="dugme dugme-sade" data-tf635-share>Profil bağlantısını kopyala</button><h3>Gizlilik merkezi</h3><p class="oyun-not">Profil alanların, kişisel rafların, okuma yolların ve sunucu taslaklarının JSON kopyasını indir. Bu işlem silme yapmaz.</p><button class="dugme" data-tf635-export>Verilerimi dışa aktar</button><p data-tf635-msg class="pencere-durum"></p>';root.appendChild(box);load(box);box.addEventListener('click',function(e){if(e.target.matches('[data-tf635-export]'))exportData(box);if(e.target.matches('[data-tf635-share]')){var k=typeof hesapKullanici!=='undefined'&&hesapKullanici.kullanici_adi||'';var u=location.origin+'/#/u/'+encodeURIComponent(k);if(typeof panoyaKopyala==='function')panoyaKopyala(u).then(function(){msg(box,'Profil bağlantısı kopyalandı.',true);});else navigator.clipboard&&navigator.clipboard.writeText(u).then(function(){msg(box,'Profil bağlantısı kopyalandı.',true);});}});}
  document.addEventListener('DOMContentLoaded',mount,{once:true});document.addEventListener('tf-veri-hazir',mount);new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});
}());
