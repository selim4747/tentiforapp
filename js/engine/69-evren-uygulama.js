const EVU_SINIR=10,EVU_KOD_SINIR=6e4,EVU_DEPO="tentiforapp_evren_uygulama",EVU_DEPO_SINIR=4e3,EVU={acik:null,duzenle:null,silOnay:null};function evuTemizle(t){return(Array.isArray(t)?t:[]).slice(0,10).map(function(n,e){if(!n||typeof n!="object")return null;const i=typeof n.kod=="string"?n.kod.slice(0,6e4):"",a=fanMetin(n.ad,60).trim();return!a&&!i.trim()?null:{id:fanMetin(n.id,40).replace(/[^\w-]/g,"")||"u"+e,ad:a||"Adsız",tur:n.tur==="ozellik"?"ozellik":"oyun",aciklama:fanMetin(n.aciklama,300),kod:i}}).filter(Boolean)}function evuListe(t){return t&&t.uygulamalar||[]}function evuEvrenVerisi(t){const n=function(e,i){return(Array.isArray(e)?e:[]).slice(0,300).map(function(a){const u={};return i.forEach(function(r){a&&a[r]!==void 0&&(u[r]=a[r])}),u})};return{ad:t.ad||"",ozet:t.ozet||"",kisiler:n((t.kisiler||[]).filter(function(e){return!e.kutu}),["ad","rol","aciklama","soz","yas","yer","etiketler"]),yerler:n(t.yerler,["ad","tur","aciklama","not"]),sozluk:n(t.sozluk,["terim","tanim"]),tarih:n(t.tarih,["zaman","olay"]),kurallar:n(t.kurallar,["ad","tur","aciklama"]),ozelAlanlar:n(t.ozelAlanlar,["ad","deger"]),haritaYerleri:n((t.harita||{}).yerler||[],["ad","x","y","tur","not"]),para:t.para?{ad:t.para.ad,simge:t.para.simge,kur:t.para.kur}:null,takvim:t.takvim?{yil:t.takvim.yil,hafta:t.takvim.hafta,bugun:t.takvim.bugun}:null}}function evuJsonGom(t){return JSON.stringify(JSON.stringify(t)).replace(/</g,"\\u003c").replace(/[\u2028]/g,"\\u2028").replace(/[\u2029]/g,"\\u2029")}function evuSrcdoc(t,n){return`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html{color-scheme:light dark}body{font:16px/1.5 system-ui,sans-serif;margin:12px}button,input,select{font:inherit;min-height:40px;padding:6px 12px}</style><script>(function(){var b={},n=0;function g(m){parent.postMessage(m,'*');}window.evren=JSON.parse(${evuJsonGom(evuEvrenVerisi(t))});evren.kazandim=function(){g({tip:'kazandi'});};evren.kaydet=function(v){g({tip:'kaydet',veri:v});};evren.skor=function(p){g({tip:'skor',puan:Number(p)||0});};evren.yukle=function(){return new Promise(function(c){var i=++n;b[i]=c;g({tip:'yukle',id:i});});};evren.ozellikDegistir=function(tur,anahtar,degerler){g({tip:'ozellik_degistir',tur:tur,anahtar:anahtar,degerler:degerler});};evren.kisiGuncelle=function(ad,degerler){g({tip:'ozellik_degistir',tur:'kisiler',anahtar:ad,degerler:degerler});};evren.yerGuncelle=function(ad,degerler){g({tip:'ozellik_degistir',tur:'yerler',anahtar:ad,degerler:degerler});};evren.kuralGuncelle=function(ad,degerler){g({tip:'ozellik_degistir',tur:'kurallar',anahtar:ad,degerler:degerler});};evren.alanGuncelle=function(ad,deger){g({tip:'ozellik_degistir',tur:'ozelAlanlar',anahtar:ad,degerler:{ad:ad,deger:deger}});};evren.paraGuncelle=function(degerler){g({tip:'ozellik_degistir',tur:'para',degerler:degerler});};evren.takvimGuncelle=function(degerler){g({tip:'ozellik_degistir',tur:'takvim',degerler:degerler});};evren.ozellikEkle=function(tur,degerler){g({tip:'ozellik_ekle',tur:tur,degerler:degerler});};evren.ozellikSil=function(tur,anahtar){g({tip:'ozellik_sil',tur:tur,anahtar:anahtar});};evren.odulOlunca=null;evren.ozellikGuncellenince=null;addEventListener('message',function(e){var d=e.data||{};if(d.tip==='yuklendi'&&b[d.id]){b[d.id](d.veri);delete b[d.id];}if(d.tip==='odul'&&typeof evren.odulOlunca==='function'){evren.odulOlunca(d);}if(d.tip==='ozellik_guncellendi'&&typeof evren.ozellikGuncellenince==='function'){evren.ozellikGuncellenince(d);}});function h(){g({tip:'yukseklik',px:document.documentElement.scrollHeight});}addEventListener('load',h);if(window.ResizeObserver){new ResizeObserver(h).observe(document.documentElement);}})();<\/script></head><body>${n.kod}</body></html>`;}let evuCerceve=null;function evuDepoAnahtari(t){return(typeof evrenCuzdanAnahtari=="function"?evrenCuzdanAnahtari():"ev")+"|"+t.id}function evuCalistir(t,n,e){t.innerHTML="";const i=document.createElement("iframe");i.className="evu-cerceve",i.setAttribute("sandbox","allow-scripts"),i.setAttribute("referrerpolicy","no-referrer"),i.setAttribute("title",e.ad),i.setAttribute("loading","lazy"),i.srcdoc=evuSrcdoc(n,e),t.appendChild(i),evuCerceve={pencere:i.contentWindow,cerceve:i,evren:n,uygulama:e},typeof evuSkorTablosu=="function"&&evuSkorTablosu(t,e),EVS&&EVS.kaynak==="fan"&&!onizlemeMi()&&t.parentNode&&!t.parentNode.querySelector(".ib-uygulama")&&t.insertAdjacentHTML("afterend",'<p class="oyun-not ib-uygulama">'+ibDugme("uygulama","fan:"+EVS.id+"/"+e.id,e.ad)+"</p>")}

