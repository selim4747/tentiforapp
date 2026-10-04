(function(){
  const FCM={kanal:"tentiforapp",anahtar:"tentiforapp_fcm_token",basladi:!1,kayitToken:"",kayitPromise:null};
  async function tokenKaydet(t){
    t=String(t||"").trim();
    if(!t||typeof hesapGerekli!=="function")return!1;
    if(FCM.kayitPromise&&FCM.kayitToken===t)return FCM.kayitPromise;
    FCM.kayitToken=t;
    FCM.kayitPromise=(async function(){
      try{
        await hesapGerekli();
        if(typeof hesapIstemci==="undefined"||!hesapIstemci||!hesapKullanici)return!1;
        const r=await hesapIstemci.rpc("bildirim_cihaz_kaydet",{p_token:t,p_platform:"android",p_surum:"6.3.8"});
        return!r.error&&r.data&&r.data.durum==="tamam";
      }catch{return!1}
      finally{FCM.kayitPromise=null}
    })();
    return FCM.kayitPromise;
  }
  async function baslat(){
    if(!kabukMu()||FCM.basladi)return!1;
    const p=kabukEklenti("PushNotifications");
    if(!p)return!1;
    FCM.basladi=!0;
    try{await p.createChannel({id:FCM.kanal,name:"TentiforApp bildirimleri",description:"TentiforApp kişisel ve hatırlatma bildirimleri",importance:5,sound:"default",visibility:1})}catch{}
    await p.addListener("registration",async function(e){
      const t=String(e&&e.value||"").trim();
      if(!t)return;
      try{localStorage.setItem(FCM.anahtar,t)}catch{}
      await tokenKaydet(t);
    });
    await p.addListener("registrationError",function(e){console.warn("FCM registration error",e)});
    await p.addListener("pushNotificationReceived",async function(e){
      const l=kabukEklenti("LocalNotifications");
      if(!l)return;
      try{await l.schedule({notifications:[{id:Date.now()%2147483647,title:String(e&&e.title||"TentiforApp"),body:String(e&&e.body||""),channelId:FCM.kanal,extra:e&&e.data||{}}]})}catch{}
    });
    await p.addListener("pushNotificationActionPerformed",function(e){
      const d=e&&e.notification&&e.notification.data||{};
      const a=typeof d.adres==="string"&&/^#\//.test(d.adres)?d.adres:"#/sen";
      setTimeout(function(){location.hash=a},300);
    });
    try{
      const q=await p.requestPermissions();
      if(!q||q.receive!=="granted")return!1;
      await p.register();
      try{const t=localStorage.getItem(FCM.anahtar);t&&await tokenKaydet(t)}catch{}
      return!0;
    }catch{return!1}
  }
  window.kabukFcmBaslat=baslat;
  document.addEventListener("DOMContentLoaded",function(){kabukMu()&&setTimeout(function(){baslat()},700)});
  window.addEventListener("tf-hesap-hazir",function(){
    try{const t=localStorage.getItem(FCM.anahtar);t&&tokenKaydet(t)}catch{}
  });
})();
