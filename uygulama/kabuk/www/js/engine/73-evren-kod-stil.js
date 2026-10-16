const EKS_STIL_SINIR=2e4,EKS_GORUNUM_SINIR=3e4,EKS_ETIKETLER=["div","span","p","h1","h2","h3","h4","h5","ul","ol","li","b","i","em","strong","u","small","mark","blockquote","figure","figcaption","img","a","br","hr","section","article","header","footer","aside","nav","table","thead","tbody","tr","th","td","details","summary","dl","dt","dd","code","pre","sup","sub"],EKS_OZNITELIK=["class","title","alt","href","src","style","colspan","rowspan","open","width","height","role","aria-label","lang","dir"];function eksCssTemizle(t){return eksSusluDengele(String(t||"").slice(0,2e4).replace(/\\[0-9a-fA-F]{1,6}\s?/g,"").replace(/\\[\s\S]?/g,"").replace(/(["'])(?:(?!\1)[^\n])*?(?:\/\/|:\s*\/)(?:(?!\1)[^\n])*\1/g,'""').replace(/<\/?\s*style/gi,"").replace(/@import[^;]*;?/gi,"").replace(/@charset[^;]*;?/gi,"").replace(/expression\s*\(/gi,"(").replace(/behavior\s*:/gi,"x:").replace(/url\s*\(\s*(?!['"]?data:image\/)[^)]*\)/gi,"none"))}function eksSusluDengele(t){let e=0,r="",a="";for(let l=0;l<t.length;l++){const n=t[l];if(a){r+=n,n===a&&(a="");continue}if(n==='"'||n==="'"){a=n,r+=n;continue}if(n==="{")e++;else if(n==="}"){if(!e)continue;e--}r+=n}return a&&(r+=a),r+"}".repeat(e)}function eksStilCss(t){const e=eksCssTemizle(t&&t.stilKodu);return e.trim()?"#evrenSayfa{"+e+"}":""}function eksAdresGuvenli(t,e){const r=String(e||"").trim();return t==="href"?/^(https?:\/\/|#)/i.test(r):t==="src"?/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(r)||/^ikon\/fan\/[\w-]{1,90}\.(jpg|png|webp)$/.test(r):!0}function eksYerTutucu(t){const e=function(r,a,l){const n=(Array.isArray(r)?r:[]).filter(function(o){return o&&String(o[a]||"").trim()});return n.length?"<ul>"+n.map(function(o){return"<li><b>"+kacir(o[a])+"</b>"+(o[l]?" — "+kacir(o[l]):"")+"</li>"}).join("")+"</ul>":""};return{ad:kacir(t.ad||""),ozet:kacir(t.ozet||""),kisiler:e((t.kisiler||[]).filter(function(r){return!r.kutu}),"ad","rol"),yerler:e(t.yerler,"ad","aciklama"),sozluk:e(t.sozluk,"terim","tanim"),tarih:e(t.tarih,"zaman","olay"),kurallar:e(t.kurallar,"ad","aciklama"),harita:'<div class="eks-yer-harita"></div>',roman:((t.roman||{}).bolumler||[]).length?"<ol>"+t.roman.bolumler.map(function(r,a){return"<li>"+kacir(r.baslik||"Bölüm "+(a+1))+"</li>"}).join("")+"</ol>":""}}function eksHtmlTemizle(t,e){const r=eksYerTutucu(e||{}),a=String(t||"").slice(0,3e4).replace(/\{\{\s*yazi\s*:\s*([^}]{1,120})\}\}/g,function(s,i){return'<span class="eks-yer-yazi" title="'+kacir(i.trim())+'"></span>'}).replace(/\{\{\s*(ad|ozet|kisiler|yerler|sozluk|tarih|kurallar|harita|roman)\s*\}\}/g,function(s,i){return r[i]}),n=new DOMParser().parseFromString("<div>"+a+"</div>","text/html").body.firstChild,o=function(s){Array.prototype.slice.call(s.childNodes).forEach(function(i){if(i.nodeType===3)return;if(i.nodeType!==1){i.remove();return}const d=i.tagName.toLowerCase();if(EKS_ETIKETLER.indexOf(d)===-1){if(["script","style","iframe","object","embed","template","svg","math","noscript","form","link","meta","base"].indexOf(d)!==-1){i.remove();return}for(o(i);i.firstChild;)s.insertBefore(i.firstChild,i);i.remove();return}Array.prototype.slice.call(i.attributes).forEach(function(u){const c=u.name.toLowerCase();if(EKS_OZNITELIK.indexOf(c)===-1||!eksAdresGuvenli(c,u.value)){i.removeAttribute(u.name);return}c==="style"&&i.setAttribute("style",eksCssTemizle(u.value).replace(/[{}]/g,""))}),d==="a"&&(i.setAttribute("rel","noopener nofollow ugc"),i.setAttribute("target","_blank")),o(i)})};return o(n),n.querySelectorAll(".eks-yer-harita").forEach(function(s){const i=e&&e.harita||{};s.innerHTML=(i.yerler||[]).length&&typeof evrenHaritaSvg=="function"?evrenHaritaSvg(i,{alfabe:e.alfabe}):""}),n.querySelectorAll(".eks-yer-yazi").forEach(function(s){const i=s.getAttribute("title")||"";s.innerHTML=typeof eyYaziSvg=="function"&&e&&e.yazi&&eyYaziSvg(i,e.yazi,34)||kacir(i)}),n.innerHTML}

const EKS_BILESENLER=[
  {id:"buton",ad:"🔘 Buton Stili",ozet:"Buton renkleri, kenarlık, hover/active geçişleri, gölgeler",secici:".dugme, .dugme-sade, .ic-bag, .evs-ikon"},
  {id:"duzen",ad:"📐 Sayfa Düzeni",ozet:"Genişlik, flex/grid kolonları, boşluklar, vitrin ızgarası",secici:".evs-govde, .eks-vitrin, .eks-izgara, .kutu-y"},
  {id:"arkaplan",ad:"🌌 Arka Plan & Doku",ozet:"Degradeler, arka plan dokusu, atmosferik parıltı, zemin",secici:"#evrenSayfa, .eks-vitrin, .evs-ust"},
  {id:"tipografi",ad:"🔤 Font & Harf Düzeni",ozet:"Başlıklar, harf aralığı, satır yüksekliği, alıntılar, evren yazısı",secici:"h1, h2, h3, p, blockquote, .evs-alfabe-ad, .eks-yer-yazi"},
  {id:"kartlar",ad:"🗂 Kartlar & Çerçeveler",ozet:"Kart sınırları, cam efekti (backdrop-filter), köşe yuvarlaklığı",secici:".kart, .kutu-y, .madde, .yaris-kart"},
  {id:"efektler",ad:"✨ Etkileşim & Animasyon",ozet:"Geçiş efektleri, nabız animasyonları, parlama, kaydırma çubuğu",secici:"::-webkit-scrollbar, .kart:hover, .dugme:hover"},
  {id:"serbest",ad:"📝 Tümleşik / Serbest CSS",ozet:"Evrenin derlenmiş veya serbest CSS kodunun tamamı",secici:"Tüm seçiciler serbest"}
];

const EKS_BILESEN_SABLONLARI={
  buton:[
    {ad:"Neon Parıltı",kod:".dugme { background: #070b19; color: #39f3ff; border: 1px solid #39f3ff; box-shadow: 0 0 10px rgba(57,243,255,0.3); border-radius: 999px; font-weight: bold; transition: all .2s; }\n.dugme:hover { box-shadow: 0 0 18px rgba(57,243,255,0.6); transform: translateY(-1px); }"},
    {ad:"Antik Parşömen",kod:".dugme { background: #d8c8a0; color: #3b2a14; border: 2px solid #6b5433; border-radius: 4px; font-family: Georgia,serif; letter-spacing: .05em; }\n.dugme:hover { background: #efe3c4; border-color: #3b2a14; }"},
    {ad:"Buzlu Cam",kod:".dugme { background: rgba(255,255,255,0.12); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.25); color: inherit; border-radius: 12px; }\n.dugme:hover { background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.4); }"}
  ],
  duzen:[
    {ad:"Çift Sütunlu Magazin",kod:".eks-vitrin { max-width: 960px; margin: 0 auto; }\n.eks-vitrin .izgara { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; }\n.evs-govde { padding: 24px 18px 60px; }"},
    {ad:"Sinematik Geniş Vitrin",kod:".eks-vitrin .kapak { padding: 48px 24px; text-align: center; border-radius: 16px; margin-bottom: 24px; }\n.eks-vitrin .kapak h1 { font-size: 3em; margin: 0 0 12px; letter-spacing: .08em; }"},
    {ad:"Kompakt Terminal",kod:".evs-govde { font-family: ui-monospace,monospace; max-width: 820px; }\n.kutu-y { border-left: 3px solid currentColor; border-radius: 0; padding: 10px 14px; }"}
  ],
  arkaplan:[
    {ad:"Yıldız Tozu Gece",kod:"#evrenSayfa { background: radial-gradient(circle at 50% 20%, #151b36 0%, #070913 80%); color: #e8eefc; }\n.evs-ust { border-bottom: 1px solid rgba(255,255,255,0.12); backdrop-filter: blur(10px); }"},
    {ad:"Eski Parşömen",kod:"#evrenSayfa { background: #f5eedb; color: #2c2011; }\n.evs-ust { border-bottom: 2px double #8b6e4e; background: #ebdcc0; }"},
    {ad:"Siber Karanlık",kod:"#evrenSayfa { background: #06090e; color: #cde2f5; }\n.eks-vitrin { background: #0c121c; border: 1px solid #1c324e; border-radius: 12px; }"}
  ],
  tipografi:[
    {ad:"Klasik Antik Roman",kod:"h1, h2, h3 { font-family: Georgia,serif; font-weight: normal; letter-spacing: .04em; }\np { line-height: 1.85; font-size: 1.05em; }\nblockquote { border-left: 3px solid currentColor; padding-left: 14px; font-style: italic; opacity: .9; }"},
    {ad:"Modern Sans & Geniş Harf",kod:"h1, h2, h3 { font-family: system-ui,sans-serif; letter-spacing: .12em; text-transform: uppercase; font-weight: 700; }\n.evs-baslik h2 { letter-spacing: .15em; }"},
    {ad:"Kadim Daktilo / Kod",kod:"h1, h2, h3, p, .kart { font-family: ui-monospace,monospace; }\nh2 { font-size: 1.3em; border-bottom: 1px dashed currentColor; padding-bottom: 4px; }"}
  ],
  kartlar:[
    {ad:"Yarı Saydam Buzlu Cam",kod:".kart, .kutu-y { background: rgba(255,255,255,0.06); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.14); border-radius: 14px; transition: transform .2s, border-color .2s; }\n.kart:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.3); }"},
    {ad:"Çift Çizgili Antik Çerçeve",kod:".kutu-y, .kart { border: 3px double currentColor; border-radius: 6px; padding: 16px; background: rgba(0,0,0,0.02); }"},
    {ad:"Neon Kontur Kart",kod:".kart, .kutu-y { border: 1px solid #1c5c96; border-radius: 10px; box-shadow: 0 2px 14px rgba(28,92,150,0.15); }\n.kart:hover { box-shadow: 0 4px 22px rgba(28,92,150,0.35); }"}
  ],
  efektler:[
    {ad:"Pürüzsüz Geçiş & Hover Yükselmesi",kod:".kart, .dugme, .ic-bag, .evs-sekme { transition: all .22s cubic-bezier(.2,.8,.2,1); }\n.kart:hover, .dugme:hover { transform: translateY(-2px); }\n::-webkit-scrollbar { width: 8px; }\n::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.4); border-radius: 4px; }"},
    {ad:"Yumuşak Parlama Nabzı",kod:"@keyframes evsParilti { 0%,100% { opacity: .7 } 50% { opacity: 1 } }\n.evs-rozet, .eks-vitrin h1 { animation: evsParilti 3s infinite ease-in-out; }"}
  ]
};

const EKS_MODULER_BLOKLAR=[
  {ad:"Kapak & Tanıtım",kod:'<header class="kapak">\n  <h1>{{ad}}</h1>\n  <p>{{ozet}}</p>\n</header>'},
  {ad:"3'lü Bilgi Izgarası",kod:'<section class="izgara">\n  <div class="kutu"><h3>Kişiler</h3>{{kisiler}}</div>\n  <div class="kutu"><h3>Yerler</h3>{{yerler}}</div>\n  <div class="kutu"><h3>Sözlük</h3>{{sozluk}}</div>\n</section>'},
  {ad:"Harita Vitrini",kod:'<section class="harita-vitrin">\n  <h3>Evren Haritası</h3>\n  {{harita}}\n</section>'},
  {ad:"Roman & Anlatı",kod:'<section class="roman-vitrin">\n  <h3>Bölümler ve Roman</h3>\n  {{roman}}\n</section>'},
  {ad:"Özel Yazı Banner'ı",kod:'<div class="yazi-banner">\n  {{yazi:Evren}}\n</div>'}
];

let EKS_AKTIF_BILESEN="buton";

function eksBilesenleriAyristir(t){
  const e={};
  EKS_BILESENLER.forEach(function(i){e[i.id]=""});
  const r=String(t||"").trim();
  if(!r)return e;
  if(!r.includes("/* === [")){
    e.serbest=r;
    return e;
  }
  const a=/\/\*\s*===\s*\[([a-z0-9_-]+)\]\s*===\s*\*\/([\s\S]*?)(?=\/\*\s*===\s*\[|$)/gi;
  let n,o=!1;
  while((n=a.exec(r))!==null){
    const l=n[1].toLowerCase(),s=n[2].trim();
    if(e[l]!==undefined){
      e[l]=s;
      o=!0;
    }else{
      e.serbest=((e.serbest||"")+"\n"+s).trim();
    }
  }
  if(!o)e.serbest=r;
  return e;
}

function eksBilesenleriBirlestir(t){
  const e=[];
  EKS_BILESENLER.forEach(function(r){
    const a=(t[r.id]||"").trim();
    if(a){
      e.push("/* === ["+r.id+"] === */\n"+a);
    }
  });
  return e.join("\n\n").trim();
}

function eksKodBolumu(t){
  const e=t.eser;
  const r=eksBilesenleriAyristir(e.stilKodu);
  const a=EKS_BILESENLER.find(function(l){return l.id===EKS_AKTIF_BILESEN})||EKS_BILESENLER[0];
  const o=EKS_BILESEN_SABLONLARI[a.id]||[];
  const n=r[a.id]||"";
  return eksDuzenKutusu(e)+`
  <div class="kutu-y eks-kod">
    <div class="gk-ust">
      <label for="eksBilesenKod">🎨 Görünüm Kod Editörü (Bileşenli CSS)</label>
      <span class="oyun-not">`+kacir(a.ad)+`</span>
    </div>
    <p class="oyun-not">Evrenin sayfasını bileşen bazında biçimlendir. Seçtiğin bileşene özel stilleri yazabilir veya hazır şablon ekleyebilirsin.</p>
    
    <div class="eks-bilesen-nav" role="tablist">`+
      EKS_BILESENLER.map(function(l){
        const doluluk=(r[l.id]||"").trim()?' <span class="eks-nokta">●</span>':"";
        return'<button type="button" class="dugme dugme-sade eks-bilesen-sekme'+(l.id===a.id?" secili":"")+'" data-eks-bilesen="'+l.id+'">'+kacir(l.ad)+doluluk+"</button>";
      }).join("")+
    `</div>

    <div class="eks-bilesen-bilgi" style="margin: 8px 0; padding: 10px 12px; background: rgba(0,0,0,0.03); border-radius: 8px;">
      <b>`+kacir(a.ad)+`:</b> <span>`+kacir(a.ozet)+`</span>
      <div style="font-size: 12.5px; opacity: .8; margin-top: 4px;">Hedef sınıflar: <code>`+kacir(a.secici)+`</code></div>
    </div>`+
    (o.length?`
    <div class="eks-sablon-blok" style="margin: 6px 0 10px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
      <span class="oyun-not">Hazır Parçalar:</span>`+
      o.map(function(s,idx){
        return'<button type="button" class="dugme dugme-sade y-kucuk" data-eks-parca-ekle="'+idx+'">+ '+kacir(s.ad)+'</button>';
      }).join("")+
    `</div>`:"")+`

    <textarea class="kod-giris arac-giris evkod" id="eksBilesenKod" rows="11" spellcheck="false" autocapitalize="off" maxlength="20000" placeholder="`+kacir(a.secici)+` için CSS yaz...">`+kacir(n)+`</textarea>

    <!-- Gizli senkron ana stil textarea -->
    <textarea class="kod-giris arac-giris evkod" id="eksStil" style="display:none;" maxlength="20000">`+kacir(e.stilKodu||"")+`</textarea>

    <div class="oyun-sira" style="margin-top: 8px;">
      <button class="dugme" data-eks-kaydet="bilesenStil">Bu bileşeni kaydet & uygula</button>
      <button class="dugme dugme-sade" data-eks-kaydet="tumStil">Tüm stilleri derle & uygula</button>
      <button class="dugme dugme-sade y-sil" data-eks-sil="bilesenStil">Bileşeni temizle</button>
    </div>
  </div>

  <div class="kutu-y eks-kod">
    <div class="gk-ust">
      <label for="eksGorunum">✦ Görünüm Kodu (HTML & Vitrin)</label>
      <span class="oyun-not">Vitrin düzeni</span>
    </div>
    <p class="oyun-not">Evreninin <b>Vitrin</b> sayfasını kendi HTML'inle kur. Yer tutucular: <code>{{ad}}</code> <code>{{ozet}}</code> <code>{{kisiler}}</code> <code>{{yerler}}</code> <code>{{sozluk}}</code> <code>{{tarih}}</code> <code>{{kurallar}}</code> <code>{{harita}}</code> <code>{{roman}}</code> <code>{{yazi:metin}}</code>.</p>
    
    <div class="eks-moduler-bloklar" style="margin: 6px 0 10px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
      <span class="oyun-not">Hazır Bloklar:</span>`+
      EKS_MODULER_BLOKLAR.map(function(b,bIdx){
        return'<button type="button" class="dugme dugme-sade y-kucuk" data-eks-blok-ekle="'+bIdx+'">+ '+kacir(b.ad)+'</button>';
      }).join("")+
    `</div>

    <textarea class="kod-giris arac-giris evkod" id="eksGorunum" rows="13" spellcheck="false" autocapitalize="off" maxlength="30000">`+kacir(e.gorunumKodu||"")+`</textarea>
    
    <p class="oyun-not">Canlı önizleme (yazdıkça anında değişir):</p>
    <div class="eks-vitrin eks-onizle" id="eksOnizle">`+eksHtmlTemizle(e.gorunumKodu||"",e)+`</div>
    
    <div class="oyun-sira">
      <button class="dugme" data-eks-kaydet="gorunumKodu">Görünüm kodunu uygula</button>
      <button class="dugme dugme-sade" data-eks-ornek="gorunumKodu">Örnek vitrin</button>
      <button class="dugme dugme-sade" data-evs-sekme="vitrin">Vitrini gör</button>
      <button class="dugme dugme-sade y-sil" data-eks-sil="gorunumKodu">Görünüm kodunu sil</button>
    </div>
  </div>
  <p class="pencere-durum" id="eksDurum" role="status"></p>`;
}

function eksVitrinBolumu(t){
  const e=t.eser;
  return String(e.gorunumKodu||"").trim()?'<div class="eks-vitrin">'+eksHtmlTemizle(e.gorunumKodu,e)+"</div>":'<p class="oyun-not">Bu evrenin henüz bir vitrini yok.'+(EVS&&EVS.kaynak==="benim"?" “Kod ile stil” sekmesinden görünüm kodu yaz.":"")+"</p>";
}

const EKS_ORNEK={
  stilKodu:[
    "/* === [duzen] === */",
    ".evs-ust { border-bottom: 3px double currentColor; }",
    ".eks-vitrin .izgara { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }",
    "",
    "/* === [tipografi] === */",
    "h2 { letter-spacing: .08em; text-transform: uppercase; }",
    ".eks-vitrin .kapak h1 { margin: 0; font-size: 2.2em; }",
    "",
    "/* === [buton] === */",
    ".evs-sekme.secili { background: var(--deniz); color: #fff; border-radius: 999px; }",
    "",
    "/* === [arkaplan] === */",
    ".eks-vitrin .kapak { padding: 28px; border-radius: 12px; background: linear-gradient(135deg, var(--deniz), transparent); color: #fff; }",
    "",
    "/* === [kartlar] === */",
    ".eks-vitrin .kutu { padding: 12px; border: 1px solid currentColor; border-radius: 8px; }"
  ].join("\n"),
  gorunumKodu:[
    '<header class="kapak">',
    "  <h1>{{ad}}</h1>",
    "  <p>{{ozet}}</p>",
    "</header>",
    '<section class="izgara">',
    '  <div class="kutu"><h3>Kişiler</h3>{{kisiler}}</div>',
    '  <div class="kutu"><h3>Yerler</h3>{{yerler}}</div>',
    '  <div class="kutu"><h3>Sözlük</h3>{{sozluk}}</div>',
    "</section>"
  ].join("\n")
};

document.addEventListener("click",function(t){
  const e=t.target.closest&&t.target.closest("[data-eks-kaydet], [data-eks-ornek], [data-eks-sil], [data-eks-bilesen], [data-eks-parca-ekle], [data-eks-blok-ekle]");
  if(!e||!EVS||EVS.kaynak!=="benim"||typeof evrenBenimDegistir!="function")return;
  const r=e.dataset;
  const a=r.eksKaydet||r.eksOrnek||r.eksSil;
  const v=evrenSayfaVerisi();
  if(!v)return;

  // Bileşen sekme değiştirme:
  if(r.eksBilesen){
    // Mevcut aktif bileşenin kodunu hafızadaki haritaya al:
    const oncekiBilesenKod=document.querySelector("#eksBilesenKod");
    const harita=eksBilesenleriAyristir(v.eser.stilKodu);
    if(oncekiBilesenKod){
      harita[EKS_AKTIF_BILESEN]=oncekiBilesenKod.value;
      const birlesik=eksBilesenleriBirlestir(harita);
      evrenBenimDegistir(EVS.id,function(s){s.stilKodu=birlesik});
    }
    EKS_AKTIF_BILESEN=r.eksBilesen;
    evrenSayfaCiz();
    return;
  }

  // Hazır stil parçası ekleme:
  if(r.eksParcaEkle!==undefined){
    const idx=Number(r.eksParcaEkle);
    const sablonlar=EKS_BILESEN_SABLONLARI[EKS_AKTIF_BILESEN]||[];
    const secilen=sablonlar[idx];
    if(secilen){
      const alan=document.querySelector("#eksBilesenKod");
      if(alan){
        alan.value=(alan.value.trim()?(alan.value.trim()+"\n\n"):"")+secilen.kod;
        alan.dispatchEvent(new Event("input",{bubbles:!0}));
        alan.focus();
      }
    }
    return;
  }

  // Hazır HTML modüler blok ekleme:
  if(r.eksBlokEkle!==undefined){
    const idx=Number(r.eksBlokEkle);
    const blok=EKS_MODULER_BLOKLAR[idx];
    if(blok){
      const gAlan=document.querySelector("#eksGorunum");
      if(gAlan){
        gAlan.value=(gAlan.value.trim()?(gAlan.value.trim()+"\n\n"):"")+blok.kod;
        gAlan.dispatchEvent(new Event("input",{bubbles:!0}));
        gAlan.focus();
      }
    }
    return;
  }

  // Bileşen kaydet veya tümünü derle:
  if(r.eksKaydet==="bilesenStil"||r.eksKaydet==="tumStil"){
    const bAlan=document.querySelector("#eksBilesenKod");
    const harita=eksBilesenleriAyristir(v.eser.stilKodu);
    if(bAlan)harita[EKS_AKTIF_BILESEN]=bAlan.value;
    const birlesik=eksBilesenleriBirlestir(harita);
    const temiz=eksCssTemizle(birlesik);
    evrenBenimDegistir(EVS.id,function(s){
      temiz.trim()?s.stilKodu=temiz.slice(0,EKS_STIL_SINIR):delete s.stilKodu;
    });
    evrenSayfaCiz();
    const o=document.querySelector("#eksDurum");
    if(o){
      o.textContent="Bileşenler derlendi, uygulandı ve kaydedildi.";
      o.className="pencere-durum iyi";
    }
    return;
  }

  // Bileşeni temizle:
  if(r.eksSil==="bilesenStil"){
    const harita=eksBilesenleriAyristir(v.eser.stilKodu);
    delete harita[EKS_AKTIF_BILESEN];
    const birlesik=eksBilesenleriBirlestir(harita);
    evrenBenimDegistir(EVS.id,function(s){
      birlesik.trim()?s.stilKodu=birlesik.slice(0,EKS_STIL_SINIR):delete s.stilKodu;
    });
    evrenSayfaCiz();
    const o=document.querySelector("#eksDurum");
    if(o){
      o.textContent="Bileşen stili temizlendi.";
      o.className="pencere-durum iyi";
    }
    return;
  }

  if(["stilKodu","gorunumKodu"].indexOf(a)===-1)return;
  let l="";
  if(r.eksKaydet){
    const s=document.querySelector(a==="stilKodu"?"#eksStil":"#eksGorunum");
    l=s?s.value:"";
  }else if(r.eksOrnek){
    l=EKS_ORNEK[a];
  }
  const n=a==="stilKodu"?2e4:3e4;
  evrenBenimDegistir(EVS.id,function(s){
    String(l).trim()?s[a]=String(l).slice(0,n):delete s[a];
  });
  evrenSayfaCiz();
  const o=document.querySelector("#eksDurum");
  o&&(o.textContent=r.eksSil?"Silindi.":"Uygulandı ve kaydedildi.",o.className="pencere-durum iyi");
});

document.addEventListener("input",function(t){
  const e=t.target;
  if(!e)return;
  if(e.id==="eksBilesenKod"){
    const v=evrenSayfaVerisi();
    if(v){
      const harita=eksBilesenleriAyristir(v.eser.stilKodu);
      harita[EKS_AKTIF_BILESEN]=e.value;
      const birlesik=eksBilesenleriBirlestir(harita);
      const stilAlan=document.querySelector("#eksStil");
      if(stilAlan)stilAlan.value=birlesik;
      const sayfa=document.querySelector("#evrenSayfa");
      let st=sayfa&&sayfa.querySelector("#evsKodStil");
      if(sayfa&&!st){
        st=document.createElement("style");
        st.id="evsKodStil";
        sayfa.appendChild(st);
      }
      if(st)st.textContent=eksStilCss({stilKodu:birlesik});
    }
  }
});