window.addEventListener("message",function(t){
  const n=evuCerceve;
  if(!n||!n.cerceve.isConnected||t.source!==n.cerceve.contentWindow)return;
  const e=t.data||{},i=function(a){try{n.cerceve.contentWindow.postMessage(a,"*")}catch{}};
  
  if(e.tip==="yukseklik"){
    n.cerceve.style.height=Math.max(160,Math.min(1600,Math.round(Number(e.px)||0)+4))+"px";
  }else if(e.tip==="kazandi"){
    const a=typeof evoOdulEngeli=="function"?evoOdulEngeli():"";
    let u=0;
    !a&&n.uygulama.tur==="oyun"&&typeof oyunXpVer=="function"&&(u=oyunXpVer(evuDepoAnahtari(n.uygulama).replace(/\|/,"|kod:")));
    const r=a?a.replace("oyunlar ödül vermez","uygulamalar XP vermez"):u?"+"+u+" XP":"Bugünün XP'sini bu oyundan aldın.";
    i({tip:"odul",xp:u,mesaj:r});
    const l=document.querySelector("#evuDurum");
    l&&(l.textContent=r);
  }else if(e.tip==="kaydet"){
    let a="";
    try{a=JSON.stringify(e.veri===void 0?null:e.veri)}catch{return}
    if(a.length>4e3)return;
    const u=jsonOku(EVU_DEPO,{})||{};
    u[evuDepoAnahtari(n.uygulama)]=a,jsonYaz(EVU_DEPO,u);
  }else if(e.tip==="skor"){
    typeof evuSkorYaz=="function"&&evuSkorYaz(n,e.puan,i);
  }else if(e.tip==="yukle"){
    const a=jsonOku(EVU_DEPO,{})||{};
    let u=null;
    try{u=JSON.parse(a[evuDepoAnahtari(n.uygulama)]||"null")}catch{u=null}
    i({tip:"yuklendi",id:e.id,veri:u});
  }else if(e.tip==="ozellik_degistir"){
    if(!EVS||EVS.kaynak!=="benim"||typeof evrenBenimDegistir!=="function"){
      i({tip:"ozellik_guncellendi",basari:false,mesaj:"Yalnızca kendi evreninin özelliklerini güncelleyebilirsin."});
      return;
    }
    let guncellendi=!1,mesaj="";
    evrenBenimDegistir(EVS.id,function(u){
      const norm=function(s){return String(s||"").toLocaleLowerCase("tr").trim();};
      const hedef=norm(e.anahtar);
      if(e.tur==="kisiler"){
        const k=(u.kisiler||[]).find(function(x){return norm(x&&x.ad)===hedef;});
        if(k&&e.degerler&&typeof e.degerler==="object"){
          ["rol","aciklama","soz","yas","yer","etiketler"].forEach(function(f){
            if(e.degerler[f]!==undefined)k[f]=String(e.degerler[f]).slice(0,f==="aciklama"?8000:300);
          });
          guncellendi=!0;mesaj="Kişi güncellendi: "+(k.ad||e.anahtar);
        }
      }else if(e.tur==="yerler"){
        const y=(u.yerler||[]).find(function(x){return norm(x&&x.ad)===hedef;});
        if(y&&e.degerler&&typeof e.degerler==="object"){
          ["aciklama","tur","not"].forEach(function(f){
            if(e.degerler[f]!==undefined)y[f]=String(e.degerler[f]).slice(0,2000);
          });
          guncellendi=!0;mesaj="Yer güncellendi: "+(y.ad||e.anahtar);
        }
      }else if(e.tur==="kurallar"){
        const kr=(u.kurallar||[]).find(function(x){return norm(x&&x.ad)===hedef;});
        if(kr&&e.degerler&&typeof e.degerler==="object"){
          ["aciklama","tur"].forEach(function(f){
            if(e.degerler[f]!==undefined)kr[f]=String(e.degerler[f]).slice(0,4000);
          });
          guncellendi=!0;mesaj="Kural güncellendi: "+(kr.ad||e.anahtar);
        }
      }else if(e.tur==="ozelAlanlar"){
        u.ozelAlanlar=u.ozelAlanlar||[];
        const oa=u.ozelAlanlar.find(function(x){return norm(x&&x.ad)===hedef;});
        const val=e.degerler&&(e.degerler.deger!==undefined?e.degerler.deger:e.degerler);
        if(oa){
          oa.deger=String(val).slice(0,8000);
        }else{
          u.ozelAlanlar.push({ad:String(e.anahtar||"Özellik").slice(0,100),deger:String(val).slice(0,8000)});
        }
        guncellendi=!0;mesaj="Özellik güncellendi: "+e.anahtar;
      }else if(e.tur==="para"&&e.degerler&&typeof e.degerler==="object"){
        u.para=u.para||{};
        if(e.degerler.ad!==undefined)u.para.ad=String(e.degerler.ad).slice(0,24);
        if(e.degerler.simge!==undefined)u.para.simge=String(e.degerler.simge).slice(0,3);
        if(e.degerler.kur!==undefined&&Number(e.degerler.kur)>0)u.para.kur=Math.min(1,Math.max(.01,Number(e.degerler.kur)));
        guncellendi=!0;mesaj="Para birimi güncellendi.";
      }else if(e.tur==="takvim"&&e.degerler&&typeof e.degerler==="object"){
        u.takvim=u.takvim||{};
        if(e.degerler.yil!==undefined)u.takvim.yil=String(e.degerler.yil).slice(0,120);
        if(e.degerler.hafta!==undefined)u.takvim.hafta=String(e.degerler.hafta).slice(0,300);
        if(e.degerler.bugun!==undefined)u.takvim.bugun=String(e.degerler.bugun).slice(0,80);
        guncellendi=!0;mesaj="Takvim güncellendi.";
      }
    });
    if(guncellendi){
      i({tip:"ozellik_guncellendi",tur:e.tur,anahtar:e.anahtar,basari:!0,mesaj:mesaj});
      const l=document.querySelector("#evuDurum");
      l&&(l.textContent="✓ "+mesaj,l.className="pencere-durum iyi");
      typeof evrenSayfaCiz=="function"&&evrenSayfaCiz();
    }else{
      i({tip:"ozellik_guncellendi",tur:e.tur,anahtar:e.anahtar,basari:!1,mesaj:"Güncellenecek özellik bulunamadı: "+e.anahtar});
    }
  }else if(e.tip==="ozellik_ekle"){
    if(!EVS||EVS.kaynak!=="benim"||typeof evrenBenimDegistir!=="function")return;
    evrenBenimDegistir(EVS.id,function(u){
      if(e.tur==="ozelAlanlar"&&e.degerler){
        u.ozelAlanlar=u.ozelAlanlar||[];
        u.ozelAlanlar.push({ad:String(e.degerler.ad||"Özellik").slice(0,100),deger:String(e.degerler.deger||"").slice(0,8000)});
      }else if(e.tur==="kurallar"&&e.degerler){
        u.kurallar=u.kurallar||[];
        u.kurallar.push({ad:String(e.degerler.ad||"Yeni Kural").slice(0,100),tur:String(e.degerler.tur||"kural").slice(0,40),aciklama:String(e.degerler.aciklama||"").slice(0,4000)});
      }
    });
    i({tip:"ozellik_guncellendi",tur:e.tur,basari:!0,mesaj:"Yeni özellik evrene eklendi."});
    typeof evrenSayfaCiz=="function"&&evrenSayfaCiz();
  }
});

