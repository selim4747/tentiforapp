function yoneticiE26Verisi(){
  return veri && veri.kanonEvrenleri && veri.kanonEvrenleri.e26;
}

function yoneticiE26(){
  if(!yoneticiAcik()) return '<p class="oyun-not">Bu sekme yalnızca ana yöneticiye açıktır.</p>';
  const e=yoneticiE26Verisi();
  if(!e) return '<p class="pencere-durum kotu">E26 verisi bulunamadı.</p>';
  const json=kacir(JSON.stringify(e,null,2));
  const alanlar=Object.keys(e).map(function(i){
    return '<span class="oyun-etiket">'+kacir(i)+'</span>';
  }).join('');
  return '<div class="kutu-y"><label>E26 · tam içerik kontrolü</label>'+
    '<p class="oyun-not">E26\'nın kuralları, kişileri, yerleri, tarihi, sözlüğü, özel alanları, okuma rehberi ve oyun listesinin tamamı burada düzenlenir. Kimlik ve biçim alanları korunur; değişiklikler bellekte tutulur, kalıcı olması için ayrıca <b>Kaydet</b> sekmesinden GitHub\'a gönderilmelidir.</p>'+
    '<div class="oyun-sira">'+alanlar+'</div>'+ 
    '<textarea class="kod-giris arac-giris" id="yE26Json" rows="28" spellcheck="false" aria-label="E26 tam JSON içeriği">'+json+'</textarea>'+ 
    '<div class="oyun-sira"><button class="dugme" data-e26-kaydet> E26\'yı güncelle</button><button class="dugme dugme-sade" data-e26-indir>E26 JSON indir</button></div>'+ 
    '<p class="oyun-not">Zorunlu yapı: <code>id: e26</code>, <code>bicim: tentifor-eser</code>, <code>tur: evren</code>. Dizi alanları korunmalıdır.</p></div>';
}

function yoneticiE26Kaydet(){
  const alan=document.querySelector('#yE26Json');
  if(!alan) return;
  let yeni;
  try{ yeni=JSON.parse(alan.value); }catch(e){ yoneticiDurum('E26 JSON geçersiz: '+e.message,!1); return; }
  if(!yeni || typeof yeni!=='object' || Array.isArray(yeni)){ yoneticiDurum('E26 içeriği bir JSON nesnesi olmalı',!1); return; }
  if(yeni.id!=='e26' || yeni.bicim!=='tentifor-eser' || yeni.tur!=='evren'){ yoneticiDurum('E26 kimliği, biçimi veya türü değiştirilemez',!1); return; }
  const zorunluDiziler=['kurallar','kisiler','yerler','tarih','sozluk','ozelAlanlar','okuma_rehberi','oyun_listesi'];
  if(zorunluDiziler.some(function(i){return !Array.isArray(yeni[i]);})){ yoneticiDurum('E26 içeriğindeki dizi alanları dizi olarak kalmalı',!1); return; }
  veri.kanonEvrenleri||(veri.kanonEvrenleri={});
  veri.kanonEvrenleri.e26=yeni;
  arsiviTazele();
  yoneticiDurum('E26 güncellendi. Kalıcı olması için Kaydet sekmesine geç.',!0);
  yoneticiCiz();
}

function yoneticiE26Indir(){
  const e=yoneticiE26Verisi();
  if(!e) return;
  const blob=new Blob([JSON.stringify(e,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='e26.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

document.addEventListener('click',function(e){
  if(e.target.closest('[data-e26-kaydet]')){ yoneticiE26Kaydet(); return; }
  if(e.target.closest('[data-e26-indir]')){ yoneticiE26Indir(); }
});