const EVU_ORNEK={
  oyun:{
    ad:"Kim bu?",
    aciklama:"Evrenin kişileriyle beş soruluk oyun.",
    kod:[
      "<h2>Kim bu?</h2>",
      '<p id="soru"></p><div id="secenek"></div><p id="durum"></p>',
      "<script>",
      "var k = evren.kisiler.filter(function (x) { return x.ad && (x.rol || x.aciklama); });",
      "var tur = 0, dogru = 0;",
      "function karistir(l) { return l.slice().sort(function () { return Math.random() - 0.5; }); }",
      "function soru() {",
      "  if (k.length < 4) { document.getElementById('soru').textContent = 'Bu oyun için evrende en az 4 kişi olmalı.'; return; }",
      "  if (tur === 5) { document.getElementById('soru').textContent = dogru + ' / 5'; document.getElementById('secenek').innerHTML = '';",
      "    evren.skor(dogru); if (dogru >= 4) { evren.kazandim(); } return; }",
      "  var cevap = k[Math.floor(Math.random() * k.length)];",
      "  document.getElementById('soru').textContent = '“' + (cevap.rol || cevap.aciklama) + '” — bu kim?';",
      "  var s = document.getElementById('secenek'); s.innerHTML = '';",
      "  karistir([cevap].concat(karistir(k.filter(function (x) { return x !== cevap; })).slice(0, 3))).forEach(function (x) {",
      "    var b = document.createElement('button'); b.textContent = x.ad;",
      "    b.onclick = function () { if (x === cevap) { dogru++; } tur++; soru(); };",
      "    s.appendChild(b);",
      "  });",
      "}",
      "evren.odulOlunca = function (d) { document.getElementById('durum').textContent = d.mesaj; };",
      "soru();",
      "<\/script>"
    ].join("\n")
  },
  ozellik:{
    ad:"Günün kehaneti",
    aciklama:"Her açılışta evrenden rastgele bir yer ve kişi; kaç kez baktığını hatırlar.",
    kod:[
      "<h2>Günün kehaneti</h2>",
      '<p id="k"></p><button id="yeni">Bir daha</button><p id="say"></p>',
      "<script>",
      "function sec(l) { return l.length ? l[Math.floor(Math.random() * l.length)] : null; }",
      "function kehanet() {",
      "  var kisi = sec(evren.kisiler), yer = sec(evren.yerler.concat(evren.haritaYerleri));",
      "  document.getElementById('k').textContent = (kisi ? kisi.ad : 'Biri') + ', bugün ' + (yer ? yer.ad : 'uzak bir yer') + ' yolunda.';",
      "}",
      "evren.yukle().then(function (v) { var n = (v && v.n || 0) + 1; evren.kaydet({ n: n });",
      "  document.getElementById('say').textContent = 'Bu kehanete ' + n + '. bakışın.'; });",
      "document.getElementById('yeni').onclick = kehanet; kehanet();",
      "<\/script>"
    ].join("\n")
  },
  ozellik_degistir:{
    ad:"Evren Durum Değiştirici",
    aciklama:"Evrenin mevcut kişilerini, kurallarını veya özel alanlarını butonlarla kodla günceller.",
    kod:[
      "<h2>Evren Durum Paneli</h2>",
      '<p class="oyun-not">Bu kod evrendeki mevcut özellikleri doğrudan günceller ve kaydeder.</p>',
      '<div id="durumKutu" style="margin: 12px 0; padding: 12px; border: 1px solid currentColor; border-radius: 8px;">',
      '  <p id="bilgi">Yükleniyor...</p>',
      '  <button id="btnGuncelle">İlk Kişinin Rolünü Güncelle</button>',
      '  <button id="btnKural">Gökyüzü Durumu Ekle/Değiştir</button>',
      '</div>',
      '<p id="mesaj" style="color: #1c5c96; font-weight: bold;"></p>',
      "<script>",
      "function goster() {",
      "  var kisi = (evren.kisiler || [])[0];",
      "  var metin = '<b>İlk Kişi:</b> ' + (kisi ? kisi.ad + ' (' + (kisi.rol || 'rolsüz') + ')' : 'Evrende kişi yok');",
      "  document.getElementById('bilgi').innerHTML = metin;",
      "}",
      "document.getElementById('btnGuncelle').onclick = function() {",
      "  var kisi = (evren.kisiler || [])[0];",
      "  if (!kisi) { alert('Evrende kişi yok!'); return; }",
      "  var roller = ['Kıdemli Kaşif', 'Yıldız Koruyucusu', 'Sürgün Gezgin', 'Büyü Ustası', 'Kadim Bekçi'];",
      "  var yeniRol = roller[Math.floor(Math.random() * roller.length)];",
      "  evren.kisiGuncelle(kisi.ad, { rol: yeniRol });",
      "  document.getElementById('mesaj').textContent = kisi.ad + ' yeni rolü: ' + yeniRol;",
      "};",
      "document.getElementById('btnKural').onclick = function() {",
      "  var durumlar = ['Kızıl Fırtına Zamanı', 'Aysız Dingin Gece', 'Yıldız Yağmuru Mevsimi', 'Zaman Kırılması'];",
      "  var secilen = durumlar[Math.floor(Math.random() * durumlar.length)];",
      "  evren.alanGuncelle('Gökyüzü Durumu', secilen);",
      "  document.getElementById('mesaj').textContent = 'Özellik güncellendi: Gökyüzü Durumu = ' + secilen;",
      "};",
      "evren.ozellikGuncellenince = function(d) {",
      "  document.getElementById('mesaj').textContent = '✓ ' + (d.mesaj || 'Değişiklik evrene kaydedildi!');",
      "  goster();",
      "};",
      "goster();",
      "<\/script>"
    ].join("\n")
  }
};

function evuBolum(t){
  const n=t.eser,e=evuListe(n),i=EVS&&EVS.kaynak==="benim",a=i&&EVU.duzenle?e.find(function(r){return r.id===EVU.duzenle}):null;
  if(a){
    const kisiler=(n.kisiler||[]).filter(function(x){return!x.kutu&&x.ad});
    const yerler=(n.yerler||[]).filter(function(x){return x.ad});
    const kurallar=(n.kurallar||[]).filter(function(x){return x.ad});
    const ozelAlanlar=(n.ozelAlanlar||[]).filter(function(x){return x.ad});
    return'<div class="kutu-y evu-duzen">'+
      '<label for="evuAd">Adı</label><input class="kod-giris arac-giris" id="evuAd" maxlength="60" value="'+kacir(a.ad)+'">'+
      '<label for="evuTur">Türü</label><select class="kod-giris arac-giris" id="evuTur"><option value="oyun"'+(a.tur==="oyun"?" selected":"")+'>Oyun (kazanınca XP)</option><option value="ozellik"'+(a.tur==="ozellik"?" selected":"")+'>Özellik (araç, panel veya özellik değiştirici)</option></select>'+
      '<label for="evuAciklama">Kısa açıklama</label><input class="kod-giris arac-giris" id="evuAciklama" maxlength="300" value="'+kacir(a.aciklama||"")+'">'+
      '<label for="evuKod">Kod (HTML + JavaScript)</label><textarea class="kod-giris arac-giris evkod" id="evuKod" rows="18" spellcheck="false" autocapitalize="off" autocomplete="off" maxlength="60000">'+kacir(a.kod)+'</textarea>'+
      
      '<details class="evu-degistirici-yardim kutu-y" style="margin: 10px 0; background: rgba(0,0,0,0.02);">'+
        '<summary><b>⚡ Mevcut Evren Özelliklerini Kodla Değiştirme Kılavuzu & Kod Üretici</b></summary>'+
        '<p class="oyun-not">Kodunun içinden evrenindeki varlıkları değiştirmek için hazır fonksiyonları çağırabilirsin:</p>'+
        '<ul>'+
          '<li><code>evren.kisiGuncelle("Kişi Adı", { rol: "...", soz: "..." })</code>: Kişinin rolünü/sözünü günceller.</li>'+
          '<li><code>evren.yerGuncelle("Yer Adı", { aciklama: "..." })</code>: Mekânın açıklamasını günceller.</li>'+
          '<li><code>evren.kuralGuncelle("Kural Adı", { aciklama: "..." })</code>: Kuralı günceller.</li>'+
          '<li><code>evren.alanGuncelle("Alan Adı", "Yeni Değer")</code>: Özel evren alanını günceller/oluşturur.</li>'+
          '<li><code>evren.paraGuncelle({ ad: "Altın", simge: "A", kur: 0.25 })</code>: Evren parasını günceller.</li>'+
        '</ul>'+
        (kisiler.length||yerler.length||kurallar.length||ozelAlanlar.length?
          '<div style="margin-top: 8px;"><b class="oyun-not">Mevcut özelliklerden kod üret:</b><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">'+
            kisiler.slice(0,6).map(function(k){
              return'<button type="button" class="dugme dugme-sade y-kucuk" data-evu-kod-ekle="kisi:'+kacir(k.ad)+'">+ '+kacir(k.ad)+' güncelle</button>';
            }).join("")+
            yerler.slice(0,4).map(function(y){
              return'<button type="button" class="dugme dugme-sade y-kucuk" data-evu-kod-ekle="yer:'+kacir(y.ad)+'">+ '+kacir(y.ad)+' güncelle</button>';
            }).join("")+
            ozelAlanlar.slice(0,4).map(function(oa){
              return'<button type="button" class="dugme dugme-sade y-kucuk" data-evu-kod-ekle="alan:'+kacir(oa.ad)+'">+ '+kacir(oa.ad)+' değiştir</button>';
            }).join("")+
          '</div></div>':"")+
      '</details>'+

      '<details class="evu-api"><summary>Kodun kullanabildikleri</summary><ul>'+
        '<li><code>evren.kisiler</code>, <code>evren.yerler</code>, <code>evren.sozluk</code>, <code>evren.tarih</code>, <code>evren.kurallar</code>, <code>evren.ozelAlanlar</code>: evreninin verileri</li>'+
        '<li><code>evren.kisiGuncelle(ad, yeniAlanlar)</code>: mevcut kişinin özelliklerini değiştirir</li>'+
        '<li><code>evren.yerGuncelle(ad, yeniAlanlar)</code>: mevcut yerin özelliklerini değiştirir</li>'+
        '<li><code>evren.kuralGuncelle(ad, yeniAlanlar)</code>: mevcut kuralı değiştirir</li>'+
        '<li><code>evren.alanGuncelle(alanAdi, deger)</code>: dinamik özel alanı değiştirir/ekler</li>'+
        '<li><code>evren.kazandim()</code>: oyunu kazanan günde bir kez XP alır</li>'+
        '<li><code>evren.kaydet(v)</code> ve <code>evren.yukle()</code>: uygulamanın küçük kaydı (en çok 4 KB)</li>'+
        '<li><code>evren.skor(puan)</code>: oyunun puan tablosuna yazar</li>'+
      '</ul></details>'+

      '<div class="oyun-sira"><button class="dugme" data-evu-kaydet="'+kacir(a.id)+'">Kaydet ve çalıştır</button><button class="dugme dugme-sade" data-evu-kapat>Listeye dön</button><button class="dugme dugme-sade y-sil" data-evu-sil="'+kacir(a.id)+'">'+(EVU.silOnay===a.id?"Emin misin? Sil":"Sil")+'</button></div><p class="pencere-durum" id="evuDurum" role="status"></p><div id="evuSahne" class="evu-sahne" data-evu="'+kacir(a.id)+'"></div></div>';
  }
  const u=EVU.acik?e.find(function(r){return r.id===EVU.acik}):null;
  return'<p class="oyun-not">'+(i?"Evrenine kodla yeni oyunlar, araçlar veya mevcut özellikleri değiştiren paneller yaz. Kod korumalı bir çerçevede çalışır; evreninin verisini okuyabilir, değiştirebilir ve XP verebilir.":"Bu evrenin kurucusunun yazdığı oyunlar ve özellikler.")+"</p>"+(e.length?'<div class="evu-liste">'+e.map(function(r){return'<div class="yaris-kart evo-kart"><h4>'+kacir(r.ad)+' <span class="evu-tur">'+(r.tur==="oyun"?"oyun":"özellik")+"</span></h4>"+(r.aciklama?'<p class="oyun-not">'+kacir(r.aciklama)+"</p>":"")+'<div class="yaris-kart-alt"><span></span><span class="oyun-sira"><button class="dugme" data-evu-ac="'+kacir(r.id)+'">Aç</button>'+(i?'<button class="dugme dugme-sade" data-evu-duzenle="'+kacir(r.id)+'">Düzenle</button>':"")+"</span></div></div>"}).join("")+"</div>":'<p class="oyun-not">Henüz uygulama yok.</p>')+(i&&e.length<10?'<div class="oyun-sira"><button class="dugme dugme-sade" data-evu-yeni="oyun">+ Oyun (örnekle)</button><button class="dugme dugme-sade" data-evu-yeni="ozellik">+ Özellik (örnekle)</button><button class="dugme dugme-sade" data-evu-yeni="ozellik_degistir">⚡ Özellik Değiştirici (örnekle)</button></div>':"")+(u?'<div class="kutu-y"><div class="gk-ust"><span class="oyun-etiket">'+kacir(u.ad)+'</span><button class="dugme dugme-sade" data-evu-kapat>Kapat</button></div><p class="pencere-durum iyi" id="evuDurum" role="status"></p><div id="evuSahne" class="evu-sahne" data-evu="'+kacir(u.id)+'"></div></div>':"");
}

function evuSahneKur(){const t=document.querySelector("#evrenSayfa #evuSahne");if(!t||t.querySelector("iframe"))return;const n=typeof evrenSayfaVerisi=="function"?evrenSayfaVerisi():null,e=n&&evuListe(n.eser).find(function(i){return i.id===t.getAttribute("data-evu")});e&&evuCalistir(t,n.eser,e)}
function evuDegistir(t){!EVS||EVS.kaynak!=="benim"||typeof evrenBenimDegistir!="function"||evrenBenimDegistir(EVS.id,function(n){n.uygulamalar=evuTemizle(t(evuListe(n).slice())),n.uygulamalar.length||delete n.uygulamalar})}

document.addEventListener("click",function(t){
  const n=t.target.closest("[data-evu-ac], [data-evu-duzenle], [data-evu-yeni], [data-evu-kaydet], [data-evu-sil], [data-evu-kapat], [data-evu-kod-ekle]");
  if(!n||!EVS)return;
  const e=n.dataset;
  if(e.evuAc)EVU.acik=e.evuAc,EVU.duzenle=null;
  else if(e.evuDuzenle)EVU.duzenle=e.evuDuzenle,EVU.acik=null,EVU.silOnay=null;
  else if(n.hasAttribute("data-evu-kapat"))EVU.acik=null,EVU.duzenle=null;
  else if(e.evuYeni){
    const i=EVU_ORNEK[e.evuYeni]||EVU_ORNEK.oyun,a="u"+Date.now().toString(36);
    evuDegistir(function(u){return u.push({id:a,ad:i.ad,tur:e.evuYeni==="oyun"?"oyun":"ozellik",aciklama:i.aciklama,kod:i.kod}),u}),EVU.duzenle=a;
  }else if(e.evuKodEkle){
    const parca=e.evuKodEkle.split(":");
    const tur=parca[0],ad=parca.slice(1).join(":");
    let kodParcasi="";
    if(tur==="kisi"){
      kodParcasi='\n// '+ad+' kişisini güncelleme:\nevren.kisiGuncelle("'+ad+'", {\n  rol: "Kıdemli Kaşif",\n  soz: "Yıldızlar rehberimdir."\n});\n';
    }else if(tur==="yer"){
      kodParcasi='\n// '+ad+' yerini güncelleme:\nevren.yerGuncelle("'+ad+'", {\n  aciklama: "Bu kadim mekân artık sessizliğe büründü."\n});\n';
    }else if(tur==="alan"){
      kodParcasi='\n// '+ad+' alanını değiştirme:\nevren.alanGuncelle("'+ad+'", "Yeni Değer");\n';
    }
    const alan=document.querySelector("#evuKod");
    if(alan&&kodParcasi){
      alan.value=alan.value+"\n"+kodParcasi;
      alan.dispatchEvent(new Event("input",{bubbles:!0}));
      alan.focus();
    }
    return;
  }else if(e.evuKaydet){
    const i=function(u){const r=document.querySelector(u);return r?r.value:""},a={id:e.evuKaydet,ad:i("#evuAd"),tur:i("#evuTur"),aciklama:i("#evuAciklama"),kod:i("#evuKod")};
    evuDegistir(function(u){return u.map(function(r){return r.id===a.id?a:r})});
  }else if(e.evuSil){
    EVU.silOnay!==e.evuSil?(EVU.silOnay=e.evuSil):(evuDegistir(function(i){return i.filter(function(a){return a.id!==e.evuSil})}),EVU.duzenle=null,EVU.silOnay=null);
  }
  evrenSayfaCiz();
});
